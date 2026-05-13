from __future__ import annotations

from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.services.memory.manager import MemoryManager
from app.services.memory.proposal_handler import handle_memory_proposal


class TestProposalHandler:
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

    def _trace_id(self) -> str:
        return f"trace_{uuid4().hex[:12]}"

    def test_handle_auto_confirmed(self):
        result = handle_memory_proposal(
            db=self.db, memory_manager=self.mm,
            student_id=200, target_field="key_topics",
            new_value=["python"], evidence="User demonstrated Python knowledge",
            confidence=0.97, risk_level="low",
            source_agent="test_agent", trace_id=self._trace_id(),
        )
        assert result.accepted is True
        assert result.decision_type == "auto_confirmed"

    def test_handle_provisional(self):
        result = handle_memory_proposal(
            db=self.db, memory_manager=self.mm,
            student_id=201, target_field="key_topics",
            new_value=["ML"], evidence="User mentioned ML interest",
            confidence=0.85, risk_level="low",
            source_agent="test_agent", trace_id=self._trace_id(),
        )
        assert result.accepted is True
        assert result.decision_type == "provisional_write"

    def test_handle_rejected(self):
        result = handle_memory_proposal(
            db=self.db, memory_manager=self.mm,
            student_id=202, target_field="key_topics",
            new_value=["unlikely"], evidence="Weak signal",
            confidence=0.50, risk_level="low",
            source_agent="test_agent", trace_id=self._trace_id(),
        )
        assert result.accepted is False
        assert result.decision_type == "rejected"

    def test_trace_id_propagates(self):
        trace_id = self._trace_id()
        handle_memory_proposal(
            db=self.db, memory_manager=self.mm,
            student_id=203, target_field="participant_state",
            new_value="match", evidence="User wants job matching",
            confidence=0.97, risk_level="low",
            source_agent="test_agent", trace_id=trace_id,
        )
        from app.models.coach import MemoryMutation

        mutation = (
            self.db.query(MemoryMutation)
            .filter(MemoryMutation.trace_id == trace_id)
            .first()
        )
        assert mutation is not None

    def test_provisional_overlay_writes_correctly(self):
        result = handle_memory_proposal(
            db=self.db, memory_manager=self.mm,
            student_id=204, target_field="participant_state",
            new_value="learning", evidence="User starting learning",
            confidence=0.85, risk_level="low",
            source_agent="test_agent", trace_id=self._trace_id(),
        )
        assert result.accepted is True
        summary = self.mm.get_conversation_summary(204)
        assert summary.participant_state != "learning"
        found = any(
            "participant_state" in k for k in summary.provisional_overlays
        )
        assert found

    def test_high_risk_overlay_always(self):
        result = handle_memory_proposal(
            db=self.db, memory_manager=self.mm,
            student_id=205, target_field="participant_state",
            new_value="critical", evidence="High-impact change",
            confidence=0.98, risk_level="high",
            source_agent="test_agent", trace_id=self._trace_id(),
        )
        assert result.accepted is True
        assert result.decision_type == "provisional_write"
