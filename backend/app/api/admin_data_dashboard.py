import json
import re

from fastapi import Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_admin_user
from app.db.session import get_db
from app.models.job_posting import JobPosting
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.schemas.admin_data_dashboard import (
    CompetencyAnalysisResponse,
    EducationDistributionItem,
    EmploymentTrendsResponse,
    IndustryDistributionItem,
    JobTitleDistributionItem,
    MajorDistributionItem,
    MajorDistributionResponse,
    SalaryDistribution,
    SchoolDistributionItem,
    ScoreDistributionItem,
    TopStudentItem,
)
from app.schemas.student_competency_profile import JOB_PROFILE_FIELD_ORDER


router = __import__("fastapi", fromlist=["APIRouter"]).APIRouter(prefix="/api/admin/data-dashboard", tags=["admin-data-dashboard"])


def _parse_salary_bucket(salary_range: str | None) -> str | None:
    """Parse salary_range like '15k-25k' and return bucket key."""
    if not salary_range:
        return None
    text = salary_range.lower()
    match = re.search(r"(\d+)k", text)
    if not match:
        return None
    low = int(match.group(1))
    if low < 15:
        return "below_15k"
    if low < 25:
        return "from_15k_to_25k"
    if low < 35:
        return "from_25k_to_35k"
    return "above_35k"


