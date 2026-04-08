from __future__ import annotations

import json
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.career_development_report import (
    CareerDevelopmentFavoriteCreateRequest,
    CareerDevelopmentFavoriteListResponse,
    CareerDevelopmentFavoriteResponse,
    CareerDevelopmentGoalPlanTaskCreateRequest,
    CareerDevelopmentGoalPlanTaskCreateResponse,
    CareerDevelopmentGoalPlanTaskResponse,
    CareerDevelopmentMatchCustomResponse,
    CareerDevelopmentMatchInitResponse,
    CareerDevelopmentMatchReportRequest,
    PlanLearningResourceRequest,
    PlanLearningResourceResponse,
    PlanWorkspaceExportRequest,
    PlanWorkspaceIntegrityCheckRequest,
    PlanWorkspaceIntegrityCheckResponse,
    PlanWorkspaceMilestoneSubmissionResponse,
    PlanWorkspacePolishRequest,
    PlanWorkspacePolishResponse,
    PlanWorkspaceResponse,
    PlanWorkspaceReviewRequest,
    PlanWorkspaceReviewResponse,
    PlanWorkspaceUpdateRequest,
)
from app.services.career_development_goal_plan_task_manager import (
    TERMINAL_TASK_STATUSES,
    career_development_goal_plan_task_manager,
)
from app.services.career_development_plan_workspace import (
    build_export_filename,
    build_integrity_check,
    build_plan_workspace_payload,
    create_workspace_review,
    export_docx_bytes,
    export_markdown_bytes,
    export_pdf_bytes,
    generate_learning_resources_for_workspace,
    get_plan_workspace_record,
    polish_markdown,
    submit_workspace_learning_milestone,
    update_workspace_content,
    update_workspace_export_meta,
)
from app.services.career_development_goal_planning import (
    delete_favorite_report,
    get_favorite_report_record,
    list_favorite_report_payloads,
    read_favorite_report_payload,
    upsert_favorite_report,
)
from app.services.career_development_report import (
    CareerDevelopmentMatchService,
    build_career_development_match_service,
)
from app.services.embeddings import EmbeddingClientError
from app.services.llm import LLMClientError
from app.services.vector_store import QdrantGroupedVectorStore


router = APIRouter(tags=["career-development-report"])


def get_job_group_vector_store():
    store = QdrantGroupedVectorStore.for_job_groups()
    try:
        yield store
    finally:
        store.close()


def get_career_group_vector_store():
    store = QdrantGroupedVectorStore.for_career_groups()
    try:
        yield store
    finally:
        store.close()


def get_career_development_match_service(
    db: Session = Depends(get_db),
    job_vector_store: QdrantGroupedVectorStore = Depends(get_job_group_vector_store),
    career_vector_store: QdrantGroupedVectorStore = Depends(get_career_group_vector_store),
) -> CareerDevelopmentMatchService:
    return build_career_development_match_service(
        db,
        job_vector_store=job_vector_store,
        career_vector_store=career_vector_store,
    )


