from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime, timezone

from sqlalchemy import delete

from app.db.session import SessionLocal
from app.models.snail_learning_resource_library import SnailLearningResourceLibrary
from app.services.llm import ChatMessage, OpenAICompatibleLLMClient
from app.services.snail_learning_resource_library import (
    SUPPORTED_JOB_TITLES,
    SUPPORTED_PHASE_KEYS,
    DIMENSION_LABELS as SERVICE_DIMENSION_LABELS,
    PHASE_REASON_SUFFIX,
    get_learning_resources,
    rebuild_learning_resource_library,
)
from app.schemas.student_competency_profile import JOB_PROFILE_FIELD_ORDER

# Rich labels for LLM prompts (more descriptive than the service module labels)
PROMPT_DIMENSION_LABELS = {
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
    "other_special": "其他/特殊要求（证书、语言、出差驻场、班次、驾照、特殊准入等）",
}

GENERATION_PROMPT = """你是一个职业学习资源推荐专家。请为「{job_title}」岗位的「{dimension_label}」能力维度，一次性输出三个学习阶段（短、中、长期）的资源推荐。

每个阶段推荐 6 个高质量学习资源，**三个阶段之间不得出现重复资源**。

阶段说明：
- **短期（short_term）**：入门级、基础的学习资源，适合初学者快速建立基础框架。偏向：入门教程、基础课程、概念讲解、新手指南。
- **中期（mid_term）**：中级实践学习资源，适合有基础的学习者通过项目实战和真实案例提升能力。偏向：项目实战、案例研究、工具实操、团队协作场景。
- **长期（long_term）**：进阶、深度的学习资源，适合有经验的学习者持续进阶和专业深化。偏向：高级专题、架构设计、行业标准、专业认证、前沿技术。

基础要求：
1. 返回 JSON 对象，包含 short_term、mid_term、long_term 三个数组
2. 每个数组包含 6 个元素（共 18 个），每个元素包含 title、url、reason 三个字段
3. title：资源名称，简短且可识别
4. url：真实可访问的 URL
5. reason：推荐理由，20-40 字，需结合「{job_title}」岗位场景和「{dimension_label}」维度说明为什么这个资源有帮助
6. 资源应覆盖不同的学习形式（文档、课程、社区、工具等）
7. 优先中文可访问资源，如果同类资源只有英文版的也可以用
8. 必须是知名、稳定的学习平台或资源
9. 三个阶段共 18 个资源，**任何两个阶段之间不得有重复**
10. 短期入门资源要基础易懂，中期资源要有实战价值，长期资源要体现深度

示例格式：
{{
  "short_term": [
    {{"title": "示例入门资源", "url": "https://example.com/beginner", "reason": "适合{job_title}补齐{dimension_label}的入门学习路径。"}}
  ],
  "mid_term": [
    {{"title": "示例实战资源", "url": "https://example.com/practical", "reason": "通过真实案例提升{job_title}在{dimension_label}方面的实战能力。"}}
  ],
  "long_term": [
    {{"title": "示例进阶资源", "url": "https://example.com/advanced", "reason": "深入{job_title}岗位{dimension_label}维度的进阶学习与专业提升。"}}
  ]
}}"""


def check_existing(
    job_title: str,
    dimension_key: str,
    phase_key: str | None = None,
) -> int:
    with SessionLocal() as db:
        if phase_key:
            resources = get_learning_resources(db, canonical_job_title=job_title, dimension_key=dimension_key, phase_key=phase_key)
            return len(resources)
        else:
            total = 0
            for pk in SUPPORTED_PHASE_KEYS:
                resources = get_learning_resources(db, canonical_job_title=job_title, dimension_key=dimension_key, phase_key=pk)
                total += len(resources)
            return total


