from __future__ import annotations

import json
import re
import textwrap
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import uuid4
from xml.sax.saxutils import escape as xml_escape
from zipfile import ZIP_DEFLATED, ZipFile

from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import UploadFile

from app.models.career_development_goal_plan_task import CareerDevelopmentGoalPlanTask
from app.models.career_development_plan_review import CareerDevelopmentPlanReview
from app.models.career_development_plan_step_submission import CareerDevelopmentPlanStepSubmission
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.core.config import DATA_DIR
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    CareerDevelopmentGoalPlanResultPayload,
    GrowthPlanCurrentLearningStep,
    GrowthPlanLearningModule,
    GrowthPlanLearningResourceItem,
    GrowthPlanMetric,
    GrowthPlanMetricSnapshot,
    GrowthPlanMilestone,
    GrowthPlanMilestoneSummary,
    GrowthPlanPhase,
    GrowthPlanPhaseFlowItem,
    GrowthPlanPracticeAction,
    GrowthPlanStepAssessment,
    GrowthPlanSubmissionFile,
    IntegrityCheckPayload,
    IntegrityIssue,
    PlanExportMeta,
    PlanLearningResourceRequest,
    PlanReviewChangeItem,
    PlanReviewPayload,
    PlanWorkspaceCurrentActionSummary,
    PlanWorkspaceOverview,
    PlanWorkspacePayload,
    ReviewFramework,
)
from app.schemas.student_competency_profile import StudentCompetencyComparisonDimensionItem
from app.services.career_development_learning_resources import (
    CareerDevelopmentLearningResourceError,
    DifyCareerLearningResourceClient,
    parse_learning_resource_recommendations,
)
from app.services.career_development_goal_planning import (
    build_comprehensive_report_markdown_content,
    get_favorite_report_record,
    read_favorite_report_payload,
)
from app.services.career_development_report import CareerDevelopmentMatchService
from app.services.llm import ChatMessage, LLMClientError, OpenAICompatibleLLMClient
from app.services.student_competency_latest_analysis import get_student_competency_latest_profile_record


UTC = timezone.utc
PLAN_STEP_UPLOAD_DIR = DATA_DIR / "career_plan_step_uploads"

PHASE_BLUEPRINTS = [
    {
        "phase_key": "short_term",
        "phase_label": "短期计划",
        "time_horizon": "0-3 个月",
        "why_now": "先补基础与关键短板，把目标岗位最直接的门槛补齐。",
    },
    {
        "phase_key": "mid_term",
        "phase_label": "中期计划",
        "time_horizon": "3-9 个月",
        "why_now": "把学习结果转成项目、实习或竞赛中的可展示证据。",
    },
    {
        "phase_key": "long_term",
        "phase_label": "长期计划",
        "time_horizon": "9-24 个月",
        "why_now": "围绕目标岗位完成稳定迁移或升级，形成持续迭代能力。",
    },
]

REVIEW_METRICS = [
    GrowthPlanMetric(
        key="learning_completion_rate",
        label="学习完成率",
        formula="已完成学习里程碑 / 学习里程碑总数",
        description="衡量基础补齐与知识积累是否按计划推进。",
    ),
    GrowthPlanMetric(
        key="practice_completion_rate",
        label="实践完成率",
        formula="已完成实践里程碑 / 实践里程碑总数",
        description="衡量项目、实习、竞赛等实践动作的推进情况。",
    ),
    GrowthPlanMetric(
        key="evidence_count",
        label="证据沉淀数",
        formula="已沉淀成果物数量",
        description="统计已经形成并可复用的成果物与证据说明。",
    ),
    GrowthPlanMetric(
        key="gap_closure_index",
        label="差距收敛指数",
        formula="当前优先短板改善度",
        description="对比初始差距与最近一次刷新差距，评估重点短板是否缩小。",
    ),
    GrowthPlanMetric(
        key="readiness_index",
        label="就绪指数",
        formula="40% 里程碑完成 + 30% 证据沉淀 + 30% 最新画像差距改善",
        description="综合判断当前阶段是否具备进入下一阶段的准备度。",
    ),
]

SECTION_RULES = [
    ("target_overview", ["目标概述", "目标岗位", "目标职业"], "请补充目标概述，说明当前目标岗位与阶段判断。"),
    ("short_term", ["短期计划", "短期阶段"], "请补充短期 0-3 个月的行动计划。"),
    ("mid_term", ["中期计划", "中期阶段"], "请补充中期 3-9 个月的行动计划。"),
    ("long_term", ["长期计划", "长期阶段"], "请补充长期 9-24 个月的行动计划。"),
    ("learning", ["学习内容", "学习模块", "学习安排"], "请明确每个阶段的学习内容与学习重点。"),
    ("practice", ["实践安排", "实践动作", "实践计划"], "请补充项目、实习、竞赛、开源等实践安排。"),
    ("milestones", ["里程碑"], "请明确阶段里程碑与检查点。"),
    ("review", ["评估周期", "周检", "月评"], "请补充周检与月评的节奏说明。"),
    ("metrics", ["指标", "完成率", "就绪指数"], "请补充阶段评估指标与口径。"),
    ("conclusion", ["结论", "总结"], "请补充报告结论与下一步建议。"),
]


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


def _slugify(value: str) -> str:
    normalized = re.sub(r"\s+", "-", value.strip().lower())
    return re.sub(r"[^a-z0-9\u4e00-\u9fa5-]+", "", normalized).strip("-")


def _build_module_id(*, phase_key: str, topic: str, index: int) -> str:
    slug = _slugify(topic) or f"module-{index}"
    return f"{phase_key}-module-{index}-{slug}"


def _priority_gap_dimensions(favorite: CareerDevelopmentFavoritePayload) -> list[StudentCompetencyComparisonDimensionItem]:
    rows = [item for item in favorite.report_snapshot.comparison_dimensions if item.market_target > 0]
    rows.sort(key=lambda item: (-item.gap, item.title))
    return rows[:3]


def _strength_dimensions(favorite: CareerDevelopmentFavoritePayload) -> list[StudentCompetencyComparisonDimensionItem]:
    rows = [item for item in favorite.report_snapshot.comparison_dimensions if item.market_target > 0]
    rows.sort(key=lambda item: (-item.user_readiness, item.gap, item.title))
    return rows[:3]


def _missing_keyword_text(item: StudentCompetencyComparisonDimensionItem) -> str:
    keywords = item.missing_market_keywords[:2]
    return "、".join(keywords) if keywords else item.title


def _build_learning_modules(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    phase_key: str,
) -> list[GrowthPlanLearningModule]:
    gaps = _priority_gap_dimensions(favorite)
    strengths = _strength_dimensions(favorite)
    if phase_key == "short_term":
        source = gaps[:2] or strengths[:2]
        return [
            GrowthPlanLearningModule(
                topic=item.title,
                learning_content=f"围绕 {_missing_keyword_text(item)} 补齐基础概念、常见任务方法与岗位表达，整理成可复用学习笔记。",
                priority="high" if index == 0 else "medium",
                suggested_resource_types=["课程", "官方文档", "案例拆解"],
            )
            for index, item in enumerate(source)
        ]
    if phase_key == "mid_term":
        source = (gaps[:1] + strengths[:1]) or gaps[:2] or strengths[:2]
        return [
            GrowthPlanLearningModule(
                topic=item.title,
                learning_content=f"把 {item.title} 从理解层推进到应用层，确保能在真实项目或实习场景中稳定复现。",
                priority="high" if item in gaps[:1] else "medium",
                suggested_resource_types=["项目复盘", "专题课程", "实战清单"],
            )
            for item in source[:2]
        ]
    source = strengths[:2] or gaps[:1]
    return [
        GrowthPlanLearningModule(
            topic=item.title,
            learning_content=f"围绕 {item.title} 持续升级方法论与复杂场景处理能力，形成可迁移的长期竞争力。",
            priority="medium",
            suggested_resource_types=["导师反馈", "高级案例", "面试题库"],
        )
        for item in source[:2]
    ]


def _build_practice_actions(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    phase_key: str,
) -> list[GrowthPlanPracticeAction]:
    gaps = _priority_gap_dimensions(favorite)
    strengths = _strength_dimensions(favorite)
    if phase_key == "short_term":
        first_gap = gaps[0] if gaps else (strengths[0] if strengths else None)
        second_gap = gaps[1] if len(gaps) > 1 else first_gap
        seed = [item for item in [first_gap, second_gap] if item]
        action_types = ["project", "certificate"]
        return [
            GrowthPlanPracticeAction(
                action_type=action_types[index],
                title=f"{item.title} 基础补强任务",
                description=f"完成 1 个与 {_missing_keyword_text(item)} 直接相关的小型练习，并留下可引用的结果说明。",
                priority="high" if index == 0 else "medium",
            )
            for index, item in enumerate(seed[:2])
        ]
    if phase_key == "mid_term":
        seed = (gaps[:1] + strengths[:2]) or strengths[:2]
        action_types = ["project", "internship", "competition"]
        return [
            GrowthPlanPracticeAction(
                action_type=action_types[index],
                title=f"{item.title} 展示型实践",
                description=f"围绕 {item.title} 形成可展示证据，优先选择项目、实习、竞赛或开源贡献中的真实交付场景。",
                priority="high" if index == 0 else "medium",
            )
            for index, item in enumerate(seed[:3])
        ]
    seed = (strengths[:2] + gaps[:1]) or strengths[:2]
    action_types = ["job_search_action", "open_source", "certificate"]
    return [
        GrowthPlanPracticeAction(
            action_type=action_types[index],
            title=f"{item.title} 迁移升级动作",
            description=f"把 {item.title} 转成求职、转岗或升级场景中的稳定证据，支撑长期岗位迁移或升级。",
            priority="high" if index == 0 else "medium",
        )
        for index, item in enumerate(seed[:3])
    ]


