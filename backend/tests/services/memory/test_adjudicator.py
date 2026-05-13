from __future__ import annotations

import pytest

from app.services.memory.adjudicator import adjudicate
from app.services.memory.models import (
    DecisionType,
    MemoryMutationProposal,
)


class TestAdjudicator9StateMatrix:
    """P1 §8.2 9-state decision matrix verification."""

    # ── Low risk ──────────────────────────────────────────────────────

    def test_low_risk_high_confidence_auto_confirmed(self):
        """low risk + >= 0.95 confidence → AUTO_CONFIRMED."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "career"},
            reasoning="User mentioned career goals",
            source_idempotency_key="k1",
            risk_level="low",
            confidence=0.97,
        )
        result = adjudicate(proposal)
        assert result.accepted is True
        assert result.decision_type == DecisionType.AUTO_CONFIRMED.value
        assert result.overlay_target is False

    def test_low_risk_medium_confidence_provisional(self):
        """low risk + 0.80-0.95 confidence → PROVISIONAL_WRITE."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "ML"},
            reasoning="User mentioned ML",
            source_idempotency_key="k2",
            risk_level="low",
            confidence=0.85,
        )
        result = adjudicate(proposal)
        assert result.accepted is True
        assert result.decision_type == DecisionType.PROVISIONAL_WRITE.value

    def test_low_risk_low_confidence_rejected(self):
        """low risk + < 0.80 confidence → REJECTED."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "AI"},
            reasoning="Weak signal",
            source_idempotency_key="k3",
            risk_level="low",
            confidence=0.50,
        )
        result = adjudicate(proposal)
        assert result.accepted is False
        assert result.decision_type == DecisionType.REJECTED.value

    # ── Medium risk ─────────────────────────────────────────────────────

    def test_medium_risk_capped_at_provisional(self):
        """medium risk + 0.95+ confidence → PROVISIONAL_WRITE (never AUTO_CONFIRMED)."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "networking"},
            reasoning="User showed interest",
            source_idempotency_key="k4",
            risk_level="medium",
            confidence=0.98,
        )
        result = adjudicate(proposal)
        assert result.accepted is True
        assert result.decision_type == DecisionType.PROVISIONAL_WRITE.value

    def test_medium_risk_low_confidence_rejected(self):
        """medium risk + < 0.80 confidence → REJECTED."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "random"},
            reasoning="Speculative",
            source_idempotency_key="k5",
            risk_level="medium",
            confidence=0.70,
        )
        result = adjudicate(proposal)
        assert result.accepted is False
        assert result.decision_type == DecisionType.REJECTED.value

    # ── High risk ───────────────────────────────────────────────────────

    def test_high_risk_capped_at_provisional(self):
        """high risk + 0.95+ confidence → PROVISIONAL_WRITE (capped, never AUTO_CONFIRMED)."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value={"mood": "frustrated"},
            reasoning="User expressed frustration",
            source_idempotency_key="k6",
            risk_level="high",
            confidence=0.99,
        )
        result = adjudicate(proposal)
        assert result.accepted is True
        assert result.decision_type == DecisionType.PROVISIONAL_WRITE.value

    def test_high_risk_low_confidence_rejected(self):
        """high risk + < 0.80 confidence → REJECTED."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value={"mood": "angry"},
            reasoning="Speculative mood inference",
            source_idempotency_key="k7",
            risk_level="high",
            confidence=0.60,
        )
        result = adjudicate(proposal)
        assert result.accepted is False
        assert result.decision_type == DecisionType.REJECTED.value

    # ── Boundary conditions ─────────────────────────────────────────────

    def test_confidence_boundary_auto_confirmed(self):
        """confidence exactly 0.95 with low risk → AUTO_CONFIRMED."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "test"},
            reasoning="Boundary test",
            source_idempotency_key="k8",
            risk_level="low",
            confidence=0.95,
        )
        result = adjudicate(proposal)
        assert result.decision_type == DecisionType.AUTO_CONFIRMED.value

    def test_confidence_boundary_provisional(self):
        """confidence exactly 0.80 with low risk → PROVISIONAL_WRITE."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "test"},
            reasoning="Boundary test",
            source_idempotency_key="k9",
            risk_level="low",
            confidence=0.80,
        )
        result = adjudicate(proposal)
        assert result.decision_type == DecisionType.PROVISIONAL_WRITE.value


class TestOverlayConflictDetection:
    """P1 §8.2 conflict detection — overlay_target logic."""

    def test_provisional_blocked_by_confirmed_writes_overlay(self):
        """provisional targeting existing confirmed field → overlay_target=True."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "ML"},
            reasoning="test",
            source_idempotency_key="k10",
            risk_level="low",
            confidence=0.85,
        )
        result = adjudicate(proposal, has_confirmed_field=True)
        assert result.decision_type == DecisionType.PROVISIONAL_WRITE.value
        assert result.overlay_target is True

    def test_provisional_no_conflict_no_overlay(self):
        """provisional with no existing confirmed → overlay_target=False."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="new_field",
            new_value={"data": "fresh"},
            reasoning="test",
            source_idempotency_key="k11",
            risk_level="low",
            confidence=0.85,
        )
        result = adjudicate(proposal, has_confirmed_field=False)
        assert result.decision_type == DecisionType.PROVISIONAL_WRITE.value
        assert result.overlay_target is False

    def test_high_risk_always_overlay(self):
        """high risk provisional always sets overlay_target=True regardless of confirmation."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="participant_state",
            new_value={"mood": "uncertain"},
            reasoning="Inference",
            source_idempotency_key="k12",
            risk_level="high",
            confidence=0.95,
        )
        # Even without existing confirmed field, high risk → overlay
        result = adjudicate(proposal, has_confirmed_field=False)
        assert result.decision_type == DecisionType.PROVISIONAL_WRITE.value
        assert result.overlay_target is True

    def test_auto_confirmed_never_overlay(self):
        """auto_confirmed decision never has overlay_target."""
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "career"},
            reasoning="test",
            source_idempotency_key="k13",
            risk_level="low",
            confidence=0.97,
        )
        result = adjudicate(proposal, has_confirmed_field=True)
        assert result.decision_type == DecisionType.AUTO_CONFIRMED.value
        assert result.overlay_target is False


class TestAdjudicatorDeterminism:
    """Adjudicator should be deterministic for same inputs."""

    def test_deterministic(self):
        proposal = MemoryMutationProposal(
            target_table="conversation_summaries",
            target_field="key_topics",
            new_value={"topic": "AI"},
            reasoning="test",
            source_idempotency_key="k14",
            risk_level="medium",
            confidence=0.90,
        )
        result1 = adjudicate(proposal)
        result2 = adjudicate(proposal)
        assert result1.decision_type == result2.decision_type
        assert result1.overlay_target == result2.overlay_target
        assert result1.reasoning == result2.reasoning