def check_all_existing() -> dict[tuple[str, str, str], int]:
    results: dict[tuple[str, str, str], int] = {}
    with SessionLocal() as db:
        for job_title in SUPPORTED_JOB_TITLES:
            for dimension_key in JOB_PROFILE_FIELD_ORDER:
                for phase_key in SUPPORTED_PHASE_KEYS:
                    resources = get_learning_resources(db, canonical_job_title=job_title, dimension_key=dimension_key, phase_key=phase_key)
                    results[(job_title, dimension_key, phase_key)] = len(resources)
    return results


def check_phases_identical(job_title: str, dimension_key: str) -> bool:
    """Check if all 3 phases have identical resources (for detection)."""
    with SessionLocal() as db:
        phase_data = {}
        for pk in SUPPORTED_PHASE_KEYS:
            resources = get_learning_resources(db, canonical_job_title=job_title, dimension_key=dimension_key, phase_key=pk)
            phase_data[pk] = [(r.site_title, r.site_url) for r in resources]

        if len(phase_data["short_term"]) != 6 or len(phase_data["mid_term"]) != 6 or len(phase_data["long_term"]) != 6:
            return False  # not comparable

        return (
            phase_data["short_term"] == phase_data["mid_term"]
            and phase_data["mid_term"] == phase_data["long_term"]
        )


async def generate_dimension_all_phases(
    client: OpenAICompatibleLLMClient,
    job_title: str,
    dimension_label: str,
) -> dict[str, list[dict]]:
    """Single LLM call returning all 3 phases for one dimension."""
    prompt = GENERATION_PROMPT.format(job_title=job_title, dimension_label=dimension_label)
    messages = [ChatMessage(role="user", content=prompt)]

    try:
        result = await client.chat_completion_structured(messages, temperature=0.3)
    except Exception as exc:
        print(f"  [ERROR] LLM call failed for {job_title}/{dimension_label}: {exc}", flush=True)
        return {}

    phases = result if isinstance(result, dict) else {}
    validated: dict[str, list[dict]] = {}
    for phase_key in SUPPORTED_PHASE_KEYS:
        items = phases.get(phase_key, [])
        if not isinstance(items, list):
            validated[phase_key] = []
            continue
        validated_items = []
        for item in items:
            if isinstance(item, dict) and item.get("title") and item.get("url") and item.get("reason"):
                validated_items.append({"title": item["title"], "url": item["url"], "reason": item["reason"]})
        validated[phase_key] = validated_items
    return validated


def persist_resources_sync(
    db: SessionLocal,
    job_title: str,
    dimension_key: str,
    resources: list[dict],
    phase_key: str,
) -> int:
    """Delete old resources for this combination and insert new ones."""
    db.execute(
        delete(SnailLearningResourceLibrary).where(
            SnailLearningResourceLibrary.canonical_job_title == job_title,
            SnailLearningResourceLibrary.dimension_key == dimension_key,
            SnailLearningResourceLibrary.phase_key == phase_key,
        )
    )
    now = datetime.now(timezone.utc)
    dimension_label = SERVICE_DIMENSION_LABELS.get(dimension_key, dimension_key)
    suffix = PHASE_REASON_SUFFIX[phase_key]
    rows = [
        SnailLearningResourceLibrary(
            canonical_job_title=job_title,
            dimension_key=dimension_key,
            phase_key=phase_key,
            rank=rank + 1,
            site_title=item["title"],
            site_url=item["url"],
            reason=f"{item['reason']} 这条资源围绕「{job_title}」的「{dimension_label}」能力设计，{suffix}",
            created_at=now,
            updated_at=now,
        )
        for rank, item in enumerate(resources)
    ]
    db.add_all(rows)
    db.commit()
    return len(rows)