def _build_deliverables(favorite: CareerDevelopmentFavoritePayload, *, phase_key: str) -> list[str]:
    gaps = _priority_gap_dimensions(favorite)
    strengths = _strength_dimensions(favorite)
    if phase_key == "short_term":
        focus = gaps[0].title if gaps else favorite.canonical_job_title
        return [
            f"{focus} 学习笔记与术语清单",
            "1 份可展示的小型练习或课程结课输出",
            "更新后的简历证据条目",
        ]
    if phase_key == "mid_term":
        focus = strengths[0].title if strengths else favorite.canonical_job_title
        return [
            f"1 个突出 {focus} 的项目作品或实习成果",
            "阶段复盘与成果说明文档",
            "可直接用于面试或沟通的案例提纲",
        ]
    return [
        "目标岗位投递材料包",
        "面试案例库与阶段成果总表",
        "下一轮升级方向的行动清单",
    ]


def _build_gates(favorite: CareerDevelopmentFavoritePayload, *, phase_key: str) -> tuple[list[str], list[str]]:
    if phase_key == "short_term":
        return (
            ["已收藏目标岗位并完成路径报告生成", "已具备最近一次学生画像与匹配结果"],
            ["完成至少 2 个学习里程碑", "沉淀至少 1 个基础成果物", "补齐 1 项关键短板证据"],
        )
    if phase_key == "mid_term":
        return (
            ["短期阶段核心里程碑已推进", "已有可展示的学习成果或小型项目"],
            ["形成至少 1 个项目/实习/竞赛证据", "完成阶段复盘并更新简历表达", "能清晰说明成果与岗位关联"],
        )
    return (
        ["中期阶段已有展示型证据", "具备稳定输出案例与复盘能力"],
        ["完成求职或升级动作闭环", "形成长期持续迭代计划", "可进入下一轮升级"],
    )


def _build_risk_alerts(favorite: CareerDevelopmentFavoritePayload, *, phase_key: str) -> list[str]:
    gaps = _priority_gap_dimensions(favorite)
    if phase_key == "short_term":
        return [
            "如果只读报告不落实到小型练习，短期阶段会停留在理解层。",
            f"优先关注 {gaps[0].title if gaps else '关键短板'}，避免多个短板同时推进导致分散。",
        ]
    if phase_key == "mid_term":
        return [
            "如果实践没有明确成果物，阶段推进会变成经历堆砌。",
            "优先把项目、实习或竞赛结果整理成可复述证据，不要只记录参与过程。",
        ]
    return [
        "长期阶段的重点不是继续加内容，而是把已有证据转成稳定岗位迁移能力。",
        "若最新学生画像没有刷新，长期阶段的差距判断可能滞后。",
    ]


def _build_milestones(
    phase: GrowthPlanPhase,
    *,
    start_at: datetime,
    month_offset: int,
) -> list[GrowthPlanMilestone]:
    milestones: list[GrowthPlanMilestone] = []
    due_offsets = [7, 21, 35, 63]
    learning_modules = list(phase.learning_modules[:3])
    if learning_modules and len(learning_modules) < 3:
        while len(learning_modules) < 3:
            learning_modules.append(learning_modules[-1])
    for index, module in enumerate(learning_modules, start=1):
        milestones.append(
            GrowthPlanMilestone(
                milestone_id=f"{phase.phase_key}-learning-{index}",
                title=f"完成「{module.topic}」学习整理",
                category="learning",
                related_learning_module_id=module.module_id or _build_module_id(
                    phase_key=phase.phase_key,
                    topic=module.topic,
                    index=min(index, len(phase.learning_modules) or 1),
                ),
                step_index=index,
                status="pending",
                planned_date=start_at + timedelta(days=month_offset * 30 + due_offsets[index - 1]),
            )
        )
    for index, action in enumerate(phase.practice_actions[:1], start=1):
        milestones.append(
            GrowthPlanMilestone(
                milestone_id=f"{phase.phase_key}-practice-{index}",
                title=f"完成「{action.title}」阶段输出",
                category="practice",
                status="pending",
                planned_date=start_at + timedelta(days=month_offset * 30 + due_offsets[index + 2]),
            )
        )
    return milestones


def summarize_phase_milestones(phase: GrowthPlanPhase) -> GrowthPlanMilestoneSummary:
    milestones = phase.milestones or []
    return GrowthPlanMilestoneSummary(
        completed_count=sum(1 for item in milestones if item.status == "completed"),
        total_count=len(milestones),
        blocked_count=sum(1 for item in milestones if item.status == "blocked"),
    )


def _normalize_submission_status(milestone: GrowthPlanMilestone) -> str:
    if milestone.latest_assessment:
        return milestone.latest_assessment.result
    if milestone.status == "completed":
        return "passed"
    if milestone.submission_summary.strip() or milestone.submission_files:
        return "submitted"
    return milestone.submission_status or "idle"


def _resource_why_first(*, module: GrowthPlanLearningModule, step_index: int) -> str:
    if step_index == 1:
        return f"先围绕「{module.topic}」补齐最关键的基础门槛，帮助你尽快进入可执行状态。"
    if step_index == 2:
        return f"第二步把「{module.topic}」从概念理解推进到可复述、可整理的基础掌握。"
    return f"最后一步把「{module.topic}」转成可提交的小结、笔记或基础输出，方便系统确认你已经真正学过。"


def _resource_expected_output(
    *,
    phase: GrowthPlanPhase,
    module: GrowthPlanLearningModule,
) -> str:
    if phase.deliverables:
        return f"完成后至少提交与「{phase.deliverables[0]}」相关的学习笔记、阶段小结或基础练习结果。"
    return f"完成后提交与「{module.topic}」相关的学习笔记、总结或基础练习结果。"


def _default_learning_milestone(
    *,
    phase: GrowthPlanPhase,
    module: GrowthPlanLearningModule | None,
    step_index: int,
    planned_date: datetime | None,
) -> GrowthPlanMilestone:
    topic = module.topic if module else phase.phase_label
    return GrowthPlanMilestone(
        milestone_id=f"{phase.phase_key}-learning-{step_index}",
        title=f"完成「{topic}」学习整理",
        category="learning",
        related_learning_module_id=module.module_id if module else None,
        step_index=step_index,
        status="pending",
        planned_date=planned_date,
    )


def hydrate_phase_relationships(phases: list[GrowthPlanPhase]) -> list[GrowthPlanPhase]:
    for phase in phases:
        module_ids: list[str] = []
        for index, module in enumerate(phase.learning_modules or [], start=1):
            module.module_id = module.module_id or _build_module_id(
                phase_key=phase.phase_key,
                topic=module.topic,
                index=index,
            )
            module.resource_recommendations = list(module.resource_recommendations or [])
            module.resource_status = module.resource_status or (
                "ready" if module.resource_recommendations else "idle"
            )
            module.resource_error_message = module.resource_error_message or ""
            module_ids.append(module.module_id)

        learning_index = 0
        learning_milestones: list[GrowthPlanMilestone] = []
        baseline_planned_date = next(
            (item.planned_date for item in phase.milestones or [] if item.planned_date),
            utc_now(),
        )
        for milestone in phase.milestones or []:
            milestone.submission_summary = milestone.submission_summary or ""
            milestone.submission_files = list(milestone.submission_files or [])
            milestone.submission_status = _normalize_submission_status(milestone)
            if milestone.category != "learning":
                continue
            if not milestone.related_learning_module_id and learning_index < len(module_ids):
                milestone.related_learning_module_id = module_ids[learning_index]
            milestone.step_index = milestone.step_index or (learning_index + 1)
            learning_milestones.append(milestone)
            learning_index += 1

        while len(learning_milestones) < 3:
            step_index = len(learning_milestones) + 1
            module = None
            if module_ids:
                module_id = module_ids[min(step_index - 1, len(module_ids) - 1)]
                module = next((item for item in phase.learning_modules if item.module_id == module_id), None)
            milestone = _default_learning_milestone(
                phase=phase,
                module=module,
                step_index=step_index,
                planned_date=baseline_planned_date + timedelta(days=7 * (step_index - 1)),
            )
            phase.milestones.append(milestone)
            learning_milestones.append(milestone)

        for index, milestone in enumerate(
            sorted(learning_milestones, key=lambda item: (item.step_index or 99, item.milestone_id)),
            start=1,
        ):
            milestone.step_index = index
            if not milestone.related_learning_module_id and module_ids:
                milestone.related_learning_module_id = module_ids[min(index - 1, len(module_ids) - 1)]
    return phases


def populate_phase_summaries(phases: list[GrowthPlanPhase]) -> list[GrowthPlanPhase]:
    hydrate_phase_relationships(phases)
    for phase in phases:
        phase.milestone_summary = summarize_phase_milestones(phase)
    return phases


def build_default_review_framework() -> ReviewFramework:
    return ReviewFramework(metrics=REVIEW_METRICS)


def build_growth_plan_phases(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    start_at: datetime | None = None,
) -> list[GrowthPlanPhase]:
    base_time = start_at or utc_now()
    phases: list[GrowthPlanPhase] = []
    for month_offset, blueprint in enumerate(PHASE_BLUEPRINTS):
        phase = GrowthPlanPhase(
            phase_key=blueprint["phase_key"],
            phase_label=blueprint["phase_label"],
            time_horizon=blueprint["time_horizon"],
            goal_statement=(
                f"围绕 {favorite.canonical_job_title}，"
                + (
                    "优先补齐基础门槛并形成首个可用证据。"
                    if blueprint["phase_key"] == "short_term"
                    else "把学习结果转成可展示项目或实习证据。"
                    if blueprint["phase_key"] == "mid_term"
                    else "把阶段证据转成稳定迁移或升级能力。"
                )
            ),
            why_now=blueprint["why_now"],
            learning_modules=_build_learning_modules(favorite, phase_key=blueprint["phase_key"]),
            practice_actions=_build_practice_actions(favorite, phase_key=blueprint["phase_key"]),
            deliverables=_build_deliverables(favorite, phase_key=blueprint["phase_key"]),
            entry_gate=_build_gates(favorite, phase_key=blueprint["phase_key"])[0],
            exit_gate=_build_gates(favorite, phase_key=blueprint["phase_key"])[1],
            milestones=[],
            risk_alerts=_build_risk_alerts(favorite, phase_key=blueprint["phase_key"]),
        )
        phase.milestones = _build_milestones(phase, start_at=base_time, month_offset=month_offset * 3)
        phase.milestone_summary = summarize_phase_milestones(phase)
        phases.append(phase)
    return phases


