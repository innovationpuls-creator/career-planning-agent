from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    CareerDevelopmentGoalCorrelationAnalysis,
    CareerDevelopmentGoalInsightCard,
    CareerDevelopmentGoalPathStage,
    CareerDevelopmentGoalPlanResultPayload,
    CareerDevelopmentGoalStrengthDirectionItem,
    CareerDevelopmentMatchReport,
)
from app.services.llm import ChatMessage, LLMClientError, OpenAICompatibleLLMClient


class CareerDevelopmentGoalPlanningError(RuntimeError):
    pass


StageHook = Callable[[str], Awaitable[None]]


# ─────────────────────────────────────────────────────────────
# Favorites
# ─────────────────────────────────────────────────────────────


def _normalize_target_value(value: str | None) -> str:
    return "".join(str(value or "").strip().lower().split())


def build_favorite_target_key(canonical_job_title: str, industry: str | None) -> str:
    return f"{_normalize_target_value(canonical_job_title)}::{_normalize_target_value(industry)}"


def serialize_report_snapshot(report: CareerDevelopmentMatchReport) -> str:
    return json.dumps(report.model_dump(mode="json"), ensure_ascii=False)


def deserialize_report_snapshot(raw: str) -> CareerDevelopmentMatchReport:
    return CareerDevelopmentMatchReport.model_validate(json.loads(raw))