@router.get("/api/career-development-report/job-exploration-match/init", response_model=CareerDevelopmentMatchInitResponse)
async def get_job_exploration_match_init(
    service: CareerDevelopmentMatchService = Depends(get_career_development_match_service),
    current_user: User = Depends(require_standard_user),
) -> CareerDevelopmentMatchInitResponse:
    try:
        payload = await service.build_init_payload(user_id=current_user.id)
    except (EmbeddingClientError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CareerDevelopmentMatchInitResponse(data=payload)


@router.post("/api/career-development-report/job-exploration-match/report", response_model=CareerDevelopmentMatchCustomResponse)
async def create_job_exploration_match_report(
    body: CareerDevelopmentMatchReportRequest,
    service: CareerDevelopmentMatchService = Depends(get_career_development_match_service),
    current_user: User = Depends(require_standard_user),
) -> CareerDevelopmentMatchCustomResponse:
    try:
        payload = await service.build_custom_payload(
            user_id=current_user.id,
            job_title=body.job_title.strip(),
            industries=[item.strip() for item in body.industries if item and item.strip()],
        )
    except (EmbeddingClientError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CareerDevelopmentMatchCustomResponse(data=payload)


@router.get("/api/career-development-report/favorites", response_model=CareerDevelopmentFavoriteListResponse)
def get_career_development_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> CareerDevelopmentFavoriteListResponse:
    return CareerDevelopmentFavoriteListResponse(data=list_favorite_report_payloads(db, user_id=current_user.id))


@router.post("/api/career-development-report/favorites", response_model=CareerDevelopmentFavoriteResponse)
def create_career_development_favorite(
    body: CareerDevelopmentFavoriteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> CareerDevelopmentFavoriteResponse:
    payload = upsert_favorite_report(
        db,
        user_id=current_user.id,
        source_kind=body.source_kind,
        report=body.report,
    )
    return CareerDevelopmentFavoriteResponse(data=payload)


@router.delete("/api/career-development-report/favorites/{favorite_id}", status_code=204)
def remove_career_development_favorite(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> Response:
    deleted = delete_favorite_report(db, user_id=current_user.id, favorite_id=favorite_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    return Response(status_code=204)


@router.post(
    "/api/career-development-report/goal-setting-path-planning/tasks",
    response_model=CareerDevelopmentGoalPlanTaskCreateResponse,
)
async def create_goal_plan_task(
    body: CareerDevelopmentGoalPlanTaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> CareerDevelopmentGoalPlanTaskCreateResponse:
    record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=body.favorite_id)
    if record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    summary = await career_development_goal_plan_task_manager.create_task(
        user_id=current_user.id,
        favorite_id=body.favorite_id,
    )
    return CareerDevelopmentGoalPlanTaskCreateResponse(data=summary)


@router.get(
    "/api/career-development-report/goal-setting-path-planning/tasks/{task_id}",
    response_model=CareerDevelopmentGoalPlanTaskResponse,
)
async def get_goal_plan_task_snapshot(
    task_id: str,
    current_user: User = Depends(require_standard_user),
) -> CareerDevelopmentGoalPlanTaskResponse:
    snapshot = await career_development_goal_plan_task_manager.get_snapshot(
        user_id=current_user.id,
        task_id=task_id,
    )
    if snapshot is None:
        raise HTTPException(status_code=404, detail="职业路径规划任务不存在。")
    return CareerDevelopmentGoalPlanTaskResponse(data=snapshot)


@router.get("/api/career-development-report/goal-setting-path-planning/tasks/{task_id}/stream")
async def stream_goal_plan_task(
    task_id: str,
    current_user: User = Depends(require_standard_user),
) -> StreamingResponse:
    async def event_stream():
        queue, snapshot = await career_development_goal_plan_task_manager.subscribe(
            user_id=current_user.id,
            task_id=task_id,
        )
        if snapshot is None:
            yield json.dumps({"stage": "not_found", "task_id": task_id}, ensure_ascii=False) + "\n"
            return

        initial_stage = "task_restored" if snapshot.status not in {"queued"} else "queued"
        yield json.dumps(
            {
                "stage": initial_stage,
                "task_id": task_id,
                "status": snapshot.status,
                "status_text": snapshot.latest_event.status_text if snapshot.latest_event else "任务已恢复。",
                "progress": snapshot.progress,
                "snapshot": snapshot.model_dump(mode="json"),
            },
            ensure_ascii=False,
        ) + "\n"
        if snapshot.status in TERMINAL_TASK_STATUSES:
            return

        try:
            while True:
                event = await queue.get()
                if event.get("stage") == "__end__":
                    break
                yield json.dumps(event, ensure_ascii=False) + "\n"
        finally:
            await career_development_goal_plan_task_manager.unsubscribe(task_id=task_id, queue=queue)

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.get(
    "/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}",
    response_model=PlanWorkspaceResponse,
)
def get_goal_plan_workspace(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PlanWorkspaceResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    row = get_plan_workspace_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="当前目标尚未生成工作台。")
    return PlanWorkspaceResponse(
        data=build_plan_workspace_payload(
            db,
            row=row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.put(
    "/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}",
    response_model=PlanWorkspaceResponse,
)
def update_goal_plan_workspace(
    favorite_id: int,
    body: PlanWorkspaceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PlanWorkspaceResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    row = get_plan_workspace_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="当前目标尚未生成工作台。")
    updated_row = update_workspace_content(
        db,
        row=row,
        edited_report_markdown=body.edited_report_markdown or row.generated_report_markdown,
        growth_plan_phases=body.growth_plan_phases,
    )
    return PlanWorkspaceResponse(
        data=build_plan_workspace_payload(
            db,
            row=updated_row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.post(
    "/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/learning-resources",
    response_model=PlanLearningResourceResponse,
)
async def generate_goal_plan_learning_resources(
    favorite_id: int,
    body: PlanLearningResourceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PlanLearningResourceResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    try:
        row = await generate_learning_resources_for_workspace(
            db,
            user_id=current_user.id,
            favorite_id=favorite_id,
            phase_key=body.phase_key,
            module_id=body.module_id,
            force_refresh=body.force_refresh,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PlanLearningResourceResponse(
        data=build_plan_workspace_payload(
            db,
            row=row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.post(
    "/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/milestones/{milestone_id}/submit",
    response_model=PlanWorkspaceMilestoneSubmissionResponse,
)
async def submit_goal_plan_workspace_milestone(
    favorite_id: int,
    milestone_id: str,
    summary_text: str = Form(default=""),
    files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PlanWorkspaceMilestoneSubmissionResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    try:
        row = await submit_workspace_learning_milestone(
            db,
            user_id=current_user.id,
            favorite_id=favorite_id,
            milestone_id=milestone_id,
            summary_text=summary_text,
            uploads=files or [],
        )
    except (ValueError, LLMClientError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PlanWorkspaceMilestoneSubmissionResponse(
        data=build_plan_workspace_payload(
            db,
            row=row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.post(
    "/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/polish",
    response_model=PlanWorkspacePolishResponse,
)
def polish_goal_plan_workspace(
    favorite_id: int,
    body: PlanWorkspacePolishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PlanWorkspacePolishResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    row = get_plan_workspace_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="当前目标尚未生成工作台。")
    polished_markdown, fact_guard_notice = polish_markdown(
        body.markdown or row.edited_report_markdown or row.generated_report_markdown,
        mode=body.mode,
    )
    return PlanWorkspacePolishResponse(
        data={
            "polished_markdown": polished_markdown,
            "mode": body.mode,
            "fact_guard_notice": fact_guard_notice,
        }
    )


@router.post(
    "/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/integrity-check",
    response_model=PlanWorkspaceIntegrityCheckResponse,
)
def integrity_check_goal_plan_workspace(
    favorite_id: int,
    body: PlanWorkspaceIntegrityCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PlanWorkspaceIntegrityCheckResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    row = get_plan_workspace_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="当前目标尚未生成工作台。")
    payload = build_integrity_check(body.markdown or row.edited_report_markdown or row.generated_report_markdown)
    row.latest_integrity_check_json = json.dumps(payload.model_dump(mode="json"), ensure_ascii=False)
    db.add(row)
    db.commit()
    db.refresh(row)
    return PlanWorkspaceIntegrityCheckResponse(data=payload)


@router.post(
    "/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/reviews",
    response_model=PlanWorkspaceReviewResponse,
)
async def create_goal_plan_workspace_review(
    favorite_id: int,
    body: PlanWorkspaceReviewRequest,
    db: Session = Depends(get_db),
    service: CareerDevelopmentMatchService = Depends(get_career_development_match_service),
    current_user: User = Depends(require_standard_user),
) -> PlanWorkspaceReviewResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    try:
        payload = await create_workspace_review(
            db,
            user_id=current_user.id,
            favorite_id=favorite_id,
            review_type=body.review_type,
            match_service=service,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PlanWorkspaceReviewResponse(data=payload)


@router.post("/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/export")
def export_goal_plan_workspace(
    favorite_id: int,
    body: PlanWorkspaceExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> Response:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    favorite_payload = read_favorite_report_payload(favorite_record)
    row = get_plan_workspace_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="当前目标尚未生成工作台。")
    integrity = build_integrity_check(row.edited_report_markdown or row.generated_report_markdown)
    if body.format in {"docx", "pdf"} and integrity.blocking_count > 0 and not body.force_with_issues:
        raise HTTPException(status_code=400, detail="当前报告仍存在阻塞缺失，暂不支持导出 DOCX/PDF。")

    markdown = row.edited_report_markdown or row.generated_report_markdown
    if body.format == "md":
        content = export_markdown_bytes(markdown)
        media_type = "text/markdown; charset=utf-8"
    elif body.format == "docx":
        content = export_docx_bytes(markdown)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        content = export_pdf_bytes(markdown)
        media_type = "application/pdf"

    update_workspace_export_meta(
        db,
        row=row,
        export_format=body.format,
        exported_with_issues=body.force_with_issues and integrity.blocking_count > 0,
        blocking_count=integrity.blocking_count,
    )
    filename = build_export_filename(favorite_payload, body.format)
    disposition = f"attachment; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": disposition},
    )
