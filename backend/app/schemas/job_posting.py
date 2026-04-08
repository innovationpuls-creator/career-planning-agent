from pydantic import BaseModel, Field


class JobPostingItem(BaseModel):
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


class JobPostingListResponse(BaseModel):
    success: bool = True
    data: list[JobPostingItem]
    total: int = Field(ge=0)
    current: int = Field(ge=1)
    page_size: int = Field(alias="pageSize", ge=1, le=100)

    model_config = {"populate_by_name": True}