def get_favorite_report_record(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> CareerDevelopmentFavoriteReport | None:
    statement = select(CareerDevelopmentFavoriteReport).where(
        CareerDevelopmentFavoriteReport.id == favorite_id,
        CareerDevelopmentFavoriteReport.user_id == user_id,
    )
    return db.scalar(statement)


def list_favorite_report_records(db: Session, *, user_id: int) -> list[CareerDevelopmentFavoriteReport]:
    statement = (
        select(CareerDevelopmentFavoriteReport)
        .where(CareerDevelopmentFavoriteReport.user_id == user_id)
        .order_by(CareerDevelopmentFavoriteReport.updated_at.desc(), CareerDevelopmentFavoriteReport.id.desc())
    )
    return list(db.scalars(statement).all())


def read_favorite_report_payload(record: CareerDevelopmentFavoriteReport) -> CareerDevelopmentFavoritePayload:
    return CareerDevelopmentFavoritePayload(
        favorite_id=record.id,
        target_key=build_favorite_target_key(record.canonical_job_title, record.industry),
        source_kind=record.source_kind,
        report_id=record.report_id,
        target_scope=record.target_scope,
        target_title=record.target_title,
        canonical_job_title=record.canonical_job_title,
        representative_job_title=record.representative_job_title,
        industry=record.industry,
        overall_match=round(float(record.overall_match or 0.0), 2),
        report_snapshot=deserialize_report_snapshot(record.report_snapshot_json),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def list_favorite_report_payloads(db: Session, *, user_id: int) -> list[CareerDevelopmentFavoritePayload]:
    return [read_favorite_report_payload(item) for item in list_favorite_report_records(db, user_id=user_id)]


def upsert_favorite_report(
    db: Session,
    *,
    user_id: int,
    source_kind: str,
    report: CareerDevelopmentMatchReport,
) -> CareerDevelopmentFavoritePayload:
    normalized_job_title = _normalize_target_value(report.canonical_job_title)
    normalized_industry = _normalize_target_value(report.industry)
    existing = db.scalar(
        select(CareerDevelopmentFavoriteReport).where(
            CareerDevelopmentFavoriteReport.user_id == user_id,
            CareerDevelopmentFavoriteReport.normalized_canonical_job_title == normalized_job_title,
            CareerDevelopmentFavoriteReport.normalized_industry == normalized_industry,
        ),
    )
    if existing is None:
        existing = CareerDevelopmentFavoriteReport(
            user_id=user_id,
            normalized_canonical_job_title=normalized_job_title,
            normalized_industry=normalized_industry,
        )

    existing.source_kind = source_kind
    existing.report_id = report.report_id
    existing.target_scope = report.target_scope
    existing.target_title = report.target_title
    existing.canonical_job_title = report.canonical_job_title
    existing.representative_job_title = report.representative_job_title
    existing.industry = report.industry
    existing.overall_match = report.overall_match
    existing.report_snapshot_json = serialize_report_snapshot(report)
    db.add(existing)
    db.commit()
    db.refresh(existing)
    return read_favorite_report_payload(existing)


def delete_favorite_report(db: Session, *, user_id: int, favorite_id: int) -> bool:
    record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if record is None:
        return False
    db.delete(record)
    db.commit()
    return True


# ─────────────────────────────────────────────────────────────
# Dify Career Goal Planning Client (V1 — used internally by build_goal_plan_result)
# ─────────────────────────────────────────────────────────────


CORRELATION_ANALYSIS_SYSTEM_PROMPT = """
你是一名职业目标关联性分析助手。你只能使用用户提供的材料进行分析，不能补造行业事实、岗位事实或个人经历。
请只输出 JSON，不要输出 Markdown、解释性前缀或代码块。JSON 必须严格包含以下结构：
{
  "foundation": {"summary": "string", "highlights": ["string"]},
  "gaps": {"summary": "string", "highlights": ["string"]},
  "path_impact": {"summary": "string", "highlights": ["string"]}
}
要求：
1. foundation 只写当前已具备的基础与优势，必须引用本地匹配报告中的契合度、优势维度、命中关键词或样本证据。
2. gaps 只写当前关键差距，必须引用本地匹配报告中的差距维度、缺失关键词或低契合数据。
3. path_impact 只写这些基础与差距对当前职业发展路径推进的影响，并结合趋势材料和路径材料。
4. 不允许输出行动建议，不允许编造新的职业阶段，不允许使用猜测性表述。
""".strip()
CORRELATION_ANALYSIS_USER_TEMPLATE = """
请基于以下材料，输出"关联性分析"JSON。
一、Dify 主文档材料
【社会需求与行业发展趋势】
{trend_section}

【职业发展路径】
{path_section}

二、本地职业探索与岗位匹配报告数据
{report_context}

请严格围绕"当前职业发展路径"回答，只能使用以上材料。
""".strip()
STRENGTH_DIRECTION_SYSTEM_PROMPT = """
你是一名职业路径支撑证据分析助手。你只能使用用户提供的材料进行分析，不能补造行业事实、岗位事实或个人经历。
请只输出 JSON 数组，不要输出 Markdown、解释性前缀或代码块。数组中每一项都必须包含以下字段：
{
  "title": "string",
  "summary": "string",
  "supporting_dimensions": ["string"],
  "matched_keywords": ["string"],
  "evidence_companies": ["string"],
  "supporting_metrics": ["string"],
  "reasoning": "string"
}
要求：
1. 这些内容要回答"为什么当前画像能支撑职业发展路径中的某一步"，不是泛泛而谈的个人优点。
2. supporting_dimensions 必须来自本地匹配报告已有维度名称。
3. matched_keywords 必须来自命中关键词，不允许编造。
4. evidence_companies 必须来自推荐岗位信息里的公司名，没有就返回空数组。
5. supporting_metrics 必须写清楚数值依据，例如契合度、差距、命中关键词数量、样本匹配度。
6. reasoning 只解释证据为什么成立，不输出行动建议。
7. 最多返回 4 条，至少返回 2 条。
""".strip()
STRENGTH_DIRECTION_USER_TEMPLATE = """
请基于以下材料，输出"路径支撑证据"JSON 数组。
一、Dify 主文档材料
【社会需求与行业发展趋势】
{trend_section}

【职业发展路径】
{path_section}

二、本地职业探索与岗位匹配报告数据
{report_context}

请将输出重点放在"哪些已有优势能够支撑当前职业路径中的阶段推进"，只能使用以上材料。
""".strip()
PATH_SECTION_KEYWORDS = ["职业发展路径", "职业路径", "发展路径", "路径规划"]
GENERIC_PATH_HEADING_KEYWORDS = [
    "职业发展路径",
    "职业路径",
    "发展路径",
    "路径规划",
    "典型晋升路径",
    "为什么这条路径成立",
    "为什么适合",
    "面临的挑战",
    "当前差距",
    "路径判断",
    "社会需求",
    "行业发展趋势",
    "综合报告",
    "结论",
]
PATH_ROLE_HINTS = ["工程师", "开发", "负责人", "专家", "架构师", "经理", "总监", "lead", "leader", "cto", "vp"]


@dataclass(slots=True)
class DifyGoalPlanningResult:
    conversation_id: str | None
    message_id: str
    answer: str


@dataclass(slots=True)
class DifyGoalPlanningRuntimeConfig:
    input_variables: list[str]


@dataclass(slots=True)
class MarkdownHeading:
    line_index: int
    level: int
    title: str


@dataclass(slots=True)
class ExtractedPathStage:
    title: str
    summary: str


# ─────────────────────────────────────────────────────────────
# V1 helpers — used by build_goal_plan_result
# ─────────────────────────────────────────────────────────────


def _normalize_target_value_v1(value: str | None) -> str:
    return "".join(str(value or "").strip().lower().split())


def _pick_strength_titles(report: CareerDevelopmentMatchReport) -> list[str]:
    return [d.dimension_name for d in (report.comparison_dimensions or []) if d.match_level == "strong" and d.source_value]


def _pick_gap_titles(report: CareerDevelopmentMatchReport) -> list[str]:
    return [d.dimension_name for d in (report.comparison_dimensions or []) if d.match_level == "weak" and d.source_value]


def _clean_markdown_title(title: str) -> str:
    return re.sub(r"^#+\s*", "", title).strip().strip(":.，,”\"")


def _normalize_markdown_title(title: str) -> str:
    return re.sub(r"\s+", " ", title).strip().strip(":：,.，,，\"")


def _parse_markdown_headings(markdown: str) -> list[MarkdownHeading]:
    result: list[MarkdownHeading] = []
    for i, raw_line in enumerate(markdown.splitlines()):
        stripped = raw_line.lstrip()
        if stripped.startswith("#"):
            level = len(raw_line) - len(stripped)
            result.append(MarkdownHeading(line_index=i, level=level, title=_normalize_markdown_title(stripped)))
    return result


def _extract_section_markdown(markdown: str, keywords: list[str]) -> str:
    headings = _parse_markdown_headings(markdown)
    for kw in keywords:
        for i, h in enumerate(headings):
            if kw in h.title:
                start = h.line_index + 1
                end = headings[i + 1].line_index if i + 1 < len(headings) else len(markdown.splitlines())
                return "\n".join(markdown.splitlines()[start:end]).strip()
    return ""


def _build_report_context(favorite: CareerDevelopmentFavoritePayload) -> str:
    report = favorite.report_snapshot
    lines = [
        f"目标岗位：{favorite.canonical_job_title}",
        f"目标行业：{favorite.industry or '不限'}",
        f"综合契合度：{favorite.overall_match}%",
        "",
        "优势维度：",
    ]
    for d in (report.comparison_dimensions or []):
        if d.match_level == "strong":
            lines.append(f"  - {d.dimension_name}（{d.source_value} vs 目标{d.target_value}）")
    lines.extend(["", "差距维度："])
    for d in (report.comparison_dimensions or []):
        if d.match_level == "weak":
            lines.append(f"  - {d.dimension_name}（{d.source_value} vs 目标{d.target_value}）")
    return "\n".join(lines)


def _extract_json_payload(text: str) -> dict[str, Any] | list[Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}


def _coerce_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if v]
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return []


def _normalize_insight_card_payload(payload: Any, fallback_summary: str = "") -> dict[str, Any]:
    if isinstance(payload, dict):
        return {
            "summary": str(payload.get("summary", fallback_summary)),
            "highlights": _coerce_string_list(payload.get("highlights", [])),
        }
    return {"summary": fallback_summary, "highlights": []}


def _normalize_correlation_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "foundation": _normalize_insight_card_payload(payload.get("foundation", {})),
        "gaps": _normalize_insight_card_payload(payload.get("gaps", {})),
        "path_impact": _normalize_insight_card_payload(payload.get("path_impact", {})),
    }


