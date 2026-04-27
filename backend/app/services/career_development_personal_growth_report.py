from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.career_development_personal_growth_report_task import (
    CareerDevelopmentPersonalGrowthReportTask,
)
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    CareerDevelopmentGoalCorrelationAnalysis,
    CareerDevelopmentGoalInsightCard,
    CareerDevelopmentGoalPlanResultPayload,
    CareerDevelopmentGoalStrengthDirectionItem,
    GrowthPlanCurrentLearningStep,
    GrowthPlanPhase,
    GrowthPlanPhaseFlowItem,
    PersonalGrowthReportPayload,
    PersonalGrowthReportSection,
    PersonalGrowthReportSectionKey,
    PersonalGrowthReportStoredPayload,
    PersonalGrowthReportTaskPayload,
    PersonalGrowthReportTaskResult,
    PersonalGrowthReportTaskSummary,
    PlanExportMeta,
    PlanWorkspacePayload,
)
from app.services.career_development_goal_planning import (
    get_favorite_report_record,
    list_favorite_report_records,
    read_favorite_report_payload,
)
from app.services.career_development_learning_resources import (
    generate_learning_resources_for_phases,
)
from app.services.career_development_plan_workspace import (
    build_default_review_framework,
    build_growth_plan_phases,
    build_plan_workspace_payload,
    export_docx_bytes,
    export_markdown_bytes,
    export_pdf_bytes,
    get_or_create_plan_workspace,
    get_plan_workspace_record,
    normalize_goal_plan_result,
    upsert_workspace_from_goal_plan_result,
)
from app.services.llm import ChatMessage, LLMClientError, OpenAICompatibleLLMClient
from app.services.student_competency_latest_analysis import (
    get_student_competency_latest_profile_record,
    read_student_competency_latest_analysis,
)
from app.services.student_profile import get_student_profile, serialize_student_profile

UTC = timezone.utc

PERSONAL_GROWTH_REPORT_TITLE = "个人职业成长报告"
PERSONAL_GROWTH_TASK_TERMINAL_STATUSES = {"completed", "cancelled", "failed"}

PERSONAL_GROWTH_SECTION_ORDER: list[PersonalGrowthReportSectionKey] = [
    "self_cognition",
    "career_direction_analysis",
    "match_assessment",
    "development_suggestions",
    "action_plan",
]

PERSONAL_GROWTH_SECTION_TITLES: dict[PersonalGrowthReportSectionKey, str] = {
    "self_cognition": "自我认知",
    "career_direction_analysis": "职业方向分析",
    "match_assessment": "匹配度判断",
    "development_suggestions": "发展建议",
    "action_plan": "行动计划",
}

PERSONAL_GROWTH_SECTION_KEYWORDS: dict[PersonalGrowthReportSectionKey, list[str]] = {
    "self_cognition": ["自我认知", "兴趣", "优势", "性格", "能力特点", "我的优势"],
    "career_direction_analysis": ["职业方向分析", "职业方向", "行业方向", "岗位类型", "发展方向", "目标定位"],
    "match_assessment": ["匹配度判断", "匹配度分析", "匹配情况", "差距分析", "当前短板", "职业匹配"],
    "development_suggestions": ["发展建议", "提升建议", "补短板建议", "学习重点", "重点提升"],
    "action_plan": ["行动计划", "短期行动", "中期行动", "长期行动", "阶段计划"],
}

PERSONAL_GROWTH_REQUIRED_SECTION_KEYS: set[PersonalGrowthReportSectionKey] = {
    "self_cognition",
    "match_assessment",
    "action_plan",
}

PERSONAL_GROWTH_PREREQUISITE_HINTS: dict[str, str] = {
    "favorite": "请先在职业匹配结果中选择并收藏一个目标岗位。",
    "profile": "请先在首页补充“我的资料”：姓名、学校、专业、学历、年级、目标岗位。",
    "analysis": "请先在“简历解析”页面完成一次最新的 12 维解析。",
    "gap_evidence": "请先生成职业匹配结果，确保包含提升建议和与目标岗位的差距分析。",
}


def utc_now() -> datetime:
    return datetime.now(UTC)


