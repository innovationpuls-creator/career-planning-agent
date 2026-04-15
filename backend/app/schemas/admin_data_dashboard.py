from pydantic import BaseModel


class MajorDistributionItem(BaseModel):
    major: str
    count: int


class SchoolDistributionItem(BaseModel):
    school: str
    count: int


class EducationDistributionItem(BaseModel):
    level: str
    count: int


class MajorDistributionResponse(BaseModel):
    success: bool = True
    total_users: int
    profiles_completed: int
    completion_rate: float
    major_distribution: list[MajorDistributionItem]
    school_distribution: list[SchoolDistributionItem]
    education_distribution: list[EducationDistributionItem]


class ScoreDistributionItem(BaseModel):
    dimension: str
    high: int
    medium: int
    low: int


class TopStudentItem(BaseModel):
    user_id: int
    display_name: str
    overall_score: float


class CompetencyAnalysisResponse(BaseModel):
    success: bool = True
    total_assessments: int
    average_scores: dict[str, float]
    score_distribution: list[ScoreDistributionItem]
    top_students: list[TopStudentItem]


class IndustryDistributionItem(BaseModel):
    industry: str
    count: int


class JobTitleDistributionItem(BaseModel):
    job_title: str
    count: int


class SalaryDistribution(BaseModel):
    below_15k: int = 0
    from_15k_to_25k: int = 0
    from_25k_to_35k: int = 0
    above_35k: int = 0


class EmploymentTrendsResponse(BaseModel):
    success: bool = True
    total_jobs: int
    total_companies: int
    industry_distribution: list[IndustryDistributionItem]
    job_title_distribution: list[JobTitleDistributionItem]
    salary_distribution: SalaryDistribution
