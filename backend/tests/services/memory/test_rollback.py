from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.services.memory.manager import MemoryManager
from app.services.memory.models import MemoryMutationProposal
from app.services.memory.rollback import create_rollback_mutation


class TestRollback:
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

    def _create_original_mutation(self, student_id: int = 100) -> int:
        """Create a mutation record and return its ID."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value="resume",
            reasoning="User started resume stage",
            source_idempotency_key=f"orig_{uuid4().hex}",
            risk_level="low",
            confidence=0.97,
            student_id=student_id,
            trace_id=f"trace_{uuid4().hex[:12]}",
        )
        self.mm.propose_memory_mutation(student_id, proposal)
        from app.models.coach import MemoryMutation

        mutation = (
            self.db.query(MemoryMutation)
            .filter(MemoryMutation.target_field == "participant_state")
            .order_by(MemoryMutation.id.desc())
            .first()
        )
        return mutation.id

    def test_rollback_creates_new_mutation(self):
        orig_id = self._create_original_mutation()
        record = create_rollback_mutation(
            self.db, self.mm, orig_id, "Test rollback"
        )
        assert record.id is not None
        assert record.rollback_of == str(orig_id)

    def test_rollback_bidirectional_link(self):
        orig_id = self._create_original_mutation()
        record = create_rollback_mutation(
            self.db, self.mm, orig_id, "Bidirectional test"
        )
        from app.models.coach import MemoryMutation

        original = self.db.query(MemoryMutation).filter(
            MemoryMutation.id == orig_id
        ).first()
        assert original.rolled_back_by is not None
        # rolled_back_by is integer FK; record.id is string — check by query
        rollback_record = self.db.query(MemoryMutation).filter(
            MemoryMutation.id == original.rolled_back_by
        ).first()
        assert rollback_record is not None

    def test_rollback_restores_old_value(self):
        orig_id = self._create_original_mutation()
        create_rollback_mutation(
            self.db, self.mm, orig_id, "Restore test"
        )
        summary_after = self.mm.get_conversation_summary(100)
        assert summary_after.participant_state != "resume"

    def test_rollback_nonexistent_mutation_raises(self):
        with pytest.raises(ValueError, match="not found"):
            create_rollback_mutation(self.db, self.mm, 99999, "Should fail")

    def test_rollback_does_not_delete_original(self):
        orig_id = self._create_original_mutation()
        create_rollback_mutation(self.db, self.mm, orig_id, "Preserve test")
        from app.models.coach import MemoryMutation

        original = self.db.query(MemoryMutation).filter(
            MemoryMutation.id == orig_id
        ).first()
        assert original is not None

    def test_double_rollback_recovers_and_new_mutations(self):
        orig_id = self._create_original_mutation()
        first = create_rollback_mutation(
            self.db, self.mm, orig_id, "First rollback"
        )
        from app.models.coach import MemoryMutation

        first_orm = self.db.query(MemoryMutation).filter(
            MemoryMutation.rollback_of == orig_id
        ).first()
        assert first_orm is not None
        second = create_rollback_mutation(
            self.db, self.mm, first_orm.id, "Second rollback"
        )
        assert second.id is not None
        assert second.id != first.id

    def test_rollback_provisional_clears_overlay(self):
        sid = 101
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value="exploring",
            reasoning="Provisional entry",
            source_idempotency_key=f"prov_{uuid4().hex}",
            risk_level="low",
            confidence=0.85,
            student_id=sid,
            trace_id=f"trace_{uuid4().hex[:12]}",
            source_agent="test_agent",
        )
        self.mm.propose_memory_mutation(sid, proposal)

        from app.models.coach import MemoryMutation

        mutation = (
            self.db.query(MemoryMutation)
            .filter(MemoryMutation.target_field == "participant_state")
            .order_by(MemoryMutation.id.desc())
            .first()
        )
        assert mutation is not None

        overlay_key = f"{mutation.target_field}::{mutation.source_agent}"
        summary = self.mm.get_conversation_summary(sid)
        assert overlay_key in summary.provisional_overlays

        rollback_result = create_rollback_mutation(self.db, self.mm, mutation.id, "Clear overlay")
        summary = self.mm.get_conversation_summary(sid)
        assert overlay_key not in summary.provisional_overlays
        assert rollback_result.rollback_of == str(mutation.id)