def build_generated_report_markdown(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    growth_plan_phases: list[GrowthPlanPhase],
    review_framework: ReviewFramework,
    comprehensive_report_markdown: str,
    trend_section_markdown: str,
    path_section_markdown: str,
) -> str:
    lines = [
        "# 学生成长路径工作台报告",
        "",
        "## 目标概述",
        f"- 目标岗位：{favorite.canonical_job_title}",
        f"- 参考方向：{favorite.target_title}",
        f"- 当前岗位匹配度：{favorite.overall_match:.2f}%",
        "",
    ]
    for phase in growth_plan_phases:
        lines.extend(
            [
                f"## {phase.phase_label}（{phase.time_horizon}）",
                "### 阶段目标",
                phase.goal_statement,
                "",
                "### 为什么现在做",
                phase.why_now,
                "",
                "### 学习内容",
            ]
        )
        for item in phase.learning_modules:
            lines.append(f"- {item.topic}：{item.learning_content}")
        lines.extend(["", "### 实践安排"])
        for item in phase.practice_actions:
            lines.append(f"- [{item.action_type}] {item.title}：{item.description}")
        lines.extend(["", "### 里程碑"])
        for milestone in phase.milestones:
            lines.append(f"- {milestone.title}")
        lines.extend(["", "### 阶段成果物"])
        for item in phase.deliverables:
            lines.append(f"- {item}")
        lines.extend(["", "### Entry Gate"])
        for item in phase.entry_gate:
            lines.append(f"- {item}")
        lines.extend(["", "### Exit Gate"])
        for item in phase.exit_gate:
            lines.append(f"- {item}")
        lines.extend(["", "### 风险提醒"])
        for item in phase.risk_alerts:
            lines.append(f"- {item}")
        lines.append("")
    lines.extend(
        [
            "## 评估周期",
            f"- 周检：{review_framework.weekly_review_cycle}，仅更新里程碑状态与阻塞项。",
            f"- 月评：{review_framework.monthly_review_cycle}，重算差距并输出保留项、下调项、新增项。",
            "",
            "## 指标",
        ]
    )
    for metric in review_framework.metrics:
        lines.append(f"- {metric.label}：{metric.formula}")
    lines.extend(
        [
            "",
            "## 证据链",
            "",
            "### 趋势依据",
            trend_section_markdown.strip() or "暂无趋势依据。",
            "",
            "### 原始路径依据",
            path_section_markdown.strip() or "暂无原始路径依据。",
            "",
            "## 结论",
            comprehensive_report_markdown.strip() or "当前工作台已生成，可根据阶段进展继续编辑与迭代。",
            "",
        ]
    )
    return "\n".join(lines).strip()


def build_generated_report_markdown(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    growth_plan_phases: list[GrowthPlanPhase],
    review_framework: ReviewFramework,
    comprehensive_report_markdown: str,
    trend_section_markdown: str,
    path_section_markdown: str,
) -> str:
    lines = [
        "# 学生成长路径工作台报告",
        "",
        "## 目标概述",
        f"- 目标岗位：{favorite.canonical_job_title}",
        f"- 参考方向：{favorite.target_title}",
        f"- 当前岗位匹配度：{favorite.overall_match:.2f}%",
        "",
    ]
    for phase in growth_plan_phases:
        lines.extend(
            [
                f"## {phase.phase_label}（{phase.time_horizon}）",
                "### 阶段目标",
                phase.goal_statement,
                "",
                "### 为什么现在做",
                phase.why_now,
                "",
                "### 学习内容",
            ]
        )
        for item in phase.learning_modules:
            lines.append(f"- {item.topic}：{item.learning_content}")
            if item.resource_recommendations:
                lines.append("  - 推荐学习路线：")
                for resource in item.resource_recommendations:
                    lines.append(f"    - [{resource.title}]({resource.url})：{resource.reason}")
        lines.extend(["", "### 实践安排"])
        for item in phase.practice_actions:
            lines.append(f"- [{item.action_type}] {item.title}：{item.description}")
        lines.extend(["", "### 里程碑"])
        for milestone in phase.milestones:
            lines.append(f"- {milestone.title}")
        lines.extend(["", "### 阶段成果物"])
        for item in phase.deliverables:
            lines.append(f"- {item}")
        lines.extend(["", "### Entry Gate"])
        for item in phase.entry_gate:
            lines.append(f"- {item}")
        lines.extend(["", "### Exit Gate"])
        for item in phase.exit_gate:
            lines.append(f"- {item}")
        lines.extend(["", "### 风险提醒"])
        for item in phase.risk_alerts:
            lines.append(f"- {item}")
        lines.append("")
    lines.extend(
        [
            "## 评估周期",
            f"- 周检：{review_framework.weekly_review_cycle}，仅更新里程碑状态、阻塞项与推荐路线推进情况。",
            f"- 月评：{review_framework.monthly_review_cycle}，重算差距并输出保留项、下调项、新增项。",
            "",
            "## 指标",
        ]
    )
    for metric in review_framework.metrics:
        lines.append(f"- {metric.label}：{metric.formula}")
    lines.extend(
        [
            "",
            "## 证据链",
            "",
            "### 趋势依据",
            trend_section_markdown.strip() or "暂无趋势依据。",
            "",
            "### 原始路径依据",
            path_section_markdown.strip() or "暂无原始路径依据。",
            "",
            "## 结论",
            comprehensive_report_markdown.strip() or "当前工作台已生成，可根据阶段进展继续编辑与迭代。",
            "",
        ]
    )
    return "\n".join(lines).strip()


def build_generated_report_markdown(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    growth_plan_phases: list[GrowthPlanPhase],
    review_framework: ReviewFramework,
    comprehensive_report_markdown: str,
    trend_section_markdown: str,
    path_section_markdown: str,
) -> str:
    del path_section_markdown
    lines = [
        "# 学生成长路径工作台报告",
        "",
        "## 目标概述",
        f"- 目标岗位：{favorite.canonical_job_title}",
        f"- 参考方向：{favorite.target_title}",
        f"- 当前岗位匹配度：{favorite.overall_match:.2f}%",
        "",
    ]
    for phase in growth_plan_phases:
        lines.extend(
            [
                f"## {phase.phase_label}（{phase.time_horizon}）",
                "### 阶段目标",
                phase.goal_statement,
                "",
                "### 为什么现在做",
                phase.why_now,
                "",
                "### 学习内容",
            ]
        )
        for item in phase.learning_modules:
            lines.append(f"- {item.topic}：{item.learning_content}")
            if item.resource_recommendations:
                lines.append("  - 推荐学习路线：")
                for resource in item.resource_recommendations:
                    lines.append(f"    - [{resource.title}]({resource.url})：{resource.reason}")
        lines.extend(["", "### 实践安排"])
        for item in phase.practice_actions:
            lines.append(f"- [{item.action_type}] {item.title}：{item.description}")
        lines.extend(["", "### 里程碑"])
        for milestone in phase.milestones:
            lines.append(f"- {milestone.title}")
        lines.extend(["", "### 阶段成果物"])
        for item in phase.deliverables:
            lines.append(f"- {item}")
        lines.extend(["", "### Entry Gate"])
        for item in phase.entry_gate:
            lines.append(f"- {item}")
        lines.extend(["", "### Exit Gate"])
        for item in phase.exit_gate:
            lines.append(f"- {item}")
        lines.extend(["", "### 风险提醒"])
        for item in phase.risk_alerts:
            lines.append(f"- {item}")
        lines.append("")
    lines.extend(
        [
            "## 评估周期",
            f"- 周检：{review_framework.weekly_review_cycle}，仅更新里程碑状态、阻塞项与学习路线推进情况。",
            f"- 月评：{review_framework.monthly_review_cycle}，重算差距并输出保留项、下调项、新增项。",
            "",
            "## 指标",
        ]
    )
    for metric in review_framework.metrics:
        lines.append(f"- {metric.label}：{metric.formula}")
    lines.extend(
        [
            "",
            "## 证据链",
            "",
            "### 趋势依据",
            trend_section_markdown.strip() or "暂无趋势依据。",
            "",
            "## 结论",
            comprehensive_report_markdown.strip() or "当前工作台已生成，可根据阶段进展继续编辑与迭代。",
            "",
        ]
    )
    return "\n".join(lines).strip()


def _looks_like_mojibake(text: str) -> bool:
    markers = ("浣犳", "璇峰", "銆", "锛", "?/p>", "?/h2>", "鍙", "缁煎悎")
    value = (text or "").strip()
    return bool(value) and any(marker in value for marker in markers)


def normalize_goal_plan_result(
    result: CareerDevelopmentGoalPlanResultPayload,
    *,
    start_at: datetime | None = None,
) -> CareerDevelopmentGoalPlanResultPayload:
    growth_plan_phases = result.growth_plan_phases or build_growth_plan_phases(result.favorite, start_at=start_at)
    review_framework = result.review_framework or build_default_review_framework()
    comprehensive_report_markdown = result.comprehensive_report_markdown
    if not comprehensive_report_markdown.strip() or _looks_like_mojibake(comprehensive_report_markdown):
        comprehensive_report_markdown = build_comprehensive_report_markdown_content(
            trend_section_markdown=result.trend_section_markdown,
            path_section_markdown=result.path_section_markdown,
            correlation_analysis=result.correlation_analysis,
            strength_directions=result.strength_directions,
        )
    generated_report_markdown = result.generated_report_markdown or build_generated_report_markdown(
        result.favorite,
        growth_plan_phases=growth_plan_phases,
        review_framework=review_framework,
        comprehensive_report_markdown=comprehensive_report_markdown,
        trend_section_markdown=result.trend_section_markdown,
        path_section_markdown=result.path_section_markdown,
    )
    return result.model_copy(
        update={
            "growth_plan_phases": populate_phase_summaries(growth_plan_phases),
            "review_framework": review_framework,
            "comprehensive_report_markdown": comprehensive_report_markdown,
            "generated_report_markdown": generated_report_markdown,
        }
    )


