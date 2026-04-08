from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.career_title_alias import CareerTitleAlias
from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.job_requirement_profile import (
    DEFAULT_KEYWORD,
    DIMENSION_FIELDS,
    default_dimension_payload,
    extract_dimensions_from_prompt,
    merge_job_details,
)
from app.services.job_requirement_profile_read import parse_effective_dimension_value
from app.services.job_transfer_groups import CAREER_ALIAS_VERSION, TRANSFER_GROUPS, build_group_coverages
from app.services.llm import ChatMessage, OpenAICompatibleLLMClient


DEFAULT_ALIAS_BATCH_SIZE = 50


@dataclass(slots=True)
class CareerProfileGroup:
    canonical_job_title: str
    raw_job_titles: list[str]
    sample_count: int
    detail_text: str | None


@dataclass(slots=True)
class CareerProfileExtractionResult:
    group: CareerProfileGroup
    payload: dict[str, str] | None
    error: Exception | None = None


def build_career_alias_prompt(job_titles: list[str]) -> str:
    titles = "\n".join(f"- {title}" for title in job_titles)
    return (
        "你是职位名称归一助手。请把下面这些招聘职位名归一成更稳定的标准职业名称。\n"
        "要求：\n"
        "1. 只输出 JSON 数组。\n"
        '2. 每项格式必须是 {"raw_job_title":"原始标题","canonical_job_title":"标准职业名"}。\n'
        "3. canonical_job_title 必须是简洁中文职业名，不要带公司、行业、地点、级别修饰。\n"
        "4. 如果两个标题本质属于同一职业方向，应归一到同一个 canonical_job_title。\n"
        "5. 如果无法判断，就保留原始职位名。\n"
        "待归一职位如下：\n"
        f"{titles}"
    )


def parse_career_alias_payload(content: str, job_titles: list[str]) -> dict[str, str]:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return {title: title for title in job_titles}

    mapping = {title: title for title in job_titles}
    if not isinstance(payload, list):
        return mapping

    for item in payload:
        if not isinstance(item, dict):
            continue
        raw_job_title = str(item.get("raw_job_title") or "").strip()
        canonical_job_title = str(item.get("canonical_job_title") or "").strip()
        if not raw_job_title or raw_job_title not in mapping:
            continue
        mapping[raw_job_title] = canonical_job_title or raw_job_title
    return mapping


async def canonicalize_job_titles(job_titles: list[str], client: OpenAICompatibleLLMClient) -> dict[str, str]:
    if not job_titles:
        return {}
    prompt = build_career_alias_prompt(job_titles)
    content = await client.chat_completion(
        [
            ChatMessage(role="system", content="你只输出合法 JSON，不要输出解释。"),
            ChatMessage(role="user", content=prompt),
        ],
        temperature=0.0,
    )
    return parse_career_alias_payload(content, job_titles)


def _batch_job_titles(job_titles: list[str], batch_size: int) -> list[list[str]]:
    normalized_batch_size = max(batch_size, 1)
    return [job_titles[index : index + normalized_batch_size] for index in range(0, len(job_titles), normalized_batch_size)]


