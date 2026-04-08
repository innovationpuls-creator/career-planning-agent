from pydantic import BaseModel, Field


class JobRequirementComparisonListItem(BaseModel):
    id: int
    industry: str
    job_title: str
    company_name: str
    job_detail_count: int = Field(ge=0)
    non_default_dimension_count: int = Field(ge=0, le=12)


class JobRequirementComparisonListResponse(BaseModel):
    success: bool = True
    data: list[JobRequirementComparisonListItem]
    total: int = Field(ge=0)
    current: int = Field(ge=1)
    page_size: int = Field(alias="pageSize", ge=1, le=100)

    model_config = {"populate_by_name": True}


class JobRequirementComparisonDetailItem(BaseModel):
    id: int
    industry: str
    job_title: str
    company_name: str
    job_detail_count: int = Field(ge=0)
    merged_job_detail: str | None = None
    professional_skills: list[str]
    professional_background: list[str]
    education_requirement: list[str]
    teamwork: list[str]
    stress_adaptability: list[str]
    communication: list[str]
    work_experience: list[str]
    documentation_awareness: list[str]
    responsibility: list[str]
    learning_ability: list[str]
    problem_solving: list[str]
    other_special: list[str]


class JobRequirementComparisonDetailResponse(BaseModel):
    success: bool = True
    data: JobRequirementComparisonDetailItem
