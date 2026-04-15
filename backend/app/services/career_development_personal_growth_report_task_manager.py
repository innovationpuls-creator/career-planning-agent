from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.career_development_personal_growth_report_task import (
    CareerDevelopmentPersonalGrowthReportTask,
)
from app.schemas.career_development_report import (
    PersonalGrowthReportTaskPayload,
    PersonalGrowthReportTaskSummary,
)
from app.services.career_development_goal_planning import (
    CareerDevelopmentGoalPlanningError,
    get_favorite_report_record,
    read_favorite_report_payload,
)
from app.services.career_development_personal_growth_report import (
    PERSONAL_GROWTH_TASK_TERMINAL_STATUSES,
    build_personal_growth_task_snapshot,
    build_personal_growth_task_summary,
    ensure_personal_growth_base_workspace,
    regenerate_personal_growth_report,
)
from app.services.llm import LLMClientError

UTC = timezone.utc

STAGE_META: dict[str, tuple[str, int]] = {
    "queued": ("已开始准备个人职业成长报告生成任务。", 5),
    "prepare_base_workspace": ("正在准备职业规划工作台基础数据。", 12),
    "collect_resume_analysis": ("正在收集简历解析与 12 维画像结果。", 24),
    "collect_match_report": ("正在整理职业匹配结果和目标差距。", 36),
    "collect_goal_planning_workspace": ("正在整理职业规划与成长路径内容。", 50),
    "collect_snail_learning_path": ("正在整理蜗牛学习路径材料。", 64),
    "build_generation_context": ("正在构建个人职业成长报告生成上下文。", 78),
    "llm_generate_sections": ("正在生成 5 个固定章节的 Markdown 报告。", 90),
    "persist_report": ("正在保存个人职业成长报告。", 97),
    "completed": ("个人职业成长报告已生成完成。", 100),
}

@dataclass(slots=True)
class RunningTaskControl:
    task: asyncio.Task[None]
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    subscribers: set[asyncio.Queue[dict[str, Any]]] = field(default_factory=set)


class PersonalGrowthReportTaskCancelledError(RuntimeError):
    pass


