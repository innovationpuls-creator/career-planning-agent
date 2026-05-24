from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.growth_workbench import (
    GrowthGapDiagnosis,
    GrowthReportVersion,
    GrowthResumeVersion,
    GrowthTargetDiagnosis,
    GrowthWorkbenchTask,
)
from app.schemas.growth_workbench import (
    GrowthGapDiagnosisPayload,
    GrowthReportVersionPayload,
    GrowthResumeVersionPayload,
    GrowthTargetDiagnosisPayload,
    GrowthWorkbenchAggregatePayload,
    GrowthWorkbenchEvidenceSource,
    GrowthWorkbenchPrerequisiteItem,
    GrowthWorkbenchTaskPayload,
)
from app.schemas.career_development_report import PersonalGrowthReportSection
from app.services.career_development_goal_planning import read_favorite_report_payload
from app.services.career_development_personal_growth_report import (
    build_personal_growth_report_payload,
    update_personal_growth_report_workspace,
)
from app.services.student_competency_latest_analysis import (
    get_student_competency_latest_profile_record,
    read_student_competency_latest_analysis,
)
from app.services.student_profile import get_student_profile, list_student_profile_attachments
from app.utils.datetime_utils import utc_now


TASK_ORDER = ["target_validation", "gap_diagnosis", "report_rewrite", "resume_draft"]


