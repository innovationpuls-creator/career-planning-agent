from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.utils.datetime_utils import utc_now


class ConversationSummary(Base):
    __tablename__ = "conversation_summaries"

    student_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )


class CoachSession(Base):
    __tablename__ = "coach_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="新对话")
    active_agent: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pipeline_stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )


class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("coach_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    client_message_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    active_agent: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tool_calls_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachments_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    run_trace_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class MemoryMutation(Base):
    __tablename__ = "memory_mutations"
    __table_args__ = (
        UniqueConstraint("student_id", "target_table", "target_field", "source_idempotency_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    source_idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    source_event_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    trace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_table: Mapped[str] = mapped_column(String(64), nullable=False)
    target_field: Mapped[str] = mapped_column(String(64), nullable=False)
    overlay_target: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_agent: Mapped[str] = mapped_column(String(64), nullable=False, default="coach")
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    decision_type: Mapped[str] = mapped_column(String(32), nullable=False)
    adjudication_result: Mapped[str | None] = mapped_column(String(16), nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    committed: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    rollback_of: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("memory_mutations.id"), nullable=True
    )
    rolled_back_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("memory_mutations.id"), nullable=True
    )
    rollback_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class DecisionJournal(Base):
    __tablename__ = "decision_journal"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    decision_type: Mapped[str] = mapped_column(String(32), nullable=False)
    proposal_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    adjudication_result: Mapped[str] = mapped_column(String(16), nullable=False)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class CompetencyHistory(Base):
    __tablename__ = "competency_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    skill_id: Mapped[str] = mapped_column(String(128), nullable=False)
    mastery_status: Mapped[str] = mapped_column(String(32), nullable=False)
    memory_status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="coach")
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_retry_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    locked_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    locked_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
    delivered_at: Mapped[str | None] = mapped_column(String(32), nullable=True)


class FeedbackRecord(Base):
    __tablename__ = "feedback_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    trace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("coach_sessions.id", ondelete="SET NULL"), nullable=True
    )
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sentiment: Mapped[str] = mapped_column(String(16), nullable=False, default="neutral")
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="user")
    compensation_status: Mapped[str] = mapped_column(String(16), nullable=False, default="none")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class RoutingLog(Base):
    __tablename__ = "routing_log"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    route_level: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    matched_agent: Mapped[str] = mapped_column(String(64), nullable=False)
    matched_rule: Mapped[str | None] = mapped_column(String(64), nullable=True)
    llm_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    llm_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    corrected_by_user: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    task_success: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class CwEntity(Base):
    __tablename__ = "cw_entities"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    entity_name: Mapped[str] = mapped_column(String(128), nullable=False)
    properties_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")


class CwRelation(Base):
    __tablename__ = "cw_relations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    from_entity_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("cw_entities.id"), nullable=False, index=True
    )
    to_entity_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("cw_entities.id"), nullable=False, index=True
    )
    relation_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)


class CwObservation(Base):
    __tablename__ = "cw_observations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    entity_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("cw_entities.id"), nullable=False, index=True
    )
    observation_type: Mapped[str] = mapped_column(String(128), nullable=False)
    support_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="seed")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    agent: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    change_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_lifted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    __table_args__ = (
        UniqueConstraint("agent", "version"),
    )


class TrainingDataset(Base):
    __tablename__ = "training_datasets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    source_table: Mapped[str] = mapped_column(String(64), nullable=False)
    filter_criteria: Mapped[str] = mapped_column(Text, nullable=False)
    total_samples: Mapped[int] = mapped_column(Integer, nullable=False)
    label_distribution: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
