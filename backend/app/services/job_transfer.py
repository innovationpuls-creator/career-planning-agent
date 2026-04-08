from __future__ import annotations

import asyncio
import json
import math
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.career_group_embedding import CareerGroupEmbedding
from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.job_requirement_profile import JobRequirementProfile
from app.schemas.job_transfer import (
    JobTransferComparisonItem,
    JobTransferComparisonRow,
    JobTransferGroupWeightItem,
    JobTransferOptionItem,
    JobTransferOptionsPayload,
    JobTransferPayload,
    JobTransferSourceSnapshot,
    JobTransferTargetGroupSimilarity,
    JobTransferTargetItem,
)
from app.services.career_transfer_profiles import get_group_weights_for_career
from app.services.job_requirement_profile import DIMENSION_FIELDS
from app.services.job_requirement_profile_read import build_dimension_payload, parse_effective_dimension_value
from app.services.job_transfer_groups import (
    DIMENSION_LABELS,
    DIMENSION_TO_GROUP_KEY,
    GROUP_LABELS,
    GROUP_VECTOR_VERSION,
    TRANSFER_GROUPS_BY_KEY,
    build_group_embedding_documents,
)
from app.services.vector_store import QdrantGroupedVectorStore, VectorSearchResult


ProgressReporter = Callable[[dict[str, object]], Awaitable[None]]
CancelChecker = Callable[[], Awaitable[bool]]


@dataclass(slots=True)
class CandidateAnalysis:
    profile: JobRequirementProfile
    weighted_similarity_score: float
    group_scores: dict[str, float]
    professional_threshold_dimension_count: int
    professional_threshold_keyword_count: int


class JobTransferTaskCancelledError(RuntimeError):
    pass