async def build_career_title_alias_mapping(
    job_titles: list[str],
    client: OpenAICompatibleLLMClient,
    *,
    batch_size: int = DEFAULT_ALIAS_BATCH_SIZE,
    concurrency: int | None = None,
    progress: Callable[..., None] | None = None,
) -> dict[str, str]:
    if not job_titles:
        if progress is not None:
            progress(
                "completed",
                {
                    "total_titles": 0,
                    "batch_count": 0,
                    "completed_batches": 0,
                },
            )
        return {}

    batches = _batch_job_titles(job_titles, batch_size)
    effective_concurrency = max(concurrency if concurrency is not None else client.concurrency, 1)
    if progress is not None:
        progress(
            "prepared",
            {
                "total_titles": len(job_titles),
                "batch_count": len(batches),
                "batch_size": max(batch_size, 1),
                "concurrency": effective_concurrency,
            },
        )

    semaphore = asyncio.Semaphore(effective_concurrency)

    async def process_batch(batch_index: int, titles_batch: list[str]) -> tuple[int, list[str], dict[str, str]]:
        async with semaphore:
            mapping = await canonicalize_job_titles(titles_batch, client)
        return batch_index, titles_batch, mapping

    tasks = [
        asyncio.create_task(process_batch(batch_index, titles_batch))
        for batch_index, titles_batch in enumerate(batches, start=1)
    ]

    combined_mapping: dict[str, str] = {}
    completed_batches = 0
    try:
        for completed in asyncio.as_completed(tasks):
            batch_index, titles_batch, batch_mapping = await completed
            completed_batches += 1
            for raw_job_title in titles_batch:
                combined_mapping[raw_job_title] = batch_mapping.get(raw_job_title, raw_job_title)
            if progress is not None:
                progress(
                    "batch_completed",
                    {
                        "batch_index": batch_index,
                        "batch_count": len(batches),
                        "batch_titles": len(titles_batch),
                        "completed_batches": completed_batches,
                        "completed_titles": len(combined_mapping),
                        "total_titles": len(job_titles),
                    },
                )
    except Exception:
        for task in tasks:
            if not task.done():
                task.cancel()
        raise
    finally:
        await asyncio.gather(*tasks, return_exceptions=True)

    if progress is not None:
        progress(
            "completed",
            {
                "total_titles": len(job_titles),
                "batch_count": len(batches),
                "completed_batches": completed_batches,
            },
        )
    return combined_mapping


def apply_canonical_job_titles(db: Session, mapping: dict[str, str]) -> None:
    profiles = db.scalars(select(JobRequirementProfile)).all()
    for profile in profiles:
        profile.canonical_job_title = mapping.get(profile.job_title, profile.job_title)
    db.flush()


async def build_career_title_aliases(
    db: Session,
    client: OpenAICompatibleLLMClient,
    *,
    batch_size: int = DEFAULT_ALIAS_BATCH_SIZE,
    concurrency: int | None = None,
    progress: Callable[..., None] | None = None,
) -> dict[str, str]:
    job_titles = [
        title
        for title in db.scalars(select(JobPosting.job_title).distinct().order_by(JobPosting.job_title.asc())).all()
        if title and title.strip()
    ]
    mapping = await build_career_title_alias_mapping(
        job_titles,
        client,
        batch_size=batch_size,
        concurrency=concurrency,
        progress=progress,
    )

    db.execute(delete(CareerTitleAlias))
    db.flush()
    for raw_job_title in job_titles:
        db.add(
            CareerTitleAlias(
                raw_job_title=raw_job_title,
                canonical_job_title=mapping.get(raw_job_title, raw_job_title),
                alias_version=CAREER_ALIAS_VERSION,
            )
        )
    apply_canonical_job_titles(db, mapping)
    db.commit()
    return mapping


def build_career_profile_prompt(group: CareerProfileGroup) -> str:
    detail_text = group.detail_text or DEFAULT_KEYWORD
    raw_titles = "、".join(group.raw_job_titles)
    return (
        f"标准职业: {group.canonical_job_title}\n"
        f"来源职位名: {raw_titles}\n"
        "以下是该标准职业聚合后的招聘岗位详情，请提取这个职业共相的 12 维关键词数组。\n"
        "要求：\n"
        "1. 只基于下面给出的岗位详情抽取，不要补充常识。\n"
        "2. 输出必须是单个 JSON 对象。\n"
        "3. JSON 必须包含以下 12 个键：professional_skills, professional_background, education_requirement, teamwork, stress_adaptability, communication, work_experience, documentation_awareness, responsibility, learning_ability, problem_solving, other_special。\n"
        f"4. 若某一维没有明确要求，返回 [\"{DEFAULT_KEYWORD}\"]。\n"
        "5. 关键词尽量短，不要输出整句。\n"
        "聚合岗位详情如下：\n"
        f"{detail_text}"
    )


