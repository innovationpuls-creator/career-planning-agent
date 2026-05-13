from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.services.memory.manager import MemoryManager
from app.services.memory.models import (
    DecisionType,
    MemoryMutationRecord,
)


def create_rollback_mutation(
    db: Session,
    memory_manager: MemoryManager,
    original_mutation_id: int,
    reason: str,
    requested_by: str = "coordinator",
) -> MemoryMutationRecord:
    """Create a rollback mutation for a previous memory mutation.

    Never deletes records. Rolls back by creating a new mutation with
    old_value/new_value swapped. Auto-increment integer IDs are used
    (matching the ORM model).

    Raises
    ------
    ValueError
        If original_mutation_id does not exist.
    """
    from app.models.coach import MemoryMutation

    original = db.query(MemoryMutation).filter(
        MemoryMutation.id == original_mutation_id
    ).first()
    if not original:
        raise ValueError(f"Mutation {original_mutation_id} not found")

    new_val = json.loads(original.old_value) if original.old_value else ""
    old_val = json.loads(original.new_value) if original.new_value else None

    # Create rollback mutation (no id — auto-increment)
    rollback = MemoryMutation(
        student_id=original.student_id,
        source_idempotency_key=f"rollback_of_{original_mutation_id}",
        source_event_id=original.source_event_id,
        trace_id=original.trace_id,
        target_table=original.target_table,
        target_field=original.target_field,
        overlay_target=0,
        old_value=json.dumps(old_val, ensure_ascii=False) if old_val else None,
        new_value=json.dumps(new_val, ensure_ascii=False) if new_val else None,
        evidence=f"Rollback: {reason}",
        source_agent=requested_by,
        confidence=1.0,
        decision_type=DecisionType.AUTO_CONFIRMED.value,
        adjudication_result="accepted",
        reasoning=f"Rollback of mutation {original_mutation_id}: {reason}",
        committed=True,
        rollback_of=original_mutation_id,
        rollback_reason=reason,
    )
    db.add(rollback)
    db.commit()
    db.refresh(rollback)

    # Update original mutation's rolled_back_by
    original.rolled_back_by = rollback.id
    db.commit()

    # Apply the rollback to conversation_summary via the public method
    memory_manager.commit_mutation(
        student_id=original.student_id,
        target_field=original.target_field,
        new_value=new_val,
        source_agent=requested_by,
    )

    # If original was provisional (overlay_target), clear the overlay key
    if original.overlay_target:
        summary = memory_manager.get_conversation_summary(original.student_id)
        overlay_key = f"{original.target_field}::{original.source_agent}"
        if overlay_key in summary.provisional_overlays:
            del summary.provisional_overlays[overlay_key]
            memory_manager._save_conversation_summary(
                original.student_id, summary
            )

    return MemoryMutationRecord(
        id=str(rollback.id),
        student_id=original.student_id,
        source_idempotency_key=f"rollback_of_{original_mutation_id}",
        source_event_id=original.source_event_id or "",
        trace_id=original.trace_id or "",
        target_table=original.target_table,
        target_field=original.target_field,
        overlay_target=False,
        old_value=old_val,
        new_value=new_val,
        evidence=f"Rollback: {reason}",
        source_agent=requested_by,
        confidence=1.0,
        decision_type=DecisionType.AUTO_CONFIRMED.value,
        rollback_of=str(original_mutation_id),
        rollback_reason=reason,
    )