def _json_dumps(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _json_loads(raw: str) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _safe_json(payload: Any) -> str:
    if payload is None:
        return ""
    try:
        return json.dumps(payload, ensure_ascii=False, indent=2)
    except TypeError:
        return str(payload)


def _join_non_empty(parts: list[str]) -> str:
    return "\n\n".join(part for part in parts if _normalize_text(part))


def _bullet_lines(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items if _normalize_text(item))


def _normalize_heading(value: str) -> str:
    return re.sub(r"\s+", "", (value or "")).lower()


def _build_section(
    key: PersonalGrowthReportSectionKey,
    content: str = "",
) -> PersonalGrowthReportSection:
    normalized = _normalize_text(content)
    return PersonalGrowthReportSection(
        key=key,
        title=PERSONAL_GROWTH_SECTION_TITLES[key],
        content=normalized,
        completed=bool(normalized),
    )


def recompute_section_completion(
    sections: list[PersonalGrowthReportSection],
) -> list[PersonalGrowthReportSection]:
    return [_build_section(section.key, section.content) for section in sections]


def ensure_fixed_section_order(
    sections: list[PersonalGrowthReportSection],
) -> list[PersonalGrowthReportSection]:
    section_map = {section.key: section for section in sections if section.key in PERSONAL_GROWTH_SECTION_ORDER}
    ordered: list[PersonalGrowthReportSection] = []
    for key in PERSONAL_GROWTH_SECTION_ORDER:
        current = section_map.get(key)
        ordered.append(_build_section(key, current.content if current else ""))
    return ordered


def _empty_sections() -> list[PersonalGrowthReportSection]:
    return ensure_fixed_section_order([])


def _has_any_content(sections: list[PersonalGrowthReportSection]) -> bool:
    return any(section.completed for section in sections)


def _find_section_key_by_heading(title: str) -> PersonalGrowthReportSectionKey | None:
    normalized_title = _normalize_heading(title)
    for key, aliases in PERSONAL_GROWTH_SECTION_KEYWORDS.items():
        if any(_normalize_heading(alias) in normalized_title for alias in aliases):
            return key
    return None


def _strip_markdown_code_fence(markdown: str) -> str:
    text = _normalize_text(markdown)
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    if len(lines) >= 2 and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1]).strip()
    return text


def _extract_markdown_sections(markdown: str) -> list[PersonalGrowthReportSection]:
    cleaned_markdown = _strip_markdown_code_fence(markdown)
    if not cleaned_markdown:
        return _empty_sections()

    matches = re.findall(r"(?:^|\n)##\s+([^\n]+)\n([\s\S]*?)(?=\n##\s+|$)", cleaned_markdown)
    section_map: dict[PersonalGrowthReportSectionKey, str] = {}
    for title, content in matches:
        key = _find_section_key_by_heading(title)
        if key and key not in section_map:
            section_map[key] = content.strip()

    return ensure_fixed_section_order(
        [_build_section(key, content) for key, content in section_map.items()]
    )


def _parse_growth_plan_phases(raw_payload: dict[str, Any]) -> list[GrowthPlanPhase]:
    raw_phases = raw_payload.get("growth_plan_phases")
    if not isinstance(raw_phases, list):
        return []
    phases: list[GrowthPlanPhase] = []
    for item in raw_phases:
        if not isinstance(item, dict):
            continue
        try:
            phases.append(GrowthPlanPhase.model_validate(item))
        except Exception:
            continue
    return phases


def _load_current_growth_plan_phases(row: CareerDevelopmentPlanWorkspace) -> list[GrowthPlanPhase]:
    return _parse_growth_plan_phases(_json_loads(row.current_plan_json))


def _load_generated_growth_plan_phases(row: CareerDevelopmentPlanWorkspace) -> list[GrowthPlanPhase]:
    return _parse_growth_plan_phases(_json_loads(row.generated_plan_json))


def _format_phase_block(phase: GrowthPlanPhase) -> str:
    lines = [
        f"- 时间范围：{phase.time_horizon}",
        f"- 阶段目标：{phase.goal_statement}",
    ]
    learning_topics = [module.topic for module in phase.learning_modules[:3] if _normalize_text(module.topic)]
    if learning_topics:
        lines.append(f"- 学习重点：{'、'.join(learning_topics)}")
    practice_titles = [action.title for action in phase.practice_actions[:3] if _normalize_text(action.title)]
    if practice_titles:
        lines.append(f"- 实践动作：{'、'.join(practice_titles)}")
    deliverables = [item for item in phase.deliverables[:3] if _normalize_text(item)]
    if deliverables:
        lines.append(f"- 阶段成果：{'、'.join(deliverables)}")
    return "\n".join(lines)