def _phase_completed(phase: GrowthPlanPhase) -> bool:
    milestones = phase.milestones or []
    return bool(milestones) and all(item.status == "completed" for item in milestones)


def _next_open_milestone(phases: list[GrowthPlanPhase]) -> GrowthPlanMilestone | None:
    for phase in phases:
        for milestone in phase.milestones or []:
            if milestone.status != "completed":
                return milestone
    return None


def calculate_metric_snapshot(
    phases: list[GrowthPlanPhase],
    *,
    baseline_report: CareerDevelopmentFavoritePayload,
    current_report: CareerDevelopmentFavoritePayload | None = None,
    latest_profile_refreshed_at: datetime | None = None,
) -> GrowthPlanMetricSnapshot:
    all_milestones = [item for phase in phases for item in phase.milestones]
    learning = [item for item in all_milestones if item.category == "learning"]
    practice = [item for item in all_milestones if item.category == "practice"]
    completed_total = sum(1 for item in all_milestones if item.status == "completed")
    evidence_count = sum(1 for item in all_milestones if item.evidence_note.strip())
    total_deliverables = sum(max(len(phase.deliverables), 1) for phase in phases)
    evidence_score = min(evidence_count / max(total_deliverables, 1), 1.0) * 100
    milestone_completion = (completed_total / max(len(all_milestones), 1)) * 100 if all_milestones else 0.0
    gap_closure_index = 0.0

    if current_report is not None:
        baseline_rows = {item.key: item for item in baseline_report.report_snapshot.comparison_dimensions}
        current_rows = {item.key: item for item in current_report.report_snapshot.comparison_dimensions}
        scores: list[float] = []
        for key in baseline_report.report_snapshot.priority_gap_dimensions[:3]:
            baseline = baseline_rows.get(key)
            current = current_rows.get(key)
            if baseline is None or current is None or baseline.gap <= 0:
                continue
            improvement = max(baseline.gap - current.gap, 0.0) / baseline.gap
            scores.append(improvement * 100)
        if scores:
            gap_closure_index = round(sum(scores) / len(scores), 2)

    readiness_index = round(
        0.4 * milestone_completion + 0.3 * evidence_score + 0.3 * gap_closure_index,
        2,
    )
    return GrowthPlanMetricSnapshot(
        learning_completion_rate=round(
            (sum(1 for item in learning if item.status == "completed") / max(len(learning), 1)) * 100,
            2,
        )
        if learning
        else 0.0,
        practice_completion_rate=round(
            (sum(1 for item in practice if item.status == "completed") / max(len(practice), 1)) * 100,
            2,
        )
        if practice
        else 0.0,
        evidence_count=evidence_count,
        gap_closure_index=gap_closure_index,
        readiness_index=readiness_index,
        uses_latest_profile=current_report is not None,
        latest_profile_refreshed_at=latest_profile_refreshed_at,
    )


def build_workspace_overview(
    phases: list[GrowthPlanPhase],
    *,
    latest_review: PlanReviewPayload | None = None,
    metric_snapshot: GrowthPlanMetricSnapshot | None = None,
    reference_time: datetime | None = None,
) -> PlanWorkspaceOverview:
    ordered_phases = populate_phase_summaries(phases)
    current_phase = next((phase for phase in ordered_phases if not _phase_completed(phase)), ordered_phases[-1])
    next_milestone = _next_open_milestone(ordered_phases)
    review_base = latest_review.created_at if latest_review else (reference_time or utc_now())
    next_review_at = review_base + timedelta(days=30)
    snapshot = metric_snapshot or GrowthPlanMetricSnapshot()
    return PlanWorkspaceOverview(
        current_phase_key=current_phase.phase_key,
        current_phase_label=current_phase.phase_label,
        next_milestone_title=next_milestone.title if next_milestone else "当前阶段里程碑已完成",
        next_review_at=next_review_at,
        readiness_index=snapshot.readiness_index,
        latest_review_summary=latest_review.adjustment_summary if latest_review else "本月尚未发起周期评估，建议完成一次月评。",
        gap_closure_index=snapshot.gap_closure_index,
        uses_latest_profile=snapshot.uses_latest_profile,
    )


def _find_phase_for_key(phases: list[GrowthPlanPhase], phase_key: str) -> GrowthPlanPhase | None:
    return next((phase for phase in phases if phase.phase_key == phase_key), None)


def phasePercentValue(phase: GrowthPlanPhase) -> int:
    total = phase.milestone_summary.total_count if phase.milestone_summary else len(phase.milestones)
    completed = phase.milestone_summary.completed_count if phase.milestone_summary else sum(
        1 for item in phase.milestones if item.status == "completed"
    )
    return round((completed / total) * 100) if total else 0


def build_current_learning_steps(
    phases: list[GrowthPlanPhase],
    *,
    current_phase_key: str,
) -> list[GrowthPlanCurrentLearningStep]:
    current_phase = _find_phase_for_key(phases, current_phase_key)
    if current_phase is None:
        return []

    module_usage: dict[str, int] = {}
    steps: list[GrowthPlanCurrentLearningStep] = []
    learning_milestones = sorted(
        [item for item in current_phase.milestones if item.category == "learning"],
        key=lambda item: (item.step_index or 99, item.milestone_id),
    )[:3]
    for fallback_index, milestone in enumerate(learning_milestones, start=1):
        step_index = milestone.step_index or fallback_index
        module = next(
            (
                item
                for item in current_phase.learning_modules
                if item.module_id == milestone.related_learning_module_id
            ),
            None,
        )
        resource = None
        if module and module.resource_recommendations:
            usage_index = module_usage.get(module.module_id, 0)
            resource_index = min(usage_index, len(module.resource_recommendations) - 1)
            resource = module.resource_recommendations[resource_index]
            module_usage[module.module_id] = usage_index + 1
            resource = resource.model_copy(
                update={
                    "step_label": resource.step_label or f"第 {step_index} 步",
                    "why_first": resource.why_first or _resource_why_first(module=module, step_index=step_index),
                    "expected_output": resource.expected_output
                    or _resource_expected_output(phase=current_phase, module=module),
                }
            )
        objective = (
            module.learning_content
            if module is not None
            else f"围绕当前阶段目标完成第 {step_index} 步基础学习，并提交学习小结。"
        )
        steps.append(
            GrowthPlanCurrentLearningStep(
                step_index=step_index,
                milestone_id=milestone.milestone_id,
                title=milestone.title,
                objective=objective,
                status=milestone.submission_status,
                resource=resource,
                summary_text=milestone.submission_summary,
                submission_files=milestone.submission_files,
                latest_assessment=milestone.latest_assessment,
            )
        )
    return steps


def build_phase_flow_summary(
    phases: list[GrowthPlanPhase],
    *,
    current_phase_key: str,
) -> list[GrowthPlanPhaseFlowItem]:
    items: list[GrowthPlanPhaseFlowItem] = []
    current_index = next(
        (index for index, phase in enumerate(phases) if phase.phase_key == current_phase_key),
        0,
    )
    for index, phase in enumerate(phases):
        status = "completed" if index < current_index else "current" if index == current_index else "upcoming"
        next_hint = ""
        if status == "current":
            next_hint = phase.learning_modules[0].topic if phase.learning_modules else phase.goal_statement
        elif status == "upcoming":
            next_hint = phase.practice_actions[0].title if phase.practice_actions else phase.goal_statement
        else:
            next_hint = phase.deliverables[0] if phase.deliverables else phase.goal_statement
        items.append(
            GrowthPlanPhaseFlowItem(
                phase_key=phase.phase_key,
                phase_label=phase.phase_label,
                time_horizon=phase.time_horizon,
                status=status,
                progress_percent=phasePercentValue(phase),
                summary=phase.goal_statement,
                next_hint=next_hint,
            )
        )
    return items


def build_current_action_summary(
    workspace_overview: PlanWorkspaceOverview,
    current_steps: list[GrowthPlanCurrentLearningStep],
) -> PlanWorkspaceCurrentActionSummary:
    current_step = next((item for item in current_steps if item.status != "passed"), None) or (
        current_steps[0] if current_steps else None
    )
    if current_step is None:
        return PlanWorkspaceCurrentActionSummary(
            current_phase_key=workspace_overview.current_phase_key,
            current_phase_label=workspace_overview.current_phase_label,
            headline="当前阶段的 3 步已完成",
            support_text="可以开始查看下一阶段的简要要求，并在合适的时候发起月评。",
            audit_summary="最近一次审计显示当前步骤已全部通过。",
            next_review_at=workspace_overview.next_review_at,
        )
    assessment = current_step.latest_assessment
    return PlanWorkspaceCurrentActionSummary(
        current_phase_key=workspace_overview.current_phase_key,
        current_phase_label=workspace_overview.current_phase_label,
        headline=current_step.title,
        support_text=current_step.objective,
        audit_summary=assessment.summary if assessment else "提交学习材料后，系统会判断你是否达到该步骤的基础通过线。",
        next_review_at=workspace_overview.next_review_at,
    )


