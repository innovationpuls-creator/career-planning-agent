from __future__ import annotations

import json
from uuid import uuid4

from sqlalchemy.orm import Session

from app.services.memory.adjudicator import with_trace_id
from app.services.memory.manager import MemoryManager
from app.services.memory.models import (
    AdjudicationResult,
    DecisionType,
    MemoryMutationProposal,
)


class ProposalResult:
    """Result returned by handle_memory_proposal."""

    def __init__(
        self,
        adjudication: AdjudicationResult,
        mutation_id: str = "",
        target_field: str = "",
        confidence: float = 0.0,
    ) -> None:
        self.adjudication = adjudication
        self.mutation_id = mutation_id
        self.target_field = target_field
        self.confidence = confidence
        self.summary: str = ""

    @property
    def decision_type(self) -> str:
        return self.adjudication.decision_type

    @property
    def accepted(self) -> bool:
        return self.adjudication.accepted


def _read_current_value(
    memory_manager: MemoryManager,
    student_id: int,
    target_field: str,
) -> object:
    """Read the current value at target_field from conversation summary.

    Used to populate old_value for mutation proposals.
    """
    summary = memory_manager.get_conversation_summary(student_id)
    try:
        import json as _json
        data = _json.loads(summary.model_dump_json())
        parts = target_field.split(".")
        current = data
        for part in parts:
            current = current[part]
        return current
    except (KeyError, TypeError, IndexError, ValueError):
        return None


def handle_memory_proposal(
    db: Session,
    memory_manager: MemoryManager,
    student_id: int,
    target_field: str,
    new_value: object,
    evidence: str,
    confidence: float,
    risk_level: str,
    source_agent: str,
    trace_id: str,
    target_table: str = "conversation_summaries",
    source_idempotency_key: str | None = None,
    source_event_id: str | None = None,
    old_value: object = None,
) -> ProposalResult:
    """Entry point called by ToolRegistry for mutation_gated tools.

    Assembles a MemoryMutationProposal, submits it through the full
    propose -> adjudicate -> commit chain, and returns the result.
    Automatically reads the current field value as old_value.
    """
    if old_value is None:
        old_value = _read_current_value(memory_manager, student_id, target_field)

    proposal = MemoryMutationProposal(
        target_table=target_table,
        target_field=target_field,
        old_value=old_value,
        new_value=new_value,
        reasoning=evidence,
        source_idempotency_key=(
            source_idempotency_key
            or f"{student_id}_{target_field}_{uuid4().hex[:8]}"
        ),
        risk_level=risk_level,
        confidence=confidence,
        student_id=student_id,
        trace_id=trace_id,
        source_event_id=source_event_id or str(uuid4()),
        source_agent=source_agent,
        evidence=evidence,
    )

    with with_trace_id(trace_id):
        result, mutation_id = memory_manager.propose_memory_mutation(student_id, proposal)

    summary = "记忆已确认"
    if result.decision_type == DecisionType.AUTO_CONFIRMED.value:
        summary = f"记忆已确认：{target_field} -> {json.dumps(new_value, ensure_ascii=False)}"
    elif result.decision_type == DecisionType.PROVISIONAL_WRITE.value:
        summary = f"记忆已临时记录：{target_field}（需进一步确认）"
    elif result.decision_type == DecisionType.REJECTED.value:
        summary = f"记忆变更未通过：{target_field}（置信度不足）"

    pr = ProposalResult(
        adjudication=result,
        mutation_id=str(mutation_id),
        target_field=target_field,
        confidence=confidence,
    )
    pr.summary = summary
    return pr
