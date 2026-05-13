from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_admin_user
from app.db.session import get_db
from app.services.memory import collective_wisdom as cw

router = APIRouter(prefix="/api/coach/cw", tags=["coach-cw"])


@router.post("/seed")
def seed_cw(
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Trigger CW seed data loading. Idempotent — safe to call multiple times."""
    return cw.seed_cw_data(db)


@router.get("/entities")
def list_entities(
    entity_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return cw.list_cw_entities(db, entity_type=entity_type, page=page, page_size=page_size)


@router.get("/relations")
def list_relations(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return cw.list_cw_relations(db, page=page, page_size=page_size)


@router.get("/observations")
def list_observations(
    entity_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return cw.list_cw_observations(db, entity_id=entity_id, page=page, page_size=page_size)
