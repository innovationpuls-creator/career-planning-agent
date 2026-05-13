from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_admin_user
from app.db.session import get_db
from app.services.observability.agent_accuracy import get_agent_accuracy
from app.services.observability.dlq_monitor import get_dlq_detail, get_dlq_summary
from app.services.observability.routing_metrics import (
    export_routing_logs,
    get_routing_hit_rates,
)

router = APIRouter(prefix="/api/coach/observability", tags=["coach-observability"])


@router.get("/dlq")
def dlq_summary(
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """DLQ summary: total dead_letter count, by_event_type, trend."""
    return get_dlq_summary(db)


@router.get("/dlq/detail")
def dlq_detail(
    event_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """DLQ detail: paginated dead_letter events."""
    return get_dlq_detail(db, event_type=event_type, page=page, page_size=page_size)


@router.get("/routing/hit-rates")
def routing_hit_rates(
    start: str = Query(...),
    end: str = Query(...),
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Routing hit rates by level and agent for the given period."""
    return get_routing_hit_rates(db, start, end)


@router.get("/routing/logs")
def routing_logs(
    start: str = Query(...),
    end: str = Query(...),
    min_confidence: float | None = Query(None, ge=0.0, le=1.0),
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Export routing logs for P5 BERT training data collection."""
    return export_routing_logs(db, start, end, min_confidence=min_confidence)


@router.get("/agent-accuracy")
def agent_accuracy(
    start: str = Query(...),
    end: str = Query(...),
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Agent accuracy metrics based on feedback_records."""
    return get_agent_accuracy(db, start, end)


@router.get("/prompt-versions")
def prompt_versions(
    agent: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """List prompt version records, optionally filtered by agent. Paginated."""
    from sqlalchemy import text

    params: dict = {}
    where = ""
    if agent:
        where = "WHERE agent = :agent"
        params["agent"] = agent

    total = db.execute(
        text(f"SELECT COUNT(*) FROM prompt_versions {where}"), params
    ).scalar() or 0

    rows = db.execute(
        text(
            f"SELECT id, agent, version, change_reason, feedback_lifted, created_at "
            f"FROM prompt_versions {where} "
            f"ORDER BY agent, version DESC "
            f"LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).fetchall()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "versions": [
            {
                "id": r[0],
                "agent": r[1],
                "version": r[2],
                "change_reason": r[3],
                "feedback_lifted": r[4],
                "created_at": r[5].isoformat() if hasattr(r[5], "isoformat") else str(r[5]),
            }
            for r in rows
        ],
    }


@router.get("/prompt-versions/{agent}/current")
def prompt_version_current(
    agent: str,
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Get the currently active prompt version for an agent."""
    from app.services.context_builder import _load_prompt_from_db

    prompt_text = _load_prompt_from_db(db, agent)
    if prompt_text is None:
        from app.services.context_builder import AGENT_SYSTEM_PROMPTS
        prompt_text = AGENT_SYSTEM_PROMPTS.get(agent)

    return {"agent": agent, "active": prompt_text is not None, "prompt_text": prompt_text}
