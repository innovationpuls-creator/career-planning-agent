from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class JobTransferOptionItem(BaseModel):
    career_id: int
    job_title: str
    label: str


class JobTransferOptionsPayload(BaseModel):
    items: list[JobTransferOptionItem]


class JobTransferOptionsResponse(BaseModel):
    success: bool = True
    data: JobTransferOptionsPayload


class JobTransferGroupWeightItem(BaseModel):
    group_key: str
    label: str
    coverage_ratio: float = Field(ge=0, le=1)
    weight: float = Field(ge=0, le=1)


class JobTransferSourceSnapshot(BaseModel):
    career_id: int
    job_title: str
    source_job_titles: list[str]
    sample_count: int = Field(ge=0)
    group_weights: list[JobTransferGroupWeightItem]
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


class JobTransferTargetGroupSimilarity(BaseModel):
    group_key: str
    label: str
    similarity_score: float = Field(ge=0)


class JobTransferTargetItem(BaseModel):
    profile_id: int
    industry: str
    job_title: str
    company_name: str
    weighted_similarity_score: float = Field(ge=0)
    professional_threshold_dimension_count: int = Field(ge=0, le=5)
    professional_threshold_keyword_count: int = Field(ge=0)
    group_similarities: list[JobTransferTargetGroupSimilarity]


class JobTransferComparisonRow(BaseModel):
    key: str
    label: str
    group_key: str
    source_values: list[str]
    target_values: list[str]


class JobTransferComparisonItem(BaseModel):
    target_profile_id: int
    weighted_similarity_score: float = Field(ge=0)
    group_similarities: list[JobTransferTargetGroupSimilarity]
    rows: list[JobTransferComparisonRow]


class JobTransferMeta(BaseModel):
    vector_version: str
    merged_candidate_count: int = Field(ge=0)
    shortlisted_candidate_count: int = Field(ge=0)
    selected_target_count: int = Field(ge=0)
    generated_at: str


class JobTransferPayload(BaseModel):
    source: JobTransferSourceSnapshot
    targets: list[JobTransferTargetItem]
    comparisons: list[JobTransferComparisonItem]
    meta: JobTransferMeta


class JobTransferResponse(BaseModel):
    success: bool = True
    data: JobTransferPayload


class JobTransferSourceResponse(BaseModel):
    success: bool = True
    data: JobTransferSourceSnapshot


class JobTransferTaskCreateRequest(BaseModel):
    career_id: int


class JobTransferTaskSummary(BaseModel):
    task_id: str
    career_id: int
    status: str
    reused_existing: bool = False


class JobTransferTaskSnapshot(BaseModel):
    task_id: str
    career_id: int
    status: str
    processed_candidates: int = Field(ge=0)
    total_candidates: int = Field(ge=0)
    payload: JobTransferPayload | None = None
    latest_event: dict[str, Any] | None = None
    error_message: str | None = None
    cancel_requested_at: str | None = None
    completed_at: str | None = None
    updated_at: str


class JobTransferTaskCreateResponse(BaseModel):
    success: bool = True
    data: JobTransferTaskSummary


class JobTransferTaskSnapshotResponse(BaseModel):
    success: bool = True
    data: JobTransferTaskSnapshot


class JobTransferTaskCancelResponse(BaseModel):
    success: bool = True
    data: JobTransferTaskSnapshot
