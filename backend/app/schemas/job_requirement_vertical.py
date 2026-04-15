from pydantic import BaseModel, Field


class OptionItem(BaseModel):
    label: str
    value: str


class JobTitleOptionsResponse(BaseModel):
    success: bool = True
    data: list[OptionItem]


class IndustryOptionsResponse(BaseModel):
    success: bool = True
    data: list[OptionItem]


class VerticalJobProfileCompany(BaseModel):
    company_name: str
    industry: str | None = None
    salary_range: str | None = None
    salary_sort_value: float | None = None
    salary_sort_label: str
    addresses: list[str] = Field(default_factory=list)
    company_sizes: list[str] = Field(default_factory=list)
    company_types: list[str] = Field(default_factory=list)


class VerticalJobProfileGroup(BaseModel):
    industry: str
    companies: list[VerticalJobProfileCompany]


class VerticalJobProfileMeta(BaseModel):
    total_industries: int
    total_companies: int
    generated_at: str


class SalaryTierItem(BaseModel):
    industry: str
    company_name: str
    salary_range: str | None = None
    salary_sort_value: float | None = None
    salary_sort_label: str


class SalaryTierGroup(BaseModel):
    level: str
    items: list[SalaryTierItem] = Field(default_factory=list)


class TieredVerticalComparisonPayload(BaseModel):
    job_title: str
    tiers: list[SalaryTierGroup]


class VerticalJobProfilePayload(BaseModel):
    title: str
    job_title: str
    selected_industries: list[str]
    available_industries: list[str]
    groups: list[VerticalJobProfileGroup]
    meta: VerticalJobProfileMeta
    tiered_comparison: TieredVerticalComparisonPayload | None = None


class VerticalJobProfileResponse(BaseModel):
    success: bool = True
    data: VerticalJobProfilePayload


class VerticalJobProfileCompanyDetailSummary(BaseModel):
    company_name: str
    job_title: str
    industry: str
    posting_count: int
    salary_ranges: list[str]


class VerticalJobProfileCompanyDetailOverview(BaseModel):
    addresses: list[str]
    company_sizes: list[str]
    company_types: list[str]


class VerticalJobProfilePostingDetailItem(BaseModel):
    id: int
    industry: str
    job_title: str
    address: str | None = None
    salary_range: str | None = None
    company_name: str
    company_size: str | None = None
    company_type: str | None = None
    job_detail: str | None = None
    company_detail: str | None = None


class VerticalJobProfileCompanyDetailPayload(BaseModel):
    summary: VerticalJobProfileCompanyDetailSummary
    overview: VerticalJobProfileCompanyDetailOverview
    postings: list[VerticalJobProfilePostingDetailItem]


class VerticalJobProfileCompanyDetailResponse(BaseModel):
    success: bool = True
    data: VerticalJobProfileCompanyDetailPayload
