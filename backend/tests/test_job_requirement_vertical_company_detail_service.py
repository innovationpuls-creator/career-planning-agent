from app.models.job_posting import JobPosting
from app.services.job_requirement_vertical import get_vertical_job_profile_company_detail


class FakeScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeSession:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self, _statement):
        return FakeScalarResult(self._rows)


def build_row(
    *,
    id: int,
    industry: str = "互联网",
    job_title: str = "Java",
    company_name: str = "甲公司",
    address: str | None = None,
    salary_range: str | None = None,
    company_size: str | None = None,
    company_type: str | None = None,
    job_detail: str | None = None,
    company_detail: str | None = None,
) -> JobPosting:
    return JobPosting(
        id=id,
        industry=industry,
        job_title=job_title,
        company_name=company_name,
        address=address,
        salary_range=salary_range,
        company_size=company_size,
        company_type=company_type,
        job_detail=job_detail,
        company_detail=company_detail,
    )


def test_get_vertical_job_profile_company_detail_deduplicates_overview_values():
    rows = [
        build_row(
            id=1,
            address="北京",
            salary_range="1-2万",
            company_size="100-499人",
            company_type="民营",
        ),
        build_row(
            id=2,
            address="北京",
            salary_range="1-2万",
            company_size="100-499人",
            company_type="民营",
        ),
        build_row(
            id=3,
            address="上海",
            salary_range="1.5-2.5万",
            company_size="500-999人",
            company_type="上市公司",
        ),
    ]

    payload = get_vertical_job_profile_company_detail(
        FakeSession(rows),
        job_title="Java",
        industry="互联网",
        company_name="甲公司",
    )

    assert payload.summary.posting_count == 3
    assert payload.summary.salary_ranges == ["1-2万", "1.5-2.5万"]
    assert payload.overview.addresses == ["北京", "上海"]
    assert payload.overview.company_sizes == ["100-499人", "500-999人"]
    assert payload.overview.company_types == ["民营", "上市公司"]


def test_get_vertical_job_profile_company_detail_handles_empty_text_fields():
    rows = [
        build_row(id=1, address=None, salary_range=None, job_detail=None, company_detail=None),
    ]

    payload = get_vertical_job_profile_company_detail(
        FakeSession(rows),
        job_title="Java",
        industry="互联网",
        company_name="甲公司",
    )

    assert payload.summary.salary_ranges == []
    assert payload.overview.addresses == []
