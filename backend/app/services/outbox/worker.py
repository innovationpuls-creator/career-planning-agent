from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class BackgroundWorker:
    """Background event poller for the outbox event bus.

    Polls outbox_events for pending/failed_retryable events,
    locks them, delivers to target agents via conversation_summaries,
    and updates status with exponential backoff retry (max 3 attempts).
    """

    def __init__(self, db: Session, worker_id: str = "worker_1") -> None:
        self._db = db
        self.worker_id = worker_id

    def process_batch(self, batch_size: int = 20) -> int:
        """Process a batch of pending events.

        Returns the number of events processed.
        """
        result = self._db.execute(
            text(
                """SELECT * FROM outbox_events
                   WHERE status IN ('pending', 'failed_retryable')
                     AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
                   ORDER BY created_at
                   LIMIT :limit"""
            ),
            {"limit": batch_size},
        )
        rows = self._fetch_rows(result)
        for row in rows:
            self._process_one(row)
        return len(rows)

    def _fetch_rows(self, result: Any) -> list[dict[str, Any]]:
        fetched = result.fetchall()
        if not isinstance(fetched, (list, tuple)) or not fetched:
            fallback = getattr(self._db, "fetchall", None)
            if callable(fallback):
                fetched = fallback()
        rows: list[dict[str, Any]] = []
        for row in fetched:
            rows.append(dict(row._mapping) if hasattr(row, "_mapping") else dict(row))
        return rows

    def _process_one(self, row: dict[str, Any]) -> None:
        """Process a single outbox event: lock -> deliver -> update."""
        self._db.execute(
            text(
                """UPDATE outbox_events
                   SET status='processing', locked_at=datetime('now'), locked_by=:worker_id
                   WHERE id=:id AND status IN ('pending', 'failed_retryable')"""
            ),
            {"worker_id": self.worker_id, "id": row["id"]},
        )
        self._db.commit()

        try:
            self._deliver(row)
            self._db.execute(
                text(
                    """UPDATE outbox_events
                       SET status='delivered', delivered_at=datetime('now'),
                           updated_at=datetime('now')
                       WHERE id=:id"""
                ),
                {"id": row["id"]},
            )
            self._db.commit()
        except Exception as e:
            attempts = (row.get("attempt_count") or 0) + 1
            if attempts >= 3:
                self._db.execute(
                    text(
                        """UPDATE outbox_events
                           SET status='dead_letter', last_error=:error,
                               updated_at=datetime('now')
                           WHERE id=:id"""
                    ),
                    {"error": str(e), "id": row["id"]},
                )
            else:
                delay_minutes = [1, 5, 15][attempts - 1]
                self._db.execute(
                    text(
                        """UPDATE outbox_events
                           SET status='failed_retryable', attempt_count=:attempts,
                               next_retry_at=datetime('now', '+' || :delay || ' minutes'),
                               last_error=:error, updated_at=datetime('now')
                           WHERE id=:id"""
                    ),
                    {"attempts": attempts, "delay": str(delay_minutes), "error": str(e), "id": row["id"]},
                )
            self._db.commit()

    def _deliver(self, row: dict[str, Any]) -> None:
        """Deliver event to target agents via conversation_summaries."""
        from app.services.outbox.emitter import CASCADE_WHITELIST

        event_type = row["event_type"]
        payload = json.loads(row["payload_json"])
        target_agents = CASCADE_WHITELIST.get(event_type, [])

        if not target_agents:
            logger.info("No cascade targets for event_type=%s", event_type)
            return

        student_id = payload.get("student_id", 0)

        for agent_name in target_agents:
            self._db.execute(
                text(
                    """UPDATE conversation_summaries
                       SET summary_json = json_set(
                         summary_json,
                         '$.pending_events[' ||
                           COALESCE(json_array_length(summary_json->>'$.pending_events'), 0) ||
                           ']',
                         :payload
                       ),
                       updated_at = datetime('now')
                       WHERE student_id = :student_id"""
                ),
                {
                    "payload": json.dumps({
                        "event_type": event_type,
                        "payload": payload,
                        "target_agent": agent_name,
                        "delivered_at": datetime.now(timezone.utc).isoformat(),
                    }, ensure_ascii=False),
                    "student_id": student_id,
                },
            )
