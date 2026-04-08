from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.job_requirement_profile import DEFAULT_KEYWORD, DIMENSION_FIELDS, merge_job_details


def parse_dimension_value(raw: str | None) -> list[str]:
    if raw is None:
        return [DEFAULT_KEYWORD]
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return [DEFAULT_KEYWORD]
    if not isinstance(payload, list):
        return [DEFAULT_KEYWORD]

    normalized: list[str] = []
    seen: set[str] = set()
    for item in payload:
        text = str(item).strip() if item is not None else ""
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized or [DEFAULT_KEYWORD]


def is_default_dimension(items: list[str]) -> bool:
    return len(items) == 1 and items[0] == DEFAULT_KEYWORD


def filter_effective_keywords(items: list[str]) -> list[str]:
    return [item for item in items if item != DEFAULT_KEYWORD]


def parse_effective_dimension_value(raw: str) -> list[str]:
    return filter_effective_keywords(parse_dimension_value(raw))


def count_non_default_dimensions(profile: JobRequirementProfile) -> int:
    return sum(
        1
        for field in DIMENSION_FIELDS
        if parse_effective_dimension_value(getattr(profile, field))
    )


def build_dimension_payload(profile: JobRequirementProfile) -> dict[str, list[str]]:
    return {
        field: parse_dimension_value(getattr(profile, field))
        for field in DIMENSION_FIELDS
    }


def build_effective_dimension_payload(profile: JobRequirementProfile) -> dict[str, list[str]]:
    return {
        field: parse_effective_dimension_value(getattr(profile, field))
        for field in DIMENSION_FIELDS
    }


def get_group_job_details(profile: JobRequirementProfile, db: Session) -> list[str]:
    rows = db.scalars(
        select(JobPosting.job_detail).where(
            JobPosting.industry == profile.industry,
            JobPosting.job_title == profile.job_title,
            JobPosting.company_name == profile.company_name,
            JobPosting.job_detail.is_not(None),
        )
    ).all()
    return [row.strip() for row in rows if row and row.strip()]


def build_merged_job_detail(profile: JobRequirementProfile, db: Session) -> tuple[str | None, int]:
    details = get_group_job_details(profile, db)
    return merge_job_details(details), len(details)
