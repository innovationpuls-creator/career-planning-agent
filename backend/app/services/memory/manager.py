from __future__ import annotations

import json
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.coach import (
    CoachMessage,
    CoachSession,
    ConversationSummary,
    DecisionJournal,
    MemoryMutation,
)
from app.services.memory.adjudicator import adjudicate
from app.services.memory.models import (
    AdjudicationResult,
    ConversationSummaryV1_1,
    DecisionType,
    MemoryMutationProposal,
    ProvisionalOverlay,
)


def _apply_field_update(
    summary: ConversationSummaryV1_1,
    target_field: str,
    new_value: object,
) -> None:
    """Apply a nested field update to the summary in-place.

    Supports dot-notation paths like ``session_goals_progress.some_key``
    and simple top-level field names like ``participant_state``.
    """
    data = json.loads(summary.model_dump_json())
    parts = target_field.split(".")
    current = data
    for part in parts[:-1]:
        if isinstance(current, dict):
            current = current.setdefault(part, {})
        else:
            current = {}
            data[part] = current
    if isinstance(current, dict):
        current[parts[-1]] = new_value

    for key, value in data.items():
        if hasattr(summary, key):
            setattr(summary, key, value)


class MemoryManager:
    """Manages coach session persistence and student memory.

    All methods are synchronous and operate on a SQLAlchemy Session.
    The session is expected to be provided by the caller (e.g., via FastAPI Depends).
    """

    def __init__(self, db: Session) -> None:
        self._db = db

    # ── Session CRUD ─────────────────────────────────────────────────

    def get_or_create_session(
        self, student_id: int, session_id: str | None = None, title: str = "新对话"
    ) -> CoachSession:
        if session_id:
            session = self._db.query(CoachSession).filter(
                CoachSession.id == session_id, CoachSession.student_id == student_id
            ).first()
            if session:
                return session

        session = CoachSession(
            id=session_id or str(uuid4()),
            student_id=student_id,
            title=title,
        )
        self._db.add(session)
        self._db.commit()
        self._db.refresh(session)
        return session

    def get_session(self, session_id: str, student_id: int) -> CoachSession | None:
        return self._db.query(CoachSession).filter(
            CoachSession.id == session_id,
            CoachSession.student_id == student_id,
        ).first()

    def list_sessions(
        self, student_id: int, limit: int = 20, offset: int = 0
    ) -> tuple[list[CoachSession], int]:
        total = self._db.query(CoachSession).filter(
            CoachSession.student_id == student_id
        ).count()
        sessions = (
            self._db.query(CoachSession)
            .filter(CoachSession.student_id == student_id)
            .order_by(CoachSession.updated_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return sessions, total

    def delete_session(self, session_id: str, student_id: int) -> bool:
        session = self.get_session(session_id, student_id)
        if not session:
            return False
        self._db.delete(session)
        self._db.commit()
        return True

    def update_session_agent(self, session_id: str, agent: str) -> None:
        self._db.query(CoachSession).filter(CoachSession.id == session_id).update(
            {"active_agent": agent}
        )
        self._db.commit()

    def increment_message_count(self, session_id: str) -> None:
        self._db.query(CoachSession).filter(CoachSession.id == session_id).update(
            {CoachSession.message_count: CoachSession.message_count + 1}
        )
        self._db.commit()

    # ── Messages ──────────────────────────────────────────────────────

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        client_message_id: str | None = None,
        active_agent: str | None = None,
        tool_calls_json: str | None = None,
        attachments_json: str | None = None,
        run_trace_json: str | None = None,
        page_context: dict | None = None,
    ) -> CoachMessage:
        # Dedup: if client_message_id is provided, return existing message
        if client_message_id:
            existing = (
                self._db.query(CoachMessage)
                .filter(
                    CoachMessage.session_id == session_id,
                    CoachMessage.client_message_id == client_message_id,
                )
                .first()
            )
            if existing:
                return existing

        msg = CoachMessage(
            session_id=session_id,
            role=role,
            content=content,
            client_message_id=client_message_id,
            active_agent=active_agent,
            tool_calls_json=tool_calls_json,
            attachments_json=attachments_json,
            run_trace_json=run_trace_json,
        )
        self._db.add(msg)
        self._db.commit()
        self._db.refresh(msg)
        return msg

    def get_messages(self, session_id: str) -> list[CoachMessage]:
        return (
            self._db.query(CoachMessage)
            .filter(CoachMessage.session_id == session_id)
            .order_by(CoachMessage.created_at.asc())
            .all()
        )

    # ── Conversation Summary ──────────────────────────────────────────

    def get_conversation_summary(self, student_id: int) -> ConversationSummaryV1_1:
        row = self._db.query(ConversationSummary).filter(
            ConversationSummary.student_id == student_id
        ).first()
        if row:
            return ConversationSummaryV1_1.model_validate_json(row.summary_json)
        return ConversationSummaryV1_1()

    def _save_conversation_summary(
        self, student_id: int, summary: ConversationSummaryV1_1
    ) -> None:
        json_str = summary.model_dump_json()
        existing = self._db.query(ConversationSummary).filter(
            ConversationSummary.student_id == student_id
        ).first()
        if existing:
            existing.summary_json = json_str
            existing.schema_version = int(str(summary.schema_version).split(".")[0])
        else:
            self._db.add(
                ConversationSummary(
                    student_id=student_id,
                    summary_json=json_str,
                    schema_version=int(summary.schema_version.split(".")[0]),
                )
            )
        self._db.commit()

    # ── Coordinator Metadata ─────────────────────────────────────────

    def save_coordinator_metadata(
        self,
        student_id: int,
        current_stage: str = "",
        last_agent: str = "",
    ) -> None:
        """Update coordinator-level fields on conversation summary.

        Only touches current_stage and last_agent.
        Does NOT overwrite student_profile, skills, or other user-data fields.
        Creates an empty summary if none exists.
        """
        summary = self.get_conversation_summary(student_id)
        if current_stage:
            summary.current_stage = current_stage
        if last_agent:
            summary.last_agent = last_agent
        self._save_conversation_summary(student_id, summary)

    # ── Memory Mutations (P2) ─────────────────────────────────────────

    def propose_memory_mutation(
        self, student_id: int, proposal: MemoryMutationProposal
    ) -> tuple[AdjudicationResult, int]:
        """Full propose → adjudicate → commit flow (P2 entry point).

        Validates trace_id non-empty, runs adjudicate, writes mutation +
        journal, then calls commit_mutation + _record_competency_history.

        Returns (AdjudicationResult, mutation_db_id).
        """
        if not proposal.trace_id:
            from app.services.memory.models import TraceIdMissingError
            raise TraceIdMissingError()

        summary = self.get_conversation_summary(student_id)
        has_confirmed = self._has_confirmed_field(summary, proposal.target_field)
        result = adjudicate(proposal, has_confirmed_field=has_confirmed)

        # Write memory_mutations record
        mutation = MemoryMutation(
            student_id=student_id,
            source_idempotency_key=proposal.source_idempotency_key
            or str(uuid4()),
            source_event_id=proposal.source_event_id or str(uuid4()),
            trace_id=proposal.trace_id,
            target_table=proposal.target_table,
            target_field=proposal.target_field,
            overlay_target=int(result.overlay_target),
            old_value=json.dumps(proposal.old_value, ensure_ascii=False)
            if proposal.old_value
            else None,
            new_value=json.dumps(proposal.new_value, ensure_ascii=False)
            if proposal.new_value
            else None,
            evidence=proposal.evidence or proposal.reasoning,
            source_agent=proposal.source_agent or "coach",
            confidence=proposal.confidence,
            decision_type=result.decision_type,
            adjudication_result="accepted" if result.accepted else "rejected",
            reasoning=result.reasoning,
            committed=result.accepted and result.decision_type
            != DecisionType.REJECTED.value,
        )
        self._db.add(mutation)
        self._db.commit()
        self._db.refresh(mutation)

        # Write decision_journal record
        journal = DecisionJournal(
            student_id=student_id,
            decision_type=result.decision_type,
            proposal_json=proposal.model_dump_json(),
            adjudication_result="accepted" if result.accepted else "rejected",
            reasoning=result.reasoning,
        )
        self._db.add(journal)
        self._db.commit()

        # Commit to summary (if not rejected)
        if result.accepted:
            self._commit_mutation_to_summary(
                student_id, summary, proposal, result
            )
            self._record_competency_history(student_id, proposal, result)

        return result, mutation.id

    def commit_mutation(
        self,
        student_id: int,
        target_field: str,
        new_value: object,
        source_agent: str = "coach",
        record: object = None,
    ) -> None:
        """Public method for rollback module — directly applies a field update.

        Writes directly to the summary main field (always auto_confirmed semantics).
        Called by create_rollback_mutation() when reverting a previous change.
        If new_value is None, the field is reset to its default value.
        """
        summary = self.get_conversation_summary(student_id)
        if new_value is not None:
            _apply_field_update(summary, target_field, new_value)
        self._save_conversation_summary(student_id, summary)

    def propose_and_commit(
        self, student_id: int, proposal: MemoryMutationProposal
    ) -> AdjudicationResult:
        """Backward-compatible alias — returns only the adjudication result."""
        result, _ = self.propose_memory_mutation(student_id, proposal)
        return result

    # ── Internal helpers ──────────────────────────────────────────────

    def _commit_mutation_to_summary(
        self,
        student_id: int,
        summary: ConversationSummaryV1_1,
        proposal: MemoryMutationProposal,
        result: AdjudicationResult,
    ) -> None:
        """Apply three-state write to conversation summary."""
        if result.decision_type == DecisionType.AUTO_CONFIRMED.value:
            _apply_field_update(
                summary, proposal.target_field, proposal.new_value,
            )
            self._save_conversation_summary(student_id, summary)
        elif result.decision_type == DecisionType.PROVISIONAL_WRITE.value:
            overlay_key = f"{proposal.target_field}::{proposal.source_agent or 'coach'}"
            summary.provisional_overlays[overlay_key] = (
                ProvisionalOverlay(
                    field_path=proposal.target_field,
                    proposed_value=proposal.new_value,
                    confidence=proposal.confidence,
                    source=proposal.source_agent or "coach",
                    overlay_target=result.overlay_target,
                ).model_dump()
            )
            self._save_conversation_summary(student_id, summary)

    def _record_competency_history(
        self,
        student_id: int,
        proposal: MemoryMutationProposal,
        result: AdjudicationResult,
    ) -> None:
        """Record competency_history snapshot when a skills.* field is updated.

        Only fires for auto_confirmed or provisional_write on skills.* paths.
        REJECTED mutations are skipped (already filtered before this call).
        """
        if not proposal.target_field.startswith("skills."):
            return
        parts = proposal.target_field.split(".")
        if len(parts) < 2:
            return
        skill_id = parts[1]

        from app.models.coach import CompetencyHistory

        new_val = proposal.new_value
        mastery = "in_progress"
        if isinstance(new_val, dict):
            mastery = new_val.get("mastery_status", "in_progress")
        elif isinstance(new_val, str):
            mastery = new_val

        memory_status = (
            "confirmed" if result.decision_type == DecisionType.AUTO_CONFIRMED.value
            else "provisional"
        )

        record = CompetencyHistory(
            student_id=student_id,
            skill_id=skill_id,
            mastery_status=mastery,
            memory_status=memory_status,
            confidence=proposal.confidence,
            evidence=proposal.evidence or "",
            source=proposal.source_agent or "coach",
        )
        self._db.add(record)
        self._db.commit()

    def _has_confirmed_field(
        self,
        summary: ConversationSummaryV1_1,
        target_field: str,
    ) -> bool:
        """Check if a target field already has a confirmed value in the summary.

        Checks top-level fields and nested paths in the summary JSON,
        excluding provisional_overlays.
        """
        data = json.loads(summary.model_dump_json())
        parts = target_field.split(".")
        current = data
        try:
            for part in parts:
                current = current[part]
        except (KeyError, TypeError):
            return False
        return current is not None and current != {} and current != []
