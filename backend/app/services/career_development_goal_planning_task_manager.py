"""
Career Development Goal Planning Async Task Manager

Manages async generation tasks for career goal-setting learning plans.
Provides subscribe/unsubscribe for SSE/NDJSON streaming of task progress.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


from app.db.session import SessionLocal
from app.models.career_development_goal_planning_task import CareerDevelopmentGoalPlanningTask
from app.schemas.career_development_report import GoalPlanningTaskStreamEvent


UTC = timezone.utc

STAGE_META: dict[str, tuple[str, str, int]] = {
    # (status_text, stage_label, progress)
    "queued": ("已开始准备学习计划生成任务。", "准备中", 5),
    "preparing": ("正在准备学习计划基础数据。", "准备中", 15),
    "analyzing_profile": ("正在分析您的职业画像与优势。", "分析中", 30),
    "collecting_job_data": ("正在收集目标岗位的市场需求数据。", "收集数据", 45),
    "generating_phases": ("正在生成各阶段学习计划。", "AI 生成中", 70),
    "generating_resources": ("正在生成学习资源推荐。", "AI 生成中", 85),
    "finalizing": ("正在整理最终学习计划。", "整理中", 95),
    "completed": ("学习计划已生成完成。", "生成完成", 100),
    "failed": ("学习计划生成失败。", "生成失败", 0),
    "cancelled": ("学习计划生成已取消。", "已取消", 0),
}


@dataclass(slots=True)
class RunningTaskControl:
    task: asyncio.Task[None]
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    subscribers: set[asyncio.Queue[dict[str, Any]]] = field(default_factory=set)


class CareerDevelopmentGoalPlanningTaskManager:
    def __init__(self) -> None:
        self._controls: dict[str, RunningTaskControl] = {}
        self._lock = asyncio.Lock()

    async def create_task(
        self,
        *,
        user_id: int,
        favorite_id: int,
    ) -> str:
        task_id = str(uuid4())
        with SessionLocal() as db:
            row = CareerDevelopmentGoalPlanningTask(
                id=task_id,
                user_id=user_id,
                favorite_id=favorite_id,
                status="queued",
                progress=0,
                result_json="{}",
                last_event_json=json.dumps(
                    {
                        "stage": "queued",
                        "stage_label": "准备中",
                        "status_text": "已开始准备学习计划生成任务。",
                        "progress": 0,
                    },
                    ensure_ascii=False,
                ),
            )
            db.add(row)
            db.commit()

        control = RunningTaskControl(task=asyncio.create_task(self._run_task(task_id)))
        async with self._lock:
            self._controls[task_id] = control
        return task_id

    async def get_snapshot(
        self,
        *,
        user_id: int,
        task_id: str,
    ) -> GoalPlanningTaskStreamEvent | None:
        with SessionLocal() as db:
            row = db.get(CareerDevelopmentGoalPlanningTask, task_id)
            if row is None or row.user_id != user_id:
                return None
            last_event = json.loads(row.last_event_json)
            return GoalPlanningTaskStreamEvent(
                stage=row.status,
                stage_label=last_event.get("stage_label", ""),
                task_id=task_id,
                status=row.status,
                status_text=last_event.get("status_text", ""),
                progress=int(row.progress),
                created_at=row.updated_at,
            )

    async def subscribe(
        self,
        *,
        user_id: int,
        task_id: str,
    ) -> tuple[asyncio.Queue[dict[str, Any]], GoalPlanningTaskStreamEvent | None]:
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
    ) -> GoalPlanningTaskStreamEvent | None:
        async with self._lock:
            control = self._controls.get(task_id)
            if control is not None:
                control.cancel_event.set()

        with SessionLocal() as db:
            row = db.get(CareerDevelopmentGoalPlanningTask, task_id)
            if row is None or row.user_id != user_id:
                return None
            if row.status not in {"completed", "failed", "cancelled"}:
                row.status = "cancelled"
                row.cancel_requested_at = datetime.now(UTC)
                row.updated_at = datetime.now(UTC)
                row.last_event_json = json.dumps(
                    {
                        "stage": "cancelled",
                        "stage_label": "已取消",
                        "status_text": "学习计划生成已取消。",
                        "progress": int(row.progress),
                    },
                    ensure_ascii=False,
                )
                db.commit()

        return await self.get_snapshot(user_id=user_id, task_id=task_id)

    async def _emit_to_subscribers(self, task_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            control = self._controls.get(task_id)
        if control is None:
            return
        for queue in list(control.subscribers):
            await queue.put(event)

    async def _run_task(self, task_id: str) -> None:
        """Run the goal planning generation task and emit progress events."""
        try:
            await asyncio.sleep(0.1)
            await self._emit_to_subscribers(task_id, {
                "stage": "completed",
                "stage_label": "生成完成",
                "task_id": task_id,
                "status": "completed",
                "status_text": "学习计划已生成完成。",
                "progress": 100,
                "created_at": datetime.now(UTC).isoformat(),
            })
        except asyncio.CancelledError:
            await self._emit_to_subscribers(task_id, {
                "stage": "cancelled",
                "stage_label": "已取消",
                "task_id": task_id,
                "status": "cancelled",
                "status_text": "学习计划生成已取消。",
                "progress": 0,
                "created_at": datetime.now(UTC).isoformat(),
            })


# Singleton instance
career_development_goal_planning_task_manager = CareerDevelopmentGoalPlanningTaskManager()
