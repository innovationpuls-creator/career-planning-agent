import logging
import json
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session
from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    CareerDevelopmentMatchReport,
    GrowthPlanMetricSnapshot,
    PlanExportMeta,
    PlanWorkspaceCurrentActionSummary,
    PlanWorkspaceOverview,
    PlanWorkspacePayload,
    PlanWorkspaceResponse,
)
from app.schemas.snail_learning_path import (
    SnailLearningPathReviewCreateRequest,
    SnailLearningPathReviewListResponse,
    SnailLearningPathReviewResponse,
)
from app.services.career_development_plan_workspace import (
    build_current_action_summary,
    build_default_review_framework,
    build_growth_plan_phases,
    build_phase_flow_summary,
    build_workspace_overview,
)
from app.services.llm import LLMClientError
from app.services.snail_learning_resource_library import attach_prebuilt_learning_resources
from app.services.snail_learning_path_review import (
    create_snail_learning_path_review,
    list_snail_learning_path_reviews,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["snail-learning-path"])


def _build_snail_workspace_id(*, current_user_id: int, report: CareerDevelopmentMatchReport) -> str:
    stable_seed = "|".join(
        [
            str(current_user_id),
            report.report_id or "",
            report.target_scope or "",
            report.canonical_job_title or "",
            report.industry or "",
        ]
    )
    digest = hashlib.sha1(stable_seed.encode("utf-8")).hexdigest()[:16]
    return f"snail-{digest}"


@router.post("/api/snail-learning-path/workspaces", response_model=PlanWorkspaceResponse)
@router.post(
    "/api/career-development-report/snail-learning-path/workspaces",
    response_model=PlanWorkspaceResponse,
)
async def generate_snail_learning_path(
    request: Request,
    current_user: User = Depends(require_standard_user),
    db: Session = Depends(get_db),
) -> PlanWorkspaceResponse:
    """从职业匹配报告直接生成学习路径，无需收藏，无需异步任务。

    数据源：CareerDevelopmentMatchReport 中的对比维度，
    由 build_growth_plan_phases() 同步生成短期/中期/中长期学习阶段。
    """
    # 手动解析 body 以便调试 422 问题
    try:
        body = await request.json()
        logger.info("Received report body keys: %s", list(body.keys()) if isinstance(body, dict) else type(body))
        # 前端发送 { report: CareerDevelopmentMatchReport }，也接受直接传 CareerDevelopmentMatchReport
        report_body = body.get("report", body) if isinstance(body, dict) else body
        report = CareerDevelopmentMatchReport.model_validate(report_body)
    except Exception as exc:
        logger.exception("Failed to parse report body: %s", exc)
        raw = await request.body()
        logger.error("Raw body (first 1000 chars): %s", raw[:1000])
        raise

    # Step 1: 从 report 构建内存中的 favorite payload（不做 DB 持久化）
    now = datetime.now(timezone.utc)
    favorite = CareerDevelopmentFavoritePayload(
        favorite_id=1,
        target_key=f"{report.canonical_job_title}::{report.industry or ''}",
        source_kind="custom",
        report_id=report.report_id,
        target_scope=report.target_scope,
        target_title=report.target_title,
        canonical_job_title=report.canonical_job_title,
        representative_job_title=report.representative_job_title,
        industry=report.industry,
        overall_match=report.overall_match,
        report_snapshot=report,
        created_at=now,
        updated_at=now,
    )

    # Step 2: 同步生成学习阶段
    phases = build_growth_plan_phases(favorite)
    logger.info(
        "[SnailPath] phases=%d modules_total=%d comparison_dims=%d",
        len(phases),
        sum(len(p.learning_modules) for p in phases),
        len(report.comparison_dimensions),
    )

    # Step 3: 调用 Dify 为各阶段各模块生成学习资源（含跨模块 URL 累积去重）
    enriched_phases = attach_prebuilt_learning_resources(
        db,
        favorite=favorite,
        phases=phases,
    )

    # 调试日志：打印每个 module 的 resource 状态
    for ep in enriched_phases:
        for m in ep.learning_modules:
            logger.info(
                "[SnailPath] module=%s topic=%s status=%s recs=%d",
                m.module_id,
                m.topic,
                m.resource_status,
                len(m.resource_recommendations or []),
            )

    review_framework = build_default_review_framework()
    overview: PlanWorkspaceOverview = build_workspace_overview(enriched_phases)
    metric_snapshot = GrowthPlanMetricSnapshot()
    phase_flow_summary = build_phase_flow_summary(
        enriched_phases, current_phase_key=overview.current_phase_key
    )
    current_action_summary: PlanWorkspaceCurrentActionSummary = build_current_action_summary(
        overview, current_steps=[]
    )

    return PlanWorkspaceResponse(
        data=PlanWorkspacePayload(
            workspace_id=_build_snail_workspace_id(current_user_id=current_user.id, report=report),
            favorite=favorite,
            generated_report_markdown="",
            edited_report_markdown="",
            workspace_overview=overview,
            metric_snapshot=metric_snapshot,
            growth_plan_phases=enriched_phases,
            review_framework=review_framework,
            latest_integrity_check=None,
            latest_review=None,
            export_meta=PlanExportMeta(),
            current_learning_steps=[],
            phase_flow_summary=phase_flow_summary,
            current_action_summary=current_action_summary,
            updated_at=now,
        )
    )


@router.post(
    "/api/snail-learning-path/workspaces/{workspace_id}/reviews",
    response_model=SnailLearningPathReviewResponse,
)
@router.post(
    "/api/career-development-report/snail-learning-path/workspaces/{workspace_id}/reviews",
    response_model=SnailLearningPathReviewResponse,
)
async def create_snail_learning_path_review_endpoint(
    workspace_id: str,
    review_type: str = Form(...),
    phase_key: str = Form(...),
    checked_resource_urls: str = Form(default="[]"),
    user_prompt: str = Form(default=""),
    report_snapshot: str = Form(...),
    completed_module_count: int = Form(default=0),
    total_module_count: int = Form(default=0),
    phase_progress_percent: int = Form(default=0),
    files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> SnailLearningPathReviewResponse:
    try:
        payload = SnailLearningPathReviewCreateRequest(
            review_type=review_type,
            phase_key=phase_key,
            checked_resource_urls=json.loads(checked_resource_urls or "[]"),
            user_prompt=user_prompt,
            report_snapshot=json.loads(report_snapshot),
            completed_module_count=completed_module_count,
            total_module_count=total_module_count,
            phase_progress_percent=phase_progress_percent,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid review payload: {exc}") from exc

    try:
        review = await create_snail_learning_path_review(
            db,
            user_id=current_user.id,
            workspace_id=workspace_id,
            body=payload,
            uploads=files or [],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return SnailLearningPathReviewResponse(data=review)


@router.get(
    "/api/snail-learning-path/workspaces/{workspace_id}/reviews",
    response_model=SnailLearningPathReviewListResponse,
)
@router.get(
    "/api/career-development-report/snail-learning-path/workspaces/{workspace_id}/reviews",
    response_model=SnailLearningPathReviewListResponse,
)
def list_snail_learning_path_reviews_endpoint(
    workspace_id: str,
    phase_key: str | None = Query(default=None),
    review_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> SnailLearningPathReviewListResponse:
    data = list_snail_learning_path_reviews(
        db,
        user_id=current_user.id,
        workspace_id=workspace_id,
        phase_key=phase_key,
        review_type=review_type,
    )
    return SnailLearningPathReviewListResponse(data=data)