async def gen_phase_with_retry(
    client: OpenAICompatibleLLMClient,
    job_title: str,
    dimension_key: str,
    dimension_label: str,
    semaphore: asyncio.Semaphore,
    max_retries: int,
) -> dict:
    """Generate ALL 3 phases for one dimension in a single LLM call, with retry."""
    for attempt in range(max_retries + 1):
        async with semaphore:
            if attempt > 0:
                print(f"    [RETRY {attempt}/{max_retries}] {dimension_label}", flush=True)
                await asyncio.sleep(2 ** attempt)

            print(f"    [LLM] {dimension_label}...", flush=True)
            all_phases = await generate_dimension_all_phases(client, job_title, dimension_label)

        if all_phases and all(len(v) == 6 for v in all_phases.values()):
            with SessionLocal() as db:
                for phase_key, resources in all_phases.items():
                    persist_resources_sync(db, job_title, dimension_key, resources, phase_key)
            total = sum(len(v) for v in all_phases.values())
            short_len = len(all_phases["short_term"])
            mid_len = len(all_phases["mid_term"])
            long_len = len(all_phases["long_term"])
            print(f"    [OK] {dimension_label} -> {total} resources (short={short_len}, mid={mid_len}, long={long_len})", flush=True)
            return {"phase": "all", "status": "generated", "count": total}

        got = sum(len(v) for v in (all_phases or {}).values())
        print(f"    [SKIP attempt {attempt+1}] {dimension_label} (got {got} valid resources)", flush=True)

    return {"phase": "all", "status": "skipped", "count": 0}


async def gen_dimension_phases(
    client: OpenAICompatibleLLMClient,
    job_title: str,
    dimension_key: str,
    dimension_label: str,
    semaphore: asyncio.Semaphore,
    max_retries: int,
) -> dict:
    """Generate ALL 3 phases for one dimension in a single LLM call."""
    result = await gen_phase_with_retry(client, job_title, dimension_key, dimension_label, semaphore, max_retries)

    status = "generated" if result["status"] == "generated" else "partial"
    print(f"  [DONE] {dimension_label}: all 3 phases ({result['count']} resources)", flush=True)

    return {
        "job_title": job_title,
        "dimension": dimension_label,
        "status": status,
        "count": result["count"],
    }


def print_summary(results: list[dict], elapsed: float, check_before: dict | None = None, check_after: dict | None = None):
    total = len(results)
    generated = sum(1 for r in results if r["status"] == "generated")
    partial = sum(1 for r in results if r["status"] == "partial")
    total_resources = sum(r["count"] for r in results)

    print(f"\n{'='*60}", flush=True)
    print(f"  Generation Complete", flush=True)
    print(f"{'='*60}", flush=True)
    print(f"  Total dimensions: {total}", flush=True)
    print(f"  All 3 phases OK: {generated}", flush=True)
    print(f"  Partial: {partial}", flush=True)
    print(f"  Total rows in DB: {total_resources}", flush=True)
    print(f"  Elapsed: {elapsed:.1f}s", flush=True)
    print(f"{'='*60}", flush=True)

    if check_before and check_after:
        print(f"\n  Verification:", flush=True)
        empty_before = sum(1 for v in check_before.values() if v == 0)
        empty_after = sum(1 for v in check_after.values() if v == 0)
        print(f"    Empty combinations before: {empty_before}", flush=True)
        print(f"    Empty combinations after: {empty_after}", flush=True)
        all_6 = sum(1 for v in check_after.values() if v == 6)
        not_6 = sum(1 for v in check_after.values() if v != 6)
        print(f"    Has 6 resources: {all_6}", flush=True)
        print(f"    Other: {not_6}", flush=True)


async def generate_all_resources(
    client: OpenAICompatibleLLMClient,
    semaphore: asyncio.Semaphore,
    max_retries: int = 2,
) -> list[dict]:
    """Generate phase-specific resources for ALL job titles × ALL dimensions."""
    results: list[dict] = []

    for job_title in SUPPORTED_JOB_TITLES:
        print(f"\n{'='*60}", flush=True)
        print(f"Processing job: {job_title}", flush=True)
        print(f"{'='*60}", flush=True)

        dim_tasks = []
        for dimension_key in JOB_PROFILE_FIELD_ORDER:
            dimension_label = PROMPT_DIMENSION_LABELS.get(dimension_key, dimension_key)
            dim_tasks.append(
                gen_dimension_phases(client, job_title, dimension_key, dimension_label, semaphore, max_retries)
            )

        dim_results = await asyncio.gather(*dim_tasks)
        results.extend(dim_results)

        ok = sum(1 for r in dim_results if r["status"] == "generated")
        print(f"\n  [{job_title}] All dimensions generated: {ok}/{len(dim_results)}", flush=True)

    return results


