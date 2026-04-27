from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.career_development_report import (
    CareerDevelopmentFavoriteCreateRequest,
    CareerDevelopmentFavoriteListResponse,
    CareerDevelopmentFavoriteResponse,
    CareerDevelopmentMatchCustomResponse,
    CareerDevelopmentMatchInitResponse,
    CareerDevelopmentMatchReportRequest,
    PlanWorkspaceResponse,
    PersonalGrowthReportExportRequest,
    PersonalGrowthReportRegenerateRequest,
    PersonalGrowthReportResponse,
    PersonalGrowthReportTaskCancelResponse,
    PersonalGrowthReportTaskCreateRequest,
    PersonalGrowthReportTaskCreateResponse,
    PersonalGrowthReportTaskResponse,
    PersonalGrowthReportUpdateRequest,
)
from app.services.career_development_goal_planning import (
    CareerDevelopmentGoalPlanningError,
    delete_favorite_report,
    get_favorite_report_record,
    list_favorite_report_payloads,
    read_favorite_report_payload,
    upsert_favorite_report,
)
from app.services.career_development_goal_planning_task_manager import (
    career_development_goal_planning_task_manager,
)
from app.services.career_development_personal_growth_report import (
    assert_personal_growth_prerequisites,
    build_personal_growth_report_payload,
    ensure_personal_growth_base_workspace,
    export_personal_growth_report_bytes,
    get_latest_personal_growth_favorite_id,
    get_personal_growth_workspace_or_none,
    regenerate_personal_growth_report,
    update_personal_growth_report_workspace,
)
from app.services.career_development_plan_workspace import (
    build_plan_workspace_payload,
    get_plan_workspace_record,
)
from app.services.career_development_personal_growth_report_task_manager import (
    career_development_personal_growth_report_task_manager,
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


@router.get(
    "/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}",
    response_model=PlanWorkspaceResponse,
)
def get_career_development_plan_workspace(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PlanWorkspaceResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")

    row = get_plan_workspace_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="目标岗位规划工作台不存在。")

    return PlanWorkspaceResponse(
        data=build_plan_workspace_payload(
            db,
            row=row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.get("/api/career-development-report/goal-setting-path-planning/tasks/{task_id}/stream")
async def stream_goal_planning_task(
    task_id: str,
    current_user: User = Depends(require_standard_user),
) -> StreamingResponse:
    snapshot = await career_development_goal_planning_task_manager.get_snapshot(
        user_id=current_user.id,
        task_id=task_id,
    )
    if snapshot is None:
        raise HTTPException(status_code=404, detail="目标岗位规划任务不存在。")

    async def event_stream():
        queue, current_snapshot = await career_development_goal_planning_task_manager.subscribe(
            user_id=current_user.id,
            task_id=task_id,
        )
        if current_snapshot is None:
            yield json.dumps({"stage": "not_found", "task_id": task_id}, ensure_ascii=False) + "\n"
            return

        yield json.dumps(current_snapshot.model_dump(mode="json"), ensure_ascii=False) + "\n"
        if current_snapshot.status in {"completed", "cancelled", "failed"}:
            return

        try:
            while True:
                event = await queue.get()
                if event.get("stage") == "__end__":
                    break
                yield json.dumps(event, ensure_ascii=False) + "\n"
        finally:
            await career_development_goal_planning_task_manager.unsubscribe(
                task_id=task_id,
                queue=queue,
            )

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.post(
    "/api/career-development-report/personal-growth-report/tasks",
    response_model=PersonalGrowthReportTaskCreateResponse,
)
async def create_personal_growth_report_task(
    body: PersonalGrowthReportTaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PersonalGrowthReportTaskCreateResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=body.favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    favorite_payload = read_favorite_report_payload(favorite_record)
    try:
        assert_personal_growth_prerequisites(
            db,
            user_id=current_user.id,
            favorite=favorite_payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    summary = await career_development_personal_growth_report_task_manager.create_task(
        user_id=current_user.id,
        favorite_id=body.favorite_id,
        overwrite_current=body.overwrite_current,
    )
    return PersonalGrowthReportTaskCreateResponse(data=summary)


@router.get(
    "/api/career-development-report/personal-growth-report/tasks/{task_id}",
    response_model=PersonalGrowthReportTaskResponse,
)
async def get_personal_growth_report_task(
    task_id: str,
    current_user: User = Depends(require_standard_user),
) -> PersonalGrowthReportTaskResponse:
    snapshot = await career_development_personal_growth_report_task_manager.get_snapshot(
        user_id=current_user.id,
        task_id=task_id,
    )
    if snapshot is None:
        raise HTTPException(status_code=404, detail="个人职业成长报告任务不存在。")
    return PersonalGrowthReportTaskResponse(data=snapshot)


@router.get("/api/career-development-report/personal-growth-report/tasks/{task_id}/stream")
async def stream_personal_growth_report_task(
    task_id: str,
    current_user: User = Depends(require_standard_user),
) -> StreamingResponse:
    async def event_stream():
        queue, snapshot = await career_development_personal_growth_report_task_manager.subscribe(
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
        if snapshot.status in {"completed", "cancelled", "failed"}:
            return

        try:
            while True:
                event = await queue.get()
                if event.get("stage") == "__end__":
                    break
                yield json.dumps(event, ensure_ascii=False) + "\n"
        finally:
            await career_development_personal_growth_report_task_manager.unsubscribe(
                task_id=task_id,
                queue=queue,
            )

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.post(
    "/api/career-development-report/personal-growth-report/tasks/{task_id}/cancel",
    response_model=PersonalGrowthReportTaskCancelResponse,
)
async def cancel_personal_growth_report_task(
    task_id: str,
    current_user: User = Depends(require_standard_user),
) -> PersonalGrowthReportTaskCancelResponse:
    snapshot = await career_development_personal_growth_report_task_manager.cancel_task(
        user_id=current_user.id,
        task_id=task_id,
    )
    if snapshot is None:
        raise HTTPException(status_code=404, detail="个人职业成长报告任务不存在。")
    return PersonalGrowthReportTaskCancelResponse(data=snapshot)


@router.get(
    "/api/career-development-report/personal-growth-report/workspaces/{favorite_id}",
    response_model=PersonalGrowthReportResponse,
)
def get_personal_growth_report_workspace(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PersonalGrowthReportResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    row = get_personal_growth_workspace_or_none(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="当前用于生成个人职业成长报告的基础内容不足。")
    return PersonalGrowthReportResponse(
        data=build_personal_growth_report_payload(
            db,
            row=row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.put(
    "/api/career-development-report/personal-growth-report/workspaces/{favorite_id}",
    response_model=PersonalGrowthReportResponse,
)
def update_personal_growth_report(
    favorite_id: int,
    body: PersonalGrowthReportUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PersonalGrowthReportResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    row = get_personal_growth_workspace_or_none(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="当前用于生成个人职业成长报告的基础内容不足。")
    updated_row = update_personal_growth_report_workspace(
        db,
        row=row,
        sections=body.sections,
    )
    return PersonalGrowthReportResponse(
        data=build_personal_growth_report_payload(
            db,
            row=updated_row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.post(
    "/api/career-development-report/personal-growth-report/workspaces/{favorite_id}/regenerate",
    response_model=PersonalGrowthReportResponse,
)
async def regenerate_personal_growth_report_workspace(
    favorite_id: int,
    body: PersonalGrowthReportRegenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PersonalGrowthReportResponse:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    row = get_personal_growth_workspace_or_none(db, user_id=current_user.id, favorite_id=favorite_id)
    favorite_payload = read_favorite_report_payload(favorite_record)
    try:
        if row is None:
            row = await ensure_personal_growth_base_workspace(
                db,
                user_id=current_user.id,
                favorite_id=favorite_id,
            )
        if row is None:
            raise HTTPException(status_code=400, detail="当前用于生成个人职业成长报告的基础内容不足。")
        updated_row = await regenerate_personal_growth_report(
            db,
            row=row,
            favorite=favorite_payload,
            overwrite_current=body.overwrite_current,
        )
    except (LLMClientError, CareerDevelopmentGoalPlanningError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return PersonalGrowthReportResponse(
        data=build_personal_growth_report_payload(
            db,
            row=updated_row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.post(
    "/api/career-development-report/personal-growth-report/bootstrap/regenerate",
    response_model=PersonalGrowthReportResponse,
)
async def bootstrap_personal_growth_report_workspace(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> PersonalGrowthReportResponse:
    favorite_id = get_latest_personal_growth_favorite_id(db, user_id=current_user.id)
    if favorite_id is None:
        raise HTTPException(status_code=400, detail="当前用于生成个人职业成长报告的基础内容不足。")
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=400, detail="当前用于生成个人职业成长报告的基础内容不足。")
    favorite_payload = read_favorite_report_payload(favorite_record)
    try:
        row = await ensure_personal_growth_base_workspace(
            db,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
        if row is None:
            raise HTTPException(status_code=400, detail="当前用于生成个人职业成长报告的基础内容不足。")
        updated_row = await regenerate_personal_growth_report(
            db,
            row=row,
            favorite=favorite_payload,
            overwrite_current=False,
        )
    except (LLMClientError, CareerDevelopmentGoalPlanningError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return PersonalGrowthReportResponse(
        data=build_personal_growth_report_payload(
            db,
            row=updated_row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.post("/api/career-development-report/personal-growth-report/workspaces/{favorite_id}/export")
def export_personal_growth_report_workspace(
    favorite_id: int,
    body: PersonalGrowthReportExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> Response:
    favorite_record = get_favorite_report_record(db, user_id=current_user.id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="收藏目标不存在。")
    row = get_personal_growth_workspace_or_none(db, user_id=current_user.id, favorite_id=favorite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="当前用于生成个人职业成长报告的基础内容不足。")
    favorite_payload = read_favorite_report_payload(favorite_record)
    try:
        content, media_type, disposition = export_personal_growth_report_bytes(
            db,
            row=row,
            favorite=favorite_payload,
            export_format=body.format,
            force_with_issues=body.force_with_issues,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": disposition},
    )