async def extract_career_profile_dimensions(
    group: CareerProfileGroup,
    client: OpenAICompatibleLLMClient,
) -> dict[str, str]:
    if not group.detail_text:
        return default_dimension_payload()
    return await extract_dimensions_from_prompt(
        build_career_profile_prompt(group),
        client,
        source_text=group.detail_text,
    )


async def _extract_career_profile_group(
    group: CareerProfileGroup,
    client: OpenAICompatibleLLMClient,
    semaphore: asyncio.Semaphore,
) -> CareerProfileExtractionResult:
    async with semaphore:
        try:
            payload = await extract_career_profile_dimensions(group, client)
        except Exception as exc:
            return CareerProfileExtractionResult(group=group, payload=None, error=exc)
    return CareerProfileExtractionResult(group=group, payload=payload)


def group_job_postings_by_canonical_title(db: Session) -> list[CareerProfileGroup]:
    alias_rows = db.scalars(select(CareerTitleAlias)).all()
    alias_map = {row.raw_job_title: row.canonical_job_title for row in alias_rows}
    rows = db.scalars(select(JobPosting).order_by(JobPosting.job_title.asc(), JobPosting.id.asc())).all()

    grouped_details: dict[str, list[str | None]] = {}
    grouped_raw_titles: dict[str, set[str]] = {}
    grouped_sample_counts: dict[str, int] = {}

    for row in rows:
        canonical_job_title = alias_map.get(row.job_title, row.job_title)
        grouped_details.setdefault(canonical_job_title, []).append(row.job_detail)
        grouped_raw_titles.setdefault(canonical_job_title, set()).add(row.job_title)
        grouped_sample_counts[canonical_job_title] = grouped_sample_counts.get(canonical_job_title, 0) + 1

    groups: list[CareerProfileGroup] = []
    for canonical_job_title in sorted(grouped_details):
        groups.append(
            CareerProfileGroup(
                canonical_job_title=canonical_job_title,
                raw_job_titles=sorted(grouped_raw_titles[canonical_job_title]),
                sample_count=grouped_sample_counts[canonical_job_title],
                detail_text=merge_job_details(grouped_details[canonical_job_title]),
            )
        )
    return groups


async def build_career_requirement_profiles(db: Session, client: OpenAICompatibleLLMClient) -> int:
    return await build_career_requirement_profiles_with_progress(db, client)


def _build_fallback_career_profile_payload(
    profiles: list[JobRequirementProfile],
    *,
    per_field_limit: int = 8,
) -> dict[str, str]:
    if not profiles:
        return default_dimension_payload()

    payload: dict[str, str] = {}
    for field in DIMENSION_FIELDS:
        counter: Counter[str] = Counter()
        first_seen: dict[str, int] = {}
        for profile in profiles:
            for item in parse_effective_dimension_value(getattr(profile, field)):
                counter[item] += 1
                first_seen.setdefault(item, len(first_seen))

        ordered_items = [
            item
            for item, _count in sorted(
                counter.items(),
                key=lambda pair: (-pair[1], first_seen[pair[0]]),
            )[: max(per_field_limit, 1)]
        ]
        payload[field] = json.dumps(ordered_items or [DEFAULT_KEYWORD], ensure_ascii=False)
    return payload


def _merge_with_fallback_career_profile_payload(
    payload: dict[str, str],
    fallback_payload: dict[str, str],
) -> dict[str, str]:
    merged = dict(payload)
    for field in DIMENSION_FIELDS:
        if not parse_effective_dimension_value(merged[field]):
            merged[field] = fallback_payload[field]
    return merged


