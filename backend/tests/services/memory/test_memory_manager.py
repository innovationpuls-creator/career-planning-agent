from __future__ import annotations

import json
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.services.memory.manager import MemoryManager, _apply_field_update
from app.services.memory.models import (
    ConversationSummaryV1_1,
    DecisionType,
    MemoryMutationProposal,
)


class TestMemoryManager:
    @classmethod
    def setup_class(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}
        )

        @event.listens_for(cls.engine, "connect")
        def set_pragma(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

        Base.metadata.create_all(bind=cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setup_method(self):
        self.db = self.SessionLocal()
        self.mm = MemoryManager(self.db)

    def teardown_method(self):
        self.db.close()

    @classmethod
    def teardown_class(cls):
        Base.metadata.drop_all(bind=cls.engine)
        cls.engine.dispose()

    def test_create_session(self):
        session = self.mm.get_or_create_session(
            student_id=1, title="Test session"
        )
        assert session.id is not None
        assert session.student_id == 1
        assert session.title == "Test session"
        assert session.message_count == 0

    def test_get_session_ownership(self):
        session = self.mm.get_or_create_session(student_id=1)
        # Wrong student_id should return None
        assert self.mm.get_session(session.id, 999) is None
        # Correct student_id should return session
        assert self.mm.get_session(session.id, 1) is not None

    def test_add_and_retrieve_messages(self):
        session = self.mm.get_or_create_session(student_id=1)
        self.mm.add_message(
            session_id=session.id,
            role="user",
            content="Hello",
            client_message_id="cm1",
        )
        self.mm.add_message(
            session_id=session.id,
            role="assistant",
            content="Hi there",
            active_agent="CareerCoach",
        )
        messages = self.mm.get_messages(session.id)
        assert len(messages) == 2
        assert messages[0].content == "Hello"
        assert messages[1].role == "assistant"
        assert messages[1].active_agent == "CareerCoach"

    def test_get_messages_empty_session(self):
        messages = self.mm.get_messages("nonexistent")
        assert messages == []

    def test_conversation_summary_roundtrip(self):
        summary = ConversationSummaryV1_1(
            student_id=1, key_topics=["career", "resume"]
        )
        self.mm._save_conversation_summary(1, summary)
        loaded = self.mm.get_conversation_summary(1)
        assert loaded.student_id == 1
        assert "career" in loaded.key_topics

    def test_conversation_summary_default_when_empty(self):
        summary = self.mm.get_conversation_summary(999)
        assert summary.student_id == 0
        assert summary.key_topics == []
        assert summary.schema_version == "2"

    def test_update_session_agent(self):
        session = self.mm.get_or_create_session(student_id=1)
        self.mm.update_session_agent(session.id, "ResumeCoach")
        updated = self.mm.get_session(session.id, 1)
        assert updated.active_agent == "ResumeCoach"

    def test_increment_message_count(self):
        session = self.mm.get_or_create_session(student_id=1)
        assert session.message_count == 0
        self.mm.increment_message_count(session.id)
        updated = self.mm.get_session(session.id, 1)
        assert updated.message_count == 1

    def test_delete_session(self):
        session = self.mm.get_or_create_session(student_id=1)
        self.mm.add_message(session.id, "user", "test")
        assert self.mm.delete_session(session.id, 1) is True
        assert self.mm.get_session(session.id, 1) is None

    def test_delete_session_wrong_owner(self):
        session = self.mm.get_or_create_session(student_id=1)
        assert self.mm.delete_session(session.id, 999) is False

    def test_list_sessions(self):
        for i in range(5):
            self.mm.get_or_create_session(student_id=100, title=f"Session {i}")
        sessions, total = self.mm.list_sessions(student_id=100, limit=3)
        assert total == 5
        assert len(sessions) == 3

    def test_save_coordinator_metadata_updates_stage(self):
        """save_coordinator_metadata updates current_stage without affecting other fields."""
        sid = 9997
        summary = ConversationSummaryV1_1(key_topics=["career"])
        self.mm._save_conversation_summary(sid, summary)

        self.mm.save_coordinator_metadata(sid, current_stage="resume", last_agent="ResumeCoach")
        loaded = self.mm.get_conversation_summary(sid)
        assert loaded.current_stage == "resume"
        assert loaded.last_agent == "ResumeCoach"
        assert loaded.key_topics == ["career"]

    def test_save_coordinator_metadata_creates_summary_if_missing(self):
        """save_coordinator_metadata works even when no summary exists yet."""
        sid = 9998
        self.mm.save_coordinator_metadata(sid, current_stage="match", last_agent="MatchCoach")
        loaded = self.mm.get_conversation_summary(sid)
        assert loaded.current_stage == "match"
        assert loaded.last_agent == "MatchCoach"

    # ── Memory Mutation Three-State Write ─────────────────────────────

    def test_propose_auto_confirmed_writes_to_summary(self):
        """auto_confirmed updates summary main field + creates mutation + journal."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value=["ML"],
            reasoning="ML mentioned in conversation",
            source_idempotency_key=f"test_{uuid4().hex}",
            risk_level="low",
            confidence=0.97,
            trace_id=f"trace_{uuid4().hex[:12]}",
        )
        result = self.mm.propose_and_commit(1, proposal)
        assert result.accepted is True
        assert result.decision_type == DecisionType.AUTO_CONFIRMED.value

        # Summary should be updated
        summary = self.mm.get_conversation_summary(1)
        assert "ML" in summary.key_topics

    def test_propose_provisional_writes_to_overlay(self):
        """provisional_write adds to provisional_overlays, not main field."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value="exploring",
            reasoning="User mentioned exploring options",
            source_idempotency_key=f"test_{uuid4().hex}",
            risk_level="low",
            confidence=0.85,
            trace_id=f"trace_{uuid4().hex[:12]}",
        )
        result = self.mm.propose_and_commit(1, proposal)
        assert result.accepted is True
        assert result.decision_type == DecisionType.PROVISIONAL_WRITE.value

        # Main field should NOT be updated
        summary = self.mm.get_conversation_summary(1)
        assert summary.participant_state == ""
        # Overlay should contain the entry
        assert len(summary.provisional_overlays) == 1
        overlay_key = "participant_state::coach"
        assert overlay_key in summary.provisional_overlays

    def test_propose_rejected_does_not_change_summary(self):
        """rejected creates mutation + journal, but summary stays unchanged."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value=["ShouldNotAppear"],
            reasoning="Weak",
            source_idempotency_key=f"test_{uuid4().hex}",
            risk_level="low",
            confidence=0.50,
            trace_id=f"trace_{uuid4().hex[:12]}",
        )
        summary_before = self.mm.get_conversation_summary(2)
        topics_before = list(summary_before.key_topics)

        result = self.mm.propose_and_commit(2, proposal)
        assert result.accepted is False
        assert result.decision_type == DecisionType.REJECTED.value

        summary_after = self.mm.get_conversation_summary(2)
        assert summary_after.key_topics == topics_before

    def test_mutation_and_journal_always_created(self):
        """All three decision types create memory_mutations + decision_journal records."""
        from app.models.coach import DecisionJournal, MemoryMutation

        trace = f"trace_{uuid4().hex[:12]}"
        prop_accepted = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value="exploring",
            reasoning="Test",
            source_idempotency_key=f"acc_{uuid4().hex}",
            risk_level="low",
            confidence=0.97,
            trace_id=trace,
        )
        self.mm.propose_and_commit(3, prop_accepted)

        prop_rejected = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value="unknown",
            reasoning="",
            source_idempotency_key=f"rej_{uuid4().hex}",
            risk_level="low",
            confidence=0.30,
            trace_id=trace,
        )
        self.mm.propose_and_commit(3, prop_rejected)

        mutations = self.db.query(MemoryMutation).count()
        journals = self.db.query(DecisionJournal).count()
        assert mutations >= 2
        assert journals >= 2


class TestCompetencyHistory:
    """P2 §7.4 competency_history recording tests."""

    @classmethod
    def setup_class(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}
        )

        @event.listens_for(cls.engine, "connect")
        def set_pragma(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setup_method(self):
        self.db = self.SessionLocal()
        self.mm = MemoryManager(self.db)

    def teardown_method(self):
        self.db.close()

    @classmethod
    def teardown_class(cls):
        Base.metadata.drop_all(bind=cls.engine)
        cls.engine.dispose()

    def test_skill_mutation_records_competency_history(self):
        from app.models.coach import CompetencyHistory

        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="skills.python.mastery_status",
            new_value="mastered",
            reasoning="User passed Python quiz",
            source_idempotency_key=f"comp_{uuid4().hex}",
            risk_level="low",
            confidence=0.97,
            student_id=500,
            trace_id=f"trace_{uuid4().hex[:12]}",
            source_agent="test_agent",
        )
        self.mm.propose_memory_mutation(500, proposal)

        records = self.db.query(CompetencyHistory).filter(
            CompetencyHistory.student_id == 500
        ).all()
        assert len(records) == 1
        assert records[0].skill_id == "python"
        assert records[0].mastery_status == "mastered"

    def test_non_skill_mutation_skips_competency_history(self):
        from app.models.coach import CompetencyHistory

        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value="resume",
            reasoning="User started resume stage",
            source_idempotency_key=f"no_comp_{uuid4().hex}",
            risk_level="low",
            confidence=0.97,
            student_id=501,
            trace_id=f"trace_{uuid4().hex[:12]}",
            source_agent="test_agent",
        )
        self.mm.propose_memory_mutation(501, proposal)

        records = self.db.query(CompetencyHistory).filter(
            CompetencyHistory.student_id == 501
        ).all()
        assert len(records) == 0

    def test_rejected_mutation_skips_competency_history(self):
        from app.models.coach import CompetencyHistory

        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="skills.java.mastery_status",
            new_value="mastered",
            reasoning="Weak evidence",
            source_idempotency_key=f"rej_comp_{uuid4().hex}",
            risk_level="low",
            confidence=0.30,
            student_id=502,
            trace_id=f"trace_{uuid4().hex[:12]}",
            source_agent="test_agent",
        )
        self.mm.propose_memory_mutation(502, proposal)

        records = self.db.query(CompetencyHistory).filter(
            CompetencyHistory.student_id == 502
        ).all()
        assert len(records) == 0

    def test_competency_history_captures_memory_status(self):
        from app.models.coach import CompetencyHistory

        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="skills.sql.mastery_status",
            new_value="in_progress",
            reasoning="User mentioned SQL experience",
            source_idempotency_key=f"prov_comp_{uuid4().hex}",
            risk_level="low",
            confidence=0.85,
            student_id=503,
            trace_id=f"trace_{uuid4().hex[:12]}",
            source_agent="test_agent",
        )
        self.mm.propose_memory_mutation(503, proposal)

        records = self.db.query(CompetencyHistory).filter(
            CompetencyHistory.student_id == 503
        ).all()
        assert len(records) == 1
        assert records[0].memory_status == "provisional"


class TestApplyFieldUpdate:
    """_apply_field_update utility tests."""

    def test_simple_field_update(self):
        summary = ConversationSummaryV1_1(participant_state="initial")
        _apply_field_update(summary, "participant_state", "active")
        assert summary.participant_state == "active"

    def test_nested_field_update(self):
        summary = ConversationSummaryV1_1(
            session_goals_progress={"step1": "started"}
        )
        _apply_field_update(summary, "session_goals_progress.step1", "completed")
        assert summary.session_goals_progress["step1"] == "completed"

    def test_nested_new_path_creates_dict(self):
        summary = ConversationSummaryV1_1()
        _apply_field_update(summary, "session_goals_progress.new_key", "value")
        assert summary.session_goals_progress["new_key"] == "value"

    def test_preserves_other_fields(self):
        summary = ConversationSummaryV1_1(
            participant_state="initial",
            key_topics=["topic1"],
        )
        _apply_field_update(summary, "participant_state", "updated")
        assert summary.key_topics == ["topic1"]
        assert summary.participant_state == "updated"
