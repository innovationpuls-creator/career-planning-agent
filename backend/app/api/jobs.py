from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_admin_user, require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.models.job_posting import JobPosting
from app.schemas.job_posting import JobPostingItem, JobPostingListResponse
from app.schemas.job_requirement_vertical import IndustryOptionsResponse, JobTitleOptionsResponse
from app.services.job_requirement_vertical import list_industry_options, list_job_title_options


router = APIRouter(prefix="/api/job-postings", tags=["job-postings"])


def _clean_multi_values(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return [value.strip() for value in values if value and value.strip()]


@router.get("/job-titles", response_model=JobTitleOptionsResponse)
def get_job_titles(
    db: Session = Depends(get_db),
) -> JobTitleOptionsResponse:
    return JobTitleOptionsResponse(data=list_job_title_options(db))


@router.get("/industries", response_model=IndustryOptionsResponse)
def get_industries(
    job_title: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_standard_user),
) -> IndustryOptionsResponse:
    return IndustryOptionsResponse(data=list_industry_options(db, job_title.strip()))


@router.get("", response_model=JobPostingListResponse)
def list_job_postings(
    current: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    industry: list[str] | None = Query(default=None),
    job_title: list[str] | None = Query(default=None),
    company_name: str | None = Query(default=None),
    address: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
) -> JobPostingListResponse:
    filters = []
    industries = _clean_multi_values(industry)
    job_titles = _clean_multi_values(job_title)

    if industries:
        filters.append(or_(*[JobPosting.industry == value for value in industries]))
    if job_titles:
        filters.append(or_(*[JobPosting.job_title == value for value in job_titles]))
    if company_name:
        filters.append(JobPosting.company_name.ilike(f"%{company_name.strip()}%"))
    if address:
        filters.append(JobPosting.address.ilike(f"%{address.strip()}%"))
    if keyword:
        term = f"%{keyword.strip()}%"
        filters.append(
            JobPosting.job_title.ilike(term)
            | JobPosting.company_name.ilike(term)
            | JobPosting.industry.ilike(term)
            | JobPosting.job_detail.ilike(term)
            | JobPosting.company_detail.ilike(term)
        )

    total_stmt = select(func.count()).select_from(JobPosting)
    data_stmt = select(JobPosting)
    if filters:
        total_stmt = total_stmt.where(*filters)
        data_stmt = data_stmt.where(*filters)

    total = db.scalar(total_stmt) or 0
    offset = (current - 1) * page_size
    items = db.scalars(
        data_stmt.order_by(JobPosting.id.desc()).offset(offset).limit(page_size)
    ).all()

    return JobPostingListResponse(
        data=[JobPostingItem.model_validate(item, from_attributes=True) for item in items],
        total=total,
        current=current,
        pageSize=page_size,
    )