def build_integrity_check(markdown: str) -> IntegrityCheckPayload:
    content = re.sub(r"\s+", "", markdown or "").lower()
    issues: list[IntegrityIssue] = []
    for section_key, keywords, fix in SECTION_RULES:
        found = any(re.sub(r"\s+", "", keyword).lower() in content for keyword in keywords)
        if not found:
            issues.append(
                IntegrityIssue(
                    severity="blocking" if section_key in {"target_overview", "short_term", "mid_term", "long_term"} else "warning",
                    section_key=section_key,
                    message=f"缺少“{keywords[0]}”相关内容。",
                    suggested_fix=fix,
                    anchor=_slugify(keywords[0]),
                )
            )

    if not re.search(r"(项目|实习|竞赛|开源|证书|求职)", markdown or ""):
        issues.append(
            IntegrityIssue(
                severity="suggestion",
                section_key="practice",
                message="实践安排还不够具体，建议明确项目、实习、竞赛、开源或求职动作。",
                suggested_fix="给每个阶段至少补 1 条可以执行的实践动作，并写清预期成果物。",
                anchor="实践安排",
            )
        )
    if not re.search(r"(成果物|作品|案例|证据)", markdown or ""):
        issues.append(
            IntegrityIssue(
                severity="suggestion",
                section_key="deliverables",
                message="当前报告对成果物描述偏弱，建议补充可沉淀的作品、案例或证明材料。",
                suggested_fix="为每个阶段补充 1-3 个阶段成果物，便于月评时核对证据沉淀。",
                anchor="阶段成果物",
            )
        )

    blocking_count = sum(1 for item in issues if item.severity == "blocking")
    warning_count = sum(1 for item in issues if item.severity == "warning")
    suggestion_count = sum(1 for item in issues if item.severity == "suggestion")
    summary = (
        "结构完整，可进入导出流程。"
        if blocking_count == 0 and warning_count == 0
        else f"发现 {blocking_count} 个阻塞项、{warning_count} 个警告项，建议先修复。"
    )
    return IntegrityCheckPayload(
        issues=issues,
        blocking_count=blocking_count,
        warning_count=warning_count,
        suggestion_count=suggestion_count,
        checked_at=utc_now(),
        summary=summary,
    )


