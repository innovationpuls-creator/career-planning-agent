import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.job_transfer import (
    JobTransferOptionsResponse,
    JobTransferResponse,
    JobTransferSourceResponse,
    JobTransferTaskCancelResponse,
    JobTransferTaskCreateRequest,
    JobTransferTaskCreateResponse,
    JobTransferTaskSnapshotResponse,
)
from app.services.job_transfer import JobTransferService
from app.services.job_transfer_task_manager import TERMINAL_TASK_STATUSES, job_transfer_task_manager
from app.services.vector_store import QdrantGroupedVectorStore


router = APIRouter(prefix="/api/job-transfer", tags=["job-transfer"])


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


def get_job_transfer_service(
    db: Session = Depends(get_db),
) -> JobTransferService:
    return JobTransferService(db)


def get_job_transfer_detail_service(
    db: Session = Depends(get_db),
    job_vector_store: QdrantGroupedVectorStore = Depends(get_job_group_vector_store),
    career_vector_store: QdrantGroupedVectorStore = Depends(get_career_group_vector_store),
) -> JobTransferService:
    return JobTransferService(
        db,
        job_vector_store=job_vector_store,
        career_vector_store=career_vector_store,
    )


@router.get("/options", response_model=JobTransferOptionsResponse)
def get_job_transfer_options(
    service: JobTransferService = Depends(get_job_transfer_service),
    _: User = Depends(require_standard_user),
) -> JobTransferOptionsResponse:
    return JobTransferOptionsResponse(data=service.list_options())


@router.get("/source/{career_id}", response_model=JobTransferSourceResponse)
def get_job_transfer_source(
    career_id: int,
    service: JobTransferService = Depends(get_job_transfer_service),
    _: User = Depends(require_standard_user),
) -> JobTransferSourceResponse:
    source = service.get_source_snapshot(career_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Job transfer source profile not found")
    return JobTransferSourceResponse(data=source)


@router.post("/tasks", response_model=JobTransferTaskCreateResponse)
async def create_job_transfer_task(
    body: JobTransferTaskCreateRequest,
    _: User = Depends(require_standard_user),
) -> JobTransferTaskCreateResponse:
    summary = await job_transfer_task_manager.create_task(body.career_id)
    return JobTransferTaskCreateResponse(data=summary)


@router.get("/tasks/{task_id}", response_model=JobTransferTaskSnapshotResponse)
async def get_job_transfer_task_snapshot(
    task_id: str,
    _: User = Depends(require_standard_user),
) -> JobTransferTaskSnapshotResponse:
    snapshot = await job_transfer_task_manager.get_snapshot(task_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Job transfer task not found")
    return JobTransferTaskSnapshotResponse(data=snapshot)


@router.post("/tasks/{task_id}/cancel", response_model=JobTransferTaskCancelResponse)
async def cancel_job_transfer_task(
    task_id: str,
    _: User = Depends(require_standard_user),
) -> JobTransferTaskCancelResponse:
    snapshot = await job_transfer_task_manager.cancel_task(task_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Job transfer task not found")
    return JobTransferTaskCancelResponse(data=snapshot)


@router.get("/tasks/{task_id}/stream")
async def stream_job_transfer_task(
    task_id: str,
    _: User = Depends(require_standard_user),
) -> StreamingResponse:
    async def event_stream():
        queue, snapshot = await job_transfer_task_manager.subscribe(task_id)
        if snapshot is None:
            yield json.dumps({"stage": "not_found", "task_id": task_id}, ensure_ascii=False) + "\n"
            return

        initial_stage = "task_restored" if snapshot.status not in {"queued"} else "task_created"
        yield json.dumps(
            {
                "stage": initial_stage,
                "task_id": task_id,
                "status": snapshot.status,
                "processed_candidates": snapshot.processed_candidates,
                "total_candidates": snapshot.total_candidates,
                "snapshot": snapshot.model_dump(),
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
            await job_transfer_task_manager.unsubscribe(task_id, queue)

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.get("/{career_id}", response_model=JobTransferResponse)
async def get_job_transfer_profile(
    career_id: int,
    service: JobTransferService = Depends(get_job_transfer_detail_service),
    _: User = Depends(require_standard_user),
) -> JobTransferResponse:
    try:
        payload = await service.get_transfer_payload_async(career_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if payload is None:
        raise HTTPException(status_code=404, detail="Job transfer career profile not found")
    return JobTransferResponse(data=payload)


@router.get("/{career_id}/stream")
async def stream_job_transfer_profile(
    career_id: int,
    _: User = Depends(require_standard_user),
) -> StreamingResponse:
    async def event_stream():
        summary = await job_transfer_task_manager.create_task(career_id)
        queue, snapshot = await job_transfer_task_manager.subscribe(summary.task_id)
        try:
            if snapshot is not None:
                yield json.dumps(
                    {
                        "stage": "task_created",
                        "task_id": summary.task_id,
                        "status": snapshot.status,
                        "processed_candidates": snapshot.processed_candidates,
                        "total_candidates": snapshot.total_candidates,
                        "snapshot": snapshot.model_dump(),
                    },
                    ensure_ascii=False,
                ) + "\n"
            while True:
                event = await queue.get()
                if event.get("stage") == "__end__":
                    break
                yield json.dumps(event, ensure_ascii=False) + "\n"
        finally:
            await job_transfer_task_manager.unsubscribe(summary.task_id, queue)

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
