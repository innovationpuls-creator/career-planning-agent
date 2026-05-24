from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.growth_workbench import GrowthWorkbenchAggregateResponse
from app.services.growth_workbench import build_growth_workbench_payload


router = APIRouter(tags=["career-development-report"])


@router.get(
    "/api/career-development-report/personal-growth-workbench/{favorite_id}",
    response_model=GrowthWorkbenchAggregateResponse,
)
def get_growth_workbench(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchAggregateResponse:
    try:
        payload = build_growth_workbench_payload(
            db,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchAggregateResponse(data=payload)