def _build_base_sections_from_workspace(
    *,
    favorite: CareerDevelopmentFavoritePayload,
    row: CareerDevelopmentPlanWorkspace,
) -> list[PersonalGrowthReportSection]:
    phases = _load_current_growth_plan_phases(row) or _load_generated_growth_plan_phases(row)
    strengths = (
        favorite.report_snapshot.narrative.strength_highlights
        if favorite.report_snapshot.narrative
        else []
    )
    gaps = (
        favorite.report_snapshot.narrative.priority_gap_highlights
        if favorite.report_snapshot.narrative
        else []
    )
    advice_lines: list[str] = []
    for item in favorite.report_snapshot.action_advices[:3]:
        if _normalize_text(item.title):
            advice_lines.append(item.title)
        advice_lines.extend(action for action in item.next_actions[:2] if _normalize_text(action))

    phase_blocks = [f"### {phase.phase_label}\n{_format_phase_block(phase)}" for phase in phases[:3]]

    sections = [
        _build_section(
            "self_cognition",
            _bullet_lines(strengths[:4]) or "结合现有画像补充兴趣、优势、性格和能力特点。",
        ),
        _build_section(
            "career_direction_analysis",
            _bullet_lines(
                [
                    f"目标岗位：{favorite.canonical_job_title}",
                    f"目标方向：{favorite.target_title}",
                    f"目标行业：{favorite.industry}" if favorite.industry else "",
                ]
            ),
        ),
        _build_section(
            "match_assessment",
            _bullet_lines(gaps[:4]) or "结合职业匹配结果补充匹配项与关键差距。",
        ),
        _build_section(
            "development_suggestions",
            _bullet_lines(advice_lines[:6]) or "结合提升建议补充重点提升方向与补短板策略。",
        ),
        _build_section(
            "action_plan",
            "\n\n".join(block for block in phase_blocks if _normalize_text(block)),
        ),
    ]
    return ensure_fixed_section_order(sections)

def load_personal_growth_generated_payload(
    row: CareerDevelopmentPlanWorkspace,
) -> PersonalGrowthReportStoredPayload:
    raw = _json_loads(row.personal_growth_report_generated_payload_json)
    try:
        payload = PersonalGrowthReportStoredPayload.model_validate(raw)
    except Exception:
        payload = PersonalGrowthReportStoredPayload()
    sections = ensure_fixed_section_order(payload.sections)
    if not _has_any_content(sections):
        sections = _extract_markdown_sections(row.personal_growth_report_generated_markdown)
    payload.sections = ensure_fixed_section_order(sections)
    return payload


def load_personal_growth_current_payload(
    row: CareerDevelopmentPlanWorkspace,
) -> PersonalGrowthReportStoredPayload:
    raw = _json_loads(row.personal_growth_report_current_payload_json)
    try:
        payload = PersonalGrowthReportStoredPayload.model_validate(raw)
    except Exception:
        payload = PersonalGrowthReportStoredPayload()
    sections = ensure_fixed_section_order(payload.sections)
    if not _has_any_content(sections):
        sections = _extract_markdown_sections(row.personal_growth_report_edited_markdown)
    payload.sections = ensure_fixed_section_order(sections)
    return payload


def render_personal_growth_report_markdown(
    sections: list[PersonalGrowthReportSection],
    *,
    title: str = PERSONAL_GROWTH_REPORT_TITLE,
) -> str:
    ordered = ensure_fixed_section_order(sections)
    blocks = [f"# {title}"]
    for section in ordered:
        blocks.append(f"## {section.title}\n{_normalize_text(section.content) or '暂无内容'}")
    return "\n\n".join(blocks).strip()


def render_personal_growth_report_export_markdown(
    sections: list[PersonalGrowthReportSection],
) -> str:
    return render_personal_growth_report_markdown(sections, title=PERSONAL_GROWTH_REPORT_TITLE)


def _parse_personal_growth_export_meta(row: CareerDevelopmentPlanWorkspace) -> PlanExportMeta:
    raw = _json_loads(row.personal_growth_report_export_meta_json)
    try:
        return PlanExportMeta.model_validate(raw)
    except Exception:
        return PlanExportMeta()


def _update_personal_growth_export_meta(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    export_format: str,
    exported_with_issues: bool,
    blocking_count: int,
) -> None:
    meta = _parse_personal_growth_export_meta(row)
    meta.last_exported_format = export_format
    meta.last_exported_at = utc_now()
    meta.last_exported_with_issues = exported_with_issues
    meta.last_exported_blocking_count = max(blocking_count, 0)
    row.personal_growth_report_export_meta_json = _json_dumps(meta.model_dump(mode="json"))
    db.add(row)
    db.commit()
    db.refresh(row)


def _personal_growth_content_status(sections: list[PersonalGrowthReportSection]) -> str:
    required_completed = all(
        section.completed
        for section in ensure_fixed_section_order(sections)
        if section.key in PERSONAL_GROWTH_REQUIRED_SECTION_KEYS
    )
    return "ready" if required_completed else "insufficient"


def _personal_growth_generation_status(
    *,
    current_sections: list[PersonalGrowthReportSection],
    generated_sections: list[PersonalGrowthReportSection],
) -> str:
    if _has_any_content(current_sections) or _has_any_content(generated_sections):
        return "ready"
    return "not_started"


