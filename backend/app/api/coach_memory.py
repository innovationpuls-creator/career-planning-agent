from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_admin_user
from app.db.session import get_db
from app.services.memory.manager import MemoryManager
from app.services.memory.rollback import create_rollback_mutation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach/memory", tags=["coach-memory"])


@router.post("/mutations/{mutation_id}/rollback")
def rollback_mutation(
    mutation_id: int,
    reason: str = "",
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Trigger rollback of a memory mutation. Returns new mutation ID."""
    memory_manager = MemoryManager(db)
    try:
        rollback = create_rollback_mutation(
            db=db,
            memory_manager=memory_manager,
            original_mutation_id=mutation_id,
            reason=reason or "Manual rollback via API",
            requested_by="admin",
        )
        return {"data": {"mutation_id": rollback.id, "rollback_of": mutation_id}}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/mutations/{mutation_id}")
def get_mutation(
    mutation_id: int,
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Get mutation detail by ID."""
    row = db.execute(
        text(
            "SELECT id, student_id, trace_id, target_table, target_field, "
            "old_value, new_value, evidence, source_agent, confidence, "
            "decision_type, overlay_target, rollback_of, rolled_back_by, "
            "rollback_reason, created_at "
            "FROM memory_mutations WHERE id = :mid"
        ),
        {"mid": mutation_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Mutation not found")

    return {
        "data": {
            "id": row[0],
            "student_id": row[1],
            "trace_id": row[2],
            "target_table": row[3],
            "target_field": row[4],
            "old_value": row[5],
            "new_value": row[6],
            "evidence": row[7],
            "source_agent": row[8],
            "confidence": row[9],
            "decision_type": row[10],
            "overlay_target": bool(row[11]),
            "rollback_of": row[12],
            "rolled_back_by": row[13],
            "rollback_reason": row[14],
            "created_at": row[15].isoformat() if hasattr(row[15], "isoformat") else str(row[15]) if row[15] else None,
        }
    }


@router.get("/mutations")
def list_mutations(
    student_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """List memory mutations, optionally filtered by student_id."""
    params: dict = {"limit": limit, "offset": offset}
    where = ""

    if student_id is not None:
        where = "WHERE student_id = :sid"
        params["sid"] = student_id

    rows = db.execute(
        text(
            f"SELECT id, student_id, trace_id, target_field, decision_type, "
            f"source_agent, confidence, created_at "
            f"FROM memory_mutations {where} "
            f"ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ),
        params,
    ).fetchall()

    items = [
        {
            "id": row[0],
            "student_id": row[1],
            "trace_id": row[2],
            "target_field": row[3],
            "decision_type": row[4],
            "source_agent": row[5],
            "confidence": row[6],
            "created_at": row[7].isoformat() if hasattr(row[7], "isoformat") else str(row[7]) if row[7] else None,
        }
        for row in rows
    ]

    return {"data": items, "limit": limit, "offset": offset}