def _normalize_strength_direction_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": str(payload.get("title", "")),
        "summary": str(payload.get("summary", "")),
        "supporting_dimensions": _coerce_string_list(payload.get("supporting_dimensions", [])),
        "matched_keywords": _coerce_string_list(payload.get("matched_keywords", [])),
        "evidence_companies": _coerce_string_list(payload.get("evidence_companies", [])),
        "supporting_metrics": _coerce_string_list(payload.get("supporting_metrics", [])),
        "reasoning": str(payload.get("reasoning", "")),
    }


async def _call_llm_json(
    client: OpenAICompatibleLLMClient,
    system: str,
    user: str,
    *,
    json_schema: dict[str, Any] | None = None,
) -> dict[str, Any]:
    messages = [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)]
    raw = await client.chat(messages=messages, json_schema=json_schema, temperature=0.3)
    return _extract_json_payload(raw)


async def _build_correlation_analysis(
    llm_client: OpenAICompatibleLLMClient,
    *,
    favorite: CareerDevelopmentFavoritePayload,
    trend_section_markdown: str,
    path_section_markdown: str,
) -> CareerDevelopmentGoalCorrelationAnalysis:
    user_text = CORRELATION_ANALYSIS_USER_TEMPLATE.format(
        trend_section=trend_section_markdown,
        path_section=path_section_markdown,
        report_context=_build_report_context(favorite),
    )
    raw = await _call_llm_json(
        llm_client,
        system=CORRELATION_ANALYSIS_SYSTEM_PROMPT,
        user=user_text,
    )
    return CareerDevelopmentGoalCorrelationAnalysis.model_validate(_normalize_correlation_payload(raw))