def _loads_task_result(raw: str) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def build_personal_growth_task_snapshot(
    row: CareerDevelopmentPersonalGrowthReportTask,
) -> PersonalGrowthReportTaskPayload:
    latest_event_payload = _json_loads(row.last_event_json)
    result_payload = _loads_task_result(row.result_json)
    return PersonalGrowthReportTaskPayload(
        task_id=row.id,
        favorite_id=row.favorite_id,
        status=row.status,
        progress=row.progress,
        overwrite_current=bool(row.overwrite_current),
        latest_event=latest_event_payload or None,
        result=PersonalGrowthReportTaskResult.model_validate(result_payload) if result_payload else None,
        error_message=_normalize_text(row.error_message) or None,
        cancel_requested_at=row.cancel_requested_at,
        completed_at=row.completed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def build_personal_growth_task_summary(
    row: CareerDevelopmentPersonalGrowthReportTask,
) -> PersonalGrowthReportTaskSummary:
    latest_event_payload = _json_loads(row.last_event_json)
    status_text = _normalize_text(str(latest_event_payload.get("status_text") or ""))
    return PersonalGrowthReportTaskSummary(
        task_id=row.id,
        favorite_id=row.favorite_id,
        status=row.status,
        progress=row.progress,
        overwrite_current=bool(row.overwrite_current),
        status_text=status_text,
        started_at=row.created_at,
        updated_at=row.updated_at,
        can_cancel=row.status not in PERSONAL_GROWTH_TASK_TERMINAL_STATUSES,
    )


def get_active_personal_growth_task(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> CareerDevelopmentPersonalGrowthReportTask | None:
    return db.scalar(
        select(CareerDevelopmentPersonalGrowthReportTask)
        .where(
            CareerDevelopmentPersonalGrowthReportTask.user_id == user_id,
            CareerDevelopmentPersonalGrowthReportTask.favorite_id == favorite_id,
            CareerDevelopmentPersonalGrowthReportTask.status.in_(["queued", "running"]),
        )
        .order_by(CareerDevelopmentPersonalGrowthReportTask.updated_at.desc())
    )


def build_personal_growth_report_payload(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    user_id: int,
    favorite_id: int,
) -> PersonalGrowthReportPayload:
    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        raise ValueError("收藏目标不存在或无权访问。")
    favorite = read_favorite_report_payload(favorite_record)

    generated_payload = load_personal_growth_generated_payload(row)
    current_payload = load_personal_growth_current_payload(row)
    generated_sections = (
        generated_payload.sections if _has_any_content(generated_payload.sections) else _empty_sections()
    )
    current_sections = (
        current_payload.sections if _has_any_content(current_payload.sections) else _empty_sections()
    )
    visible_sections = current_sections if _has_any_content(current_sections) else generated_sections

    if not _has_any_content(visible_sections):
        visible_sections = _build_base_sections_from_workspace(favorite=favorite, row=row)
        if not _has_any_content(visible_sections):
            visible_sections = _empty_sections()

    generation_status = _personal_growth_generation_status(
        current_sections=current_sections,
        generated_sections=generated_sections,
    )
    if generation_status != "ready" and not _has_any_content(visible_sections):
        visible_sections = _empty_sections()

    generated_markdown = _normalize_text(row.personal_growth_report_generated_markdown)
    if not generated_markdown and _has_any_content(generated_sections):
        generated_markdown = render_personal_growth_report_markdown(generated_sections)

    edited_markdown = _normalize_text(row.personal_growth_report_edited_markdown)
    if not edited_markdown and _has_any_content(current_sections):
        edited_markdown = render_personal_growth_report_markdown(current_sections)

    active_task_row = get_active_personal_growth_task(db, user_id=user_id, favorite_id=favorite_id)

    return PersonalGrowthReportPayload(
        workspace_id=row.id,
        favorite=favorite,
        sections=ensure_fixed_section_order(visible_sections),
        generated_markdown=generated_markdown,
        edited_markdown=edited_markdown,
        export_meta=_parse_personal_growth_export_meta(row),
        content_status=_personal_growth_content_status(visible_sections),
        generation_status=generation_status,
        active_task=build_personal_growth_task_summary(active_task_row) if active_task_row else None,
        last_generated_at=row.personal_growth_report_last_generated_at,
        last_saved_at=row.personal_growth_report_last_saved_at,
        updated_at=row.updated_at,
    )


def update_personal_growth_report_workspace(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    sections: list[PersonalGrowthReportSection],
) -> CareerDevelopmentPlanWorkspace:
    normalized_sections = recompute_section_completion(ensure_fixed_section_order(sections))
    payload = PersonalGrowthReportStoredPayload(
        sections=normalized_sections,
        source_workspace_updated_at=row.updated_at,
    )
    row.personal_growth_report_current_payload_json = _json_dumps(payload.model_dump(mode="json"))
    row.personal_growth_report_edited_markdown = render_personal_growth_report_markdown(
        normalized_sections
    )
    row.personal_growth_report_last_saved_at = utc_now()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

def _render_phase_summary(phases: list[GrowthPlanPhase]) -> str:
    blocks: list[str] = []
    for phase in phases:
        block = [f"阶段：{phase.phase_label}", f"时间跨度：{phase.time_horizon}", f"阶段目标：{phase.goal_statement}"]
        learning_topics = [module.topic for module in phase.learning_modules[:5] if _normalize_text(module.topic)]
        if learning_topics:
            block.append("学习模块：")
            block.extend(f"- {topic}" for topic in learning_topics)
        practice_titles = [item.title for item in phase.practice_actions[:5] if _normalize_text(item.title)]
        if practice_titles:
            block.append("实践动作：")
            block.extend(f"- {title}" for title in practice_titles)
        deliverables = [item for item in phase.deliverables[:5] if _normalize_text(item)]
        if deliverables:
            block.append("阶段成果：")
            block.extend(f"- {item}" for item in deliverables)
        blocks.append("\n".join(block))
    return "\n\n".join(blocks).strip()


def _render_current_learning_steps(steps: list[GrowthPlanCurrentLearningStep]) -> str:
    if not steps:
        return ""
    blocks: list[str] = []
    for step in steps:
        lines = [
            f"步骤 {step.step_index}：{step.title}",
            f"- 目标：{step.objective}",
            f"- 状态：{step.status}",
        ]
        if step.resource and _normalize_text(step.resource.title):
            lines.append(f"- 推荐资源：{step.resource.title}")
        if _normalize_text(step.summary_text):
            lines.append(f"- 备注：{step.summary_text}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks).strip()


def _render_phase_flow_summary(items: list[GrowthPlanPhaseFlowItem]) -> str:
    if not items:
        return ""
    blocks: list[str] = []
    for item in items:
        lines = [
            f"{item.phase_label}（{item.time_horizon}）",
            f"- 状态：{item.status}",
            f"- 进度：{item.progress_percent}%",
        ]
        if _normalize_text(item.summary):
            lines.append(f"- 摘要：{item.summary}")
        if _normalize_text(item.next_hint):
            lines.append(f"- 下一步：{item.next_hint}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks).strip()


def validate_personal_growth_prerequisites(
    db: Session,
    *,
    user_id: int,
    favorite: CareerDevelopmentFavoritePayload | None,
) -> list[str]:
    issues: list[str] = []
    if favorite is None:
        issues.append(PERSONAL_GROWTH_PREREQUISITE_HINTS["favorite"])
        return issues

    profile = get_student_profile(db, user_id=user_id)
    if profile is None or not all(
        _normalize_text(value)
        for value in [
            profile.full_name,
            profile.school,
            profile.major,
            profile.education_level,
            profile.grade,
            profile.target_job_title,
        ]
    ):
        issues.append(PERSONAL_GROWTH_PREREQUISITE_HINTS["profile"])

    competency_record = get_student_competency_latest_profile_record(db, user_id=user_id)
    competency_analysis = read_student_competency_latest_analysis(competency_record)
    has_analysis = (
        competency_analysis.available
        and competency_analysis.profile is not None
        and bool(competency_analysis.comparison_dimensions)
    )
    if not has_analysis:
        issues.append(PERSONAL_GROWTH_PREREQUISITE_HINTS["analysis"])

    has_gap_evidence = bool(
        favorite.report_snapshot.action_advices
        or favorite.report_snapshot.narrative
        or favorite.report_snapshot.comparison_dimensions
    )
    if not has_gap_evidence:
        issues.append(PERSONAL_GROWTH_PREREQUISITE_HINTS["gap_evidence"])

    return issues


def assert_personal_growth_prerequisites(
    db: Session,
    *,
    user_id: int,
    favorite: CareerDevelopmentFavoritePayload | None,
) -> None:
    issues = validate_personal_growth_prerequisites(db, user_id=user_id, favorite=favorite)
    if issues:
        raise ValueError("无法生成个人职业成长报告，请先补充以下内容：" + "；".join(issues))


def build_personal_growth_generation_context(
    db: Session,
    *,
    user_id: int,
    favorite: CareerDevelopmentFavoritePayload,
    row: CareerDevelopmentPlanWorkspace,
) -> dict[str, Any]:
    assert_personal_growth_prerequisites(db, user_id=user_id, favorite=favorite)

    workspace_payload: PlanWorkspacePayload = build_plan_workspace_payload(
        db,
        row=row,
        user_id=user_id,
        favorite_id=favorite.favorite_id,
    )

    profile = get_student_profile(db, user_id=user_id)
    competency_record = get_student_competency_latest_profile_record(db, user_id=user_id)
    competency_analysis = read_student_competency_latest_analysis(competency_record)

    phases = workspace_payload.growth_plan_phases
    phase_summary = _render_phase_summary(phases)
    current_learning_steps = _render_current_learning_steps(workspace_payload.current_learning_steps)
    phase_flow_summary = _render_phase_flow_summary(workspace_payload.phase_flow_summary)
    match_gap_text = _join_non_empty(
        [
            favorite.report_snapshot.narrative.overall_review if favorite.report_snapshot.narrative else "",
            favorite.report_snapshot.narrative.completeness_explanation
            if favorite.report_snapshot.narrative
            else "",
            favorite.report_snapshot.narrative.competitiveness_explanation
            if favorite.report_snapshot.narrative
            else "",
            _bullet_lines([item.title for item in favorite.report_snapshot.action_advices[:5]]),
            _bullet_lines(
                [
                    f"{item.title}：{'、'.join(item.next_actions[:2])}"
                    for item in favorite.report_snapshot.action_advices[:5]
                    if _normalize_text(item.title)
                ]
            ),
            workspace_payload.edited_report_markdown,
            workspace_payload.generated_report_markdown,
        ]
    )

    structured_context = {
        "user_profile": serialize_student_profile(profile).model_dump(mode="json") if profile else {},
        "favorite": favorite.model_dump(mode="json"),
        "workspace_overview": workspace_payload.workspace_overview.model_dump(mode="json"),
        "metric_snapshot": workspace_payload.metric_snapshot.model_dump(mode="json"),
        "current_action_summary": workspace_payload.current_action_summary.model_dump(mode="json"),
        "resume_analysis": competency_analysis.model_dump(mode="json"),
        "job_match": favorite.report_snapshot.model_dump(mode="json"),
        "match_gap_text": match_gap_text,
        "snail_learning_path_summary": {
            "growth_plan_phases": [phase.model_dump(mode="json") for phase in phases],
            "current_learning_steps": [
                step.model_dump(mode="json") for step in workspace_payload.current_learning_steps
            ],
            "phase_flow_summary": [
                item.model_dump(mode="json") for item in workspace_payload.phase_flow_summary
            ],
        },
    }

    source_documents = [
        {
            "source": "我的资料",
            "content": _safe_json(structured_context["user_profile"]),
        },
        {
            "source": "12维解析结果",
            "content": _safe_json(competency_analysis.model_dump(mode="json")),
        },
        {
            "source": "职业匹配与目标差距文本",
            "content": match_gap_text,
        },
        {
            "source": "当前目标岗位",
            "content": _safe_json(
                {
                    "target_title": favorite.target_title,
                    "canonical_job_title": favorite.canonical_job_title,
                    "industry": favorite.industry,
                    "overall_match": favorite.overall_match,
                }
            ),
        },
        {
            "source": "蜗牛学习路径",
            "content": _join_non_empty([phase_summary, current_learning_steps, phase_flow_summary]),
        },
        {
            "source": "已有个人成长报告内容",
            "content": _join_non_empty(
                [
                    row.personal_growth_report_edited_markdown,
                    row.personal_growth_report_generated_markdown,
                ]
            ),
        },
    ]

    cleaned_source_documents = [
        item for item in source_documents if _normalize_text(str(item.get("content") or ""))
    ]

    return {
        "structured_context": structured_context,
        "source_documents": cleaned_source_documents,
    }

async def generate_personal_growth_report_draft(
    *,
    db: Session,
    user_id: int,
    favorite: CareerDevelopmentFavoritePayload,
    row: CareerDevelopmentPlanWorkspace,
) -> list[PersonalGrowthReportSection]:
    context = build_personal_growth_generation_context(
        db,
        user_id=user_id,
        favorite=favorite,
        row=row,
    )

    llm_client = OpenAICompatibleLLMClient.from_settings()
    try:
        response = await llm_client.chat_completion(
            [
                ChatMessage(
                    role="system",
                    content=(
                        "你是一名职业发展顾问，负责生成《个人职业成长报告》。"
                        "你只能输出 Markdown 正文，不能输出解释、前言、JSON、代码块。"
                        "必须严格使用以下标题结构："
                        "# 个人职业成长报告\n"
                        "## 自我认知\n"
                        "## 职业方向分析\n"
                        "## 匹配度判断\n"
                        "## 发展建议\n"
                        "## 行动计划\n"
                        "其中“行动计划”必须继续使用 3 个三级标题："
                        "### 短期行动（0-3个月）"
                        "### 中期行动（3-9个月）"
                        "### 长期行动（9-24个月）。"
                    ),
                ),
                ChatMessage(
                    role="user",
                    content=(
                        "请基于以下输入生成一份综合性的个人职业成长报告。\n"
                        "报告必须覆盖：自我认知、职业方向分析、匹配度判断、发展建议、行动计划。\n"
                        "写作要求：\n"
                        "1. 自我认知要覆盖兴趣、优势、性格、能力特点。\n"
                        "2. 职业方向分析要覆盖适合的行业、岗位类型、发展方向。\n"
                        "3. 匹配度判断要明确写出当前匹配项与不足。\n"
                        "4. 发展建议要指出重点提升项和补短板方法。\n"
                        "5. 行动计划必须结合蜗牛学习路径，写出短期、中期、长期的具体动作，如考证、实习、项目、求职准备。\n"
                        "6. 只使用提供的材料，不要捏造经历。\n"
                        "7. 保持内容专业、可执行、适合学生职业成长场景。\n\n"
                        "structured_context:\n"
                        f"{_safe_json(context['structured_context'])}\n\n"
                        "source_documents:\n"
                        f"{_safe_json(context['source_documents'])}"
                    ),
                ),
            ],
            temperature=0.2,
        )
    finally:
        await llm_client.aclose()

    sections = _extract_markdown_sections(response)
    if not _has_any_content(sections):
        raise LLMClientError("个人职业成长报告初稿生成失败：LLM 未返回有效 Markdown 内容。")

    missing_required = [
        section.title
        for section in sections
        if section.key in PERSONAL_GROWTH_REQUIRED_SECTION_KEYS and not section.completed
    ]
    if missing_required:
        raise LLMClientError(
            "个人职业成长报告初稿生成失败：以下章节缺失或为空：" + "、".join(missing_required)
        )
    return sections


async def regenerate_personal_growth_report(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    favorite: CareerDevelopmentFavoritePayload,
    overwrite_current: bool = False,
) -> CareerDevelopmentPlanWorkspace:
    generated_sections = await generate_personal_growth_report_draft(
        db=db,
        user_id=row.user_id,
        favorite=favorite,
        row=row,
    )
    generated_payload = PersonalGrowthReportStoredPayload(
        sections=generated_sections,
        source_workspace_updated_at=row.updated_at,
    )
    row.personal_growth_report_generated_payload_json = _json_dumps(
        generated_payload.model_dump(mode="json")
    )
    row.personal_growth_report_generated_markdown = render_personal_growth_report_markdown(
        generated_sections
    )
    row.personal_growth_report_last_generated_at = utc_now()

    current_payload = load_personal_growth_current_payload(row)
    has_current_content = _has_any_content(current_payload.sections)
    if overwrite_current or not has_current_content:
        row.personal_growth_report_current_payload_json = _json_dumps(
            generated_payload.model_dump(mode="json")
        )
        row.personal_growth_report_edited_markdown = row.personal_growth_report_generated_markdown
        row.personal_growth_report_last_saved_at = row.personal_growth_report_last_generated_at

    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _build_personal_growth_base_goal_plan_result(
    *,
    favorite: CareerDevelopmentFavoritePayload,
    growth_plan_phases: list[GrowthPlanPhase],
) -> CareerDevelopmentGoalPlanResultPayload:
    report = favorite.report_snapshot
    strengths = [item for item in (report.strength_dimensions or []) if _normalize_text(item)]
    gaps = [item for item in (report.priority_gap_dimensions or []) if _normalize_text(item)]

    strength_directions = [
        CareerDevelopmentGoalStrengthDirectionItem(
            title=title,
            summary=f"当前画像在“{title}”上已有一定基础，可继续转化为目标岗位证据。",
            supporting_dimensions=[title],
            matched_keywords=[],
            evidence_companies=[],
            supporting_metrics=[f"当前岗位匹配度 {favorite.overall_match:.2f}%"],
            reasoning="该方向已体现在当前职业匹配结果中，可作为后续成长规划的支撑点。",
        )
        for title in strengths[:3]
    ]

    trend_lines = [
        f"目标岗位：{favorite.canonical_job_title}",
        f"目标方向：{favorite.target_title}",
        f"目标行业：{favorite.industry}" if favorite.industry else "",
        f"当前匹配度：{favorite.overall_match:.2f}%",
    ]
    path_lines = []
    for phase in growth_plan_phases:
        path_lines.extend(
            [
                f"## {phase.phase_label}",
                f"- 时间范围：{phase.time_horizon}",
                f"- 阶段目标：{phase.goal_statement}",
            ]
        )

    return CareerDevelopmentGoalPlanResultPayload(
        favorite=favorite,
        trend_markdown="\n".join(line for line in trend_lines if line),
        trend_section_markdown="\n".join(line for line in trend_lines if line),
        path_section_markdown="\n".join(path_lines).strip(),
        correlation_analysis=CareerDevelopmentGoalCorrelationAnalysis(
            foundation=CareerDevelopmentGoalInsightCard(
                summary="已具备与目标岗位相关的基础能力。",
                highlights=strengths[:3],
            ),
            gaps=CareerDevelopmentGoalInsightCard(
                summary="仍存在需要持续补齐的关键差距。",
                highlights=gaps[:3],
            ),
            path_impact=CareerDevelopmentGoalInsightCard(
                summary="建议围绕现有学习路径逐步推进，优先补强关键短板。",
                highlights=[phase.phase_label for phase in growth_plan_phases[:3]],
            ),
        ),
        strength_directions=strength_directions,
        path_stages=[],
        comprehensive_report_markdown="",
        path_nodes=[],
        stage_recommendations=[],
        growth_plan_phases=growth_plan_phases,
        review_framework=build_default_review_framework(),
        generated_report_markdown="",
    )


async def ensure_personal_growth_base_workspace(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> CareerDevelopmentPlanWorkspace | None:
    row = get_or_create_plan_workspace(db, user_id=user_id, favorite_id=favorite_id)
    if row is not None:
        return row

    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        return None
    favorite = read_favorite_report_payload(favorite_record)
    base_phases = build_growth_plan_phases(favorite)
    enriched_phases = await generate_learning_resources_for_phases(
        favorite=favorite,
        phases=base_phases,
        user_id=user_id,
        favorite_id=favorite_id,
    )
    result = _build_personal_growth_base_goal_plan_result(
        favorite=favorite,
        growth_plan_phases=enriched_phases,
    )
    normalized_result = normalize_goal_plan_result(result)
    normalized_result = normalize_goal_plan_result(
        normalized_result.model_copy(update={"growth_plan_phases": enriched_phases})
    )
    return upsert_workspace_from_goal_plan_result(
        db,
        user_id=user_id,
        favorite_id=favorite_id,
        result=normalized_result,
        source_task_id=None,
    )


def build_personal_growth_export_filename(
    favorite: CareerDevelopmentFavoritePayload,
    export_format: str,
) -> str:
    base = re.sub(r"[^a-z0-9\u4e00-\u9fa5-]+", "", favorite.canonical_job_title.lower().replace(" ", "-"))
    base = base or "personal-growth-report"
    return f"{base}-personal-growth-report.{export_format}"


def build_personal_growth_integrity_check(
    sections: list[PersonalGrowthReportSection],
) -> tuple[int, str]:
    missing_required = [
        section.title
        for section in ensure_fixed_section_order(sections)
        if section.key in PERSONAL_GROWTH_REQUIRED_SECTION_KEYS and not section.completed
    ]
    if missing_required:
        return len(missing_required), "以下章节尚未完善：" + "、".join(missing_required)
    return 0, ""


def export_personal_growth_report_bytes(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    favorite: CareerDevelopmentFavoritePayload,
    export_format: str,
    force_with_issues: bool = False,
) -> tuple[bytes, str, str]:
    payload = build_personal_growth_report_payload(
        db,
        row=row,
        user_id=row.user_id,
        favorite_id=row.favorite_id,
    )
    markdown = payload.edited_markdown or payload.generated_markdown or render_personal_growth_report_export_markdown(
        payload.sections
    )
    blocking_count, detail = build_personal_growth_integrity_check(payload.sections)
    if export_format in {"docx", "pdf"} and blocking_count > 0 and not force_with_issues:
        raise ValueError(detail)

    if export_format == "md":
        content = export_markdown_bytes(markdown)
        media_type = "text/markdown; charset=utf-8"
    elif export_format == "docx":
        content = export_docx_bytes(markdown)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        content = export_pdf_bytes(markdown)
        media_type = "application/pdf"

    _update_personal_growth_export_meta(
        db,
        row=row,
        export_format=export_format,
        exported_with_issues=force_with_issues and blocking_count > 0,
        blocking_count=blocking_count,
    )
    filename = build_personal_growth_export_filename(favorite, export_format)
    disposition = f"attachment; filename*=UTF-8''{quote(filename)}"
    return content, media_type, disposition


def get_personal_growth_workspace_or_none(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> CareerDevelopmentPlanWorkspace | None:
    return get_plan_workspace_record(db, user_id=user_id, favorite_id=favorite_id)


def get_latest_personal_growth_favorite_id(
    db: Session,
    *,
    user_id: int,
) -> int | None:
    records = list_favorite_report_records(db, user_id=user_id)
    if not records:
        return None
    return records[0].id
