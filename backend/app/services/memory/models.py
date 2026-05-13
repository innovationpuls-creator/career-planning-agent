from __future__ import annotations

from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class DecisionType(str, Enum):
    AUTO_CONFIRMED = "auto_confirmed"
    PROVISIONAL_WRITE = "provisional_write"
    REJECTED = "rejected"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class MasteryStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    MASTERED = "mastered"
    NEEDS_REVIEW = "needs_review"


class MemoryStatus(str, Enum):
    CONFIRMED = "confirmed"
    PROVISIONAL = "provisional"
    REJECTED = "rejected"


class TraceIdMissingError(ValueError):
    """Raised when a memory mutation proposal is missing a required trace_id."""

    def __init__(self) -> None:
        super().__init__("trace_id is required for memory mutation proposals in P2 mode")


class ConversationSummaryV1_1(BaseModel):
    """Serializable conversation summary, versioned for forward compat."""

    student_id: int = 0
    key_topics: list[str] = Field(default_factory=list)
    decisions_made: list[dict[str, Any]] = Field(default_factory=list)
    pending_actions: list[str] = Field(default_factory=list)
    mastery_observations: list[dict[str, Any]] = Field(default_factory=list)
    unresolved_questions: list[str] = Field(default_factory=list)
    participant_state: str = ""
    session_goals_progress: dict[str, Any] = Field(default_factory=dict)
    provisional_overlays: dict[str, Any] = Field(default_factory=dict)
    schema_version: str = "2"
    skills: dict[str, Any] = Field(default_factory=dict)
    student_profile: dict[str, Any] = Field(default_factory=dict)
    career_goal: dict[str, Any] = Field(default_factory=dict)
    current_stage: str = ""
    last_agent: str = ""
    next_recommended_action: str = ""
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    prompt_versions: dict[str, int] = Field(default_factory=dict)


class MemoryMutationProposal(BaseModel):
    """A proposed change to student memory, ready for adjudication."""

    target_table: str
    target_field: str
    old_value: Any = None
    new_value: Any = None
    decision_type: str = "preference"
    reasoning: str = ""
    source_idempotency_key: str = ""
    risk_level: str = Field(default="low", description="low | medium | high")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    student_id: int = 0
    trace_id: str = ""
    source_event_id: str = ""
    source_agent: str = ""
    evidence: str = ""


class AdjudicationResult(BaseModel):
    """Result of adjudicating a memory mutation proposal."""

    accepted: bool
    reasoning: str = ""
    risk_level: str = "low"
    decision_type: str = DecisionType.AUTO_CONFIRMED.value
    overlay_target: bool = False


class ProvisionalOverlay(BaseModel):
    """A provisional overlay entry stored in conversation_summaries."""

    field_path: str
    proposed_value: Any = None
    confidence: float = 0.0
    source: str = ""
    overlay_target: bool = False


class MemoryMutationRecord(BaseModel):
    """Full audit record for a committed memory mutation."""

    id: str = Field(default_factory=lambda: f"mut_{uuid4().hex[:12]}")
    student_id: int = 0
    source_idempotency_key: str = ""
    source_event_id: str = ""
    trace_id: str = ""
    target_table: str = ""
    target_field: str = ""
    overlay_target: bool = False
    old_value: Any = None
    new_value: Any = None
    evidence: str = ""
    source_agent: str = ""
    confidence: float = 0.0
    decision_type: str = DecisionType.AUTO_CONFIRMED.value
    rollback_of: str | None = None
    rolled_back_by: str | None = None
    rollback_reason: str | None = None