async def _build_strength_directions(
    llm_client: OpenAICompatibleLLMClient,
    *,
    favorite: CareerDevelopmentFavoritePayload,
    trend_section_markdown: str,
    path_section_markdown: str,
) -> list[CareerDevelopmentGoalStrengthDirectionItem]:
    user_text = STRENGTH_DIRECTION_USER_TEMPLATE.format(
        trend_section=trend_section_markdown,
        path_section=path_section_markdown,
        report_context=_build_report_context(favorite),
    )
    raw = await _call_llm_json(
        llm_client,
        system=STRENGTH_DIRECTION_SYSTEM_PROMPT,
        user=user_text,
    )
    items = raw if isinstance(raw, list) else []
    normalized_items: list[CareerDevelopmentGoalStrengthDirectionItem] = []
    for item in items:
        normalized = CareerDevelopmentGoalStrengthDirectionItem.model_validate(
            _normalize_strength_direction_payload(item)
        )
        normalized_items.append(normalized)
    return normalized_items


def _find_section_heading(
    markdown: str, keywords: list[str]
) -> tuple[list[str], MarkdownHeading | None, list[MarkdownHeading]]:
    headings = _parse_markdown_headings(markdown)
    section_lines: list[str] = []
    target_heading: MarkdownHeading | None = None
    for i, h in enumerate(headings):
        if any(kw in h.title for kw in keywords):
            target_heading = h
            section_lines = markdown.splitlines()[h.line_index + 1 :]
            if i + 1 < len(headings):
                section_lines = markdown.splitlines()[h.line_index + 1 : headings[i + 1].line_index]
            break
    return section_lines, target_heading, headings


def _normalize_sentence(text: str, max_length: int = 54) -> str:
    text = text.strip().strip("。.”\"'")
    if len(text) <= max_length:
        return text
    return text[: max_length - 1].rstrip(",，、..") + "…"


def _is_generic_path_heading(title: str) -> bool:
    return any(kw in title for kw in GENERIC_PATH_HEADING_KEYWORDS)


def _looks_like_role_title(title: str) -> bool:
    return any(hint in title for hint in PATH_ROLE_HINTS)


def _clean_path_segment(segment: str) -> str:
    lines = [l.strip().strip("-–*# ") for l in segment.strip().splitlines() if l.strip()]
    return " ".join(lines)


def _default_stage_summary(title: str, index: int, total: int) -> str:
    if _looks_like_role_title(title):
        return f"在 {total} 年内成为 {title}，逐步积累相关经验与技能。"
    return f"第 {index} 步：{title}。"


def _extract_inline_path_stages(path_lines: list[str], fallback_title: str) -> list[ExtractedPathStage]:
    stages: list[ExtractedPathStage] = []
    current_title = fallback_title
    current_body: list[str] = []
    for line in path_lines:
        stripped = line.strip()
        if not stripped:
            continue
        h_match = re.match(r"^(#{1,3})\s+(.+)$", stripped)
        if h_match:
            if current_body:
                stages.append(ExtractedPathStage(title=current_title, summary=_clean_path_segment("\n".join(current_body))))
            heading_text = _normalize_markdown_title(h_match.group(2))
            if not _is_generic_path_heading(heading_text):
                current_title = heading_text
                current_body = []
        else:
            current_body.append(stripped)
    if current_body:
        stages.append(ExtractedPathStage(title=current_title, summary=_clean_path_segment("\n".join(current_body))))
    return stages