def polish_markdown(markdown: str, *, mode: str) -> tuple[str, str]:
    text = (markdown or "").replace("\r\n", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    if mode == "formal":
        polished = re.sub(r"(?m)^- ", "- ", text)
    elif mode == "concise":
        lines: list[str] = []
        for raw_line in text.split("\n"):
            line = raw_line.strip()
            if line and lines and lines[-1] == line:
                continue
            lines.append(raw_line)
        polished = "\n".join(lines).strip()
    else:
        polished = (
            text.replace("你", "该学生")
            .replace("你的", "该学生的")
            .replace("建议你", "建议该学生")
        )

    fact_guard_notice = "润色仅调整表达，不补造经历、成果或行业事实。"
    return polished, fact_guard_notice


def _priority_keys_from_report(report: CareerDevelopmentFavoritePayload) -> list[str]:
    return report.report_snapshot.priority_gap_dimensions[:3] or [
        item.key for item in _priority_gap_dimensions(report)
    ]


def _comparison_rows(
    report: CareerDevelopmentFavoritePayload | None,
) -> dict[str, StudentCompetencyComparisonDimensionItem]:
    if report is None:
        return {}
    return {item.key: item for item in report.report_snapshot.comparison_dimensions}


def _build_change_item(
    row: StudentCompetencyComparisonDimensionItem,
    *,
    reason: str,
    next_action: str,
    phase_key: str,
) -> PlanReviewChangeItem:
    return PlanReviewChangeItem(
        title=row.title,
        reason=reason,
        next_action=next_action,
        phase_key=phase_key,
    )


def build_monthly_review_payload(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    phases: list[GrowthPlanPhase],
    current_report: CareerDevelopmentFavoritePayload | None,
    latest_profile_refreshed_at: datetime | None,
) -> PlanReviewPayload:
    baseline_rows = _comparison_rows(favorite)
    current_rows = _comparison_rows(current_report)
    priority_keys = _priority_keys_from_report(favorite)
    current_priority_keys = _priority_keys_from_report(current_report) if current_report is not None else []
    keep_items: list[PlanReviewChangeItem] = []
    deprioritized_items: list[PlanReviewChangeItem] = []
    new_items: list[PlanReviewChangeItem] = []

    for key in priority_keys:
        baseline = baseline_rows.get(key)
        current = current_rows.get(key) if current_rows else None
        if baseline is None:
            continue
        if current is None:
            keep_items.append(
                _build_change_item(
                    baseline,
                    reason="本次月评未拿到最新画像重算结果，继续保留为当前优先项。",
                    next_action=f"继续围绕 {_missing_keyword_text(baseline)} 补充新的学习与实践证据。",
                    phase_key="short_term",
                )
            )
            continue
        if key in current_priority_keys:
            keep_items.append(
                _build_change_item(
                    current,
                    reason=f"该项仍位于当前优先短板，最新 gap 为 {current.gap:.2f}%。",
                    next_action=f"继续优先补齐 {_missing_keyword_text(current)} 相关证据与表达。",
                    phase_key="short_term" if current.gap >= 35 else "mid_term",
                )
            )
        elif current.user_readiness >= 55 or current.gap < baseline.gap:
            deprioritized_items.append(
                _build_change_item(
                    current,
                    reason=f"该项已较初始阶段改善，gap 从 {baseline.gap:.2f}% 收敛到 {current.gap:.2f}%。",
                    next_action="保持低频复盘即可，把主力资源转向仍然卡住推进的短板。",
                    phase_key="mid_term",
                )
            )

    for key in current_priority_keys:
        if key in priority_keys:
            continue
        current = current_rows.get(key)
        if current is None:
            continue
        new_items.append(
            _build_change_item(
                current,
                reason=f"最新画像显示该项进入新的优先短板，当前 gap 为 {current.gap:.2f}%。",
                next_action=f"把 {current.title} 纳入下月主线，并尽快补 1 条实践证据。",
                phase_key="mid_term" if current.gap < 35 else "short_term",
            )
        )
        if len(new_items) >= 3:
            break

    metric_snapshot = calculate_metric_snapshot(
        phases,
        baseline_report=favorite,
        current_report=current_report,
        latest_profile_refreshed_at=latest_profile_refreshed_at,
    )
    prefix = "本次月评已基于最新学生画像刷新差距指标。" if current_report is not None else "本次月评未使用最新学生画像刷新差距指标。"
    adjustment_summary = (
        prefix
        + f" 当前就绪指数为 {metric_snapshot.readiness_index:.2f}，"
        + (
            "建议先稳住已有优先项，再逐步吸收新增项。"
            if new_items
            else "建议继续围绕既有优先项推进，并把已改善项转入低频维护。"
        )
    )
    return PlanReviewPayload(
        review_id=1,
        review_type="monthly",
        metric_snapshot=metric_snapshot,
        keep_items=keep_items[:3],
        deprioritized_items=deprioritized_items[:3],
        new_items=new_items[:3],
        adjustment_summary=adjustment_summary,
        created_at=utc_now(),
    )


def build_weekly_review_payload(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    phases: list[GrowthPlanPhase],
) -> PlanReviewPayload:
    metric_snapshot = calculate_metric_snapshot(phases, baseline_report=favorite)
    return PlanReviewPayload(
        review_id=1,
        review_type="weekly",
        metric_snapshot=metric_snapshot,
        keep_items=[],
        deprioritized_items=[],
        new_items=[],
        adjustment_summary="本周复盘已更新里程碑状态与阻塞项，建议继续围绕当前阶段主线推进。",
        created_at=utc_now(),
    )


def _learning_resource_progress_summary(phases: list[GrowthPlanPhase]) -> str:
    linked_milestones = [
        milestone
        for phase in phases
        for milestone in phase.milestones
        if milestone.category == "learning" and milestone.related_learning_module_id
    ]
    if not linked_milestones:
        return "当前学习里程碑尚未绑定推荐路线。"
    completed = sum(1 for item in linked_milestones if item.status == "completed")
    blocked = sum(1 for item in linked_milestones if item.status == "blocked")
    return (
        f"已绑定推荐路线的学习里程碑共 {len(linked_milestones)} 个，"
        f"已完成 {completed} 个，阻塞 {blocked} 个。"
    )


def build_monthly_review_payload(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    phases: list[GrowthPlanPhase],
    current_report: CareerDevelopmentFavoritePayload | None,
    latest_profile_refreshed_at: datetime | None,
) -> PlanReviewPayload:
    baseline_rows = _comparison_rows(favorite)
    current_rows = _comparison_rows(current_report)
    priority_keys = _priority_keys_from_report(favorite)
    current_priority_keys = _priority_keys_from_report(current_report) if current_report is not None else []
    keep_items: list[PlanReviewChangeItem] = []
    deprioritized_items: list[PlanReviewChangeItem] = []
    new_items: list[PlanReviewChangeItem] = []

    for key in priority_keys:
        baseline = baseline_rows.get(key)
        current = current_rows.get(key) if current_rows else None
        if baseline is None:
            continue
        if current is None:
            keep_items.append(
                _build_change_item(
                    baseline,
                    reason="本次月评未拿到最新画像重算结果，继续保留为当前优先项。",
                    next_action=f"继续围绕 {_missing_keyword_text(baseline)} 补充新的学习与实践证据。",
                    phase_key="short_term",
                )
            )
            continue
        if key in current_priority_keys:
            keep_items.append(
                _build_change_item(
                    current,
                    reason=f"该项仍位于当前优先短板，最新 gap 为 {current.gap:.2f}%。",
                    next_action=f"继续优先补齐 {_missing_keyword_text(current)} 相关证据与表达。",
                    phase_key="short_term" if current.gap >= 35 else "mid_term",
                )
            )
        elif current.user_readiness >= 55 or current.gap < baseline.gap:
            deprioritized_items.append(
                _build_change_item(
                    current,
                    reason=f"该项较初始阶段已有改善，gap 已从 {baseline.gap:.2f}% 收敛到 {current.gap:.2f}%。",
                    next_action="保持低频复盘即可，把主要资源转向仍然卡住推进的短板。",
                    phase_key="mid_term",
                )
            )

    for key in current_priority_keys:
        if key in priority_keys:
            continue
        current = current_rows.get(key)
        if current is None:
            continue
        new_items.append(
            _build_change_item(
                current,
                reason=f"最新画像显示该项进入新的优先短板，当前 gap 为 {current.gap:.2f}%。",
                next_action=f"把 {current.title} 纳入下月主线，并尽快补 1 条实践证据。",
                phase_key="mid_term" if current.gap < 35 else "short_term",
            )
        )
        if len(new_items) >= 3:
            break

    metric_snapshot = calculate_metric_snapshot(
        phases,
        baseline_report=favorite,
        current_report=current_report,
        latest_profile_refreshed_at=latest_profile_refreshed_at,
    )
    prefix = (
        "本次月评已基于最新学生画像刷新差距指标。"
        if current_report is not None
        else "本次月评未使用最新学生画像刷新差距指标。"
    )
    adjustment_summary = (
        prefix
        + f" 当前就绪指数为 {metric_snapshot.readiness_index:.2f}。"
        + (
            "建议先稳住已有优先项，再逐步吸收新增项。"
            if new_items
            else "建议继续围绕既有优先项推进，并把已改善项转入低频维护。"
        )
        + _learning_resource_progress_summary(phases)
    )
    return PlanReviewPayload(
        review_id=1,
        review_type="monthly",
        metric_snapshot=metric_snapshot,
        keep_items=keep_items[:3],
        deprioritized_items=deprioritized_items[:3],
        new_items=new_items[:3],
        adjustment_summary=adjustment_summary,
        created_at=utc_now(),
    )


def build_weekly_review_payload(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    phases: list[GrowthPlanPhase],
) -> PlanReviewPayload:
    metric_snapshot = calculate_metric_snapshot(phases, baseline_report=favorite)
    return PlanReviewPayload(
        review_id=1,
        review_type="weekly",
        metric_snapshot=metric_snapshot,
        keep_items=[],
        deprioritized_items=[],
        new_items=[],
        adjustment_summary=(
            "本周复盘已更新里程碑状态、阻塞项与推荐路线推进情况。"
            + _learning_resource_progress_summary(phases)
        ),
        created_at=utc_now(),
    )


def _load_workspace_generated_payload(row: CareerDevelopmentPlanWorkspace) -> dict[str, Any]:
    return _json_loads(row.generated_plan_json)


def _load_workspace_current_payload(row: CareerDevelopmentPlanWorkspace) -> dict[str, Any]:
    return _json_loads(row.current_plan_json)


def _parse_phases(payload: dict[str, Any]) -> list[GrowthPlanPhase]:
    raw = payload.get("growth_plan_phases") or []
    if not isinstance(raw, list):
        return []
    return populate_phase_summaries(
        [GrowthPlanPhase.model_validate(item) for item in raw if isinstance(item, dict)]
    )


def _parse_review_framework(payload: dict[str, Any]) -> ReviewFramework:
    raw = payload.get("review_framework")
    if isinstance(raw, dict):
        try:
            return ReviewFramework.model_validate(raw)
        except Exception:
            pass
    return build_default_review_framework()


def _parse_integrity(row: CareerDevelopmentPlanWorkspace) -> IntegrityCheckPayload | None:
    payload = _json_loads(row.latest_integrity_check_json)
    if not payload:
        return None
    try:
        return IntegrityCheckPayload.model_validate(payload)
    except Exception:
        return None


def _parse_latest_review(row: CareerDevelopmentPlanWorkspace) -> PlanReviewPayload | None:
    payload = _json_loads(row.latest_review_json)
    if not payload:
        return None
    try:
        return PlanReviewPayload.model_validate(payload)
    except Exception:
        return None


def _parse_export_meta(row: CareerDevelopmentPlanWorkspace) -> PlanExportMeta:
    payload = _json_loads(row.export_meta_json)
    if not payload:
        return PlanExportMeta()
    try:
        return PlanExportMeta.model_validate(payload)
    except Exception:
        return PlanExportMeta()


def _safe_filename(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", name or "upload.bin").strip("._") or "upload.bin"


def _strip_markup(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip()


def _extract_upload_text(*, file_name: str, content_type: str, content: bytes) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix in {".txt", ".md", ".markdown", ".json", ".csv", ".xml", ".html", ".htm", ".py", ".js", ".ts"}:
        return content.decode("utf-8", errors="ignore").strip()[:4000]
    if suffix == ".docx":
        try:
            with ZipFile(BytesIO(content)) as archive:
                xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
                return _strip_markup(xml)[:4000]
        except Exception:
            return ""
    if content_type.startswith("text/"):
        return content.decode("utf-8", errors="ignore").strip()[:4000]
    return ""


def _extract_json_candidate(text: str) -> Any | None:
    raw = (text or "").strip()
    if not raw:
        return None
    candidates = [raw]
    if "```" in raw:
        for segment in raw.split("```"):
            cleaned = segment.strip()
            if not cleaned:
                continue
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            candidates.append(cleaned)
    if "{" in raw and "}" in raw:
        candidates.append(raw[raw.find("{") : raw.rfind("}") + 1])
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except Exception:
            continue
    return None


async def _assess_learning_step(
    *,
    favorite: CareerDevelopmentFavoritePayload,
    phase: GrowthPlanPhase,
    milestone: GrowthPlanMilestone,
    module: GrowthPlanLearningModule | None,
    resource: GrowthPlanLearningResourceItem | None,
    summary_text: str,
    uploaded_files: list[GrowthPlanSubmissionFile],
) -> GrowthPlanStepAssessment:
    client = OpenAICompatibleLLMClient.from_settings()
    try:
        file_context = "\n".join(
            [
                f"- 文件名：{item.file_name}\n  提取文本：{item.text_excerpt or '无可提取文本，仅记录了文件元数据。'}"
                for item in uploaded_files
            ]
        )
        messages = [
            ChatMessage(
                role="system",
                content=(
                    "你是学生成长路径规划工作台的学习步骤审核器。"
                    "请只判断学生是否基于给定学习网站完成了当前步骤的基础学习。"
                    "不要评估高阶水平，不要补造事实。"
                    "输出必须是 JSON："
                    '{"result":"passed|needs_more_evidence","summary":"...","missing_points":["..."],"next_action":"..."}'
                ),
            ),
            ChatMessage(
                role="user",
                content=(
                    f"目标岗位：{favorite.canonical_job_title}\n"
                    f"当前阶段：{phase.phase_label}（{phase.time_horizon}）\n"
                    f"当前步骤：{milestone.title}\n"
                    f"步骤目标：{module.learning_content if module else phase.goal_statement}\n"
                    f"学习网站：{resource.url if resource else '暂无链接'}\n"
                    f"推荐理由：{resource.reason if resource else '暂无'}\n"
                    f"期望输出：{resource.expected_output if resource else (_resource_expected_output(phase=phase, module=module) if module else '提交学习小结、基础笔记或基础练习结果。')}\n"
                    f"学生小结：{summary_text or '未填写'}\n"
                    f"上传材料：\n{file_context or '- 无附件'}\n\n"
                    "判断标准：只要能看出学生确实围绕该网站完成了基础学习，并沉淀了基础笔记、总结或基础练习结果，就判定为 passed；否则为 needs_more_evidence。"
                ),
            ),
        ]
        raw = await client.chat_completion(messages, temperature=0.0)
    finally:
        await client.aclose()

    payload = _extract_json_candidate(raw)
    if not isinstance(payload, dict):
        raise LLMClientError("学习步骤审核返回了不可解析的结果。")
    result = str(payload.get("result") or "").strip()
    if result not in {"passed", "needs_more_evidence"}:
        raise LLMClientError("学习步骤审核结果缺少有效的 result 字段。")
    missing_points = payload.get("missing_points") or []
    return GrowthPlanStepAssessment(
        result=result,
        summary=str(payload.get("summary") or "").strip() or "系统已完成本次步骤审核。",
        missing_points=[str(item).strip() for item in missing_points if str(item).strip()],
        next_action=str(payload.get("next_action") or "").strip(),
        assessed_at=utc_now(),
    )


def get_plan_workspace_record(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> CareerDevelopmentPlanWorkspace | None:
    return db.scalar(
        select(CareerDevelopmentPlanWorkspace).where(
            CareerDevelopmentPlanWorkspace.user_id == user_id,
            CareerDevelopmentPlanWorkspace.favorite_id == favorite_id,
        )
    )


def _latest_completed_task_record(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> CareerDevelopmentGoalPlanTask | None:
    return db.scalar(
        select(CareerDevelopmentGoalPlanTask)
        .where(
            CareerDevelopmentGoalPlanTask.user_id == user_id,
            CareerDevelopmentGoalPlanTask.favorite_id == favorite_id,
            CareerDevelopmentGoalPlanTask.status == "completed",
        )
        .order_by(CareerDevelopmentGoalPlanTask.updated_at.desc())
    )


def _generated_markdown_supporting_sections(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    user_id: int,
    favorite_id: int,
) -> tuple[str, str, str]:
    generated_payload = _load_workspace_generated_payload(row)
    comprehensive = str(generated_payload.get("comprehensive_report_markdown") or "").strip()
    trend = str(generated_payload.get("trend_section_markdown") or "").strip()
    path = str(generated_payload.get("path_section_markdown") or "").strip()
    if comprehensive or trend or path:
        return comprehensive, trend, path

    task_row = None
    if row.source_task_id:
        task_row = db.get(CareerDevelopmentGoalPlanTask, row.source_task_id)
    if task_row is None:
        task_row = _latest_completed_task_record(db, user_id=user_id, favorite_id=favorite_id)
    if task_row is None:
        return "", "", ""

    payload = _json_loads(task_row.result_json)
    if not payload:
        return "", "", ""
    try:
        result = CareerDevelopmentGoalPlanResultPayload.model_validate(payload)
    except Exception:
        return "", "", ""
    return (
        result.comprehensive_report_markdown,
        result.trend_section_markdown,
        result.path_section_markdown,
    )


def _rebuild_generated_report_markdown(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    favorite: CareerDevelopmentFavoritePayload,
    user_id: int,
    favorite_id: int,
    phases: list[GrowthPlanPhase],
    review_framework: ReviewFramework,
) -> str:
    comprehensive, trend, path = _generated_markdown_supporting_sections(
        db,
        row=row,
        user_id=user_id,
        favorite_id=favorite_id,
    )
    return build_generated_report_markdown(
        favorite,
        growth_plan_phases=phases,
        review_framework=review_framework,
        comprehensive_report_markdown=comprehensive,
        trend_section_markdown=trend,
        path_section_markdown=path,
    )


def _should_sync_edited_report_markdown(
    *,
    edited_report_markdown: str,
    previous_generated_markdown: str,
) -> bool:
    edited = (edited_report_markdown or "").strip()
    generated = (previous_generated_markdown or "").strip()
    return not edited or edited == generated


def upsert_workspace_from_goal_plan_result(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    result: CareerDevelopmentGoalPlanResultPayload,
    source_task_id: str | None = None,
) -> CareerDevelopmentPlanWorkspace:
    normalized = normalize_goal_plan_result(result)
    row = get_plan_workspace_record(db, user_id=user_id, favorite_id=favorite_id)
    if row is None:
        row = CareerDevelopmentPlanWorkspace(
            user_id=user_id,
            favorite_id=favorite_id,
        )

    generated_payload = {
        "growth_plan_phases": [item.model_dump(mode="json") for item in normalized.growth_plan_phases],
        "review_framework": normalized.review_framework.model_dump(mode="json")
        if normalized.review_framework
        else build_default_review_framework().model_dump(mode="json"),
        "comprehensive_report_markdown": normalized.comprehensive_report_markdown,
        "trend_section_markdown": normalized.trend_section_markdown,
        "path_section_markdown": normalized.path_section_markdown,
    }
    row.source_task_id = source_task_id
    row.generated_plan_json = _json_dumps(generated_payload)
    row.current_plan_json = _json_dumps(generated_payload)
    row.generated_report_markdown = normalized.generated_report_markdown
    row.edited_report_markdown = row.edited_report_markdown or normalized.generated_report_markdown
    row.latest_integrity_check_json = _json_dumps(
        build_integrity_check(row.edited_report_markdown).model_dump(mode="json")
    )
    if not row.export_meta_json:
        row.export_meta_json = _json_dumps(PlanExportMeta().model_dump(mode="json"))
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_or_create_plan_workspace(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> CareerDevelopmentPlanWorkspace | None:
    existing = get_plan_workspace_record(db, user_id=user_id, favorite_id=favorite_id)
    if existing is not None:
        return existing

    task_row = _latest_completed_task_record(db, user_id=user_id, favorite_id=favorite_id)
    if task_row is None:
        return None

    result_payload = _json_loads(task_row.result_json)
    if not result_payload:
        return None
    result = CareerDevelopmentGoalPlanResultPayload.model_validate(result_payload)
    return upsert_workspace_from_goal_plan_result(
        db,
        user_id=user_id,
        favorite_id=favorite_id,
        result=result,
        source_task_id=task_row.id,
    )


def build_plan_workspace_payload(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    user_id: int,
    favorite_id: int,
) -> PlanWorkspacePayload:
    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        raise ValueError("收藏目标不存在或无权访问。")
    favorite = read_favorite_report_payload(favorite_record)
    generated_payload = _load_workspace_generated_payload(row)
    current_payload = _load_workspace_current_payload(row)
    phases = _parse_phases(current_payload) or _parse_phases(generated_payload) or build_growth_plan_phases(favorite)
    review_framework = _parse_review_framework(generated_payload)
    latest_review = _parse_latest_review(row)
    integrity = _parse_integrity(row)
    if integrity is None:
        integrity = build_integrity_check(row.edited_report_markdown or row.generated_report_markdown)
    metric_snapshot = (
        latest_review.metric_snapshot
        if latest_review
        else calculate_metric_snapshot(phases, baseline_report=favorite)
    )
    overview = build_workspace_overview(
        phases,
        latest_review=latest_review,
        metric_snapshot=metric_snapshot,
        reference_time=row.updated_at,
    )
    current_learning_steps = build_current_learning_steps(
        phases,
        current_phase_key=overview.current_phase_key,
    )
    phase_flow_summary = build_phase_flow_summary(
        phases,
        current_phase_key=overview.current_phase_key,
    )
    current_action_summary = build_current_action_summary(overview, current_learning_steps)
    generated_report_markdown = row.generated_report_markdown or ""
    edited_report_markdown = row.edited_report_markdown or generated_report_markdown
    if _looks_like_mojibake(generated_report_markdown) or not generated_report_markdown.strip():
        generated_report_markdown = _rebuild_generated_report_markdown(
            db,
            row=row,
            favorite=favorite,
            user_id=user_id,
            favorite_id=favorite_id,
            phases=phases,
            review_framework=review_framework,
        )
        row.generated_report_markdown = generated_report_markdown
        if not edited_report_markdown.strip() or _looks_like_mojibake(edited_report_markdown):
            edited_report_markdown = generated_report_markdown
            row.edited_report_markdown = edited_report_markdown
        integrity = build_integrity_check(edited_report_markdown)
        row.latest_integrity_check_json = _json_dumps(integrity.model_dump(mode="json"))
        db.add(row)
        db.commit()
        db.refresh(row)
    return PlanWorkspacePayload(
        workspace_id=row.id,
        favorite=favorite,
        generated_report_markdown=generated_report_markdown,
        edited_report_markdown=edited_report_markdown,
        workspace_overview=overview,
        metric_snapshot=metric_snapshot,
        growth_plan_phases=phases,
        review_framework=review_framework,
        latest_integrity_check=integrity,
        latest_review=latest_review,
        export_meta=_parse_export_meta(row),
        current_learning_steps=current_learning_steps,
        phase_flow_summary=phase_flow_summary,
        current_action_summary=current_action_summary,
        updated_at=row.updated_at,
    )


def update_workspace_content(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    edited_report_markdown: str,
    growth_plan_phases: list[GrowthPlanPhase] | None,
) -> CareerDevelopmentPlanWorkspace:
    generated_payload = _load_workspace_generated_payload(row)
    phases = populate_phase_summaries(growth_plan_phases or _parse_phases(generated_payload))
    current_payload = {
        "growth_plan_phases": [item.model_dump(mode="json") for item in phases]
    }
    row.current_plan_json = _json_dumps(current_payload)
    row.edited_report_markdown = edited_report_markdown
    row.latest_integrity_check_json = _json_dumps(
        build_integrity_check(edited_report_markdown).model_dump(mode="json")
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


async def generate_learning_resources_for_workspace(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    phase_key: str,
    module_id: str,
    force_refresh: bool = False,
) -> CareerDevelopmentPlanWorkspace:
    row = get_or_create_plan_workspace(db, user_id=user_id, favorite_id=favorite_id)
    if row is None:
        raise ValueError("当前目标尚未生成工作台，请先完成成长路径规划生成。")
    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        raise ValueError("收藏目标不存在或无权访问。")
    favorite = read_favorite_report_payload(favorite_record)

    generated_payload = _load_workspace_generated_payload(row)
    generated_phases = _parse_phases(generated_payload) or build_growth_plan_phases(favorite)
    current_phases = _parse_phases(_load_workspace_current_payload(row)) or _parse_phases(generated_payload) or build_growth_plan_phases(favorite)

    current_phase = next((phase for phase in current_phases if phase.phase_key == phase_key), None)
    generated_phase = next((phase for phase in generated_phases if phase.phase_key == phase_key), None)
    if current_phase is None or generated_phase is None:
        raise ValueError("未找到对应阶段。")

    current_module = next((item for item in current_phase.learning_modules if item.module_id == module_id), None)
    generated_module = next((item for item in generated_phase.learning_modules if item.module_id == module_id), None)
    if current_module is None or generated_module is None:
        raise ValueError("未找到对应学习模块。")

    if current_module.resource_recommendations and not force_refresh:
        return row

    client = DifyCareerLearningResourceClient()
    try:
        result = await client.generate_learning_resources(
            favorite=favorite,
            phase=current_phase,
            module=current_module,
            user=f"career-goal-resource-{user_id}-{favorite_id}-{module_id}",
        )
        recommendations = parse_learning_resource_recommendations(
            result.answer,
            fallback_title=current_module.topic,
        )
        if not recommendations:
            raise CareerDevelopmentLearningResourceError("未能从 Dify 返回中解析出有效学习路线链接。")

        generated_at = utc_now()
        for module in (current_module, generated_module):
            module.resource_recommendations = recommendations
            module.resource_status = "ready"
            module.resource_generated_at = generated_at
            module.resource_error_message = ""

        generated_payload["growth_plan_phases"] = [item.model_dump(mode="json") for item in generated_phases]
        row.generated_plan_json = _json_dumps(generated_payload)
        row.current_plan_json = _json_dumps(
            {"growth_plan_phases": [item.model_dump(mode="json") for item in current_phases]}
        )

        previous_generated_markdown = row.generated_report_markdown
        review_framework = _parse_review_framework(generated_payload)
        row.generated_report_markdown = _rebuild_generated_report_markdown(
            db,
            row=row,
            favorite=favorite,
            user_id=user_id,
            favorite_id=favorite_id,
            phases=generated_phases,
            review_framework=review_framework,
        )
        if _should_sync_edited_report_markdown(
            edited_report_markdown=row.edited_report_markdown,
            previous_generated_markdown=previous_generated_markdown,
        ):
            row.edited_report_markdown = row.generated_report_markdown
            row.latest_integrity_check_json = _json_dumps(
                build_integrity_check(row.edited_report_markdown).model_dump(mode="json")
            )

    except CareerDevelopmentLearningResourceError as exc:
        for module in (current_module, generated_module):
            module.resource_status = "failed"
            module.resource_error_message = str(exc)
        generated_payload["growth_plan_phases"] = [item.model_dump(mode="json") for item in generated_phases]
        row.generated_plan_json = _json_dumps(generated_payload)
        row.current_plan_json = _json_dumps(
            {"growth_plan_phases": [item.model_dump(mode="json") for item in current_phases]}
        )
    finally:
        await client.aclose()

    db.add(row)
    db.commit()
    db.refresh(row)
    return row


async def submit_workspace_learning_milestone(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    milestone_id: str,
    summary_text: str,
    uploads: list[UploadFile],
) -> CareerDevelopmentPlanWorkspace:
    row = get_or_create_plan_workspace(db, user_id=user_id, favorite_id=favorite_id)
    if row is None:
        raise ValueError("当前目标尚未生成工作台，请先完成成长路径规划生成。")
    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        raise ValueError("收藏目标不存在或无权访问。")
    favorite = read_favorite_report_payload(favorite_record)
    current_payload = _load_workspace_current_payload(row)
    generated_payload = _load_workspace_generated_payload(row)
    phases = _parse_phases(current_payload) or _parse_phases(generated_payload) or build_growth_plan_phases(favorite)

    target_phase: GrowthPlanPhase | None = None
    target_milestone: GrowthPlanMilestone | None = None
    target_module: GrowthPlanLearningModule | None = None
    target_resource: GrowthPlanLearningResourceItem | None = None
    for phase in phases:
        for milestone in phase.milestones:
            if milestone.milestone_id != milestone_id:
                continue
            if milestone.category != "learning":
                raise ValueError("当前只支持提交学习型里程碑。")
            target_phase = phase
            target_milestone = milestone
            target_module = next(
                (
                    item
                    for item in phase.learning_modules
                    if item.module_id == milestone.related_learning_module_id
                ),
                None,
            )
            if target_module and target_module.resource_recommendations:
                resource_index = max((milestone.step_index or 1) - 1, 0)
                target_resource = target_module.resource_recommendations[
                    min(resource_index, len(target_module.resource_recommendations) - 1)
                ]
                target_resource = target_resource.model_copy(
                    update={
                        "step_label": target_resource.step_label or f"第 {milestone.step_index or 1} 步",
                        "why_first": target_resource.why_first
                        or _resource_why_first(module=target_module, step_index=milestone.step_index or 1),
                        "expected_output": target_resource.expected_output
                        or _resource_expected_output(phase=phase, module=target_module),
                    }
                )
            break
        if target_milestone is not None:
            break
    if target_phase is None or target_milestone is None:
        raise ValueError("未找到对应的学习步骤。")

    PLAN_STEP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    upload_dir = PLAN_STEP_UPLOAD_DIR / row.id / milestone_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_payloads: list[GrowthPlanSubmissionFile] = []
    for upload in uploads:
        content = await upload.read()
        safe_name = _safe_filename(upload.filename or "upload.bin")
        stored_name = f"{utc_now().strftime('%Y%m%d%H%M%S')}-{uuid4().hex}-{safe_name}"
        stored_path = upload_dir / stored_name
        stored_path.write_bytes(content)
        excerpt = _extract_upload_text(
            file_name=safe_name,
            content_type=upload.content_type or "",
            content=content,
        )
        file_payloads.append(
            GrowthPlanSubmissionFile(
                file_name=upload.filename or safe_name,
                stored_name=stored_name,
                content_type=upload.content_type or "application/octet-stream",
                size_bytes=len(content),
                file_path=str(stored_path.relative_to(DATA_DIR)),
                text_excerpt=excerpt,
            )
        )

    assessment = await _assess_learning_step(
        favorite=favorite,
        phase=target_phase,
        milestone=target_milestone,
        module=target_module,
        resource=target_resource,
        summary_text=summary_text,
        uploaded_files=file_payloads,
    )
    target_milestone.submission_summary = summary_text.strip()
    target_milestone.submission_files = file_payloads
    target_milestone.latest_assessment = assessment
    target_milestone.submission_status = assessment.result
    if assessment.result == "passed":
        target_milestone.status = "completed"
        target_milestone.completed_at = assessment.assessed_at
        target_milestone.evidence_note = assessment.summary
        target_milestone.blocker_note = ""
    else:
        target_milestone.status = "in_progress"
        target_milestone.completed_at = None
        target_milestone.blocker_note = ""

    populate_phase_summaries(phases)
    row.current_plan_json = _json_dumps({"growth_plan_phases": [item.model_dump(mode="json") for item in phases]})
    db.add(
        CareerDevelopmentPlanStepSubmission(
            workspace_id=row.id,
            user_id=user_id,
            favorite_id=favorite_id,
            milestone_id=milestone_id,
            submission_json=_json_dumps(
                {
                    "summary_text": summary_text.strip(),
                    "files": [item.model_dump(mode="json") for item in file_payloads],
                    "assessment": assessment.model_dump(mode="json"),
                }
            ),
        )
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


async def create_workspace_review(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    review_type: str,
    match_service: CareerDevelopmentMatchService | None = None,
) -> PlanReviewPayload:
    row = get_or_create_plan_workspace(db, user_id=user_id, favorite_id=favorite_id)
    if row is None:
        raise ValueError("当前目标尚未生成工作台，请先完成路径报告生成。")
    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        raise ValueError("收藏目标不存在或无权访问。")
    favorite = read_favorite_report_payload(favorite_record)
    phases = _parse_phases(_load_workspace_current_payload(row)) or build_growth_plan_phases(favorite)

    if review_type == "weekly":
        payload = build_weekly_review_payload(favorite, phases=phases)
    else:
        latest_profile = get_student_competency_latest_profile_record(db, user_id=user_id)
        current_report_payload: CareerDevelopmentFavoritePayload | None = None
        if latest_profile is not None and match_service is not None:
            try:
                latest_report = await match_service.build_report_for_favorite(user_id=user_id, favorite=favorite)
                current_report_payload = favorite.model_copy(update={"report_snapshot": latest_report})
            except Exception:
                current_report_payload = None
        payload = build_monthly_review_payload(
            favorite,
            phases=phases,
            current_report=current_report_payload,
            latest_profile_refreshed_at=latest_profile.updated_at if latest_profile is not None else None,
        )

    review_row = CareerDevelopmentPlanReview(
        workspace_id=row.id,
        user_id=user_id,
        favorite_id=favorite_id,
        review_type=review_type,
        snapshot_json="{}",
    )
    db.add(review_row)
    db.commit()
    db.refresh(review_row)
    payload = payload.model_copy(update={"review_id": review_row.id, "created_at": review_row.created_at})
    review_row.snapshot_json = _json_dumps(payload.model_dump(mode="json"))
    row.latest_review_json = review_row.snapshot_json
    db.add(review_row)
    db.add(row)
    db.commit()
    db.refresh(row)
    return payload


def _docx_document_xml(markdown: str) -> str:
    body_parts: list[str] = []
    for raw_line in (markdown or "").splitlines() or [""]:
        text = raw_line or " "
        body_parts.append(
            "<w:p><w:r><w:t xml:space=\"preserve\">"
            + xml_escape(text)
            + "</w:t></w:r></w:p>"
        )
    body_parts.append(
        "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/></w:sectPr>"
    )
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\" "
        "xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" "
        "xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" "
        "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
        "xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
        "xmlns:w10=\"urn:schemas-microsoft-com:office:word\" "
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\" "
        "xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\" "
        "xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\" "
        "xmlns:wne=\"http://schemas.microsoft.com/office/word/2006/wordml\" "
        "xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\" mc:Ignorable=\"w14 wp14\">"
        "<w:body>"
        + "".join(body_parts)
        + "</w:body></w:document>"
    )


def export_docx_bytes(markdown: str) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""",
        )
        archive.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""",
        )
        archive.writestr(
            "word/_rels/document.xml.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>""",
        )
        archive.writestr("word/document.xml", _docx_document_xml(markdown))
    return buffer.getvalue()


def _pdf_hex_text(text: str) -> str:
    return text.encode("utf-16-be").hex().upper()


def export_pdf_bytes(markdown: str) -> bytes:
    wrapped_lines: list[str] = []
    for raw_line in (markdown or "").splitlines():
        if not raw_line.strip():
            wrapped_lines.append("")
            continue
        wrapped_lines.extend(textwrap.wrap(raw_line, width=28) or [""])
    page_lines = [wrapped_lines[index : index + 34] for index in range(0, max(len(wrapped_lines), 1), 34)] or [[""]]
    objects: list[bytes] = []

    def append_object(content: bytes) -> int:
        objects.append(content)
        return len(objects)

    catalog_id = append_object(b"<< /Type /Catalog /Pages 2 0 R >>")
    pages_id = append_object(b"<< /Type /Pages /Count 0 /Kids [] >>")
    font_id = append_object(
        b"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>"
    )
    append_object(
        b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 >>"
    )

    page_object_ids: list[int] = []
    for lines in page_lines:
        commands = ["BT", "/F1 10 Tf", "50 790 Td", "18 TL"]
        first_line = True
        for line in lines:
            if not first_line:
                commands.append("T*")
            commands.append(f"<{_pdf_hex_text(line)}> Tj")
            first_line = False
        commands.append("ET")
        stream = "\n".join(commands).encode("ascii")
        content_id = append_object(
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream"
        )
        page_id = append_object(
            (
                f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 595 842] "
                f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>"
            ).encode("ascii")
        )
        page_object_ids.append(page_id)

    objects[pages_id - 1] = (
        f"<< /Type /Pages /Count {len(page_object_ids)} /Kids [{' '.join(f'{item} 0 R' for item in page_object_ids)}] >>"
    ).encode("ascii")

    output = BytesIO()
    output.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, content in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode("ascii"))
        output.write(content)
        output.write(b"\nendobj\n")
    xref_offset = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.write(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_offset}\n%%EOF"
        ).encode("ascii")
    )
    return output.getvalue()


def export_markdown_bytes(markdown: str) -> bytes:
    return (markdown or "").encode("utf-8")


def update_workspace_export_meta(
    db: Session,
    *,
    row: CareerDevelopmentPlanWorkspace,
    export_format: str,
    exported_with_issues: bool = False,
    blocking_count: int = 0,
) -> None:
    meta = _parse_export_meta(row)
    meta.last_exported_format = export_format
    meta.last_exported_at = utc_now()
    meta.last_exported_with_issues = exported_with_issues
    meta.last_exported_blocking_count = max(blocking_count, 0)
    row.export_meta_json = _json_dumps(meta.model_dump(mode="json"))
    db.add(row)
    db.commit()
    db.refresh(row)


def build_export_filename(favorite: CareerDevelopmentFavoritePayload, export_format: str) -> str:
    base = _slugify(favorite.canonical_job_title) or "career-development-plan"
    return f"{base}-workspace.{export_format}"
