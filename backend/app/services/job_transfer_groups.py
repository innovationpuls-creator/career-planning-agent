from __future__ import annotations

import hashlib
from dataclasses import dataclass

from app.services.job_requirement_profile import DIMENSION_FIELDS
from app.services.job_requirement_profile_read import parse_effective_dimension_value


GROUP_VECTOR_VERSION = "job-transfer-groups-v2"
CAREER_ALIAS_VERSION = "career-title-alias-v2"

DIMENSION_LABELS = {
    "professional_skills": "专业技能",
    "professional_background": "专业背景",
    "education_requirement": "学历要求",
    "teamwork": "团队协作能力",
    "stress_adaptability": "抗压/适应能力",
    "communication": "沟通表达能力",
    "work_experience": "工作经验",
    "documentation_awareness": "文档规范意识",
    "responsibility": "责任心/工作态度",
    "learning_ability": "学习能力",
    "problem_solving": "分析解决问题能力",
    "other_special": "其他/特殊要求",
}


@dataclass(frozen=True, slots=True)
class TransferGroupSpec:
    key: str
    label: str
    coverage_field: str
    dimensions: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class GroupEmbeddingDocument:
    group_key: str
    text: str
    signature: str
    keywords_by_dimension: dict[str, list[str]]


TRANSFER_GROUPS: tuple[TransferGroupSpec, ...] = (
    TransferGroupSpec(
        key="professional-and-threshold",
        label="专业与门槛",
        coverage_field="professional_and_threshold_coverage",
        dimensions=(
            "professional_skills",
            "professional_background",
            "education_requirement",
            "work_experience",
            "other_special",
        ),
    ),
    TransferGroupSpec(
        key="collaboration-and-adaptation",
        label="协作与适应",
        coverage_field="collaboration_and_adaptation_coverage",
        dimensions=("teamwork", "stress_adaptability", "communication"),
    ),
    TransferGroupSpec(
        key="growth-and-professionalism",
        label="成长与职业素养",
        coverage_field="growth_and_professionalism_coverage",
        dimensions=("documentation_awareness", "responsibility", "learning_ability", "problem_solving"),
    ),
)

TRANSFER_GROUPS_BY_KEY = {group.key: group for group in TRANSFER_GROUPS}
GROUP_LABELS = {group.key: group.label for group in TRANSFER_GROUPS}
DIMENSION_TO_GROUP_KEY = {
    dimension: group.key
    for group in TRANSFER_GROUPS
    for dimension in group.dimensions
}


def build_effective_dimension_payload(profile: object) -> dict[str, list[str]]:
    return {
        field: parse_effective_dimension_value(str(getattr(profile, field, "")))
        for field in DIMENSION_FIELDS
    }


def build_group_embedding_documents(profile: object) -> dict[str, GroupEmbeddingDocument]:
    effective = build_effective_dimension_payload(profile)
    documents: dict[str, GroupEmbeddingDocument] = {}
    for group in TRANSFER_GROUPS:
        segments: list[str] = []
        keywords_by_dimension: dict[str, list[str]] = {}
        for dimension in group.dimensions:
            keywords = effective[dimension]
            keywords_by_dimension[dimension] = keywords
            if keywords:
                segments.append(f"{DIMENSION_LABELS[dimension]}: {' '.join(keywords)}")
        text = "\n".join(segments).strip()
        if not text:
            continue
        documents[group.key] = GroupEmbeddingDocument(
            group_key=group.key,
            text=text,
            signature=hashlib.sha256(text.encode("utf-8")).hexdigest(),
            keywords_by_dimension=keywords_by_dimension,
        )
    return documents


def normalize_group_weights(raw_weights: dict[str, float], active_group_keys: set[str] | None = None) -> dict[str, float]:
    filtered: dict[str, float] = {}
    for group in TRANSFER_GROUPS:
        if active_group_keys is not None and group.key not in active_group_keys:
            continue
        value = max(float(raw_weights.get(group.key, 0.0)), 0.0)
        if value > 0:
            filtered[group.key] = value
    total = sum(filtered.values())
    if total <= 0:
        return {}
    return {key: round(value / total, 6) for key, value in filtered.items()}


def build_group_coverages(profiles: list[object]) -> dict[str, float]:
    total_profiles = len(profiles)
    if total_profiles == 0:
        return {group.key: 0.0 for group in TRANSFER_GROUPS}

    coverages: dict[str, float] = {}
    for group in TRANSFER_GROUPS:
        active_profiles = 0
        for profile in profiles:
            payload = build_effective_dimension_payload(profile)
            if any(payload[dimension] for dimension in group.dimensions):
                active_profiles += 1
        coverages[group.key] = round(active_profiles / total_profiles, 4)
    return coverages
