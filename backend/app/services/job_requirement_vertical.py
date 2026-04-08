from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job_posting import JobPosting
from app.schemas.job_requirement_vertical import (
    OptionItem,
    VerticalJobProfileCompany,
    VerticalJobProfileCompanyDetailOverview,
    VerticalJobProfileCompanyDetailPayload,
    VerticalJobProfileCompanyDetailSummary,
    VerticalJobProfileGroup,
    VerticalJobProfileMeta,
    VerticalJobProfilePayload,
    VerticalJobProfilePostingDetailItem,
)


MONTHS_PER_WORKING_DAY = 21.75
MAX_COMPANIES_PER_INDUSTRY = 10
SALARY_RANGE_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)")
SALARY_MONTHS_PATTERN = re.compile(r"·\s*(\d+)\s*薪")


@dataclass(frozen=True)
class SalarySortMetrics:
    lower: float
    upper: float


def list_job_title_options(db: Session) -> list[OptionItem]:
    rows = db.scalars(
        select(JobPosting.job_title)
        .where(JobPosting.job_title.is_not(None))
        .distinct()
        .order_by(JobPosting.job_title.asc())
    ).all()
    return [OptionItem(label=value, value=value) for value in rows if value and value.strip()]


def list_industry_options(db: Session, job_title: str) -> list[OptionItem]:
    rows = db.scalars(
        select(JobPosting.industry)
        .where(JobPosting.job_title == job_title, JobPosting.industry.is_not(None))
        .distinct()
        .order_by(JobPosting.industry.asc())
    ).all()
    return [OptionItem(label=value, value=value) for value in rows if value and value.strip()]


def parse_salary_sort_metrics(salary_range: str | None) -> SalarySortMetrics | None:
    if salary_range is None:
        return None

    text = salary_range.strip()
    if not text or text == "面议":
        return None

    range_match = SALARY_RANGE_PATTERN.search(text)
    if range_match is None:
        return None

    lower = float(range_match.group(1))
    upper = float(range_match.group(2))

    if "万" in text:
        lower *= 10000
        upper *= 10000
    elif "元/天" in text:
        lower *= MONTHS_PER_WORKING_DAY
        upper *= MONTHS_PER_WORKING_DAY
    elif "元" in text:
        pass
    else:
        return None

    months_match = SALARY_MONTHS_PATTERN.search(text)
    if months_match is not None:
        months = int(months_match.group(1))
        lower = lower * months / 12
        upper = upper * months / 12

    return SalarySortMetrics(lower=lower, upper=upper)


def format_salary_sort_label(metrics: SalarySortMetrics | None) -> str:
    if metrics is None:
        return "薪资面议或暂未披露"
    return f"月薪等效上限 {round(metrics.upper):,} 元"


def build_vertical_job_profile_payload(
    rows: list[JobPosting],
    job_title: str,
    selected_industries: list[str],
    available_industries: list[str],
) -> VerticalJobProfilePayload:
    grouped_rows: dict[str, list[JobPosting]] = defaultdict(list)
    for row in rows:
        grouped_rows[row.industry].append(row)

    groups: list[VerticalJobProfileGroup] = []
    total_companies = 0

    for industry in selected_industries:
        industry_rows = grouped_rows.get(industry, [])
        company_rows: dict[str, list[JobPosting]] = defaultdict(list)
        for row in industry_rows:
            company_rows[row.company_name].append(row)
        sorted_rows = sorted(
            industry_rows,
            key=lambda row: _build_salary_sort_key(row.salary_range, row.company_name),
        )
        top_rows = sorted_rows[:MAX_COMPANIES_PER_INDUSTRY]
        companies = []
        for row in top_rows:
            metrics = parse_salary_sort_metrics(row.salary_range)
            related_rows = company_rows.get(row.company_name, [row])
            companies.append(
                VerticalJobProfileCompany(
                    company_name=row.company_name,
                    salary_range=row.salary_range,
                    salary_sort_value=metrics.upper if metrics is not None else None,
                    salary_sort_label=format_salary_sort_label(metrics),
                    addresses=_collect_distinct_values(item.address for item in related_rows),
                    company_sizes=_collect_distinct_values(item.company_size for item in related_rows),
                    company_types=_collect_distinct_values(item.company_type for item in related_rows),
                )
            )

        total_companies += len(companies)
        groups.append(VerticalJobProfileGroup(industry=industry, companies=companies))

    return VerticalJobProfilePayload(
        title=f"{job_title}职业在{len(selected_industries)}个行业的工资垂直对比图谱",
        job_title=job_title,
        selected_industries=selected_industries,
        available_industries=available_industries,
        groups=groups,
        meta=VerticalJobProfileMeta(
            total_industries=len(selected_industries),
            total_companies=total_companies,
            generated_at=datetime.now(timezone.utc).isoformat(),
        ),
    )


