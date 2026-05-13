from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.services.observability.routing_metrics import get_routing_hit_rates, export_routing_logs


def _make_routing_log(db_session, **kwargs):
    """Helper to create a RoutingLog via ORM with required defaults."""
    from app.models.coach import RoutingLog

    defaults = {
        "id": "rl_default",
        "student_id": 1,
        "session_id": "sess_default",
        "trace_id": "trace_default",
        "message": "test",
        "route_level": "L4",
        "matched_agent": "CareerCoach",
        "created_at": datetime(2026, 5, 5, tzinfo=timezone.utc),
    }
    defaults.update(kwargs)
    log = RoutingLog(**defaults)
    db_session.add(log)
    return log


class TestRoutingMetrics:
    def test_get_routing_hit_rates_empty(self, db_session):
        """Hit rates returns zeros when no routing logs exist."""
        rates = get_routing_hit_rates(db_session, "2026-05-01", "2026-05-10")
        assert rates["total_routes"] == 0
        assert all(v["count"] == 0 for v in rates["by_level"].values())

    def test_get_routing_hit_rates_by_level(self, db_session):
        """Hit rates correctly counts routing logs by level."""
        _make_routing_log(db_session, id="rl_001", trace_id="trace_1", route_level="L2", matched_agent="ResumeCoach", matched_rule="简历")
        _make_routing_log(db_session, id="rl_002", trace_id="trace_2", route_level="L2", matched_agent="CareerMatchCoach", matched_rule="岗位")
        _make_routing_log(db_session, id="rl_003", trace_id="trace_3", route_level="L4", matched_agent="CareerCoach", matched_rule="L4")
        _make_routing_log(db_session, id="rl_004", trace_id="trace_4", route_level="L1.5", matched_agent="ResumeCoach", matched_rule="/resume")
        db_session.commit()

        rates = get_routing_hit_rates(db_session, "2026-05-01", "2026-05-10")
        assert rates["total_routes"] == 4
        assert rates["by_level"]["L1.5"]["count"] == 1
        assert rates["by_level"]["L2"]["count"] == 2
        assert rates["by_level"]["L4"]["count"] == 1
        assert abs(rates["by_level"]["L2"]["percentage"] - 50.0) < 0.1

    def test_export_routing_logs_filters_by_confidence(self, db_session):
        """export_routing_logs respects min_confidence filter."""
        _make_routing_log(db_session, id="rl_010", trace_id="t_1", route_level="L4", matched_agent="CareerMatchCoach", matched_rule="llm", llm_confidence=0.87)
        _make_routing_log(db_session, id="rl_011", trace_id="t_2", route_level="L4", matched_agent="ResumeCoach", matched_rule="llm", llm_confidence=0.65)
        db_session.commit()

        result = export_routing_logs(db_session, "2026-05-01", "2026-05-10", min_confidence=0.8)
        assert result["total"] == 1
        assert result["logs"][0]["llm_confidence"] == 0.87


@pytest.fixture
def db_session():
    """Create an in-memory SQLite session for routing metrics tests."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine("sqlite:///:memory:")
    from app.db.base import Base
    from app.models.coach import RoutingLog  # noqa: F811

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
