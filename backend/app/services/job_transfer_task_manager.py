from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db.session import SessionLocal
from app.models.job_transfer_analysis_task import JobTransferAnalysisTask
from app.schemas.job_transfer import JobTransferTaskSnapshot, JobTransferTaskSummary
from app.services.job_transfer import JobTransferService, JobTransferTaskCancelledError
from app.services.vector_store import QdrantGroupedVectorStore


TERMINAL_TASK_STATUSES = {"completed", "cancelled", "failed"}


@dataclass(slots=True)
class RunningTaskControl:
    task: asyncio.Task[None]
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    subscribers: set[asyncio.Queue[dict[str, Any]]] = field(default_factory=set)


class JobTransferTaskManager:
    def __init__(self) -> None:
        self._controls: dict[str, RunningTaskControl] = {}
        self._lock = asyncio.Lock()

    async def create_task(self, career_id: int) -> JobTransferTaskSummary:
        task_id = str(uuid4())
        with SessionLocal() as db:
            row = JobTransferAnalysisTask(
                id=task_id,
                career_profile_id=career_id,
                status="queued",
                payload_json="{}",
                last_event_json="{}",
            )
            db.add(row)
            db.commit()

        control = RunningTaskControl(task=asyncio.create_task(self._run_task(task_id)))
        async with self._lock:
            self._controls[task_id] = control
        return JobTransferTaskSummary(task_id=task_id, career_id=career_id, status="queued", reused_existing=False)

    async def get_snapshot(self, task_id: str) -> JobTransferTaskSnapshot | None:
        with SessionLocal() as db:
            row = db.get(JobTransferAnalysisTask, task_id)
            if row is None:
                return None
            return self._to_snapshot(row)

    async def cancel_task(self, task_id: str) -> JobTransferTaskSnapshot | None:
        async with self._lock:
            control = self._controls.get(task_id)
            if control is not None:
                control.cancel_event.set()

        with SessionLocal() as db:
            row = db.get(JobTransferAnalysisTask, task_id)
            if row is None:
                return None
            if row.status not in TERMINAL_TASK_STATUSES:
                row.status = "cancelled"
                row.cancel_requested_at = datetime.now(timezone.utc)
                row.updated_at = datetime.now(timezone.utc)
                event = {
                    "stage": "task_cancelled",
                    "task_id": task_id,
                    "status": "cancelled",
                    "processed_candidates": row.processed_candidates,
                    "total_candidates": row.total_candidates,
                }
                row.last_event_json = json.dumps(event, ensure_ascii=False)
                db.commit()
            snapshot = self._to_snapshot(row)

        await self._publish(
            task_id,
            {
                "stage": "task_cancelled",
                "task_id": task_id,
                "status": snapshot.status,
                "processed_candidates": snapshot.processed_candidates,
                "total_candidates": snapshot.total_candidates,
                "snapshot": snapshot.model_dump(),
            },
        )
        return snapshot

    async def subscribe(self, task_id: str) -> tuple[asyncio.Queue[dict[str, Any]], JobTransferTaskSnapshot | None]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            control = self._controls.get(task_id)
            if control is not None:
                control.subscribers.add(queue)
        snapshot = await self.get_snapshot(task_id)
        return queue, snapshot

    async def unsubscribe(self, task_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            control = self._controls.get(task_id)
            if control is not None:
                control.subscribers.discard(queue)

    async def _run_task(self, task_id: str) -> None:
        try:
            with SessionLocal() as db:
                row = db.get(JobTransferAnalysisTask, task_id)
                if row is None:
                    return

                row.status = "running"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()

                await self._publish(
                    task_id,
                    {
                        "stage": "task_created",
                        "task_id": task_id,
                        "status": "running",
                        "processed_candidates": 0,
                        "total_candidates": 0,
                        "snapshot": self._to_snapshot(row).model_dump(),
                    },
                )

                job_vector_store = QdrantGroupedVectorStore.for_job_groups()
                career_vector_store = QdrantGroupedVectorStore.for_career_groups()
                try:
                    service = JobTransferService(db, job_vector_store=job_vector_store, career_vector_store=career_vector_store)

                    async def on_progress(event: dict[str, Any]) -> None:
                        row.processed_candidates = int(event.get("processed_candidates", row.processed_candidates) or 0)
                        row.total_candidates = int(event.get("total_candidates", row.total_candidates) or 0)
                        if "payload" in event:
                            row.payload_json = json.dumps(event["payload"], ensure_ascii=False)
                        row.last_event_json = json.dumps(event, ensure_ascii=False)
                        row.updated_at = datetime.now(timezone.utc)
                        if event.get("stage") == "completed":
                            row.status = "completed"
                            row.completed_at = datetime.now(timezone.utc)
                        db.commit()

                        snapshot = self._to_snapshot(row)
                        await self._publish(
                            task_id,
                            {
                                **event,
                                "task_id": task_id,
                                "status": row.status,
                                "processed_candidates": row.processed_candidates,
                                "total_candidates": row.total_candidates,
                                "snapshot": snapshot.model_dump(),
                            },
                        )

                    async def cancel_checker() -> bool:
                        db.refresh(row)
                        return row.status == "cancelled"

                    payload = await service.get_transfer_payload_async(
                        row.career_profile_id,
                        progress=on_progress,
                        cancel_checker=cancel_checker,
                    )
                    if payload is None:
                        row.status = "failed"
                        row.error_message = "Job transfer career profile not found"
                        row.completed_at = datetime.now(timezone.utc)
                        row.updated_at = datetime.now(timezone.utc)
                        db.commit()
                        await self._publish(
                            task_id,
                            {
                                "stage": "error",
                                "task_id": task_id,
                                "status": row.status,
                                "detail": row.error_message,
                                "snapshot": self._to_snapshot(row).model_dump(),
                            },
                        )
                    elif row.status != "completed":
                        row.status = "completed"
                        row.payload_json = json.dumps(payload.model_dump(), ensure_ascii=False)
                        row.completed_at = datetime.now(timezone.utc)
                        row.updated_at = datetime.now(timezone.utc)
                        db.commit()
                        await self._publish(
                            task_id,
                            {
                                "stage": "completed",
                                "task_id": task_id,
                                "status": row.status,
                                "processed_candidates": row.processed_candidates,
                                "total_candidates": row.total_candidates,
                                "snapshot": self._to_snapshot(row).model_dump(),
                            },
                        )
                except (JobTransferTaskCancelledError, asyncio.CancelledError):
                    row.status = "cancelled"
                    if row.cancel_requested_at is None:
                        row.cancel_requested_at = datetime.now(timezone.utc)
                    row.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    await self._publish(
                        task_id,
                        {
                            "stage": "task_cancelled",
                            "task_id": task_id,
                            "status": row.status,
                            "processed_candidates": row.processed_candidates,
                            "total_candidates": row.total_candidates,
                            "snapshot": self._to_snapshot(row).model_dump(),
                        },
                    )
                except Exception as exc:  # noqa: BLE001
                    row.status = "failed"
                    row.error_message = str(exc)
                    row.completed_at = datetime.now(timezone.utc)
                    row.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    await self._publish(
                        task_id,
                        {
                            "stage": "error",
                            "task_id": task_id,
                            "status": row.status,
                            "detail": row.error_message,
                            "snapshot": self._to_snapshot(row).model_dump(),
                        },
                    )
                finally:
                    job_vector_store.close()
                    career_vector_store.close()
        finally:
            await self._publish(task_id, {"stage": "__end__", "task_id": task_id})
            async with self._lock:
                control = self._controls.pop(task_id, None)
            if control is not None:
                for queue in list(control.subscribers):
                    with suppress(Exception):
                        await queue.put({"stage": "__end__", "task_id": task_id})

    async def _publish(self, task_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            control = self._controls.get(task_id)
            queues = list(control.subscribers) if control is not None else []
        for queue in queues:
            await queue.put(event)

    def _to_snapshot(self, row: JobTransferAnalysisTask) -> JobTransferTaskSnapshot:
        payload = self._loads_json(row.payload_json)
        latest_event = self._loads_json(row.last_event_json)
        return JobTransferTaskSnapshot(
            task_id=row.id,
            career_id=row.career_profile_id,
            status=row.status,
            processed_candidates=row.processed_candidates,
            total_candidates=row.total_candidates,
            payload=payload or None,
            latest_event=latest_event or None,
            error_message=row.error_message or None,
            cancel_requested_at=row.cancel_requested_at.isoformat() if row.cancel_requested_at else None,
            completed_at=row.completed_at.isoformat() if row.completed_at else None,
            updated_at=row.updated_at.isoformat(),
        )

    @staticmethod
    def _loads_json(raw: str) -> dict[str, Any]:
        if not raw:
            return {}
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}


job_transfer_task_manager = JobTransferTaskManager()
