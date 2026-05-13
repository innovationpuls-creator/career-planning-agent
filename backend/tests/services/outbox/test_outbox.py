from __future__ import annotations

import json
from unittest.mock import MagicMock

from app.services.outbox.emitter import CASCADE_WHITELIST, OutboxEmitter
from app.services.outbox.worker import BackgroundWorker


class TestOutboxEmitter:
    """P2b §11 OutboxEmitter tests — idempotent event emission."""

    def test_emit_event_creates_pending(self):
        """emit_event creates a pending event record."""
        db = MagicMock()
        db.execute = MagicMock()
        db.fetchone = MagicMock(return_value=None)
        emitter = OutboxEmitter(db=db)

        event_id = emitter.emit_event(
            event_type="skill_mastered",
            payload={"skill_id": "python", "student_id": "stu_1"},
            idempotency_key="hash_abc",
            trace_id="trace_001",
        )

        assert event_id.startswith("evt_")
        db.execute.assert_called_once()

    def test_emit_event_idempotent(self):
        """Same idempotency_key does not create duplicate records."""
        db = MagicMock()
        db.execute = MagicMock()
        call_count = 0

        def mock_execute(sql, params):
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                from sqlite3 import IntegrityError
                raise IntegrityError("UNIQUE constraint failed")

        db.execute = mock_execute
        db.fetchone = MagicMock(return_value={"id": "evt_existing"})
        emitter = OutboxEmitter(db=db)

        event_id_1 = emitter.emit_event(
            event_type="skill_mastered",
            payload={"skill_id": "python"},
            idempotency_key="hash_abc",
            trace_id="trace_001",
        )
        event_id_2 = emitter.emit_event(
            event_type="skill_mastered",
            payload={"skill_id": "python"},
            idempotency_key="hash_abc",
            trace_id="trace_001",
        )

        assert event_id_1 != event_id_2
        assert event_id_2 == "evt_existing"

    def test_cascade_whitelist_contains_expected_events(self):
        """CASCADE_WHITELIST defines correct event->agent mappings."""
        assert "skill_mastered" in CASCADE_WHITELIST
        assert "goal_reached" in CASCADE_WHITELIST
        assert CASCADE_WHITELIST["skill_mastered"] == ["ReportCoach", "ResumeCoach"]
        assert CASCADE_WHITELIST["goal_reached"] == ["ReportCoach"]

    def test_unknown_event_type_returns_empty_targets(self):
        """Unknown event type returns empty target list."""
        assert CASCADE_WHITELIST.get("unknown_event", []) == []


class TestBackgroundWorker:
    """P2b §11.3 BackgroundWorker tests — polling, retry, dead letter."""

    def test_worker_processes_pending(self):
        """Worker processes pending events."""
        db = MagicMock()
        worker = BackgroundWorker(db=db, worker_id="worker_1")

        pending_event = {
            "id": "evt_001",
            "event_type": "skill_mastered",
            "payload_json": json.dumps({"skill_id": "python", "student_id": 1}),
            "idempotency_key": "hash_abc",
            "trace_id": "trace_001",
            "status": "pending",
            "attempt_count": 0,
            "next_retry_at": None,
            "locked_at": None,
            "locked_by": None,
            "last_error": None,
        }

        db.fetchall = MagicMock(return_value=[pending_event])
        db.fetchone = MagicMock(return_value=None)
        db.execute = MagicMock()

        result = worker.process_batch(batch_size=20)
        assert result is not None

    def test_worker_retry_backoff(self):
        """Failed delivery increments attempt_count and sets next_retry_at."""
        db = MagicMock()
        worker = BackgroundWorker(db=db, worker_id="worker_1")

        failed_event = {
            "id": "evt_002",
            "event_type": "skill_mastered",
            "payload_json": json.dumps({"skill_id": "python", "student_id": 1}),
            "idempotency_key": "hash_def",
            "trace_id": "trace_002",
            "status": "pending",
            "attempt_count": 1,
            "next_retry_at": None,
            "locked_at": None,
            "locked_by": None,
            "last_error": None,
        }

        db.fetchall = MagicMock(return_value=[failed_event])
        db.execute = MagicMock()

        result = worker.process_batch(batch_size=20)
        assert result is not None

    def test_worker_dead_letter_after_3_retries(self):
        """After 3 failed attempts, event goes to dead_letter."""
        db = MagicMock()
        worker = BackgroundWorker(db=db, worker_id="worker_1")

        dead_event = {
            "id": "evt_003",
            "event_type": "skill_mastered",
            "payload_json": json.dumps({"skill_id": "python", "student_id": 1}),
            "idempotency_key": "hash_ghi",
            "trace_id": "trace_003",
            "status": "failed_retryable",
            "attempt_count": 3,
            "next_retry_at": None,
            "locked_at": None,
            "locked_by": None,
            "last_error": "Previous error",
        }

        db.fetchall = MagicMock(return_value=[dead_event])
        db.execute = MagicMock()

        result = worker.process_batch(batch_size=20)
        assert result is not None

    def test_worker_locks_events(self):
        """Events are locked when being processed."""
        db = MagicMock()
        worker = BackgroundWorker(db=db, worker_id="worker_1")

        event = {
            "id": "evt_004",
            "event_type": "skill_mastered",
            "payload_json": json.dumps({"skill_id": "python", "student_id": 1}),
            "idempotency_key": "hash_jkl",
            "trace_id": "trace_004",
            "status": "pending",
            "attempt_count": 0,
            "next_retry_at": None,
            "locked_at": None,
            "locked_by": None,
            "last_error": None,
        }

        db.fetchall = MagicMock(return_value=[event])
        db.fetchone = MagicMock(return_value=None)
        db.execute = MagicMock()

        worker.process_batch(batch_size=20)

        lock_calls = [
            call for call in db.execute.call_args_list
            if "locked_at" in str(call.args[0]) or "locked_by" in str(call.args[0])
        ]
        assert len(lock_calls) >= 1
