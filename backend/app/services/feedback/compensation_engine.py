from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.coach import FeedbackRecord
from app.services.memory.manager import MemoryManager
from app.services.memory.rollback import create_rollback_mutation
from app.services.outbox.emitter import OutboxEmitter

logger = logging.getLogger(__name__)

CASCADE_WHITELIST: dict[str, list[str]] = {
    "skill_mastered": ["ReportCoach", "ResumeCoach"],
    "goal_reached": ["ReportCoach"],
    "compensation_needed": ["LearningPathCoach"],
    "report_regeneration_needed": ["ReportCoach"],
}


class CompensationEngine:
    """Handles automatic compensation actions for negative feedback."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def compensate(self, feedback: FeedbackRecord) -> None:
        """Route compensation by feedback target_type."""
        if feedback.sentiment != "negative":
            return

        if feedback.target_type == "skill_mastered":
            self._compensate_skill_mastered(feedback)
        elif feedback.target_type == "report_generated":
            self._compensate_report(feedback)

    def _compensate_skill_mastered(self, feedback: FeedbackRecord) -> None:
        """Skill mastery disputed → rollback via create_rollback_mutation + emit compensation event."""
        skill_id = feedback.target_id

        mutation = self._db.execute(
            text(
                "SELECT id FROM memory_mutations "
                "WHERE student_id = :sid AND target_field = :field "
                "AND decision_type IN ('auto_confirmed', 'provisional_write') "
                "ORDER BY created_at DESC LIMIT 1"
            ),
            {"sid": feedback.student_id, "field": f"skills.{skill_id}.mastery_status"},
        ).fetchone()

        if not mutation:
            return

        original_mutation_id = mutation[0]
        memory_manager = MemoryManager(self._db)

        try:
            rollback = create_rollback_mutation(
                db=self._db,
                memory_manager=memory_manager,
                original_mutation_id=original_mutation_id,
                reason=f"Negative feedback compensation: {feedback.feedback_text}",
                requested_by="CompensationEngine",
            )
        except ValueError:
            logger.exception(
                "Compensation rollback failed for mutation %s", original_mutation_id
            )
            return

        emitter = OutboxEmitter(db=self._db)
        emitter.emit_event(
            event_type="compensation_needed",
            payload={
                "skill_id": skill_id,
                "student_id": feedback.student_id,
                "feedback_text": feedback.feedback_text,
                "rollback_id": rollback.id,
            },
            idempotency_key=f"comp_{feedback.student_id}_{skill_id}_v1",
            trace_id=feedback.trace_id or "",
        )

        self._db.execute(
            text("UPDATE feedback_records SET compensation_status = 'completed' WHERE id = :fid"),
            {"fid": feedback.id},
        )
        self._db.commit()

        logger.info(
            "Compensation completed: skill=%s student=%s rollback=%s",
            skill_id, feedback.student_id, rollback.id,
        )

    def _compensate_report(self, feedback: FeedbackRecord) -> None:
        """Report negative feedback → emit regeneration event."""
        emitter = OutboxEmitter(db=self._db)
        emitter.emit_event(
            event_type="report_regeneration_needed",
            payload={
                "student_id": feedback.student_id,
                "report_id": feedback.target_id,
                "feedback_text": feedback.feedback_text,
            },
            idempotency_key=f"regen_{feedback.student_id}_{feedback.target_id}_v1",
            trace_id=feedback.trace_id or "",
        )

        self._db.execute(
            text("UPDATE feedback_records SET compensation_status = 'completed' WHERE id = :fid"),
            {"fid": feedback.id},
        )
        self._db.commit()
