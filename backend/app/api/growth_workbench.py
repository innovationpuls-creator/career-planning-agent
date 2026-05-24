from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.growth_workbench import (
    GrowthWorkbenchAcceptResponse,
    GrowthWorkbenchAggregateResponse,
    GrowthWorkbenchTaskCreateRequest,
    GrowthWorkbenchTaskResponse,
    GrowthWorkbenchTaskStreamEvent,
)
from app.services.growth_workbench import (
    _task_payload,
    accept_workbench_artifact,
    build_growth_workbench_payload,
    cancel_workbench_task,
    create_and_run_workbench_task,
    get_workbench_task,
    skip_workbench_task,
)
from app.utils.datetime_utils import utc_now


router = APIRouter(tags=["career-development-report"])


@router.post(
    "/api/career-development-report/personal-growth-workbench/tasks",
    response_model=GrowthWorkbenchTaskResponse,
)
def create_growth_workbench_task(
    body: GrowthWorkbenchTaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchTaskResponse:
    try:
        row = create_and_run_workbench_task(
            db,
            user_id=current_user.id,
            favorite_id=body.favorite_id,
            task_type=body.task_type,
            run_mode=body.run_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return GrowthWorkbenchTaskResponse(data=_task_payload(row))


@router.get(
    "/api/career-development-report/personal-growth-workbench/{favorite_id}",
    response_model=GrowthWorkbenchAggregateResponse,
)
def get_growth_workbench(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchAggregateResponse:
    try:
        payload = build_growth_workbench_payload(
            db,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchAggregateResponse(data=payload)


@router.get(
    "/api/career-development-report/personal-growth-workbench/tasks/{task_id}",
    response_model=GrowthWorkbenchTaskResponse,
)
def get_growth_workbench_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchTaskResponse:
    row = get_workbench_task(db, user_id=current_user.id, task_id=task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="任务不存在。")
    return GrowthWorkbenchTaskResponse(data=_task_payload(row))


@router.post(
    "/api/career-development-report/personal-growth-workbench/tasks/{task_id}/skip",
    response_model=GrowthWorkbenchTaskResponse,
)
def skip_growth_workbench_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchTaskResponse:
    try:
        row = skip_workbench_task(db, user_id=current_user.id, task_id=task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchTaskResponse(data=_task_payload(row))


@router.post(
    "/api/career-development-report/personal-growth-workbench/tasks/{task_id}/cancel",
    response_model=GrowthWorkbenchTaskResponse,
)
def cancel_growth_workbench_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchTaskResponse:
    try:
        row = cancel_workbench_task(db, user_id=current_user.id, task_id=task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchTaskResponse(data=_task_payload(row))


@router.get("/api/career-development-report/personal-growth-workbench/tasks/{task_id}/stream")
def stream_growth_workbench_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> StreamingResponse:
    def event_stream():
        row = get_workbench_task(db, user_id=current_user.id, task_id=task_id)
        if row is None:
            yield json.dumps(
                {"stage": "not_found", "task_id": task_id},
                ensure_ascii=False,
            ) + "\n"
            return
        snapshot = _task_payload(row)
        event = GrowthWorkbenchTaskStreamEvent(
            stage=row.status,
            task_id=row.id,
            queue_id=row.queue_id,
            task_type=row.task_type,  # type: ignore[arg-type]
            status=row.status,  # type: ignore[arg-type]
            status_text=snapshot.status_text,
            progress=row.progress,
            snapshot=snapshot,
            created_at=utc_now(),
        )
        yield event.model_dump_json() + "\n"
        yield json.dumps(
            {"stage": "__end__", "task_id": task_id},
            ensure_ascii=False,
        ) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.post(
    "/api/career-development-report/personal-growth-workbench/artifacts/{artifact_id}/accept",
    response_model=GrowthWorkbenchAcceptResponse,
)
def accept_growth_workbench_artifact(
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchAcceptResponse:
    try:
        data = accept_workbench_artifact(
            db,
            user_id=current_user.id,
            artifact_id=artifact_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchAcceptResponse(data=data)
