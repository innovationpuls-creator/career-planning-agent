from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from typing import Any


@dataclass(slots=True)
class StudentCompetencyStatusEvent:
    event_id: int
    conversation_id: str
    status_text: str
    stage: str | None
    progress: int | None
    source: str
    details: dict[str, Any] | None
    created_at: datetime


class StudentCompetencyStatusStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._next_event_id = 1
        self._events_by_conversation: dict[str, list[StudentCompetencyStatusEvent]] = defaultdict(list)

    def append(
        self,
        *,
        conversation_id: str,
        status_text: str,
        stage: str | None = None,
        progress: int | None = None,
        source: str = "external",
        details: dict[str, Any] | None = None,
    ) -> StudentCompetencyStatusEvent:
        with self._lock:
            event = StudentCompetencyStatusEvent(
                event_id=self._next_event_id,
                conversation_id=conversation_id,
                status_text=status_text,
                stage=stage,
                progress=progress,
                source=source or "external",
                details=details,
                created_at=datetime.now(UTC),
            )
            self._next_event_id += 1
            self._events_by_conversation[conversation_id].append(event)
            return event

    def list(
        self,
        *,
        conversation_id: str,
        after_id: int | None = None,
        limit: int = 50,
    ) -> list[StudentCompetencyStatusEvent]:
        with self._lock:
            events = self._events_by_conversation.get(conversation_id, [])
            filtered = [event for event in events if after_id is None or event.event_id > after_id]
            return filtered[:limit]


student_competency_status_store = StudentCompetencyStatusStore()
