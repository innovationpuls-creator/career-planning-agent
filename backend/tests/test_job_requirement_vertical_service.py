from app.models.job_posting import JobPosting
from app.services.job_requirement_vertical import (
    build_tiered_vertical_comparison,
    build_vertical_job_profile_payload,
    parse_salary_sort_metrics,
)


def build_job_posting(
    *,
    id: int,
    industry: str,
    job_title: str,
    company_name: str,
    salary_range: str | None,
    address: str | None = None,
    company_size: str | None = None,
    company_type: str | None = None,
) -> JobPosting:
    return JobPosting(
        id=id,
        industry=industry,
        job_title=job_title,
        company_name=company_name,
        salary_range=salary_range,
        address=address,
        company_size=company_size,
        company_type=company_type,
    )


def test_parse_salary_sort_metrics_supports_multiple_salary_formats():
    metrics_wan = parse_salary_sort_metrics("1.5-2.5万·13薪")
    metrics_yuan = parse_salary_sort_metrics("9000-18000元")
    metrics_day = parse_salary_sort_metrics("150-200元/天")

    assert metrics_wan is not None
    assert round(metrics_wan.upper) == 27083
    assert metrics_yuan is not None
    assert metrics_yuan.upper == 18000
    assert metrics_day is not None
    assert round(metrics_day.upper) == 4350


def test_parse_salary_sort_metrics_returns_none_for_unparseable_values():
    assert parse_salary_sort_metrics("面议") is None
    assert parse_salary_sort_metrics(None) is None
    assert parse_salary_sort_metrics("薪资保密") is None


def test_build_vertical_job_profile_payload_sorts_limits_and_exposes_overview_fields():
    rows = [
        build_job_posting(
            id=1,
            industry="互联网",
            job_title="Java",
            company_name="甲公司",
            salary_range="1.5-2.5万·13薪",
            address="上海",
            company_size="500-999人",
            company_type="民营公司",
        ),
        build_job_posting(
            id=2,
            industry="互联网",
            job_title="Java",
            company_name="甲公司",
            salary_range="1.2-2.2万",
            address="杭州",
            company_size="500-999人",
            company_type="民营公司",
        ),
        build_job_posting(
            id=3,
            industry="互联网",
            job_title="Java",
            company_name="乙公司",
            salary_range="9000-18000元",
        ),
        build_job_posting(
            id=4,
            industry="互联网",
            job_title="Java",
            company_name="丙公司",
            salary_range="面议",
        ),
    ] + [
        build_job_posting(
            id=index + 10,
            industry="计算机软件",
            job_title="Java",
            company_name=f"公司{index}",
            salary_range=f"{10000 + index}-{12000 + index}元",
        )
        for index in range(12)
    ]

    payload = build_vertical_job_profile_payload(
        rows=rows,
        job_title="Java",
        selected_industries=["互联网", "计算机软件"],
        available_industries=["互联网", "计算机软件"],
    )

    internet_group = payload.groups[0]
    software_group = payload.groups[1]

    assert internet_group.companies[0].company_name == "甲公司"
    assert internet_group.companies[0].addresses == ["上海", "杭州"]
    assert internet_group.companies[0].company_sizes == ["500-999人"]
    assert internet_group.companies[0].company_types == ["民营公司"]
    assert internet_group.companies[1].company_name == "甲公司"
    assert "乙公司" in [company.company_name for company in internet_group.companies]
    assert internet_group.companies[2].company_name == "乙公司"
    assert len(software_group.companies) == 10
    assert payload.tiered_comparison is not None


def test_build_tiered_vertical_comparison_places_missing_salary_at_lowest_end():
    payload = build_vertical_job_profile_payload(
        rows=[
            build_job_posting(
                id=1,
                industry="互联网",
                job_title="Java",
                company_name="甲公司",
                salary_range="2-3万",
            ),
            build_job_posting(
                id=2,
                industry="互联网",
                job_title="Java",
                company_name="乙公司",
                salary_range="1-2万",
            ),
            build_job_posting(
                id=3,
                industry="软件",
                job_title="Java",
                company_name="丙公司",
                salary_range="5000-8000元",
            ),
            build_job_posting(
                id=4,
                industry="软件",
                job_title="Java",
                company_name="丁公司",
                salary_range="面议",
            ),
        ],
        job_title="Java",
        selected_industries=["互联网", "软件"],
        available_industries=["互联网", "软件"],
    )

    tiered = build_tiered_vertical_comparison(payload)

    assert [tier.level for tier in tiered.tiers] == ["高级", "中级", "低级"]
    assert tiered.tiers[0].items[0].company_name == "甲公司"
    assert tiered.tiers[2].items[-1].company_name == "丁公司"
