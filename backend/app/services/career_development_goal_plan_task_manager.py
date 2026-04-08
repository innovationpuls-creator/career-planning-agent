from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db.session import SessionLocal
from app.models.career_development_goal_plan_task import CareerDevelopmentGoalPlanTask
from app.schemas.career_development_report import (
    CareerDevelopmentGoalPlanStatusEvent,
    CareerDevelopmentGoalPlanTaskPayload,
    CareerDevelopmentGoalPlanTaskSummary,
)
from app.services.career_development_goal_planning import (
    CareerDevelopmentGoalPlanningError,
    build_goal_plan_result,
)
from app.services.career_development_learning_resources import (
    generate_learning_resources_for_phases,
)
from app.services.career_development_plan_workspace import (
    build_plan_workspace_payload,
    normalize_goal_plan_result,
    upsert_workspace_from_goal_plan_result,
)


TERMINAL_TASK_STATUSES = {"completed", "failed"}

STAGE_META: dict[str, tuple[str, int]] = {
    "queued": ("已开始准备职业目标与成长路径规划请求。", 5),
    "dify_request": ("正在获取 Dify 行业趋势与发展分析材料。", 20),
    "dify_complete": ("已收到 Dify 原始内容，正在整理趋势依据。", 45),
    "correlation": ("正在生成职业目标关联性分析。", 62),
    "strengths": ("正在生成路径支撑证据。", 76),
    "comprehensive": ("正在生成综合分析报告。", 86),
    "learning_resources": ("正在补齐短中长期学习路线与推荐网址。", 96),
    "completed": ("职业目标分析报告与成长路径规划已生成完成。", 100),
}
STAGE_META = {
    "queued": ("已开始准备职业目标分析与成长路径规划请求。", 5),
    "dify_request": ("正在获取 Dify 趋势与发展路径原始材料。", 20),
    "dify_complete": ("已收到 Dify 原始内容，正在整理趋势依据。", 45),
    "correlation": ("正在生成职业目标关联性分析。", 62),
    "strengths": ("正在生成路径支撑证据。", 76),
    "comprehensive": ("正在整理综合分析报告。", 86),
    "learning_resources": ("正在补齐短中长期学习路线与推荐网址。", 96),
    "completed": ("职业目标分析报告与成长路径规划已生成完成。", 100),
}


@dataclass(slots=True)
class RunningTaskControl:
    task: asyncio.Task[None]
    subscribers: set[asyncio.Queue[dict[str, Any]]] = field(default_factory=set)


