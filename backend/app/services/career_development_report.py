from __future__ import annotations

import json
import math
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.job_requirement_profile import JobRequirementProfile
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    CareerDevelopmentMatchCustomPayload,
    CareerDevelopmentMatchEvidenceCard,
    CareerDevelopmentMatchGroupSummary,
    CareerDevelopmentMatchIndustryReport,
    CareerDevelopmentMatchInitPayload,
    CareerDevelopmentMatchReport,
    CareerDevelopmentMatchSourcePayload,
)
from app.schemas.job_transfer import JobTransferTargetGroupSimilarity
from app.schemas.student_competency_profile import (
    JOB_PROFILE_FIELD_ORDER,
    LEGACY_EMPTY_PROFILE_VALUES,
    JobProfile12Dimensions,
    StudentCompetencyActionAdviceItem,
    StudentCompetencyChartSeriesItem,
    StudentCompetencyComparisonDimensionItem,
    StudentCompetencyNarrativePayload,
)
from app.services.embeddings import OpenAICompatibleEmbeddingClient
from app.services.job_requirement_profile_read import (
    parse_effective_dimension_value,
)
from app.services.job_requirement_vertical import get_vertical_job_profile
from app.services.job_transfer import JobTransferService
from app.services.job_transfer_groups import (
    DIMENSION_LABELS,
    GROUP_LABELS,
    TRANSFER_GROUPS,
)
from app.services.student_competency_latest_analysis import (
    get_student_competency_latest_profile_record,
)
from app.services.student_competency_profile import normalize_profile_payload
from app.services.vector_store import QdrantGroupedVectorStore


STATUS_LABEL_HIGH = "高契合"
STATUS_LABEL_BASELINE = "基础契合"
STATUS_LABEL_GAP = "待补强"
STATUS_LABEL_MISSING = "明显差距"

GENERIC_EVIDENCE_SOURCES: dict[str, list[str]] = {
    "professional_skills": ["课程项目", "实习任务", "作品集"],
    "professional_background": ["专业背景", "主修课程", "研究方向"],
    "education_requirement": ["学历信息", "学位信息", "毕业时间"],
    "teamwork": ["团队项目", "社团协作", "跨组任务"],
    "stress_adaptability": ["高峰任务", "多任务场景", "活动执行"],
    "communication": ["汇报场景", "项目对接", "跨部门协作"],
    "work_experience": ["实习经历", "项目经历", "科研任务"],
    "documentation_awareness": ["需求文档", "测试文档", "项目报告"],
    "responsibility": ["长期任务", "值班安排", "独立负责事项"],
    "learning_ability": ["自学记录", "新工具上手", "课程拓展"],
    "problem_solving": ["故障排查", "流程优化", "复盘总结"],
    "other_special": ["证书材料", "语言证明", "工作安排说明"],
}


@dataclass(slots=True)
class TargetDimensionSnapshot:
    values_by_dimension: dict[str, list[str]]
    requirement_by_dimension: dict[str, float]


@dataclass(slots=True)
class ScoredProfile:
    profile: JobRequirementProfile
    weighted_score: float
    group_scores: dict[str, float]
    professional_threshold_dimension_count: int
    professional_threshold_keyword_count: int


