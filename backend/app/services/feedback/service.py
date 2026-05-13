from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.coach import FeedbackRecord

logger = logging.getLogger(__name__)


def record_feedback(
    db: Session,
    *,
    student_id: int,
    target_type: str,
    target_id: str,
    sentiment: str,
    feedback_text: str | None = None,
    trace_id: str | None = None,
    session_id: str | None = None,
    source: str = "user",
) -> FeedbackRecord:
    """Write a feedback record and trigger compensation for negative feedback."""
    compensation_status = "pending" if sentiment == "negative" else "none"

    record = FeedbackRecord(
        student_id=student_id,
        trace_id=trace_id,
        session_id=session_id,
        target_type=target_type,
        target_id=target_id,
        sentiment=sentiment,
        feedback_text=feedback_text,
        source=source,
        compensation_status=compensation_status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    if sentiment == "negative":
        logger.info(
            "Negative feedback recorded: student=%s target=%s/%s",
            student_id, target_type, target_id,
        )
        from app.services.feedback.compensation_engine import CompensationEngine

        try:
            engine = CompensationEngine(db)
            engine.compensate(record)
        except Exception:
            logger.exception("Compensation failed for feedback %s", record.id)

    return record


def should_prompt_feedback(
    db: Session,
    student_id: int,
    target_type: str,
    target_id: str,
    session_id: str,
) -> bool:
    """Frequency control: same target 7-day cooldown, max 2 active per session."""
    from sqlalchemy import text

    recent = db.execute(
        text(
            "SELECT COUNT(*) FROM feedback_records "
            "WHERE student_id = :sid AND target_type = :tt AND target_id = :tid "
            "AND created_at > datetime('now', '-7 days')"
        ),
        {"sid": student_id, "tt": target_type, "tid": target_id},
    ).scalar() or 0
    if recent > 0:
        return False

    session_count = db.execute(
        text(
            "SELECT COUNT(*) FROM feedback_records "
            "WHERE session_id = :sess AND source = 'prompted'"
        ),
        {"sess": session_id},
    ).scalar() or 0
    if session_count >= 2:
        return False

    return True