def _section_lines(markdown: str, keywords: list[str]) -> list[str]:
    section, heading, _ = _find_section_heading(markdown, keywords)
    return section


def _summarize_stage_body(lines: list[str]) -> str:
    body = " ".join(l.strip().strip("-–*# ") for l in lines if l.strip())
    return _normalize_sentence(body)


def _extract_stage_entries(path_section_markdown: str, fallback_title: str) -> list[ExtractedPathStage]:
    all_path_lines = _section_lines(path_section_markdown, PATH_SECTION_KEYWORDS)
    return _extract_inline_path_stages(all_path_lines, fallback_title)


def _stage_label(step: int, total: int) -> str:
    if total <= 1:
        return "当前阶段"
    if step == 1:
        return "第一阶段"
    if step == 2:
        return "第二阶段"
    return f"第 {step} 阶段"


def _build_supporting_pool(
    favorite: CareerDevelopmentFavoritePayload,
    strength_titles: list[str],
) -> list[str]:
    pool: list[str] = []
    for d in (favorite.report_snapshot.comparison_dimensions or []):
        if d.dimension_name in strength_titles and d.source_value:
            pool.append(f"{d.dimension_name}（当前：{d.source_value}）")
    pool.extend([kw for kw in (favorite.report_snapshot.strength_dimensions or []) if kw])
    return pool


def _build_gap_pool(
    favorite: CareerDevelopmentFavoritePayload,
    gap_titles: list[str],
) -> list[str]:
    pool: list[str] = []
    for d in (favorite.report_snapshot.comparison_dimensions or []):
        if d.dimension_name in gap_titles and d.source_value:
            pool.append(f"{d.dimension_name}（当前：{d.source_value}，目标：{d.target_value}）")
    pool.extend([kw for kw in (favorite.report_snapshot.priority_gap_dimensions or []) if kw])
    return pool


def _rotate_pick(pool: list[str], start: int, size: int) -> list[str]:
    if not pool:
        return []
    return pool[start % len(pool) : start % len(pool) + size]


def _build_focus_tag_pool(favorite: CareerDevelopmentFavoritePayload) -> list[str]:
    tags: list[str] = []
    for d in (favorite.report_snapshot.comparison_dimensions or []):
        if d.match_level == "medium" and d.source_value:
            tags.append(d.dimension_name)
    tags.extend([kw for kw in (favorite.report_snapshot.priority_gap_dimensions or []) if kw])
    return tags


def _build_focus_tags(
    step: int,
    total: int,
    *,
    strength_pool: list[str],
    gap_pool: list[str],
    focus_pool: list[str],
    readiness_label: str,
    gap_notes: list[str],
) -> list[str]:
    tags: list[str] = []
    strength_count = 2 if total <= 2 else 1
    gap_count = 2 if total <= 2 else 1
    tags.extend(_rotate_pick(strength_pool, step * 3, strength_count))
    tags.extend(_rotate_pick(gap_pool, step * 5, gap_count))
    if readiness_label in {"中等准备", "高准备"}:
        tags.extend(_rotate_pick(focus_pool, step * 7, 1))
    if gap_notes:
        tags.append(gap_notes[step % len(gap_notes)])
    return list(dict.fromkeys(tags))[:5]


def _build_readiness_label(index: int, total: int, gap_notes: list[str]) -> str:
    if total == 1:
        return "当前目标"
    if not gap_notes:
        return f"第 {index} 阶段"
    if index == 1:
        return "第一阶段（基础期）"
    if index == total:
        return f"第 {index} 阶段（长期目标）"
    return f"第 {index} 阶段（过渡期）"