class CareerDevelopmentGoalPlanTaskManager:
    def __init__(self) -> None:
        self._controls: dict[str, RunningTaskControl] = {}
        self._lock = asyncio.Lock()

    async def create_task(self, *, user_id: int, favorite_id: int) -> CareerDevelopmentGoalPlanTaskSummary:
        task_id = str(uuid4())
        with SessionLocal() as db:
            row = CareerDevelopmentGoalPlanTask(
                id=task_id,
                user_id=user_id,
                favorite_id=favorite_id,
                status="queued",
                progress=0,
                result_json="{}",
                last_event_json="{}",
            )
            db.add(row)
            db.commit()

        control = RunningTaskControl(task=asyncio.create_task(self._run_task(task_id)))
        async with self._lock:
            self._controls[task_id] = control
        return CareerDevelopmentGoalPlanTaskSummary(
            task_id=task_id,
            favorite_id=favorite_id,
            status="queued",
            progress=0,
        )

    async def get_snapshot(self, *, user_id: int, task_id: str) -> CareerDevelopmentGoalPlanTaskPayload | None:
        with SessionLocal() as db:
            row = db.get(CareerDevelopmentGoalPlanTask, task_id)
            if row is None or row.user_id != user_id:
                return None
            return self._to_snapshot(row)

    async def subscribe(
        self,
        *,
        user_id: int,
        task_id: str,
    ) -> tuple[asyncio.Queue[dict[str, Any]], CareerDevelopmentGoalPlanTaskPayload | None]:
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

    async def _run_task(self, task_id: str) -> None:
        try:
            with SessionLocal() as db:
                row = db.get(CareerDevelopmentGoalPlanTask, task_id)
                if row is None:
                    return

                row.status = "running"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()

                await self._push_stage(db=db, row=row, stage="queued")
                await self._push_stage(db=db, row=row, stage="dify_request")

                result, dify_conversation_id = await build_goal_plan_result(
                    db,
                    user_id=row.user_id,
                    favorite_id=row.favorite_id,
                    stage_hook=lambda stage: self._push_stage(db=db, row=row, stage=stage),
                )
                normalized_result = normalize_goal_plan_result(result)

                await self._push_stage(db=db, row=row, stage="learning_resources")
                enriched_phases = await generate_learning_resources_for_phases(
                    favorite=normalized_result.favorite,
                    phases=normalized_result.growth_plan_phases,
                    user_id=row.user_id,
                    favorite_id=row.favorite_id,
                )
                normalized_result = normalize_goal_plan_result(
                    normalized_result.model_copy(
                        update={
                            "growth_plan_phases": enriched_phases,
                        }
                    )
                )

                workspace = upsert_workspace_from_goal_plan_result(
                    db,
                    user_id=row.user_id,
                    favorite_id=row.favorite_id,
                    result=normalized_result,
                    source_task_id=row.id,
                )
                workspace_payload = build_plan_workspace_payload(
                    db,
                    row=workspace,
                    user_id=row.user_id,
                    favorite_id=row.favorite_id,
                )
                normalized_result = normalized_result.model_copy(
                    update={
                        "workspace_id": workspace.id,
                        "workspace_overview": workspace_payload.workspace_overview,
                    }
                )

                row.dify_conversation_id = dify_conversation_id
                row.status = "completed"
                row.progress = 100
                row.result_json = json.dumps(normalized_result.model_dump(mode="json"), ensure_ascii=False)
                row.completed_at = datetime.now(timezone.utc)
                row.updated_at = datetime.now(timezone.utc)
                db.commit()

                await self._push_stage(db=db, row=row, stage="completed", include_snapshot=True)
        except CareerDevelopmentGoalPlanningError as exc:
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

    async def _fail_task(self, *, task_id: str, detail: str) -> None:
        with SessionLocal() as db:
            row = db.get(CareerDevelopmentGoalPlanTask, task_id)
            if row is None:
                return
            row.status = "failed"
            row.error_message = detail
            row.completed_at = datetime.now(timezone.utc)
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            await self._update_event(
                db=db,
                row=row,
                stage="failed",
                status_text=f"职业目标分析生成失败：{detail}",
                progress=max(row.progress, 100),
                include_snapshot=True,
            )

    async def _push_stage(
        self,
        *,
        db,
        row: CareerDevelopmentGoalPlanTask,
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
        row: CareerDevelopmentGoalPlanTask,
        stage: str,
        status_text: str,
        progress: int,
        include_snapshot: bool = False,
    ) -> None:
        event_created_at = datetime.now(timezone.utc)
        row.progress = progress
        row.last_event_json = json.dumps(
            {
                "stage": stage,
                "status_text": status_text,
                "progress": progress,
                "created_at": event_created_at.isoformat(),
            },
            ensure_ascii=False,
        )
        row.updated_at = event_created_at
        db.commit()

        snapshot = self._to_snapshot(row)
        event = {
            "stage": stage,
            "task_id": row.id,
            "status": row.status,
            "status_text": status_text,
            "progress": progress,
            "created_at": event_created_at.isoformat(),
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

    def _to_snapshot(self, row: CareerDevelopmentGoalPlanTask) -> CareerDevelopmentGoalPlanTaskPayload:
        result_payload = self._loads_json(row.result_json)
        if result_payload:
            with suppress(Exception):
                from app.schemas.career_development_report import CareerDevelopmentGoalPlanResultPayload

                normalized_result = normalize_goal_plan_result(
                    CareerDevelopmentGoalPlanResultPayload.model_validate(result_payload)
                )
                result_payload = normalized_result.model_dump(mode="json")
        latest_event = self._loads_json(row.last_event_json)
        return CareerDevelopmentGoalPlanTaskPayload(
            task_id=row.id,
            favorite_id=row.favorite_id,
            status=row.status,
            progress=row.progress,
            result=result_payload or None,
            latest_event=CareerDevelopmentGoalPlanStatusEvent.model_validate(latest_event)
            if latest_event
            else None,
            error_message=row.error_message or None,
            completed_at=row.completed_at,
            updated_at=row.updated_at,
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


career_development_goal_plan_task_manager = CareerDevelopmentGoalPlanTaskManager()
