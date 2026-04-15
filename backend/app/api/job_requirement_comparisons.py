from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_admin_user, require_authenticated_user
from app.db.session import get_db
from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.models.user import User
from app.schemas.job_requirement_comparison import (
    JobRequirementComparisonDetailItem,
    JobRequirementComparisonDetailResponse,
    JobRequirementComparisonListItem,
    JobRequirementComparisonListResponse,
)
from app.services.job_requirement_profile_read import (
    build_dimension_payload,
    build_merged_job_detail,
    count_non_default_dimensions,
)


router = APIRouter(prefix="/api/job-requirement-comparisons", tags=["job-requirement-comparisons"])


def _clean_multi_values(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return [value.strip() for value in values if value and value.strip()]


@router.get("", response_model=JobRequirementComparisonListResponse)
def list_job_requirement_comparisons(
    current: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    industry: list[str] | None = Query(default=None),
    job_title: list[str] | None = Query(default=None),
    company_name: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
) -> JobRequirementComparisonListResponse:
    filters = []
    industries = _clean_multi_values(industry)
    job_titles = _clean_multi_values(job_title)

    if industries:
        filters.append(or_(*[JobRequirementProfile.industry == value for value in industries]))
    if job_titles:
        filters.append(or_(*[JobRequirementProfile.job_title == value for value in job_titles]))
    if company_name:
        filters.append(JobRequirementProfile.company_name.ilike(f"%{company_name.strip()}%"))

    total_stmt = select(func.count()).select_from(JobRequirementProfile)
    job_detail_count_stmt = (
        select(func.count())
        .select_from(JobPosting)
        .where(
            JobPosting.industry == JobRequirementProfile.industry,
            JobPosting.job_title == JobRequirementProfile.job_title,
            JobPosting.company_name == JobRequirementProfile.company_name,
            JobPosting.job_detail.is_not(None),
            func.trim(JobPosting.job_detail) != "",
        )
        .scalar_subquery()
    )
    data_stmt = select(JobRequirementProfile, job_detail_count_stmt.label("job_detail_count"))
    if filters:
        total_stmt = total_stmt.where(*filters)
        data_stmt = data_stmt.where(*filters)

    total = db.scalar(total_stmt) or 0
    offset = (current - 1) * page_size
    rows = db.execute(
        data_stmt.order_by(JobRequirementProfile.id.desc()).offset(offset).limit(page_size)
    ).all()

    items = [
        JobRequirementComparisonListItem(
            id=profile.id,
            industry=profile.industry,
            job_title=profile.job_title,
            company_name=profile.company_name,
            job_detail_count=job_detail_count,
            non_default_dimension_count=count_non_default_dimensions(profile),
        )
        for profile, job_detail_count in rows
    ]

    return JobRequirementComparisonListResponse(
        data=items,
        total=total,
        current=current,
        pageSize=page_size,
    )


@router.get("/{profile_id}", response_model=JobRequirementComparisonDetailResponse)
def get_job_requirement_comparison(
    profile_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_authenticated_user),
) -> JobRequirementComparisonDetailResponse:
    profile = db.get(JobRequirementProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Job requirement comparison not found")

    merged_job_detail, job_detail_count = build_merged_job_detail(profile, db)
    detail = JobRequirementComparisonDetailItem(
        id=profile.id,
        industry=profile.industry,
        job_title=profile.job_title,
        company_name=profile.company_name,
        job_detail_count=job_detail_count,
        merged_job_detail=merged_job_detail,
        **build_dimension_payload(profile),
    )
    return JobRequirementComparisonDetailResponse(data=detail)
