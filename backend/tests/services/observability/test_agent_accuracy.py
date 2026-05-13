from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.services.observability.agent_accuracy import get_agent_accuracy


def _make_feedback(db_session, **kwargs):
    """Helper to create a FeedbackRecord via ORM with required defaults."""
    from app.models.coach import FeedbackRecord

    defaults = {
        "student_id": 1,
        "target_type": "ResumeCoach",
        "target_id": "agent_0",
        "sentiment": "neutral",
        "source": "user",
        "created_at": datetime(2026, 5, 5, tzinfo=timezone.utc),
    }
    defaults.update(kwargs)
    record = FeedbackRecord(**defaults)
    db_session.add(record)
    return record


class TestAgentAccuracy:
    def test_get_agent_accuracy_empty(self, db_session):
        """Accuracy returns empty when no feedback exists."""
        result = get_agent_accuracy(db_session, "2026-05-01", "2026-05-10")
        assert result["total_feedback"] == 0
        assert result["by_agent"] == {}

    def test_get_agent_accuracy_calculation(self, db_session):
        """Accuracy = positive / (positive + negative) * 100 for each agent."""
        _make_feedback(db_session, student_id=1, trace_id="t1", target_type="ResumeCoach", target_id="agent_1", sentiment="positive")
        _make_feedback(db_session, student_id=1, trace_id="t2", target_type="ResumeCoach", target_id="agent_1", sentiment="positive")
        _make_feedback(db_session, student_id=1, trace_id="t3", target_type="ResumeCoach", target_id="agent_1", sentiment="negative")
        _make_feedback(db_session, student_id=1, trace_id="t4", target_type="CareerMatchCoach", target_id="agent_2", sentiment="positive")
        _make_feedback(db_session, student_id=1, trace_id="t5", target_type="CareerMatchCoach", target_id="agent_2", sentiment="positive")
        _make_feedback(db_session, student_id=1, trace_id="t6", target_type="CareerMatchCoach", target_id="agent_2", sentiment="neutral")
        db_session.commit()

        result = get_agent_accuracy(db_session, "2026-05-01", "2026-05-10")
        assert result["total_feedback"] == 6

        resume = result["by_agent"]["ResumeCoach"]
        assert resume["positive"] == 2
        assert resume["negative"] == 1
        assert resume["neutral"] == 0
        assert abs(resume["accuracy"] - 66.7) < 0.1

        match = result["by_agent"]["CareerMatchCoach"]
        assert match["positive"] == 2
        assert match["negative"] == 0
        assert match["neutral"] == 1

    def test_get_agent_accuracy_insufficient_data(self, db_session):
        """Agents with < 5 feedback records are marked insufficient_data."""
        _make_feedback(db_session, student_id=1, target_type="ReportCoach", target_id="agent_3", sentiment="positive")
        _make_feedback(db_session, student_id=1, target_type="ReportCoach", target_id="agent_3", sentiment="positive")
        _make_feedback(db_session, student_id=1, target_type="ReportCoach", target_id="agent_3", sentiment="negative")
        db_session.commit()

        result = get_agent_accuracy(db_session, "2026-05-01", "2026-05-10")
        agent = result["by_agent"]["ReportCoach"]
        assert agent["insufficient_data"] is True


@pytest.fixture
def db_session():
    """Create an in-memory SQLite session for agent accuracy tests."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine("sqlite:///:memory:")
    from app.db.base import Base
    from app.models.coach import FeedbackRecord  # noqa: F811

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