class CareerDevelopmentPersonalGrowthReportTaskManager:
    def __init__(self) -> None:
        self._controls: dict[str, RunningTaskControl] = {}
        self._lock = asyncio.Lock()

    async def create_task(
        self,
        *,
        user_id: int,
        favorite_id: int,
        overwrite_current: bool = False,
    ) -> PersonalGrowthReportTaskSummary:
        with SessionLocal() as db:
            existing = db.scalar(
                select(CareerDevelopmentPersonalGrowthReportTask)
                .where(
                    CareerDevelopmentPersonalGrowthReportTask.user_id == user_id,
                    CareerDevelopmentPersonalGrowthReportTask.favorite_id == favorite_id,
                    CareerDevelopmentPersonalGrowthReportTask.status.in_(["queued", "running"]),
                )
                .order_by(CareerDevelopmentPersonalGrowthReportTask.updated_at.desc())
            )
            if existing is not None:
                return build_personal_growth_task_summary(existing)

            task_id = str(uuid4())
            row = CareerDevelopmentPersonalGrowthReportTask(
                id=task_id,
                user_id=user_id,
                favorite_id=favorite_id,
                status="queued",
                progress=0,
                overwrite_current=1 if overwrite_current else 0,
                result_json="{}",
                last_event_json="{}",
            )
            db.add(row)
            db.commit()
            db.refresh(row)

        control = RunningTaskControl(task=asyncio.create_task(self._run_task(task_id)))
        async with self._lock:
            self._controls[task_id] = control
        return build_personal_growth_task_summary(row)

    async def get_snapshot(
        self,
        *,
        user_id: int,
        task_id: str,
    ) -> PersonalGrowthReportTaskPayload | None:
        with SessionLocal() as db:
            row = db.get(CareerDevelopmentPersonalGrowthReportTask, task_id)
            if row is None or row.user_id != user_id:
                return None
            return build_personal_growth_task_snapshot(row)

    async def subscribe(
        self,
        *,
        user_id: int,
        task_id: str,
    ) -> tuple[asyncio.Queue[dict[str, Any]], PersonalGrowthReportTaskPayload | None]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            control = self._controls.get(task_id)
            if control is not None:
                control.subscribers.add(queue)
        snapshot = await self.get_snapshot(user_id=user_id, task_id=task_id)
        return queue, snapshot

    async def unsubscribe(self, *, task_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            control = self._controls.get(task_id)
            if control is not None:
                control.subscribers.discard(queue)

    async def cancel_task(
        self,
        *,
        user_id: int,
        task_id: str,
    ) -> PersonalGrowthReportTaskPayload | None:
        async with self._lock:
            control = self._controls.get(task_id)
            if control is not None:
                control.cancel_event.set()

        with SessionLocal() as db:
            row = db.get(CareerDevelopmentPersonalGrowthReportTask, task_id)
            if row is None or row.user_id != user_id:
                return None
            if row.status not in PERSONAL_GROWTH_TASK_TERMINAL_STATUSES:
                row.status = "cancelled"
                row.cancel_requested_at = datetime.now(UTC)
                row.updated_at = datetime.now(UTC)
                row.last_event_json = json.dumps(
                    {
                        "stage": "task_cancelled",
                        "status_text": "已取消个人职业成长报告生成。",
                        "progress": row.progress,
                        "created_at": row.updated_at.isoformat(),
                    },
                    ensure_ascii=False,
                )
                db.add(row)
                db.commit()
                db.refresh(row)
            snapshot = build_personal_growth_task_snapshot(row)

        await self._publish(
            task_id,
            {
                "stage": "task_cancelled",
                "task_id": task_id,
                "status": snapshot.status,
                "status_text": snapshot.latest_event.status_text if snapshot.latest_event else "已取消。",
                "progress": snapshot.progress,
                "snapshot": snapshot.model_dump(mode="json"),
            },
        )
        return snapshot

    async def _run_task(self, task_id: str) -> None:
        try:
            with SessionLocal() as db:
                row = db.get(CareerDevelopmentPersonalGrowthReportTask, task_id)
                if row is None:
                    return

                row.status = "running"
                row.updated_at = datetime.now(UTC)
                db.commit()
                db.refresh(row)

                await self._push_stage(db=db, row=row, stage="queued")
                await self._push_stage(db=db, row=row, stage="prepare_base_workspace")
                await self._ensure_not_cancelled(db=db, row=row)

                favorite_record = get_favorite_report_record(
                    db,
                    user_id=row.user_id,
                    favorite_id=row.favorite_id,
                )
                if favorite_record is None:
                    raise ValueError("收藏目标不存在。")

                workspace = await ensure_personal_growth_base_workspace(
                    db,
                    user_id=row.user_id,
                    favorite_id=row.favorite_id,
                )
                if workspace is None:
                    raise ValueError("当前用于生成个人职业成长报告的基础内容不足。")

                for stage in [
                    "collect_resume_analysis",
                    "collect_match_report",
                    "collect_goal_planning_workspace",
                    "collect_snail_learning_path",
                    "build_generation_context",
                    "llm_generate_sections",
                ]:
                    await self._ensure_not_cancelled(db=db, row=row)
                    await self._push_stage(db=db, row=row, stage=stage)

                updated_workspace = await regenerate_personal_growth_report(
                    db,
                    row=workspace,
                    favorite=favorite,
                    overwrite_current=bool(row.overwrite_current),
                )
                row.result_workspace_id = updated_workspace.id
                row.result_json = json.dumps(
                    {
                        "workspace_id": updated_workspace.id,
                        "section_count": 5,
                        "generated_markdown": updated_workspace.personal_growth_report_generated_markdown,
                        "updated_at": updated_workspace.updated_at.isoformat(),
                    },
                    ensure_ascii=False,
                )
                db.add(row)
                db.commit()
                db.refresh(row)

                await self._ensure_not_cancelled(db=db, row=row)
                await self._push_stage(db=db, row=row, stage="persist_report")

                row.status = "completed"
                row.progress = 100
                row.completed_at = datetime.now(UTC)
                row.updated_at = datetime.now(UTC)
                db.add(row)
                db.commit()
                db.refresh(row)
                await self._push_stage(db=db, row=row, stage="completed", include_snapshot=True)
        except PersonalGrowthReportTaskCancelledError:
            await self._mark_cancelled(task_id)
        except (LLMClientError, CareerDevelopmentGoalPlanningError, ValueError) as exc:
            await self._fail_task(task_id=task_id, detail=str(exc))
        except Exception as exc:  # noqa: BLE001
            await self._fail_task(task_id=task_id, detail=str(exc))
        finally:
            await self._publish(task_id, {"stage": "__end__", "task_id": task_id})
            async with self._lock:
                control = self._controls.pop(task_id, None)
            if control is not None:
                for queue in list(control.subscribers):
                    with suppress(Exception):
                        await queue.put({"stage": "__end__", "task_id": task_id})

    async def _ensure_not_cancelled(
        self,
        *,
        db,
        row: CareerDevelopmentPersonalGrowthReportTask,
    ) -> None:
        async with self._lock:
            control = self._controls.get(row.id)
            if control is not None and control.cancel_event.is_set():
                raise PersonalGrowthReportTaskCancelledError()
        db.refresh(row)
        if row.status == "cancelled":
            raise PersonalGrowthReportTaskCancelledError()

    async def _mark_cancelled(self, task_id: str) -> None:
        with SessionLocal() as db:
            row = db.get(CareerDevelopmentPersonalGrowthReportTask, task_id)
            if row is None:
                return
            row.status = "cancelled"
            if row.cancel_requested_at is None:
                row.cancel_requested_at = datetime.now(UTC)
            row.updated_at = datetime.now(UTC)
            row.last_event_json = json.dumps(
                {
                    "stage": "task_cancelled",
                    "status_text": "已取消个人职业成长报告生成。",
                    "progress": row.progress,
                    "created_at": row.updated_at.isoformat(),
                },
                ensure_ascii=False,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            snapshot = build_personal_growth_task_snapshot(row)
        await self._publish(
            task_id,
            {
                "stage": "task_cancelled",
                "task_id": task_id,
                "status": snapshot.status,
                "status_text": "已取消个人职业成长报告生成。",
                "progress": snapshot.progress,
                "snapshot": snapshot.model_dump(mode="json"),
            },
        )

    async def _fail_task(self, *, task_id: str, detail: str) -> None:
        with SessionLocal() as db:
            row = db.get(CareerDevelopmentPersonalGrowthReportTask, task_id)
            if row is None:
                return
            row.status = "failed"
            row.error_message = detail
            row.completed_at = datetime.now(UTC)
            row.updated_at = datetime.now(UTC)
            db.add(row)
            db.commit()
            db.refresh(row)
            await self._update_event(
                db=db,
                row=row,
                stage="failed",
                status_text=f"个人职业成长报告生成失败：{detail}",
                progress=max(row.progress, 100),
                include_snapshot=True,
            )

    async def _push_stage(
        self,
        *,
        db,
        row: CareerDevelopmentPersonalGrowthReportTask,
        stage: str,
        include_snapshot: bool = False,
    ) -> None:
        status_text, progress = STAGE_META[stage]
        await self._update_event(
            db=db,
            row=row,
            stage=stage,
            status_text=status_text,
            progress=progress,
            include_snapshot=include_snapshot,
        )

    async def _update_event(
        self,
        *,
        db,
        row: CareerDevelopmentPersonalGrowthReportTask,
        stage: str,
        status_text: str,
        progress: int,
        include_snapshot: bool = False,
    ) -> None:
        created_at = datetime.now(UTC)
        row.progress = progress
        row.updated_at = created_at
        row.last_event_json = json.dumps(
            {
                "stage": stage,
                "status_text": status_text,
                "progress": progress,
                "created_at": created_at.isoformat(),
            },
            ensure_ascii=False,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        snapshot = build_personal_growth_task_snapshot(row)
        event = {
            "stage": stage,
            "task_id": row.id,
            "status": row.status,
            "status_text": status_text,
            "progress": progress,
            "created_at": created_at.isoformat(),
        }
        if include_snapshot:
            event["snapshot"] = snapshot.model_dump(mode="json")
        await self._publish(row.id, event)

    async def _publish(self, task_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            control = self._controls.get(task_id)
            queues = list(control.subscribers) if control is not None else []
        for queue in queues:
            await queue.put(event)


career_development_personal_growth_report_task_manager = (
    CareerDevelopmentPersonalGrowthReportTaskManager()
)