def _effective_student_values(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        text = str(raw or "").strip()
        if not text or text in LEGACY_EMPTY_PROFILE_VALUES or text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized


def _normalize_token(value: str) -> str:
    return "".join(value.lower().split())


def _keyword_matches(source_value: str, target_value: str) -> bool:
    left = _normalize_token(source_value)
    right = _normalize_token(target_value)
    if not left or not right:
        return False
    return left == right or left in right or right in left


def _match_keywords(source_values: list[str], target_values: list[str]) -> tuple[list[str], list[str]]:
    matched: list[str] = []
    for keyword in target_values:
        if any(_keyword_matches(value, keyword) for value in source_values):
            matched.append(keyword)
    matched_set = set(matched)
    missing = [keyword for keyword in target_values if keyword not in matched_set]
    return matched, missing


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _round_metric(value: float) -> float:
    return round(_clamp(value, 0.0, 100.0), 2)


def _status_label(match_score: float) -> str:
    if match_score >= 80:
        return STATUS_LABEL_HIGH
    if match_score >= 55:
        return STATUS_LABEL_BASELINE
    if match_score >= 25:
        return STATUS_LABEL_GAP
    return STATUS_LABEL_MISSING


def _requirement_from_keyword_count(value_count: int) -> float:
    if value_count <= 0:
        return 0.0
    if value_count == 1:
        return 55.0
    if value_count == 2:
        return 78.0
    return 100.0


def _group_similarity_items(group_scores: dict[str, float]) -> list[JobTransferTargetGroupSimilarity]:
    return [
        JobTransferTargetGroupSimilarity(
            group_key=group.key,
            label=group.label,
            similarity_score=round(group_scores.get(group.key, 0.0), 4),
        )
        for group in TRANSFER_GROUPS
        if group.key in group_scores
    ]


def _build_group_weights(profile: JobProfile12Dimensions) -> dict[str, float]:
    raw_weights: dict[str, float] = {}
    for group in TRANSFER_GROUPS:
        keyword_count = 0
        for dimension in group.dimensions:
            keyword_count += len(_effective_student_values(getattr(profile, dimension)))
        if keyword_count > 0:
            raw_weights[group.key] = float(keyword_count)
    total = sum(raw_weights.values())
    if total <= 0:
        return {}
    return {key: round(value / total, 6) for key, value in raw_weights.items()}


def _build_source_documents(profile: JobProfile12Dimensions) -> dict[str, str]:
    documents: dict[str, str] = {}
    for group in TRANSFER_GROUPS:
        parts: list[str] = []
        for dimension in group.dimensions:
            values = _effective_student_values(getattr(profile, dimension))
            if not values:
                continue
            parts.append(f"{DIMENSION_LABELS[dimension]}: {' '.join(values)}")
        text = "\n".join(parts).strip()
        if text:
            documents[group.key] = text
    return documents


def _build_source_summary(record: StudentCompetencyUserLatestProfile) -> CareerDevelopmentMatchSourcePayload:
    profile = normalize_profile_payload(json.loads(record.latest_profile_json))
    active_dimension_count = sum(
        1 for key in JOB_PROFILE_FIELD_ORDER if _effective_student_values(getattr(profile, key))
    )
    return CareerDevelopmentMatchSourcePayload(
        workspace_conversation_id=record.latest_workspace_conversation_id,
        updated_at=record.updated_at,
        active_dimension_count=active_dimension_count,
        profile=profile,
    )


class CareerDevelopmentMatchService:
    def __init__(
        self,
        db: Session,
        *,
        job_vector_store: QdrantGroupedVectorStore,
        career_vector_store: QdrantGroupedVectorStore,
    ) -> None:
        self.db = db
        self.job_vector_store = job_vector_store
        self.career_vector_store = career_vector_store

    async def build_init_payload(self, *, user_id: int) -> CareerDevelopmentMatchInitPayload:
        latest_record = get_student_competency_latest_profile_record(self.db, user_id=user_id)
        if latest_record is None:
            return CareerDevelopmentMatchInitPayload(
                available=False,
                message="暂无最近一次已保存的学生画像，请先生成学生就业能力画像。",
            )

        source = _build_source_summary(latest_record)
        source_embeddings = await self._build_source_embeddings(source.profile)
        group_weights = _build_group_weights(source.profile)
        if not source_embeddings or not group_weights:
            return CareerDevelopmentMatchInitPayload(
                available=False,
                message="当前学生画像缺少足够的有效关键词，暂时无法生成职业探索与岗位匹配报告。",
                source=source,
            )

        career_rows = self.db.scalars(
            select(CareerRequirementProfile).order_by(CareerRequirementProfile.canonical_job_title.asc())
        ).all()
        ranked_careers = [
            (career, self._score_entity(career.id, source_embeddings, group_weights, self.career_vector_store))
            for career in career_rows
        ]
        ranked_careers = [
            (career, score, group_scores)
            for career, (score, group_scores) in ranked_careers
            if score > 0
        ]
        ranked_careers.sort(key=lambda item: (-item[1], item[0].canonical_job_title))
        top_careers = ranked_careers[:2]

        recommendations = [
            self._build_career_report(
                source_profile=source.profile,
                source_embeddings=source_embeddings,
                group_weights=group_weights,
                career=career,
                overall_score=score,
                group_scores=group_scores,
            )
            for career, score, group_scores in top_careers
        ]
        return CareerDevelopmentMatchInitPayload(
            available=bool(recommendations),
            message=None if recommendations else "暂时没有找到可展示的匹配职业。",
            source=source,
            recommendations=recommendations,
            default_report_id=recommendations[0].report_id if recommendations else None,
        )

    async def build_custom_payload(
        self,
        *,
        user_id: int,
        job_title: str,
        industries: list[str],
    ) -> CareerDevelopmentMatchCustomPayload:
        latest_record = get_student_competency_latest_profile_record(self.db, user_id=user_id)
        if latest_record is None:
            raise ValueError("暂无最近一次已保存的学生画像，请先生成学生就业能力画像。")

        source = _build_source_summary(latest_record)
        source_embeddings = await self._build_source_embeddings(source.profile)
        group_weights = _build_group_weights(source.profile)
        if not source_embeddings or not group_weights:
            raise ValueError("当前学生画像缺少足够的有效关键词，暂时无法生成匹配报告。")

        graph_payload = get_vertical_job_profile(self.db, job_title=job_title, industries=industries)
        reports: list[CareerDevelopmentMatchIndustryReport] = []
        for industry in graph_payload.selected_industries:
            industry_rows = self.db.scalars(
                select(JobRequirementProfile).where(
                    JobRequirementProfile.job_title == job_title,
                    JobRequirementProfile.industry == industry,
                )
            ).all()
            if not industry_rows:
                continue
            target_snapshot = self._build_industry_snapshot(industry_rows)
            scored_profiles = self._score_job_profiles(industry_rows, source_embeddings, group_weights)[:3]
            report = self._build_match_report(
                report_id=f"industry:{job_title}:{industry}",
                target_scope="industry",
                target_title=f"{industry} / {job_title}",
                canonical_job_title=job_title,
                representative_job_title=job_title,
                industry=industry,
                source_profile=source.profile,
                target_snapshot=target_snapshot,
                evidence_cards=self._build_evidence_cards(scored_profiles),
                overall_score=None,
                base_group_scores=None,
                industry_supplement=get_vertical_job_profile(self.db, job_title=job_title, industries=[industry]),
            )
            reports.append(CareerDevelopmentMatchIndustryReport(industry=industry, report=report))

        return CareerDevelopmentMatchCustomPayload(
            source=source,
            job_title=graph_payload.job_title,
            selected_industries=graph_payload.selected_industries,
            available_industries=graph_payload.available_industries,
            graph_payload=graph_payload,
            reports=reports,
        )

    async def build_report_for_favorite(
        self,
        *,
        user_id: int,
        favorite: CareerDevelopmentFavoritePayload,
    ) -> CareerDevelopmentMatchReport:
        latest_record = get_student_competency_latest_profile_record(self.db, user_id=user_id)
        if latest_record is None:
            raise ValueError("暂无最近一次已保存的学生画像，请先生成学生就业能力画像。")

        source = _build_source_summary(latest_record)
        source_embeddings = await self._build_source_embeddings(source.profile)
        group_weights = _build_group_weights(source.profile)
        if not source_embeddings or not group_weights:
            raise ValueError("当前学生画像缺少足够的有效关键词，暂时无法重算目标岗位匹配报告。")

        if favorite.target_scope == "career":
            career = self.db.scalar(
                select(CareerRequirementProfile).where(
                    CareerRequirementProfile.canonical_job_title == favorite.canonical_job_title
                )
            )
            if career is None:
                raise ValueError("目标职业画像不存在，暂时无法重算当前目标。")
            overall_score, group_scores = self._score_entity(
                career.id,
                source_embeddings,
                group_weights,
                self.career_vector_store,
            )
            return self._build_career_report(
                source_profile=source.profile,
                source_embeddings=source_embeddings,
                group_weights=group_weights,
                career=career,
                overall_score=overall_score,
                group_scores=group_scores,
            )

        job_title = favorite.representative_job_title or favorite.canonical_job_title
        profiles = self.db.scalars(
            select(JobRequirementProfile).where(
                JobRequirementProfile.industry == favorite.industry,
                or_(
                    JobRequirementProfile.job_title == job_title,
                    JobRequirementProfile.canonical_job_title == favorite.canonical_job_title,
                ),
            )
        ).all()
        if not profiles:
            raise ValueError("目标行业画像不存在，暂时无法重算当前目标。")

        target_snapshot = self._build_industry_snapshot(profiles)
        scored_profiles = self._score_job_profiles(profiles, source_embeddings, group_weights)[:3]
        return self._build_match_report(
            report_id=favorite.report_id,
            target_scope=favorite.target_scope,
            target_title=favorite.target_title,
            canonical_job_title=favorite.canonical_job_title,
            representative_job_title=job_title,
            industry=favorite.industry,
            source_profile=source.profile,
            target_snapshot=target_snapshot,
            evidence_cards=self._build_evidence_cards(scored_profiles),
            overall_score=None,
            base_group_scores=None,
            industry_supplement=get_vertical_job_profile(
                self.db,
                job_title=job_title,
                industries=[favorite.industry] if favorite.industry else [],
            ),
        )

    async def _build_source_embeddings(self, profile: JobProfile12Dimensions) -> dict[str, list[float]]:
        documents = _build_source_documents(profile)
        if not documents:
            return {}
        client = OpenAICompatibleEmbeddingClient.from_settings()
        try:
            ordered_group_keys = list(documents.keys())
            vectors = await client.embed_texts([documents[key] for key in ordered_group_keys])
        finally:
            await client.aclose()
        return {
            group_key: [float(value) for value in vector]
            for group_key, vector in zip(ordered_group_keys, vectors)
            if vector
        }

    def _score_entity(
        self,
        entity_id: int,
        source_embeddings: dict[str, list[float]],
        group_weights: dict[str, float],
        store: QdrantGroupedVectorStore,
    ) -> tuple[float, dict[str, float]]:
        group_scores: dict[str, float] = {}
        for group_key, weight in group_weights.items():
            if weight <= 0:
                continue
            source_embedding = source_embeddings.get(group_key)
            if not source_embedding:
                continue
            target_embedding = store.get_embedding(entity_id=entity_id, group_key=group_key)
            if not target_embedding:
                continue
            group_scores[group_key] = self._cosine_similarity(source_embedding, target_embedding)
        score = round(sum(group_weights.get(key, 0.0) * group_scores.get(key, 0.0) for key in group_weights) * 100, 2)
        return score, group_scores

    def _score_job_profiles(
        self,
        profiles: list[JobRequirementProfile],
        source_embeddings: dict[str, list[float]],
        group_weights: dict[str, float],
    ) -> list[ScoredProfile]:
        scored: list[ScoredProfile] = []
        transfer_service = JobTransferService(self.db)
        for profile in profiles:
            weighted_score, group_scores = self._score_entity(
                profile.id,
                source_embeddings,
                group_weights,
                self.job_vector_store,
            )
            if weighted_score <= 0:
                continue
            scored.append(
                ScoredProfile(
                    profile=profile,
                    weighted_score=weighted_score,
                    group_scores=group_scores,
                    professional_threshold_dimension_count=transfer_service._count_professional_threshold_dimensions(profile),
                    professional_threshold_keyword_count=transfer_service._count_professional_threshold_keywords(profile),
                )
            )
        scored.sort(
            key=lambda item: (
                -item.weighted_score,
                -item.professional_threshold_dimension_count,
                -item.professional_threshold_keyword_count,
                item.profile.id,
            )
        )
        return scored

    def _build_career_report(
        self,
        *,
        source_profile: JobProfile12Dimensions,
        source_embeddings: dict[str, list[float]],
        group_weights: dict[str, float],
        career: CareerRequirementProfile,
        overall_score: float,
        group_scores: dict[str, float],
    ) -> CareerDevelopmentMatchReport:
        target_snapshot = self._build_career_snapshot(career)
        evidence_rows = self.db.scalars(
            select(JobRequirementProfile).where(
                JobRequirementProfile.canonical_job_title == career.canonical_job_title
            )
        ).all()
        evidence_profiles = self._score_job_profiles(evidence_rows, source_embeddings, group_weights)[:3]
        industry_supplement = self._build_career_supplement(evidence_profiles)
        representative_job_title = evidence_profiles[0].profile.job_title if evidence_profiles else None
        return self._build_match_report(
            report_id=f"career:{career.id}",
            target_scope="career",
            target_title=career.canonical_job_title,
            canonical_job_title=career.canonical_job_title,
            representative_job_title=representative_job_title,
            industry=None,
            source_profile=source_profile,
            target_snapshot=target_snapshot,
            evidence_cards=self._build_evidence_cards(evidence_profiles),
            overall_score=overall_score,
            base_group_scores=group_scores,
            industry_supplement=industry_supplement,
        )

    def _build_career_snapshot(self, career: CareerRequirementProfile) -> TargetDimensionSnapshot:
        values_by_dimension = {
            key: parse_effective_dimension_value(getattr(career, key))
            for key in JOB_PROFILE_FIELD_ORDER
        }
        requirement_by_dimension = {
            key: _requirement_from_keyword_count(len(values))
            for key, values in values_by_dimension.items()
        }
        return TargetDimensionSnapshot(
            values_by_dimension=values_by_dimension,
            requirement_by_dimension=requirement_by_dimension,
        )

    def _build_industry_snapshot(self, profiles: list[JobRequirementProfile]) -> TargetDimensionSnapshot:
        total_profiles = len(profiles)
        values_by_dimension: dict[str, list[str]] = {}
        requirement_by_dimension: dict[str, float] = {}
        for key in JOB_PROFILE_FIELD_ORDER:
            frequency = Counter()
            active_count = 0
            for profile in profiles:
                values = parse_effective_dimension_value(getattr(profile, key))
                if values:
                    active_count += 1
                for value in values:
                    frequency[value] += 1
            ordered_values = [
                item
                for item, _count in sorted(frequency.items(), key=lambda row: (-row[1], row[0]))
            ][:6]
            values_by_dimension[key] = ordered_values
            coverage_ratio = active_count / total_profiles if total_profiles else 0.0
            richness_ratio = min(len(ordered_values) / 3, 1.0)
            requirement_by_dimension[key] = round(_clamp((coverage_ratio * 0.7 + richness_ratio * 0.3) * 100, 0, 100), 2)
        return TargetDimensionSnapshot(
            values_by_dimension=values_by_dimension,
            requirement_by_dimension=requirement_by_dimension,
        )

    def _build_evidence_cards(self, scored_profiles: list[ScoredProfile]) -> list[CareerDevelopmentMatchEvidenceCard]:
        cards: list[CareerDevelopmentMatchEvidenceCard] = []
        for item in scored_profiles[:3]:
            cards.append(
                CareerDevelopmentMatchEvidenceCard(
                    profile_id=item.profile.id,
                    career_title=item.profile.canonical_job_title or item.profile.job_title,
                    job_title=item.profile.job_title,
                    company_name=item.profile.company_name,
                    industry=item.profile.industry,
                    match_score=_round_metric(item.weighted_score),
                    professional_threshold_dimension_count=item.professional_threshold_dimension_count,
                    professional_threshold_keyword_count=item.professional_threshold_keyword_count,
                    group_similarities=_group_similarity_items(item.group_scores),
                )
            )
        return cards

    def _build_career_supplement(self, evidence_profiles: list[ScoredProfile]):
        if not evidence_profiles:
            return None
        representative_job_title = evidence_profiles[0].profile.job_title
        industries: list[str] = []
        seen: set[str] = set()
        for item in evidence_profiles:
            if item.profile.job_title != representative_job_title:
                continue
            if item.profile.industry in seen:
                continue
            seen.add(item.profile.industry)
            industries.append(item.profile.industry)
        if not industries:
            industries = [evidence_profiles[0].profile.industry]
        return get_vertical_job_profile(
            self.db,
            job_title=representative_job_title,
            industries=industries[:3],
        )

    def _build_match_report(
        self,
        *,
        report_id: str,
        target_scope: str,
        target_title: str,
        canonical_job_title: str,
        representative_job_title: str | None,
        industry: str | None,
        source_profile: JobProfile12Dimensions,
        target_snapshot: TargetDimensionSnapshot,
        evidence_cards: list[CareerDevelopmentMatchEvidenceCard],
        overall_score: float | None,
        base_group_scores: dict[str, float] | None,
        industry_supplement,
    ) -> CareerDevelopmentMatchReport:
        comparison_dimensions: list[StudentCompetencyComparisonDimensionItem] = []
        chart_series: list[StudentCompetencyChartSeriesItem] = []
        weighted_total = 0.0
        total_requirement = 0.0

        for key in JOB_PROFILE_FIELD_ORDER:
            source_values = _effective_student_values(getattr(source_profile, key))
            target_values = target_snapshot.values_by_dimension.get(key, [])
            target_requirement = target_snapshot.requirement_by_dimension.get(key, 0.0)
            if not target_values or target_requirement <= 0:
                matched_keywords: list[str] = []
                missing_keywords: list[str] = []
                match_score = 0.0
                gap = 0.0
            else:
                matched_keywords, missing_keywords = _match_keywords(source_values, target_values)
                match_ratio = len(matched_keywords) / max(len(target_values), 1)
                source_signal = min(len(source_values) / max(len(target_values), 1), 1.0)
                match_score = (0.25 * (1.0 if source_values else 0.0) + 0.15 * source_signal + 0.6 * match_ratio) * 100
                gap = max(target_requirement - match_score, 0.0)

            weighted_total += target_requirement * match_score
            total_requirement += target_requirement
            chart_series.append(
                StudentCompetencyChartSeriesItem(
                    key=key,
                    title=DIMENSION_LABELS[key],
                    market_importance=_round_metric(target_requirement),
                    user_readiness=_round_metric(match_score),
                )
            )
            comparison_dimensions.append(
                StudentCompetencyComparisonDimensionItem(
                    key=key,
                    title=DIMENSION_LABELS[key],
                    user_values=source_values,
                    market_keywords=target_values,
                    market_weight=round(target_requirement / 100, 4),
                    normalized_weight=round((target_requirement / total_requirement), 4) if total_requirement else 0.0,
                    market_target=_round_metric(target_requirement),
                    user_readiness=_round_metric(match_score),
                    gap=_round_metric(gap),
                    presence=1 if source_values else 0,
                    richness=round(min(len(source_values) / 3, 1.0), 2),
                    status_label=_status_label(match_score if target_requirement > 0 else 60),
                    matched_market_keywords=matched_keywords,
                    missing_market_keywords=missing_keywords,
                    coverage_score=round(min(len(source_values) / max(len(target_values), 1), 1.0), 2) if target_values else 0.0,
                    alignment_score=round(len(matched_keywords) / max(len(target_values), 1), 2) if target_values else 0.0,
                )
            )

        for item in comparison_dimensions:
            item.normalized_weight = round(item.market_target / total_requirement, 4) if total_requirement else 0.0

        comparison_dimensions.sort(key=lambda item: item.gap, reverse=True)
        effective_dimensions = [item for item in comparison_dimensions if item.market_target > 0]
        computed_match = round(weighted_total / total_requirement, 2) if total_requirement > 0 else 0.0
        strength_dimensions = [item.key for item in effective_dimensions if item.user_readiness >= 80][:4]
        priority_gap_dimensions = [item.key for item in effective_dimensions if item.user_readiness < 55][:4]
        group_summaries = self._build_group_summaries(comparison_dimensions, base_group_scores)
        action_advices = self._build_action_advices(comparison_dimensions)
        narrative = self._build_narrative(
            target_title=target_title,
            overall_match=overall_score if overall_score is not None else computed_match,
            strength_dimensions=strength_dimensions,
            priority_gap_dimensions=priority_gap_dimensions,
            comparison_dimensions=comparison_dimensions,
        )

        return CareerDevelopmentMatchReport(
            report_id=report_id,
            target_scope=target_scope,
            target_title=target_title,
            canonical_job_title=canonical_job_title,
            representative_job_title=representative_job_title,
            industry=industry,
            overall_match=_round_metric(overall_score if overall_score is not None else computed_match),
            strength_dimension_count=len(strength_dimensions),
            priority_gap_dimension_count=len(priority_gap_dimensions),
            group_summaries=group_summaries,
            comparison_dimensions=comparison_dimensions,
            chart_series=chart_series,
            strength_dimensions=strength_dimensions,
            priority_gap_dimensions=priority_gap_dimensions,
            action_advices=action_advices,
            evidence_cards=evidence_cards,
            industry_supplement=industry_supplement,
            narrative=narrative,
        )

    def _build_group_summaries(
        self,
        comparison_dimensions: list[StudentCompetencyComparisonDimensionItem],
        base_group_scores: dict[str, float] | None,
    ) -> list[CareerDevelopmentMatchGroupSummary]:
        items_by_key = {item.key: item for item in comparison_dimensions}
        summaries: list[CareerDevelopmentMatchGroupSummary] = []
        for group in TRANSFER_GROUPS:
            rows = [items_by_key[dimension] for dimension in group.dimensions if dimension in items_by_key]
            active_rows = [row for row in rows if row.market_target > 0]
            if active_rows:
                total_target = sum(row.market_target for row in active_rows)
                match_score = (
                    sum(row.user_readiness * row.market_target for row in active_rows) / total_target
                    if total_target > 0
                    else 0.0
                )
                target_requirement = total_target / len(active_rows)
                gap = max(target_requirement - match_score, 0.0)
            else:
                match_score = (base_group_scores or {}).get(group.key, 0.0) * 100
                target_requirement = 0.0
                gap = 0.0
            summaries.append(
                CareerDevelopmentMatchGroupSummary(
                    group_key=group.key,
                    label=GROUP_LABELS[group.key],
                    match_score=_round_metric(match_score),
                    target_requirement=_round_metric(target_requirement),
                    gap=_round_metric(gap),
                    status_label=_status_label(match_score if active_rows else 60),
                    dimension_keys=list(group.dimensions),
                )
            )
        return summaries

    def _build_action_advices(
        self,
        comparison_dimensions: list[StudentCompetencyComparisonDimensionItem],
    ) -> list[StudentCompetencyActionAdviceItem]:
        advices: list[StudentCompetencyActionAdviceItem] = []
        for item in comparison_dimensions:
            if item.market_target <= 0 or item.user_readiness >= 55:
                continue
            recommended_keywords = item.missing_market_keywords[:3]
            keyword_text = "、".join(recommended_keywords) if recommended_keywords else item.title
            generic_sources = GENERIC_EVIDENCE_SOURCES.get(item.key, ["课程项目", "实践经历", "成果证明"])
            advices.append(
                StudentCompetencyActionAdviceItem(
                    key=item.key,
                    title=item.title,
                    status_label=item.status_label,
                    gap=_round_metric(item.gap),
                    why_it_matters=f"{item.title} 是目标画像里的重点维度，补齐这部分内容会直接缩小与目标岗位的差距。",
                    current_issue=(
                        f"当前与目标画像的对齐度还不够，建议优先补充与「{keyword_text}」相关的经历、动作和结果证据。"
                    ),
                    next_actions=[
                        f"先从 {generic_sources[0]} 里梳理与 {item.title} 对应的真实经历。",
                        f"再补充能体现 {keyword_text} 的具体动作、协作对象或产出结果。",
                        "最后把经历改写成更贴近目标岗位语言的关键词和短句。",
                    ],
                    example_phrases=[
                        f"围绕 {keyword_text} 完成具体任务并形成结果",
                        f"在真实项目中体现 {item.title} 相关能力",
                        f"将 {item.title} 经验整理成可验证的案例表达",
                    ],
                    evidence_sources=generic_sources,
                    recommended_keywords=recommended_keywords,
                )
            )
            if len(advices) >= 3:
                break
        return advices

    def _build_narrative(
        self,
        *,
        target_title: str,
        overall_match: float,
        strength_dimensions: list[str],
        priority_gap_dimensions: list[str],
        comparison_dimensions: list[StudentCompetencyComparisonDimensionItem],
    ) -> StudentCompetencyNarrativePayload:
        items_by_key = {item.key: item for item in comparison_dimensions}
        strength_highlights = [
            f"{items_by_key[key].title} 当前属于{items_by_key[key].status_label}。"
            for key in strength_dimensions
            if key in items_by_key
        ][:3]
        gap_highlights = [
            f"{items_by_key[key].title} 仍有差距，建议优先围绕 {('、'.join(items_by_key[key].missing_market_keywords[:2]) or items_by_key[key].title)} 补充证据。"
            for key in priority_gap_dimensions
            if key in items_by_key
        ][:3]
        return StudentCompetencyNarrativePayload(
            overall_review=f"当前画像与「{target_title}」的整体契合度为 {round(overall_match)}%，可以先巩固高契合维度，再优先缩小关键差距。",
            completeness_explanation="目标要求表示该维度在目标画像中的要求强度，当前契合度表示你已有内容与目标表达的贴合程度。",
            competitiveness_explanation="差距值越高，说明该维度越值得优先补充；优先补强高要求且低契合的维度，会更快提升整体匹配表现。",
            strength_highlights=strength_highlights,
            priority_gap_highlights=gap_highlights,
        )

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


def build_career_development_match_service(
    db: Session,
    *,
    job_vector_store: QdrantGroupedVectorStore,
    career_vector_store: QdrantGroupedVectorStore,
) -> CareerDevelopmentMatchService:
    return CareerDevelopmentMatchService(
        db,
        job_vector_store=job_vector_store,
        career_vector_store=career_vector_store,
    )