class JobTransferService:
    def __init__(
        self,
        db: Session,
        job_vector_store: QdrantGroupedVectorStore | None = None,
        career_vector_store: QdrantGroupedVectorStore | None = None,
    ) -> None:
        self.db = db
        self.job_vector_store = job_vector_store
        self.career_vector_store = career_vector_store

    def list_options(self) -> JobTransferOptionsPayload:
        careers = self.db.scalars(
            select(CareerRequirementProfile)
            .join(CareerGroupEmbedding, CareerGroupEmbedding.career_id == CareerRequirementProfile.id)
            .distinct()
            .order_by(CareerRequirementProfile.canonical_job_title.asc())
        ).all()
        return JobTransferOptionsPayload(
            items=[
                JobTransferOptionItem(
                    career_id=career.id,
                    job_title=career.canonical_job_title,
                    label=career.canonical_job_title,
                )
                for career in careers
            ]
        )

    def get_source_snapshot(self, career_id: int) -> JobTransferSourceSnapshot | None:
        source = self.db.get(CareerRequirementProfile, career_id)
        if source is None:
            return None

        active_group_keys = set(build_group_embedding_documents(source))
        group_weights = get_group_weights_for_career(source, active_group_keys=active_group_keys)
        return self._build_source_snapshot(source, group_weights=group_weights)

    async def get_transfer_payload_async(
        self,
        career_id: int,
        *,
        progress: ProgressReporter | None = None,
        cancel_checker: CancelChecker | None = None,
    ) -> JobTransferPayload | None:
        if self.job_vector_store is None or self.career_vector_store is None:
            raise RuntimeError("Both grouped vector stores are required for transfer queries.")

        source = self.db.get(CareerRequirementProfile, career_id)
        if source is None:
            return None

        source_embeddings = self.career_vector_store.get_embeddings_by_entity(entity_id=career_id)
        active_group_keys = set(source_embeddings)
        if not active_group_keys:
            raise RuntimeError("Current career profile has no grouped embeddings available.")

        group_weights = get_group_weights_for_career(source, active_group_keys=active_group_keys)

        await self._emit(
            progress,
            {
                "stage": "retrieval_started",
                "career_id": career_id,
                "processed_candidates": 0,
                "total_candidates": len(active_group_keys),
            },
        )
        await self._ensure_not_cancelled(cancel_checker)

        candidate_scores: dict[int, dict[str, float]] = {}
        ordered_group_keys = [group.key for group in TRANSFER_GROUPS_BY_KEY.values() if group.key in active_group_keys]
        for index, group_key in enumerate(ordered_group_keys, start=1):
            results = self.job_vector_store.query_similar_by_group(
                source_embeddings[group_key],
                group_key=group_key,
                n_results=5,
            )
            for item in results:
                candidate_scores.setdefault(item.entity_id, {})[group_key] = round(float(item.score), 4)
            await self._emit(
                progress,
                {
                    "stage": "group_retrieved",
                    "career_id": career_id,
                    "group_key": group_key,
                    "group_label": GROUP_LABELS[group_key],
                    "group_candidate_count": len(results),
                    "merged_candidate_count": len(candidate_scores),
                    "processed_candidates": index,
                    "total_candidates": len(ordered_group_keys),
                },
            )
            await self._ensure_not_cancelled(cancel_checker)

        candidate_rows = self.db.scalars(
            select(JobRequirementProfile).where(JobRequirementProfile.id.in_(list(candidate_scores)))
        ).all()
        profiles_by_id = {profile.id: profile for profile in candidate_rows}

        merged_candidates: list[CandidateAnalysis] = []
        filtered_candidate_ids = [
            profile_id
            for profile_id in candidate_scores
            if profile_id in profiles_by_id
            and (profiles_by_id[profile_id].canonical_job_title or profiles_by_id[profile_id].job_title)
            != source.canonical_job_title
        ]
        total_filtered = len(filtered_candidate_ids)

        for index, profile_id in enumerate(filtered_candidate_ids, start=1):
            profile = profiles_by_id[profile_id]
            group_scores = {
                group_key: round(
                    self._resolve_group_score(
                        source_embeddings=source_embeddings,
                        candidate_scores=candidate_scores,
                        profile_id=profile_id,
                        group_key=group_key,
                    ),
                    4,
                )
                for group_key in ordered_group_keys
            }
            weighted_similarity_score = round(
                sum(group_weights.get(group_key, 0.0) * group_scores.get(group_key, 0.0) for group_key in ordered_group_keys),
                4,
            )
            professional_threshold_dimension_count = self._count_professional_threshold_dimensions(profile)
            professional_threshold_keyword_count = self._count_professional_threshold_keywords(profile)
            analysis = CandidateAnalysis(
                profile=profile,
                weighted_similarity_score=weighted_similarity_score,
                group_scores=group_scores,
                professional_threshold_dimension_count=professional_threshold_dimension_count,
                professional_threshold_keyword_count=professional_threshold_keyword_count,
            )
            merged_candidates.append(analysis)

            await self._emit(
                progress,
                {
                    "stage": "candidate_ranked",
                    "career_id": career_id,
                    "profile_id": profile.id,
                    "job_title": profile.job_title,
                    "company_name": profile.company_name,
                    "weighted_similarity_score": weighted_similarity_score,
                    "processed_candidates": index,
                    "total_candidates": total_filtered,
                },
            )
            await self._ensure_not_cancelled(cancel_checker)

        shortlisted = sorted(
            merged_candidates,
            key=lambda item: (
                -item.weighted_similarity_score,
                -item.professional_threshold_dimension_count,
                -item.professional_threshold_keyword_count,
                item.profile.id,
            ),
        )[:5]
        selected = sorted(
            sorted(
                shortlisted,
                key=lambda item: (
                    -item.professional_threshold_dimension_count,
                    -item.professional_threshold_keyword_count,
                    -item.weighted_similarity_score,
                    item.profile.id,
                ),
            )[:3],
            key=lambda item: (
                -item.weighted_similarity_score,
                -item.professional_threshold_dimension_count,
                -item.professional_threshold_keyword_count,
                item.profile.id,
            ),
        )

        payload = self._build_payload(
            source,
            selected,
            group_weights=group_weights,
            merged_candidate_count=len(merged_candidates),
            shortlisted_candidate_count=len(shortlisted),
        )
        await self._emit(
            progress,
            {
                "stage": "completed",
                "career_id": career_id,
                "processed_candidates": total_filtered,
                "total_candidates": total_filtered,
                "payload": payload.model_dump(),
            },
        )
        return payload

    def get_transfer_payload(self, career_id: int) -> JobTransferPayload | None:
        return asyncio.run(self.get_transfer_payload_async(career_id))

    def _build_payload(
        self,
        source: CareerRequirementProfile,
        analyses: list[CandidateAnalysis],
        *,
        group_weights: dict[str, float],
        merged_candidate_count: int,
        shortlisted_candidate_count: int,
    ) -> JobTransferPayload:
        source_dimension_payload = build_dimension_payload(source)
        source_group_weights = [
            JobTransferGroupWeightItem(
                group_key=group.key,
                label=group.label,
                coverage_ratio=float(getattr(source, group.coverage_field)),
                weight=group_weights.get(group.key, 0.0),
            )
            for group in TRANSFER_GROUPS_BY_KEY.values()
            if group.key in group_weights
        ]
        source_titles = self._load_json_list(source.source_job_titles_json)

        return JobTransferPayload(
            source=self._build_source_snapshot(source, group_weights=group_weights),
            targets=[self._build_target_item(item) for item in analyses],
            comparisons=[self._build_comparison_item(source_dimension_payload, item) for item in analyses],
            meta={
                "vector_version": GROUP_VECTOR_VERSION,
                "merged_candidate_count": merged_candidate_count,
                "shortlisted_candidate_count": shortlisted_candidate_count,
                "selected_target_count": len(analyses),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def _build_source_snapshot(
        self,
        source: CareerRequirementProfile,
        *,
        group_weights: dict[str, float],
    ) -> JobTransferSourceSnapshot:
        source_dimension_payload = build_dimension_payload(source)
        source_group_weights = [
            JobTransferGroupWeightItem(
                group_key=group.key,
                label=group.label,
                coverage_ratio=float(getattr(source, group.coverage_field)),
                weight=group_weights.get(group.key, 0.0),
            )
            for group in TRANSFER_GROUPS_BY_KEY.values()
            if group.key in group_weights
        ]
        source_titles = self._load_json_list(source.source_job_titles_json)
        return JobTransferSourceSnapshot(
            career_id=source.id,
            job_title=source.canonical_job_title,
            source_job_titles=source_titles,
            sample_count=source.sample_count,
            group_weights=source_group_weights,
            **source_dimension_payload,
        )

    def _build_target_item(self, analysis: CandidateAnalysis) -> JobTransferTargetItem:
        return JobTransferTargetItem(
            profile_id=analysis.profile.id,
            industry=analysis.profile.industry,
            job_title=analysis.profile.job_title,
            company_name=analysis.profile.company_name,
            weighted_similarity_score=analysis.weighted_similarity_score,
            professional_threshold_dimension_count=analysis.professional_threshold_dimension_count,
            professional_threshold_keyword_count=analysis.professional_threshold_keyword_count,
            group_similarities=self._build_group_similarities(analysis.group_scores),
        )

    def _build_comparison_item(
        self,
        source_dimension_payload: dict[str, list[str]],
        analysis: CandidateAnalysis,
    ) -> JobTransferComparisonItem:
        target_dimension_payload = build_dimension_payload(analysis.profile)
        return JobTransferComparisonItem(
            target_profile_id=analysis.profile.id,
            weighted_similarity_score=analysis.weighted_similarity_score,
            group_similarities=self._build_group_similarities(analysis.group_scores),
            rows=[
                JobTransferComparisonRow(
                    key=dimension,
                    label=DIMENSION_LABELS[dimension],
                    group_key=DIMENSION_TO_GROUP_KEY[dimension],
                    source_values=source_dimension_payload[dimension],
                    target_values=target_dimension_payload[dimension],
                )
                for dimension in DIMENSION_FIELDS
            ],
        )

    def _build_group_similarities(self, group_scores: dict[str, float]) -> list[JobTransferTargetGroupSimilarity]:
        return [
            JobTransferTargetGroupSimilarity(
                group_key=group_key,
                label=GROUP_LABELS[group_key],
                similarity_score=round(group_scores.get(group_key, 0.0), 4),
            )
            for group_key in group_scores
        ]

    def _count_professional_threshold_dimensions(self, profile: JobRequirementProfile) -> int:
        group = TRANSFER_GROUPS_BY_KEY["professional-and-threshold"]
        return sum(1 for dimension in group.dimensions if parse_effective_dimension_value(getattr(profile, dimension)))

    def _count_professional_threshold_keywords(self, profile: JobRequirementProfile) -> int:
        group = TRANSFER_GROUPS_BY_KEY["professional-and-threshold"]
        return sum(len(parse_effective_dimension_value(getattr(profile, dimension))) for dimension in group.dimensions)

    def _resolve_group_score(
        self,
        *,
        source_embeddings: dict[str, list[float]],
        candidate_scores: dict[int, dict[str, float]],
        profile_id: int,
        group_key: str,
    ) -> float:
        retrieved_score = candidate_scores.get(profile_id, {}).get(group_key)
        if retrieved_score is not None:
            return float(retrieved_score)

        source_embedding = source_embeddings.get(group_key)
        if not source_embedding:
            return 0.0

        target_embedding = self.job_vector_store.get_embedding(entity_id=profile_id, group_key=group_key)
        if not target_embedding:
            return 0.0

        return self._cosine_similarity(source_embedding, target_embedding)

    @staticmethod
    def _cosine_similarity(left: list[float], right: list[float]) -> float:
        if len(left) != len(right) or not left:
            return 0.0

        dot_product = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(a * a for a in left))
        right_norm = math.sqrt(sum(b * b for b in right))
        if left_norm <= 0 or right_norm <= 0:
            return 0.0
        return max(dot_product / (left_norm * right_norm), 0.0)

    @staticmethod
    def _load_json_list(raw: str) -> list[str]:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return []
        if not isinstance(payload, list):
            return []
        return [str(item).strip() for item in payload if str(item).strip()]

    async def _emit(self, progress: ProgressReporter | None, event: dict[str, object]) -> None:
        if progress is None:
            return
        await progress(event)

    async def _ensure_not_cancelled(self, cancel_checker: CancelChecker | None) -> None:
        if cancel_checker is not None and await cancel_checker():
            raise JobTransferTaskCancelledError("Job transfer analysis cancelled.")