def get_vertical_job_profile(
    db: Session,
    job_title: str,
    industries: list[str] | None = None,
) -> VerticalJobProfilePayload:
    cleaned_job_title = job_title.strip()
    available_industries = [item.value for item in list_industry_options(db, cleaned_job_title)]
    selected_industries = [value for value in (industries or []) if value in available_industries]
    if not selected_industries:
        selected_industries = available_industries

    rows = db.scalars(
        select(JobPosting).where(
            JobPosting.job_title == cleaned_job_title,
            JobPosting.industry.in_(selected_industries),
        )
    ).all()

    return build_vertical_job_profile_payload(
        rows=rows,
        job_title=cleaned_job_title,
        selected_industries=selected_industries,
        available_industries=available_industries,
    )


def get_vertical_job_profile_company_detail(
    db: Session,
    *,
    job_title: str,
    industry: str,
    company_name: str,
) -> VerticalJobProfileCompanyDetailPayload:
    cleaned_job_title = job_title.strip()
    cleaned_industry = industry.strip()
    cleaned_company_name = company_name.strip()

    rows = db.scalars(
        select(JobPosting)
        .where(
            JobPosting.job_title == cleaned_job_title,
            JobPosting.industry == cleaned_industry,
            JobPosting.company_name == cleaned_company_name,
        )
        .order_by(JobPosting.id.desc())
    ).all()

    salary_ranges = _collect_distinct_values(row.salary_range for row in rows)
    addresses = _collect_distinct_values(row.address for row in rows)
    company_sizes = _collect_distinct_values(row.company_size for row in rows)
    company_types = _collect_distinct_values(row.company_type for row in rows)

    postings = [
        VerticalJobProfilePostingDetailItem(
            id=row.id,
            industry=row.industry,
            job_title=row.job_title,
            address=row.address,
            salary_range=row.salary_range,
            company_name=row.company_name,
            company_size=row.company_size,
            company_type=row.company_type,
            job_detail=row.job_detail,
            company_detail=row.company_detail,
        )
        for row in rows
    ]

    return VerticalJobProfileCompanyDetailPayload(
        summary=VerticalJobProfileCompanyDetailSummary(
            company_name=cleaned_company_name,
            job_title=cleaned_job_title,
            industry=cleaned_industry,
            posting_count=len(rows),
            salary_ranges=salary_ranges,
        ),
        overview=VerticalJobProfileCompanyDetailOverview(
            addresses=addresses,
            company_sizes=company_sizes,
            company_types=company_types,
        ),
        postings=postings,
    )


def _build_salary_sort_key(salary_range: str | None, company_name: str) -> tuple[float, float, str]:
    metrics = parse_salary_sort_metrics(salary_range)
    if metrics is None:
        return (float("inf"), float("inf"), company_name)
    return (-metrics.upper, -metrics.lower, company_name)


def _collect_distinct_values(values) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value is None:
            continue
        text = value.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized
