"""Adjudicator — stateless pure function for memory mutation decisions.

Implements the P2 9-state decision matrix (P1 §8.2):

| risk_level | confidence | decision_type   | overlay_target |
|------------|-----------|-----------------|----------------|
| low        | >= 0.95   | auto_confirmed  | False          |
| low        | 0.80-0.95 | provisional     | conflict       |
| low        | < 0.80    | rejected        | —              |
| medium     | >= 0.95   | provisional     | conflict       |
| medium     | 0.80-0.95 | provisional     | conflict       |
| medium     | < 0.80    | rejected        | —              |
| high       | >= 0.95   | provisional     | ALWAYS True    |
| high       | 0.80-0.95 | provisional     | ALWAYS True    |
| high       | < 0.80    | rejected        | —              |

Plus conflict detection: provisional targeting an already-confirmed field
sets overlay_target = True. High-risk provisional always sets overlay_target.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from app.services.memory.models import (
    AdjudicationResult,
    DecisionType,
    MemoryMutationProposal,
)


_trace_id_context: str = ""


@contextmanager
def with_trace_id(trace_id: str) -> Generator[None, None, None]:
    """Context manager that sets the adjudicator's trace_id for the duration of a block.

    Used by proposal_handler / manager to ensure all mutations carry the
    full trace chain without threading a trace_id through every function call.

    Usage::

        with with_trace_id("trace_abc"):
            result = adjudicate(proposal)
    """
    global _trace_id_context
    previous = _trace_id_context
    _trace_id_context = trace_id
    try:
        yield
    finally:
        _trace_id_context = previous


def get_trace_id() -> str:
    return _trace_id_context


def _decision_from_risk_confidence(risk_level: str, confidence: float) -> str:
    """Determine decision type from risk level and confidence.

    Medium and high risk are capped at provisional_write (never auto_confirmed).
    """
    if risk_level == "low":
        if confidence >= 0.95:
            return DecisionType.AUTO_CONFIRMED.value
        elif confidence >= 0.80:
            return DecisionType.PROVISIONAL_WRITE.value
        else:
            return DecisionType.REJECTED.value
    elif risk_level == "medium":
        if confidence >= 0.80:
            return DecisionType.PROVISIONAL_WRITE.value
        else:
            return DecisionType.REJECTED.value
    else:  # high
        if confidence >= 0.80:
            return DecisionType.PROVISIONAL_WRITE.value
        else:
            return DecisionType.REJECTED.value


def _build_reasoning(
    decision_type: str,
    risk_level: str,
    confidence: float,
    overlay_target: bool,
) -> str:
    """Build human-readable reasoning for the adjudication result."""
    if decision_type == DecisionType.AUTO_CONFIRMED.value:
        return (
            f"low risk ({risk_level}) + high confidence ({confidence:.2f}) "
            f"— auto confirmed, writing to main field"
        )
    elif decision_type == DecisionType.PROVISIONAL_WRITE.value:
        parts = [f"risk={risk_level}, confidence={confidence:.2f} — provisional write"]
        if overlay_target:
            parts.append("(overlay target: existing confirmed or high-risk safeguard)")
        return " ".join(parts)
    else:
        return (
            f"risk={risk_level}, confidence={confidence:.2f} — "
            f"rejected, audit only"
        )


def adjudicate(
    proposal: MemoryMutationProposal,
    has_confirmed_field: bool = False,
) -> AdjudicationResult:
    """Evaluate a memory mutation proposal and return the decision.

    Parameters
    ----------
    proposal : MemoryMutationProposal
        The proposed mutation with risk_level and confidence.
    has_confirmed_field : bool
        Whether the target field already has a confirmed value in the summary.
        Used for conflict detection with provisional writes.

    Returns
    -------
    AdjudicationResult
        The adjudication outcome with decision_type and overlay_target.
    """
    decision_type = _decision_from_risk_confidence(
        proposal.risk_level, proposal.confidence
    )

    # Conflict detection: provisional targeting confirmed → overlay_target
    overlay_target = False
    if decision_type == DecisionType.PROVISIONAL_WRITE.value:
        if has_confirmed_field:
            overlay_target = True
        if proposal.risk_level == "high":
            overlay_target = True

    accepted = decision_type != DecisionType.REJECTED.value

    return AdjudicationResult(
        accepted=accepted,
        decision_type=decision_type,
        overlay_target=overlay_target,
        risk_level=proposal.risk_level,
        reasoning=_build_reasoning(
            decision_type, proposal.risk_level, proposal.confidence, overlay_target
        ),
    )