async def build_career_requirement_profiles_with_progress(
    db: Session,
    client: OpenAICompatibleLLMClient,
    *,
    progress: Callable[..., None] | None = None,
    max_groups: int | None = None,
) -> int:
    groups = group_job_postings_by_canonical_title(db)
    if max_groups is not None:
        groups = groups[: max(max_groups, 0)]
    if progress is not None:
        progress("groups_loaded", {"total_groups": len(groups)})
    db.execute(delete(CareerRequirementProfile))
    db.flush()
    if progress is not None:
        progress("profiles_cleared", {"total_groups": len(groups)})

    profiles = db.scalars(select(JobRequirementProfile).order_by(JobRequirementProfile.id.asc())).all()
    profiles_by_canonical_title: dict[str, list[JobRequirementProfile]] = {}
    for profile in profiles:
        profiles_by_canonical_title.setdefault(profile.canonical_job_title or profile.job_title, []).append(profile)

    created = 0
    total_groups = len(groups)
    semaphore = asyncio.Semaphore(client.concurrency)
    tasks = [asyncio.create_task(_extract_career_profile_group(group, client, semaphore)) for group in groups]

    try:
        for index, completed in enumerate(asyncio.as_completed(tasks), start=1):
            result = await completed
            group = result.group
            if progress is not None:
                progress(
                    "processing",
                    {
                        "current": index,
                        "total": total_groups,
                        "canonical_job_title": group.canonical_job_title,
                        "sample_count": group.sample_count,
                        "raw_job_title_count": len(group.raw_job_titles),
                    },
                )
            if result.error is not None:
                if progress is not None:
                    progress(
                        "failed",
                        {
                            "current": index,
                            "total": total_groups,
                            "canonical_job_title": group.canonical_job_title,
                            "sample_count": group.sample_count,
                            "error": str(result.error),
                        },
                    )
                for task in tasks:
                    if not task.done():
                        task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                raise RuntimeError(f"Failed to build career profile for {group.canonical_job_title}") from result.error

            payload = result.payload
            if payload is None:
                raise RuntimeError(f"Missing career profile payload for {group.canonical_job_title}")

            fallback_payload = _build_fallback_career_profile_payload(
                profiles_by_canonical_title.get(group.canonical_job_title, [])
            )
            payload = _merge_with_fallback_career_profile_payload(payload, fallback_payload)
            coverages = build_group_coverages(profiles_by_canonical_title.get(group.canonical_job_title, []))
            db.add(
                CareerRequirementProfile(
                    canonical_job_title=group.canonical_job_title,
                    source_job_titles_json=json.dumps(group.raw_job_titles, ensure_ascii=False),
                    sample_count=group.sample_count,
                    professional_and_threshold_coverage=coverages["professional-and-threshold"],
                    collaboration_and_adaptation_coverage=coverages["collaboration-and-adaptation"],
                    growth_and_professionalism_coverage=coverages["growth-and-professionalism"],
                    **payload,
                )
            )
            created += 1
            if progress is not None:
                progress(
                    "processed",
                    {
                        "current": index,
                        "total": total_groups,
                        "canonical_job_title": group.canonical_job_title,
                        "sample_count": group.sample_count,
                        "created": created,
                    },
                )
    finally:
        await asyncio.gather(*tasks, return_exceptions=True)

    db.commit()
    if progress is not None:
        progress("completed", {"total_groups": total_groups, "created": created})
    return created


def get_group_weights_for_career(
    career_profile: CareerRequirementProfile,
    *,
    active_group_keys: set[str],
) -> dict[str, float]:
    raw_weights = {
        group.key: float(getattr(career_profile, group.coverage_field))
        for group in TRANSFER_GROUPS
        if group.key in active_group_keys
    }
    total = sum(value for value in raw_weights.values() if value > 0)
    if total <= 0:
        if not active_group_keys:
            return {}
        fallback = round(1 / len(active_group_keys), 6)
        return {group_key: fallback for group_key in sorted(active_group_keys)}
    return {
        group_key: round(value / total, 6)
        for group_key, value in raw_weights.items()
        if value > 0
    }