async def run_all_generation(max_concurrent: int = 6, max_retries: int = 2):
    """Generate ALL learning resources for all job titles × dimensions × phases."""
    start = time.time()
    total_calls = len(SUPPORTED_JOB_TITLES) * len(JOB_PROFILE_FIELD_ORDER)

    print(f"Generating resources for:", flush=True)
    print(f"  Job titles: {len(SUPPORTED_JOB_TITLES)} ({', '.join(SUPPORTED_JOB_TITLES)})", flush=True)
    print(f"  Dimensions: {len(JOB_PROFILE_FIELD_ORDER)}", flush=True)
    print(f"  Total LLM calls: {total_calls} (1 per dimension × 3 phases combined)")
    print(f"  Max concurrency: {max_concurrent}", flush=True)
    print(f"  Max retries: {max_retries}", flush=True)

    # Check existing state before generation
    print(f"\nChecking existing resources before generation...", flush=True)
    check_before = check_all_existing()
    empty_before = sum(1 for v in check_before.values() if v == 0)
    print(f"  Empty combinations: {empty_before}")

    if empty_before == 0:
        print(f"\nChecking if phases have identical content...", flush=True)
        identical_count = 0
        for job_title in SUPPORTED_JOB_TITLES:
            for dimension_key in JOB_PROFILE_FIELD_ORDER:
                if check_phases_identical(job_title, dimension_key):
                    identical_count += 1
        if identical_count > 0:
            print(f"  {identical_count} dimensions have identical content across phases.")
            print(f"  Use --force to regenerate with phase-specific content.")
        else:
            print(f"\nAll resources already populated. Use --force to regenerate.")
        return

    # Initialize LLM client
    try:
        client = OpenAICompatibleLLMClient.from_settings()
    except Exception as exc:
        print(f"\n  [FATAL] LLM not configured: {exc}", flush=True)
        print("  Please configure LLM settings in backend/.env or root .env", flush=True)
        sys.exit(1)

    semaphore = asyncio.Semaphore(max_concurrent)

    try:
        results = await generate_all_resources(client, semaphore, max_retries)
    finally:
        await client.aclose()

    elapsed = time.time() - start

    # Check state after generation
    print(f"\nVerifying resources after generation...", flush=True)
    check_after = check_all_existing()

    print_summary(results, elapsed, check_before, check_after)


async def run_all_generation_force(max_concurrent: int = 6, max_retries: int = 2):
    """Force regenerate ALL resources with phase-specific content."""
    start = time.time()

    print(f"Force-regenerating all resources with phase-specific content...", flush=True)
    print(f"  Job titles: {len(SUPPORTED_JOB_TITLES)}", flush=True)
    print(f"  Dimensions: {len(JOB_PROFILE_FIELD_ORDER)}", flush=True)
    print(f"  Total LLM calls: {len(SUPPORTED_JOB_TITLES) * len(JOB_PROFILE_FIELD_ORDER)}", flush=True)
    print(f"  Max concurrency: {max_concurrent}", flush=True)

    try:
        client = OpenAICompatibleLLMClient.from_settings()
    except Exception as exc:
        print(f"\n  [FATAL] LLM not configured: {exc}", flush=True)
        sys.exit(1)

    semaphore = asyncio.Semaphore(max_concurrent)

    try:
        results = await generate_all_resources(client, semaphore, max_retries)
    finally:
        await client.aclose()

    elapsed = time.time() - start
    check_after = check_all_existing()
    print_summary(results, elapsed, None, check_after)