def _json_loads(raw: str, fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return fallback


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _as_list(raw: str) -> list[Any]:
    value = _json_loads(raw, [])
    return value if isinstance(value, list) else []


def _as_dict(raw: str) -> dict[str, Any]:
    value = _json_loads(raw, {})
    return value if isinstance(value, dict) else {}


def _status_text(row: GrowthWorkbenchTask) -> str:
    labels = {
        "queued": "待运行",
        "running": "运行中",
        "completed": "已完成",
        "skipped": "已跳过",
        "blocked": "需补充",
        "failed": "失败",
        "cancelled": "已取消",
    }
    return labels.get(row.status, row.status)


def _task_payload(row: GrowthWorkbenchTask) -> GrowthWorkbenchTaskPayload:
    return GrowthWorkbenchTaskPayload(
        task_id=row.id,
        favorite_id=row.favorite_id,
        queue_id=row.queue_id,
        task_type=row.task_type,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        progress=row.progress,
        status_text=row.error_message or _status_text(row),
        result_artifact_id=row.result_artifact_id,
        error_message=row.error_message,
        can_cancel=row.status in {"queued", "running"},
        created_at=row.created_at,
        updated_at=row.updated_at,
        completed_at=row.completed_at,
    )


def _target_payload(row: GrowthTargetDiagnosis) -> GrowthTargetDiagnosisPayload:
    return GrowthTargetDiagnosisPayload(
        id=row.id,
        fit_status=row.fit_status,
        risk_level=row.risk_level,
        recommendation=row.recommendation,  # type: ignore[arg-type]
        summary=row.summary,
        evidence_refs=_as_list(row.evidence_refs_json),
        created_at=row.created_at,
    )


def _gap_payload(row: GrowthGapDiagnosis) -> GrowthGapDiagnosisPayload:
    return GrowthGapDiagnosisPayload(
        id=row.id,
        priority_dimensions=_as_list(row.priority_dimensions_json),
        market_keyword_gaps=_as_list(row.market_keyword_gaps_json),
        learning_path_suggestions=_as_list(row.learning_path_suggestions_json),
        resume_expression_gaps=_as_list(row.resume_expression_gaps_json),
        summary=row.summary,
        evidence_refs=_as_list(row.evidence_refs_json),
        created_at=row.created_at,
    )


def _report_payload(row: GrowthReportVersion) -> GrowthReportVersionPayload:
    return GrowthReportVersionPayload(
        id=row.id,
        task_id=row.task_id,
        sections=_as_list(row.sections_json),
        markdown=row.markdown,
        source_summary=_as_dict(row.source_summary_json),
        accepted=bool(row.accepted),
        accepted_at=row.accepted_at,
        backfilled_workspace_id=row.backfilled_workspace_id,
        created_at=row.created_at,
    )


def _resume_payload(row: GrowthResumeVersion) -> GrowthResumeVersionPayload:
    return GrowthResumeVersionPayload(
        id=row.id,
        task_id=row.task_id,
        suggestions=_as_list(row.suggestions_json),
        section_rewrites=_as_dict(row.section_rewrites_json),
        resume_markdown=row.resume_markdown,
        resume_html=row.resume_html,
        source_material_status=row.source_material_status,  # type: ignore[arg-type]
        source_summary=_as_dict(row.source_summary_json),
        accepted=bool(row.accepted),
        accepted_at=row.accepted_at,
        created_at=row.created_at,
    )


def _workspace_for_favorite(
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


def _ensure_favorite_exists(db: Session, *, user_id: int, favorite_id: int) -> None:
    exists = db.scalar(
        select(CareerDevelopmentFavoriteReport.id).where(
            CareerDevelopmentFavoriteReport.user_id == user_id,
            CareerDevelopmentFavoriteReport.id == favorite_id,
        )
    )
    if exists is None:
        raise ValueError("收藏目标不存在。")


def _build_prerequisites(
    *,
    profile: Any,
    competency_ready: bool,
    favorite_id: int,
    workspace: CareerDevelopmentPlanWorkspace | None,
) -> list[GrowthWorkbenchPrerequisiteItem]:
    return [
        GrowthWorkbenchPrerequisiteItem(
            key="profile",
            label="资料",
            ready=bool(
                profile
                and profile.full_name
                and profile.major
                and profile.target_job_title
            ),
            action_label="补资料",
            action_path="/home-v2",
        ),
        GrowthWorkbenchPrerequisiteItem(
            key="competency",
            label="画像",
            ready=competency_ready,
            action_label="去解析",
            action_path="/student-competency-profile",
        ),
        GrowthWorkbenchPrerequisiteItem(
            key="learning_path",
            label="路径",
            ready=workspace is not None,
            blocking=False,
            action_label="去路径",
            action_path=f"/snail-learning-path?favorite_id={favorite_id}",
        ),
    ]


def _build_evidence_sources(
    *,
    profile: Any,
    competency_available: bool,
    competency_dimension_count: int,
    competency_message: str,
    favorite_id: int,
    workspace: CareerDevelopmentPlanWorkspace | None,
    attachment_count: int,
) -> list[GrowthWorkbenchEvidenceSource]:
    report_ready = bool(workspace and workspace.personal_growth_report_edited_markdown)
    return [
        GrowthWorkbenchEvidenceSource(
            key="profile",
            label="画像",
            status="available" if profile else "missing",
            summary=f"{profile.school} · {profile.major}" if profile else "资料缺失",
            href="/home-v2",
        ),
        GrowthWorkbenchEvidenceSource(
            key="competency",
            label="12维",
            status="available" if competency_available else "missing",
            summary=f"{competency_dimension_count} 个维度"
            if competency_available
            else competency_message,
            href="/student-competency-profile",
        ),
        GrowthWorkbenchEvidenceSource(
            key="learning_path",
            label="学习路径",
            status="available" if workspace else "missing",
            summary="已读取学习路径" if workspace else "学习路径缺失",
            href=f"/snail-learning-path?favorite_id={favorite_id}",
        ),
        GrowthWorkbenchEvidenceSource(
            key="resume_material",
            label="简历材料",
            status="available" if attachment_count else "missing",
            summary=f"{attachment_count} 个附件" if attachment_count else "需上传或粘贴材料",
            href="/student-competency-profile",
        ),
        GrowthWorkbenchEvidenceSource(
            key="report",
            label="报告",
            status="available" if report_ready else "partial",
            summary="已有报告内容" if report_ready else "可生成报告",
            href=f"/personal-growth-report?favorite_id={favorite_id}",
        ),
    ]


def build_growth_workbench_payload(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> GrowthWorkbenchAggregatePayload:
    favorite_row = db.scalar(
        select(CareerDevelopmentFavoriteReport).where(
            CareerDevelopmentFavoriteReport.user_id == user_id,
            CareerDevelopmentFavoriteReport.id == favorite_id,
        )
    )
    if favorite_row is None:
        raise ValueError("收藏目标不存在。")

    favorite = read_favorite_report_payload(favorite_row)
    profile = get_student_profile(db, user_id=user_id)
    latest_record = get_student_competency_latest_profile_record(db, user_id=user_id)
    latest_analysis = read_student_competency_latest_analysis(latest_record)
    workspace = _workspace_for_favorite(db, user_id=user_id, favorite_id=favorite_id)
    attachments = list_student_profile_attachments(db, user_id=user_id)

    competency_dimension_count = len(latest_analysis.comparison_dimensions)
    prerequisites = _build_prerequisites(
        profile=profile,
        competency_ready=bool(latest_analysis.available and competency_dimension_count),
        favorite_id=favorite_id,
        workspace=workspace,
    )
    evidence_sources = _build_evidence_sources(
        profile=profile,
        competency_available=bool(latest_analysis.available),
        competency_dimension_count=competency_dimension_count,
        competency_message=latest_analysis.message or "画像缺失",
        favorite_id=favorite_id,
        workspace=workspace,
        attachment_count=len(attachments),
    )

    tasks = db.scalars(
        select(GrowthWorkbenchTask)
        .where(
            GrowthWorkbenchTask.user_id == user_id,
            GrowthWorkbenchTask.favorite_id == favorite_id,
        )
        .order_by(GrowthWorkbenchTask.created_at.desc())
        .limit(20)
    ).all()
    target_diagnosis = db.scalar(
        select(GrowthTargetDiagnosis)
        .where(
            GrowthTargetDiagnosis.user_id == user_id,
            GrowthTargetDiagnosis.favorite_id == favorite_id,
        )
        .order_by(GrowthTargetDiagnosis.created_at.desc())
    )
    gap_diagnosis = db.scalar(
        select(GrowthGapDiagnosis)
        .where(
            GrowthGapDiagnosis.user_id == user_id,
            GrowthGapDiagnosis.favorite_id == favorite_id,
        )
        .order_by(GrowthGapDiagnosis.created_at.desc())
    )
    reports = db.scalars(
        select(GrowthReportVersion)
        .where(
            GrowthReportVersion.user_id == user_id,
            GrowthReportVersion.favorite_id == favorite_id,
        )
        .order_by(GrowthReportVersion.created_at.desc())
        .limit(10)
    ).all()
    resumes = db.scalars(
        select(GrowthResumeVersion)
        .where(
            GrowthResumeVersion.user_id == user_id,
            GrowthResumeVersion.favorite_id == favorite_id,
        )
        .order_by(GrowthResumeVersion.created_at.desc())
        .limit(10)
    ).all()

    existing_report_workspace = None
    if workspace is not None:
        existing_report_workspace = build_personal_growth_report_payload(
            db,
            row=workspace,
            user_id=user_id,
            favorite_id=favorite_id,
        ).model_dump(mode="json")

    return GrowthWorkbenchAggregatePayload(
        target_summary={
            "favorite_id": favorite.favorite_id,
            "title": favorite.canonical_job_title,
            "industry": favorite.industry,
            "overall_match": favorite.overall_match,
        },
        prerequisites=prerequisites,
        task_queue=[_task_payload(item) for item in tasks],
        latest_diagnoses={
            "target": _target_payload(target_diagnosis).model_dump(mode="json")
            if target_diagnosis
            else None,
            "gap": _gap_payload(gap_diagnosis).model_dump(mode="json")
            if gap_diagnosis
            else None,
        },
        report_versions=[_report_payload(item) for item in reports],
        resume_versions=[_resume_payload(item) for item in resumes],
        evidence_sources=evidence_sources,
        existing_report_workspace=existing_report_workspace,
    )


def _create_task_row(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    task_type: str,
    queue_id: str,
) -> GrowthWorkbenchTask:
    row = GrowthWorkbenchTask(
        id=str(uuid4()),
        user_id=user_id,
        favorite_id=favorite_id,
        queue_id=queue_id,
        task_type=task_type,
        status="running",
        progress=10,
        input_snapshot_json=_json_dumps(
            {"favorite_id": favorite_id, "task_type": task_type}
        ),
    )
    db.add(row)
    db.flush()
    return row


def _complete_task(
    db: Session,
    row: GrowthWorkbenchTask,
    artifact_id: str = "",
) -> GrowthWorkbenchTask:
    row.status = "completed"
    row.progress = 100
    row.result_artifact_id = artifact_id
    row.completed_at = utc_now()
    db.add(row)
    db.flush()
    return row


def _run_target_validation(db: Session, *, task: GrowthWorkbenchTask) -> str:
    artifact = GrowthTargetDiagnosis(
        id=str(uuid4()),
        user_id=task.user_id,
        favorite_id=task.favorite_id,
        task_id=task.id,
        fit_status="可继续推进",
        risk_level="medium",
        recommendation="keep",
        summary="当前目标可继续推进，需重点补强岗位证据和市场关键词表达。",
        evidence_refs_json=_json_dumps(
            [{"source": "favorite", "label": "职业匹配收藏目标"}]
        ),
    )
    db.add(artifact)
    db.flush()
    return artifact.id


def _run_gap_diagnosis(db: Session, *, task: GrowthWorkbenchTask) -> str:
    artifact = GrowthGapDiagnosis(
        id=str(uuid4()),
        user_id=task.user_id,
        favorite_id=task.favorite_id,
        task_id=task.id,
        priority_dimensions_json=_json_dumps(
            [
                {"key": "work_experience", "label": "工作经验", "priority": "high"},
                {
                    "key": "professional_skills",
                    "label": "专业技能",
                    "priority": "high",
                },
            ]
        ),
        market_keyword_gaps_json=_json_dumps(
            [
                {"keyword": "项目落地", "reason": "岗位市场常见表达"},
                {"keyword": "工程化", "reason": "前端岗位高频要求"},
            ]
        ),
        learning_path_suggestions_json=_json_dumps(
            ["把学习路径中的项目成果转成可证明经历。"]
        ),
        resume_expression_gaps_json=_json_dumps(["项目经历需要量化结果和技术栈。"]),
        summary="优先补齐工作经验和专业技能的岗位证据。",
        evidence_refs_json=_json_dumps([{"source": "competency", "label": "12维画像"}]),
    )
    db.add(artifact)
    db.flush()
    return artifact.id


def _run_report_rewrite(db: Session, *, task: GrowthWorkbenchTask) -> str:
    sections = [
        {
            "key": "self_cognition",
            "title": "自我认知",
            "content": "结合画像，当前优势是学习能力和前端基础。",
        },
        {
            "key": "career_direction_analysis",
            "title": "职业方向分析",
            "content": "目标可继续聚焦前端工程方向。",
        },
        {
            "key": "match_assessment",
            "title": "匹配度判断",
            "content": "匹配基础存在，项目证据和市场表达仍需补强。",
        },
        {
            "key": "development_suggestions",
            "title": "发展建议",
            "content": "优先补齐工程化项目、协作证据和岗位关键词。",
        },
        {
            "key": "action_plan",
            "title": "行动计划",
            "content": "### 短期行动（0-3个月）\n- 完成项目改写\n\n"
            "### 中期行动（3-9个月）\n- 沉淀作品集\n\n"
            "### 长期行动（9-24个月）\n- 持续投递并复盘",
        },
    ]
    markdown = "# 个人职业成长报告\n\n" + "\n\n".join(
        f"## {item['title']}\n{item['content']}" for item in sections
    )
    artifact = GrowthReportVersion(
        id=str(uuid4()),
        user_id=task.user_id,
        favorite_id=task.favorite_id,
        task_id=task.id,
        sections_json=_json_dumps(sections),
        markdown=markdown,
        source_summary_json=_json_dumps({"mode": "workbench_task"}),
    )
    db.add(artifact)
    db.flush()
    return artifact.id


def _resume_source_status(db: Session, *, user_id: int) -> str:
    return "available" if list_student_profile_attachments(db, user_id=user_id) else "missing"


def _run_resume_draft(db: Session, *, task: GrowthWorkbenchTask) -> str:
    source_status = _resume_source_status(db, user_id=task.user_id)
    missing_note = "（待补充材料）" if source_status == "missing" else ""
    artifact = GrowthResumeVersion(
        id=str(uuid4()),
        user_id=task.user_id,
        favorite_id=task.favorite_id,
        task_id=task.id,
        suggestions_json=_json_dumps(
            [
                {"title": "补强项目证据", "detail": "用动作、技术栈、结果重写项目经历。"},
                {"title": "对齐市场关键词", "detail": "补充工程化、组件化、性能优化等表达。"},
            ]
        ),
        section_rewrites_json=_json_dumps(
            {
                "summary": f"前端方向候选人{missing_note}，具备组件开发和持续学习能力。",
                "projects": f"项目经历需补充可验证成果{missing_note}。",
            }
        ),
        resume_markdown=f"# 简历草稿\n\n## 个人总结\n前端方向候选人{missing_note}，具备组件开发和持续学习能力。",
        resume_html="<h1>简历草稿</h1><h2>个人总结</h2>"
        f"<p>前端方向候选人{missing_note}，具备组件开发和持续学习能力。</p>",
        source_material_status=source_status,
        source_summary_json=_json_dumps({"resume_material": source_status}),
    )
    db.add(artifact)
    db.flush()
    return artifact.id


def run_task_body(db: Session, *, task: GrowthWorkbenchTask) -> str:
    if task.task_type == "target_validation":
        return _run_target_validation(db, task=task)
    if task.task_type == "gap_diagnosis":
        return _run_gap_diagnosis(db, task=task)
    if task.task_type == "report_rewrite":
        return _run_report_rewrite(db, task=task)
    if task.task_type == "resume_draft":
        return _run_resume_draft(db, task=task)
    return ""


def create_and_run_workbench_task(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    task_type: str,
    run_mode: str = "single",
) -> GrowthWorkbenchTask:
    _ensure_favorite_exists(db, user_id=user_id, favorite_id=favorite_id)
    queue_id = str(uuid4())
    if run_mode == "full_queue" or task_type == "full_queue":
        root = _create_task_row(
            db,
            user_id=user_id,
            favorite_id=favorite_id,
            task_type="full_queue",
            queue_id=queue_id,
        )
        for item in TASK_ORDER:
            child = _create_task_row(
                db,
                user_id=user_id,
                favorite_id=favorite_id,
                task_type=item,
                queue_id=queue_id,
            )
            artifact_id = run_task_body(db, task=child)
            _complete_task(db, child, artifact_id)
        _complete_task(db, root)
        db.commit()
        db.refresh(root)
        return root

    row = _create_task_row(
        db,
        user_id=user_id,
        favorite_id=favorite_id,
        task_type=task_type,
        queue_id=queue_id,
    )
    artifact_id = run_task_body(db, task=row)
    _complete_task(db, row, artifact_id)
    db.commit()
    db.refresh(row)
    return row


def get_workbench_task(
    db: Session,
    *,
    user_id: int,
    task_id: str,
) -> GrowthWorkbenchTask | None:
    return db.scalar(
        select(GrowthWorkbenchTask).where(
            GrowthWorkbenchTask.user_id == user_id,
            GrowthWorkbenchTask.id == task_id,
        )
    )


def skip_workbench_task(
    db: Session,
    *,
    user_id: int,
    task_id: str,
) -> GrowthWorkbenchTask:
    row = get_workbench_task(db, user_id=user_id, task_id=task_id)
    if row is None:
        raise ValueError("任务不存在。")
    now = utc_now()
    row.status = "skipped"
    row.progress = 100
    row.completed_at = now
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def cancel_workbench_task(
    db: Session,
    *,
    user_id: int,
    task_id: str,
) -> GrowthWorkbenchTask:
    row = get_workbench_task(db, user_id=user_id, task_id=task_id)
    if row is None:
        raise ValueError("任务不存在。")
    now = utc_now()
    row.status = "cancelled"
    row.progress = 100
    row.cancel_requested_at = now
    row.completed_at = now
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _report_sections_from_version(row: GrowthReportVersion) -> list[PersonalGrowthReportSection]:
    sections: list[PersonalGrowthReportSection] = []
    for item in _as_list(row.sections_json):
        if isinstance(item, dict):
            sections.append(PersonalGrowthReportSection.model_validate(item))
    if not sections:
        raise ValueError("报告版本内容为空。")
    return sections


def accept_workbench_artifact(
    db: Session,
    *,
    user_id: int,
    artifact_id: str,
) -> dict[str, object]:
    report = db.scalar(
        select(GrowthReportVersion).where(
            GrowthReportVersion.user_id == user_id,
            GrowthReportVersion.id == artifact_id,
        )
    )
    if report is not None:
        workspace = _workspace_for_favorite(
            db,
            user_id=user_id,
            favorite_id=report.favorite_id,
        )
        if workspace is None:
            raise ValueError("报告工作区不存在。")
        updated = update_personal_growth_report_workspace(
            db,
            row=workspace,
            sections=_report_sections_from_version(report),
        )
        report.accepted = 1
        report.accepted_at = utc_now()
        report.backfilled_workspace_id = updated.id
        db.add(report)
        db.commit()
        db.refresh(report)
        return {
            "artifact_type": "report",
            "artifact_id": artifact_id,
            "workspace_id": updated.id,
        }

    resume = db.scalar(
        select(GrowthResumeVersion).where(
            GrowthResumeVersion.user_id == user_id,
            GrowthResumeVersion.id == artifact_id,
        )
    )
    if resume is not None:
        resume.accepted = 1
        resume.accepted_at = utc_now()
        db.add(resume)
        db.commit()
        db.refresh(resume)
        return {
            "artifact_type": "resume",
            "artifact_id": artifact_id,
            "accepted": True,
        }

    raise ValueError("产物不存在。")
