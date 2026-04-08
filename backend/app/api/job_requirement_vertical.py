from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.job_requirement_vertical import (
    VerticalJobProfileCompanyDetailResponse,
    VerticalJobProfileResponse,
)
from app.services.job_requirement_vertical import (
    get_vertical_job_profile,
    get_vertical_job_profile_company_detail,
)


router = APIRouter(prefix="/api/job-requirement-profile", tags=["job-requirement-profile"])


def _clean_multi_values(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return [value.strip() for value in values if value and value.strip()]


@router.get("/vertical", response_model=VerticalJobProfileResponse)
def get_vertical_job_requirement_profile(
    job_title: str = Query(..., min_length=1),
    industry: list[str] | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_standard_user),
) -> VerticalJobProfileResponse:
    payload = get_vertical_job_profile(
        db=db,
        job_title=job_title,
        industries=_clean_multi_values(industry),
    )
    return VerticalJobProfileResponse(data=payload)


@router.get("/vertical/company-detail", response_model=VerticalJobProfileCompanyDetailResponse)
def get_vertical_job_requirement_company_detail(
    job_title: str = Query(..., min_length=1),
    industry: str = Query(..., min_length=1),
    company_name: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_standard_user),
) -> VerticalJobProfileCompanyDetailResponse:
    payload = get_vertical_job_profile_company_detail(
        db=db,
        job_title=job_title,
        industry=industry,
        company_name=company_name,
    )
    return VerticalJobProfileCompanyDetailResponse(data=payload)
