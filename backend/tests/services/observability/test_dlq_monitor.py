from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.services.observability.dlq_monitor import get_dlq_summary, get_dlq_detail


def _make_event(db_session, **kwargs):
    """Helper to create an OutboxEvent via ORM with required defaults."""
    from app.models.coach import OutboxEvent

    defaults = {
        "id": "evt_default",
        "event_type": "test_event",
        "payload_json": "{}",
        "idempotency_key": "ik_default",
        "trace_id": "trace_default",
        "status": "pending",
    }
    defaults.update(kwargs)
    event = OutboxEvent(**defaults)
    db_session.add(event)
    return event


class TestDlqMonitor:
    def test_get_dlq_summary_empty_when_no_dead_letter(self, db_session):
        """DLQ summary returns zeros when no dead_letter events exist."""
        summary = get_dlq_summary(db_session)
        assert summary["total"] == 0
        assert summary["by_event_type"] == {}
        assert summary["trend"]["last_24h"] == 0
        assert summary["trend"]["last_7d"] == 0

    def test_get_dlq_summary_counts_dead_letter_events(self, db_session):
        """DLQ summary correctly counts dead_letter events by type."""
        _make_event(db_session, id="evt_001", event_type="skill_mastered", idempotency_key="ik_001", trace_id="trace_001", status="dead_letter")
        _make_event(db_session, id="evt_002", event_type="skill_mastered", idempotency_key="ik_002", trace_id="trace_002", status="dead_letter")
        _make_event(db_session, id="evt_003", event_type="goal_reached", idempotency_key="ik_003", trace_id="trace_003", status="pending")
        _make_event(db_session, id="evt_004", event_type="goal_reached", idempotency_key="ik_004", trace_id="trace_004", status="dead_letter")
        db_session.commit()

        summary = get_dlq_summary(db_session)
        assert summary["total"] == 3
        assert summary["by_event_type"]["skill_mastered"] == 2
        assert summary["by_event_type"]["goal_reached"] == 1

    def test_get_dlq_detail_paginated(self, db_session):
        """DLQ detail returns paginated dead_letter events."""
        now = datetime.now(timezone.utc)
        _make_event(db_session, id="evt_010", event_type="skill_mastered", idempotency_key="ik_010", trace_id="trace_010", status="dead_letter", last_error="timeout")
        _make_event(db_session, id="evt_011", event_type="report_generated", idempotency_key="ik_011", trace_id="trace_011", status="dead_letter", last_error="error")
        db_session.commit()

        result = get_dlq_detail(db_session, page=1, page_size=1)
        assert len(result["items"]) == 1
        assert result["total"] == 2

        result2 = get_dlq_detail(db_session, event_type="report_generated", page=1, page_size=10)
        assert len(result2["items"]) == 1
        assert result2["items"][0]["event_type"] == "report_generated"


@pytest.fixture
def db_session():
    """Create an in-memory SQLite session for observability tests."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine("sqlite:///:memory:")
    from app.db.base import Base
    from app.models.coach import OutboxEvent  # noqa: F811

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
