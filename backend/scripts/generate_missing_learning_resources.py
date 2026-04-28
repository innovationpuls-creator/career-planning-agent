from __future__ import annotations

import argparse
import asyncio
import json
import sys

from app.db.session import SessionLocal
from app.models.snail_learning_resource_library import SnailLearningResourceLibrary
from app.services.llm import ChatMessage, OpenAICompatibleLLMClient
from app.services.snail_learning_resource_library import (
    SUPPORTED_PHASE_KEYS,
    get_learning_resources,
    rebuild_learning_resource_library,
)


GENERATION_PROMPT = """你是一个职业学习资源推荐专家。请为「{job_title}」岗位的「{dimension_label}」能力维度推荐 6 个高质量学习资源。

要求：
1. 返回 JSON 数组，每个元素包含 title、url、reason 三个字段
2. title：资源名称，简短且可识别
3. url：真实可访问的 URL
4. reason：推荐理由，20-40 字，需结合「{job_title}」岗位场景和「{dimension_label}」维度说明为什么这个资源有帮助
5. 资源应覆盖不同的学习形式（文档、课程、社区、工具等）
6. 优先中文可访问资源，如果同类资源只有英文版的也可以用
7. 必须是知名、稳定的学习平台或资源
8. 数组长度严格为 6

示例格式：
[
  {{
    "title": "示例资源名称",
    "url": "https://example.com/learn",
    "reason": "适合{job_title}岗位补齐{dimension_label}维度能力的系统化学习路径。"
  }}
]
"""

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
    "other_special": "其他/特殊要求（证书、语言、出差驻场、班次、驾照、特殊准入等）",
}

PHASE_REASON_SUFFIX = {
    "short_term": "适合当前阶段先补基础，帮你尽快建立可执行的入门框架。",
    "mid_term": "适合当前阶段把知识转成项目、协作或真实任务中的可用方法。",
    "long_term": "适合当前阶段持续深化，帮助你把这项能力沉淀成长期竞争力。",
}


def check_existing(
    job_title: str,
    dimension_key: str,
    phase_key: str | None = None,
) -> None:
    with SessionLocal() as db:
        if phase_key:
            resources = get_learning_resources(db, canonical_job_title=job_title, dimension_key=dimension_key, phase_key=phase_key)
            print(f"  [{job_title} / {dimension_key} / {phase_key}] count={len(resources)}", flush=True)
        else:
            for pk in SUPPORTED_PHASE_KEYS:
                resources = get_learning_resources(db, canonical_job_title=job_title, dimension_key=dimension_key, phase_key=pk)
                print(f"  [{job_title} / {dimension_key} / {pk}] count={len(resources)}", flush=True)


async def generate_resources(
    client: OpenAICompatibleLLMClient,
    job_title: str,
    dimension_key: str,
    dimension_label: str,
) -> list[dict]:
    prompt = GENERATION_PROMPT.format(job_title=job_title, dimension_label=dimension_label)
    messages = [ChatMessage(role="user", content=prompt)]

    try:
        result = await client.chat_completion_structured(messages, temperature=0.3)
    except Exception as exc:
        print(f"  [ERROR] LLM call failed: {exc}", flush=True)
        return []

    items = result if isinstance(result, list) else result.get("items", result.get("resources", []))
    if not isinstance(items, list):
        print(f"  [ERROR] Unexpected response format: {json.dumps(result, ensure_ascii=False)[:200]}", flush=True)
        return []

    validated: list[dict] = []
    for item in items:
        if isinstance(item, dict) and item.get("title") and item.get("url") and item.get("reason"):
            validated.append({"title": item["title"], "url": item["url"], "reason": item["reason"]})

    return validated


async def persist_resources(
    db: SessionLocal,
    job_title: str,
    dimension_key: str,
    resources: list[dict],
    phase_key: str,
) -> int:
    from datetime import datetime, timezone

    from sqlalchemy import delete

    # Remove existing resources for this combination first
    db.execute(
        delete(SnailLearningResourceLibrary).where(
            SnailLearningResourceLibrary.canonical_job_title == job_title,
            SnailLearningResourceLibrary.dimension_key == dimension_key,
            SnailLearningResourceLibrary.phase_key == phase_key,
        )
    )

    now = datetime.now(timezone.utc)
    rows = [
        SnailLearningResourceLibrary(
            canonical_job_title=job_title,
            dimension_key=dimension_key,
            phase_key=phase_key,
            rank=rank + 1,
            site_title=item["title"],
            site_url=item["url"],
            reason=f"{item['reason']} 这条资源围绕「{job_title}」的「{DIMENSION_LABELS.get(dimension_key, dimension_key)}」能力设计，{PHASE_REASON_SUFFIX[phase_key]}",
            created_at=now,
            updated_at=now,
        )
        for rank, item in enumerate(resources)
    ]
    db.add_all(rows)
    db.commit()
    return len(rows)


async def main_async() -> None:
    parser = argparse.ArgumentParser(description="Generate learning resources for missing job/dimension combinations via LLM.")
    parser.add_argument("--job-title", default="Java", help="Canonical job title (default: Java)")
    parser.add_argument("--dimension", default="other_special", help="Dimension key (default: other_special)")
    parser.add_argument("--phase", default=None, choices=["short_term", "mid_term", "long_term", "all"],
                        help="Phase key (default: all)")
    parser.add_argument("--rebuild-first", action="store_true", help="Rebuild static library before checking")
    parser.add_argument("--check-only", action="store_true", help="Only check existing resources, don't generate")
    args = parser.parse_args()

    job_title = args.job_title
    dimension_key = args.dimension
    dimension_label = DIMENSION_LABELS.get(dimension_key, dimension_key)
    phases = SUPPORTED_PHASE_KEYS if args.phase in (None, "all") else [args.phase]

    if args.rebuild_first:
        print(f"\nRebuilding static resource library...", flush=True)
        with SessionLocal() as db:
            total = rebuild_learning_resource_library(db)
            print(f"  Rebuilt with {total} rows.", flush=True)

    print(f"\nChecking existing resources for: {job_title} / {dimension_key}", flush=True)
    for phase_key in phases:
        check_existing(job_title, dimension_key, phase_key)

    if args.check_only:
        return

    print(f"\nGenerating resources via LLM for: {job_title} / {dimension_key} / {', '.join(phases)}", flush=True)
    try:
        client = OpenAICompatibleLLMClient.from_settings()
    except Exception as exc:
        print(f"  [ERROR] LLM not configured: {exc}", flush=True)
        print("  Please configure LLM settings in backend/.env or root .env", flush=True)
        sys.exit(1)

    try:
        generated = await generate_resources(client, job_title, dimension_key, dimension_label)
        if not generated:
            print(f"  [ERROR] No valid resources generated from LLM.", flush=True)
            return

        print(f"  Generated {len(generated)} resources:", flush=True)
        for i, item in enumerate(generated, 1):
            print(f"    {i}. {item['title']} - {item['url']}", flush=True)

        with SessionLocal() as db:
            for phase_key in phases:
                count = await persist_resources(db, job_title, dimension_key, generated, phase_key)
                print(f"  Persisted {count} resources for phase '{phase_key}'.", flush=True)

        print(f"\nVerification after generation:", flush=True)
        for phase_key in phases:
            check_existing(job_title, dimension_key, phase_key)

    finally:
        await client.aclose()

    print(f"\nDone. Generated and persisted resources for {job_title} / {dimension_key}.", flush=True)


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