def _build_path_stages(
    favorite: CareerDevelopmentFavoritePayload,
    path_section_markdown: str,
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis,
) -> list[CareerDevelopmentGoalPathStage]:
    strength_titles = [d.title for d in strength_directions]
    gap_titles = [d.dimension_name for d in (favorite.report_snapshot.comparison_dimensions or []) if d.match_level == "weak"]
    entries = _extract_stage_entries(path_section_markdown, favorite.canonical_job_title)
    if not entries:
        return [
            CareerDevelopmentGoalPathStage(
                step=1,
                title=favorite.canonical_job_title,
                stage_label="当前目标",
                rationale=f"基于{_normalize_sentence(correlation_analysis.foundation.summary, 60)}建立。",
            )
        ]
    total = len(entries)
    strength_pool = _build_supporting_pool(favorite, strength_titles)
    gap_pool = _build_gap_pool(favorite, gap_titles)
    focus_pool = _build_focus_tag_pool(favorite)
    gap_notes = [str(n) for n in (favorite.report_snapshot.priority_gap_dimensions or [])]
    result: list[CareerDevelopmentGoalPathStage] = []
    for i, entry in enumerate(entries, start=1):
        readiness = _build_readiness_label(i, total, gap_notes)
        focus_tags = _build_focus_tags(i, total, strength_pool=strength_pool, gap_pool=gap_pool, focus_pool=focus_pool, readiness_label=readiness, gap_notes=gap_notes)
        rationale = _normalize_sentence(entry.summary or _default_stage_summary(entry.title, i, total), 120)
        if i == 1 and correlation_analysis.foundation.summary:
            rationale = f"基于{_normalize_sentence(correlation_analysis.foundation.summary, 80)}，当前优先：{rationale}"
        result.append(
            CareerDevelopmentGoalPathStage(
                step=i,
                title=entry.title or favorite.canonical_job_title,
                stage_label=_stage_label(i, total),
                rationale=rationale,
            )
        )
    return result


def _compact_markdown(markdown: str, *, max_lines: int = 10, max_chars: int = 420) -> str:
    lines = markdown.splitlines()
    compact = lines[:max_lines]
    text = "\n".join(compact)
    if len(text) > max_chars:
        text = text[:max_chars].rstrip(",，、.\n ") + "…"
    return text


def _format_highlights(card: CareerDevelopmentGoalInsightCard) -> str:
    highlights = card.highlights or []
    if not highlights:
        return "暂无。"
    return "；".join(f"{i + 1}. {h}" for i, h in enumerate(highlights))


def _format_strength_direction_items(
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
) -> str:
    parts: list[str] = []
    for item in strength_directions:
        companies = "、".join(item.evidence_companies[:3]) if item.evidence_companies else ""
        companies_line = f"（来源：{companies}）" if companies else ""
        parts.append(f"- **{item.title}**：{item.summary}{companies_line}")
    return "\n".join(parts) if parts else "暂无支撑证据。"


def build_comprehensive_report_markdown_content(
    *,
    trend_section_markdown: str,
    path_section_markdown: str,
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis,
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
) -> str:
    gap_summary = _format_highlights(correlation_analysis.gaps)
    foundation_summary = _format_highlights(correlation_analysis.foundation)
    strength_block = _format_strength_direction_items(strength_directions)
    conclusion_parts: list[str] = []
    for item in strength_directions[:2]:
        if item.summary:
            conclusion_parts.append(_normalize_sentence(item.summary, 80))
    return "\n".join(
        [
            "# 综合报告",
            "## 当前发展路径判断",
            _compact_markdown(trend_section_markdown),
            "",
            "## 为什么这条路径成立",
            _compact_markdown(path_section_markdown),
            "",
            "## 关联性分析",
            "### 已有基础与优势",
            _format_highlights(correlation_analysis.foundational),
            "",
            "### 当前差距",
            gap_summary,
            "",
            "## 重点补强方向",
            strength_block,
            "",
            "## 当前差距对路径推进的影响",
            _format_highlights(correlation_analysis.gaps),
            "",
            "当前差距对路径推进的影响：\n" + _format_highlights(correlation_analysis.path_impact) + "\n\n优先补强点：\n" + gap_summary,
            "## 结论\n" + "；".join(part for part in conclusion_parts if part).strip("；"),
        ]
    ).strip()


