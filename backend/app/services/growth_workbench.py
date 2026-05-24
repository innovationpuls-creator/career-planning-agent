from __future__ import annotations

import json
from typing import Any

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
from app.services.career_development_goal_planning import read_favorite_report_payload
from app.services.career_development_personal_growth_report import (
    build_personal_growth_report_payload,
)
from app.services.student_competency_latest_analysis import (
    get_student_competency_latest_profile_record,
    read_student_competency_latest_analysis,
)
from app.services.student_profile import get_student_profile, list_student_profile_attachments


def _json_loads(raw: str, fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return fallback


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
