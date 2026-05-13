from __future__ import annotations

from app.models.coach import RoutingLog


class TestRoutingLogModel:
    def test_model_has_expected_columns(self):
        """RoutingLog model should have all columns defined in the P4 spec."""
        columns = {c.name for c in RoutingLog.__table__.columns}
        expected = {
            "id",
            "student_id",
            "session_id",
            "trace_id",
            "message",
            "route_level",
            "matched_agent",
            "matched_rule",
            "llm_latency_ms",
            "llm_confidence",
            "corrected_by_user",
            "task_success",
            "created_at",
        }
        assert columns == expected

    def test_route_level_values_accept_expected_formats(self):
        """route_level should accept L1, L1.5, L2, L4 as valid values."""
        valid_levels = ["L1", "L1.5", "L2", "L4"]
        for level in valid_levels:
            rl = RoutingLog(
                id="test_rl_001",
                student_id=1,
                session_id="sess_001",
                trace_id="trace_001",
                message="test message",
                route_level=level,
                matched_agent="ResumeCoach",
            )
            assert rl.route_level == level