@router.get("/major-distribution", response_model=MajorDistributionResponse)
def get_major_distribution(
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> MajorDistributionResponse:
    total_users = db.query(func.count(User.id)).scalar() or 0

    # Students with a major filled in
    profiles_completed = db.query(func.count(StudentProfile.id)).filter(
        StudentProfile.major.isnot(None),
        StudentProfile.major != "",
    ).scalar() or 0

    completion_rate = round(profiles_completed / total_users, 4) if total_users > 0 else 0.0

    # Major distribution
    major_rows = (
        db.query(StudentProfile.major, func.count(StudentProfile.id).label("count"))
        .filter(StudentProfile.major.isnot(None), StudentProfile.major != "")
        .group_by(StudentProfile.major)
        .order_by(func.count(StudentProfile.id).desc())
        .all()
    )
    major_distribution = [
        MajorDistributionItem(major=row.major or "未知", count=row.count)
        for row in major_rows
    ]

    # School distribution
    school_rows = (
        db.query(StudentProfile.school, func.count(StudentProfile.id).label("count"))
        .filter(StudentProfile.school.isnot(None), StudentProfile.school != "")
        .group_by(StudentProfile.school)
        .order_by(func.count(StudentProfile.id).desc())
        .limit(20)
        .all()
    )
    school_distribution = [
        SchoolDistributionItem(school=row.school or "未知", count=row.count)
        for row in school_rows
    ]

    # Education level distribution
    education_rows = (
        db.query(StudentProfile.education_level, func.count(StudentProfile.id).label("count"))
        .filter(StudentProfile.education_level.isnot(None), StudentProfile.education_level != "")
        .group_by(StudentProfile.education_level)
        .all()
    )
    education_distribution = [
        EducationDistributionItem(level=row.education_level or "未知", count=row.count)
        for row in education_rows
    ]

    return MajorDistributionResponse(
        success=True,
        total_users=total_users,
        profiles_completed=profiles_completed,
        completion_rate=completion_rate,
        major_distribution=major_distribution,
        school_distribution=school_distribution,
        education_distribution=education_distribution,
    )


@router.get("/competency-analysis", response_model=CompetencyAnalysisResponse)
def get_competency_analysis(
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> CompetencyAnalysisResponse:
    records = db.query(StudentCompetencyUserLatestProfile).all()

    total_assessments = len(records)

    # Parse latest_analysis_json for each record
    dimension_scores: dict[str, list[float]] = {dim: [] for dim in JOB_PROFILE_FIELD_ORDER}
    overall_scores: list[tuple[int, str, float]] = []  # (user_id, display_name, overall)

    dimension_gap_counts: dict[str, dict[str, int]] = {
        dim: {"high": 0, "medium": 0, "low": 0} for dim in JOB_PROFILE_FIELD_ORDER
    }

    for record in records:
        try:
            analysis = json.loads(record.latest_analysis_json)
        except (json.JSONDecodeError, TypeError):
            continue

        score = analysis.get("score") or {}
        overall = score.get("overall") or 0
        if overall <= 0:
            continue

        user = db.query(User).filter(User.id == record.user_id).first()
        display_name = user.display_name if user else str(record.user_id)
        overall_scores.append((record.user_id, display_name, float(overall)))

        comparison_dims = analysis.get("comparison_dimensions") or []
        dims_by_key = {item.get("key"): item for item in comparison_dims}

        for dim in JOB_PROFILE_FIELD_ORDER:
            item = dims_by_key.get(dim)
            if not item:
                continue
            user_readiness = item.get("user_readiness") or 0.0
            dimension_scores[dim].append(user_readiness)

            # Bucket by readiness
            if user_readiness >= 0.8:
                dimension_gap_counts[dim]["high"] += 1
            elif user_readiness >= 0.6:
                dimension_gap_counts[dim]["medium"] += 1
            else:
                dimension_gap_counts[dim]["low"] += 1

    # Compute averages
    average_scores: dict[str, float] = {}
    for dim, scores in dimension_scores.items():
        average_scores[dim] = round(sum(scores) / len(scores), 2) if scores else 0.0

    # Score distribution per dimension
    score_distribution = [
        ScoreDistributionItem(
            dimension=dim,
            high=dimension_gap_counts[dim]["high"],
            medium=dimension_gap_counts[dim]["medium"],
            low=dimension_gap_counts[dim]["low"],
        )
        for dim in JOB_PROFILE_FIELD_ORDER
    ]

    # TOP 10 students by overall score
    top_scores = sorted(overall_scores, key=lambda x: x[2], reverse=True)[:10]
    top_students = [
        TopStudentItem(user_id=uid, display_name=name, overall_score=score)
        for uid, name, score in top_scores
    ]

    return CompetencyAnalysisResponse(
        success=True,
        total_assessments=total_assessments,
        average_scores=average_scores,
        score_distribution=score_distribution,
        top_students=top_students,
    )


@router.get("/employment-trends", response_model=EmploymentTrendsResponse)
def get_employment_trends(
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> EmploymentTrendsResponse:
    total_jobs = db.query(func.count(JobPosting.id)).scalar() or 0
    total_companies = db.query(func.count(func.distinct(JobPosting.company_name))).scalar() or 0

    # Industry distribution
    industry_rows = (
        db.query(JobPosting.industry, func.count(JobPosting.id).label("count"))
        .filter(JobPosting.industry.isnot(None), JobPosting.industry != "")
        .group_by(JobPosting.industry)
        .order_by(func.count(JobPosting.id).desc())
        .all()
    )
    industry_distribution = [
        IndustryDistributionItem(industry=row.industry or "未知", count=row.count)
        for row in industry_rows
    ]

    # Job title distribution (top 20)
    title_rows = (
        db.query(JobPosting.job_title, func.count(JobPosting.id).label("count"))
        .filter(JobPosting.job_title.isnot(None), JobPosting.job_title != "")
        .group_by(JobPosting.job_title)
        .order_by(func.count(JobPosting.id).desc())
        .limit(20)
        .all()
    )
    job_title_distribution = [
        JobTitleDistributionItem(job_title=row.job_title or "未知", count=row.count)
        for row in title_rows
    ]

    # Salary distribution
    all_jobs = db.query(JobPosting.salary_range).all()
    salary_counts = SalaryDistribution()
    for (salary_range,) in all_jobs:
        bucket = _parse_salary_bucket(salary_range)
        if bucket == "below_15k":
            salary_counts.below_15k += 1
        elif bucket == "from_15k_to_25k":
            salary_counts.from_15k_to_25k += 1
        elif bucket == "from_25k_to_35k":
            salary_counts.from_25k_to_35k += 1
        elif bucket == "above_35k":
            salary_counts.above_35k += 1

    return EmploymentTrendsResponse(
        success=True,
        total_jobs=total_jobs,
        total_companies=total_companies,
        industry_distribution=industry_distribution,
        job_title_distribution=job_title_distribution,
        salary_distribution=salary_counts,
    )