async def run_targeted_generation(
    job_title: str,
    dimension_key: str,
    dimension_label: str,
    max_retries: int = 2,
):
    """Generate all 3 phases for a single job×dimension in one LLM call."""
    client = OpenAICompatibleLLMClient.from_settings()
    semaphore = asyncio.Semaphore(1)

    try:
        result = await gen_phase_with_retry(client, job_title, dimension_key, dimension_label, semaphore, max_retries)
        print(f"\nResult: {json.dumps(result, ensure_ascii=False)}", flush=True)
    finally:
        await client.aclose()


async def main_async() -> None:
    parser = argparse.ArgumentParser(
        description="Generate learning resources via LLM. Without arguments, generates ALL resources."
    )
    parser.add_argument("--job-title", default=None, help="Canonical job title (omit to generate all)")
    parser.add_argument("--dimension", default=None, help="Dimension key (omit to generate all)")
    parser.add_argument("--phase", default=None, choices=["short_term", "mid_term", "long_term", "all"],
                        help="Phase key (default: all)")
    parser.add_argument("--rebuild-first", action="store_true", help="Rebuild static library before generation")
    parser.add_argument("--check-only", action="store_true", help="Only check existing state, don't generate")
    parser.add_argument("--force", action="store_true", help="Force regenerate even if data exists")
    parser.add_argument("--max-concurrent", type=int, default=6,
                        help="Max concurrent LLM calls (default: 6)")
    parser.add_argument("--max-retries", type=int, default=2,
                        help="Max retries per failed generation (default: 2)")
    args = parser.parse_args()

    if args.rebuild_first:
        print(f"\nRebuilding static resource library first...", flush=True)
        with SessionLocal() as db:
            total = rebuild_learning_resource_library(db)
            print(f"  Rebuilt with {total} rows.", flush=True)

    # Determine mode: targeted or full
    if args.job_title and args.dimension:
        dimension_label = PROMPT_DIMENSION_LABELS.get(args.dimension, args.dimension)
        phases = SUPPORTED_PHASE_KEYS if args.phase in (None, "all") else [args.phase]

        print(f"\nTargeted generation:", flush=True)
        print(f"  Job title: {args.job_title}", flush=True)
        print(f"  Dimension: {args.dimension} ({dimension_label})", flush=True)
        print(f"  Phases: {', '.join(phases)} (single LLM call for all 3 phases)")

        if args.check_only:
            for phase_key in phases:
                count = check_existing(args.job_title, args.dimension, phase_key)
                print(f"  [{args.job_title} / {args.dimension} / {phase_key}] count={count}", flush=True)
            return

        await run_targeted_generation(args.job_title, args.dimension, dimension_label, args.max_retries)

        print(f"\nVerification:")
        for phase_key in phases:
            count = check_existing(args.job_title, args.dimension, phase_key)
            print(f"  [{args.job_title} / {args.dimension} / {phase_key}] count={count}")

    else:
        if args.check_only:
            print(f"\nChecking all existing resources...", flush=True)
            check_results = check_all_existing()
            empty_count = 0
            full_count = 0
            total = len(check_results)
            for (job_title, dim_key, phase_key), count in sorted(check_results.items()):
                status = "OK" if count == 6 else f"MISSING ({count})"
                if count == 0:
                    empty_count += 1
                elif count == 6:
                    full_count += 1
                print(f"  {job_title} / {dim_key} / {phase_key}: {status}", flush=True)
            print(f"\nSummary: {full_count}/{total} populated, {empty_count} empty", flush=True)

            # Check for identical phases
            print(f"\nChecking phase content diversity...", flush=True)
            identical = 0
            for job_title in SUPPORTED_JOB_TITLES:
                for dim_key in JOB_PROFILE_FIELD_ORDER:
                    if check_phases_identical(job_title, dim_key):
                        identical += 1
            print(f"  Dimensions with identical content across phases: {identical}")
            return

        if args.force:
            await run_all_generation_force(args.max_concurrent, args.max_retries)
        else:
            await run_all_generation(args.max_concurrent, args.max_retries)


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