async def _build_comprehensive_report_markdown(
    llm_client: OpenAICompatibleLLMClient,
    *,
    trend_section_markdown: str,
    path_section_markdown: str,
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis,
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
) -> str:
    del llm_client
    return build_comprehensive_report_markdown_content(
        trend_section_markdown=trend_section_markdown,
        path_section_markdown=path_section_markdown,
        correlation_analysis=correlation_analysis,
        strength_directions=strength_directions,
    )


async def _emit_stage(stage_hook: StageHook | None, stage: str) -> None:
    if stage_hook is not None:
        await stage_hook(stage)


# ─────────────────────────────────────────────────────────────
# Dify Career Goal Planning Client
# ─────────────────────────────────────────────────────────────


class DifyCareerGoalPlanningClient:
    def __init__(self) -> None:
        self.base_url = settings.dify_api_base_url.rstrip("/")
        self.api_key = settings.dify_api_key

    async def generate_trend_markdown(
        self,
        favorite: CareerDevelopmentFavoritePayload,
        user: str,
    ) -> DifyGoalPlanningResult:
        payload = {
            "inputs": {
                "job_title": favorite.canonical_job_title,
                "industry": favorite.industry or "",
                "overall_match": str(favorite.overall_match),
                "top_strength_keywords": ", ".join(favorite.report_snapshot.strength_dimensions[:5]),
                "top_gap_keywords": ", ".join(favorite.report_snapshot.priority_gap_dimensions[:5]),
            },
            "query": f"请为 {favorite.canonical_job_title} 提供【{favorite.industry or "不限行业"}】的职业发展路径和社会需求分析。",
            "user": user,
            "response_mode": "blocking",
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{self.base_url}/app/messages", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            answer = data.get("answer", "")
            conversation_id = data.get("conversation_id")
            message_id = data.get("id", "")
            return DifyGoalPlanningResult(conversation_id=conversation_id, message_id=message_id, answer=answer)

    async def aclose(self) -> None:
        pass


async def build_goal_plan_result(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    stage_hook: StageHook | None = None,
) -> tuple[CareerDevelopmentGoalPlanResultPayload, str | None]:
    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        raise CareerDevelopmentGoalPlanningError("收藏目标不存在或无权访问。")

    favorite = read_favorite_report_payload(favorite_record)
    dify_client = DifyCareerGoalPlanningClient()
    llm_client = OpenAICompatibleLLMClient.from_settings()
    try:
        dify_result = await dify_client.generate_trend_markdown(
            favorite=favorite,
            user=f"career-goal-{user_id}-{favorite.favorite_id}",
        )
        trend_section_markdown = dify_result.answer
        path_source_markdown = (
            _extract_section_markdown(dify_result.answer, PATH_SECTION_KEYWORDS)
            or dify_result.answer
        )
        path_section_markdown = ""

        await _emit_stage(stage_hook, "dify_complete")
        await _emit_stage(stage_hook, "correlation")
        correlation_analysis = await _build_correlation_analysis(
            llm_client,
            favorite=favorite,
            trend_section_markdown=trend_section_markdown,
            path_section_markdown=path_source_markdown,
        )

        await _emit_stage(stage_hook, "strengths")
        strength_directions = await _build_strength_directions(
            llm_client,
            favorite=favorite,
            trend_section_markdown=trend_section_markdown,
            path_section_markdown=path_source_markdown,
        )

        await _emit_stage(stage_hook, "comprehensive")
        comprehensive_report_markdown = await _build_comprehensive_report_markdown(
            llm_client,
            trend_section_markdown=trend_section_markdown,
            path_section_markdown=path_source_markdown,
            correlation_analysis=correlation_analysis,
            strength_directions=strength_directions,
        )

        return (
            CareerDevelopmentGoalPlanResultPayload(
                favorite=favorite,
                trend_markdown=dify_result.answer,
                trend_section_markdown=trend_section_markdown,
                path_section_markdown=path_section_markdown,
                correlation_analysis=correlation_analysis,
                strength_directions=strength_directions,
                path_stages=_build_path_stages(
                    favorite,
                    path_section_markdown=path_source_markdown,
                    strength_directions=strength_directions,
                    correlation_analysis=correlation_analysis,
                ),
                comprehensive_report_markdown=comprehensive_report_markdown,
                path_nodes=[],
                stage_recommendations=[],
            ),
            dify_result.conversation_id,
        )
    finally:
        await dify_client.aclose()
        await llm_client.aclose()
