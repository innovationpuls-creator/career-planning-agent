from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import text

logger = logging.getLogger(__name__)


CASCADE_WHITELIST: dict[str, list[str]] = {
    "skill_mastered": ["ReportCoach", "ResumeCoach"],
    "goal_reached": ["ReportCoach"],
}


class OutboxEmitter:
    """Idempotent event emitter for the outbox event bus.

    Writes events to the outbox_events table.
    Same idempotency_key -> no duplicate INSERT (UNIQUE constraint).
    """

    def __init__(self, db: Any) -> None:
        self._db = db

    def emit_event(
        self,
        event_type: str,
        payload: dict[str, Any],
        idempotency_key: str,
        trace_id: str,
    ) -> str:
        """Write a pending event to outbox_events.

        Idempotent: same idempotency_key returns existing event_id.
        """
        from uuid import uuid4

        event_id = f"evt_{uuid4().hex[:12]}"
        try:
            self._db.execute(
                text(
                    "INSERT INTO outbox_events "
                    "(id, event_type, payload_json, idempotency_key, trace_id) "
                    "VALUES (:id, :event_type, :payload_json, :idempotency_key, :trace_id)"
                ),
                {
                    "id": event_id,
                    "event_type": event_type,
                    "payload_json": json.dumps(payload, ensure_ascii=False),
                    "idempotency_key": idempotency_key,
                    "trace_id": trace_id,
                },
            )
            self._db.commit()
            return event_id
        except Exception:
            # Likely a UNIQUE constraint violation — return existing event_id
            self._db.rollback()
            row = self._fetch_existing(idempotency_key)
            if row:
                if isinstance(row, dict):
                    return row["id"]
                return row[0]
            raise

    def _fetch_existing(self, idempotency_key: str) -> Any:
        try:
            return self._db.execute(
                text("SELECT id FROM outbox_events WHERE idempotency_key = :k"),
                {"k": idempotency_key},
            ).fetchone()
        except Exception:
            fetchone = getattr(self._db, "fetchone", None)
            if callable(fetchone):
                return fetchone()
            raise
