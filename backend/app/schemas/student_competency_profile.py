from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


DEFAULT_PROFILE_VALUE = ["暂无明确信息"]
LEGACY_EMPTY_PROFILE_VALUES = {"暂无明确信息", "无明确要求"}
JOB_PROFILE_FIELD_ORDER = [
    "professional_skills",
    "professional_background",
    "education_requirement",
    "teamwork",
    "stress_adaptability",
    "communication",
    "work_experience",
    "documentation_awareness",
    "responsibility",
    "learning_ability",
    "problem_solving",
    "other_special",
]


class StudentCompetencyStatusEventItem(BaseModel):
    event_id: int = Field(ge=1)
    conversation_id: str
    status_text: str
    stage: str | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    source: str = "external"
    details: dict[str, Any] | None = None
    created_at: datetime


class StudentCompetencyStatusEventResponse(BaseModel):
    success: bool = True
    data: StudentCompetencyStatusEventItem


class StudentCompetencyStatusEventListResponse(BaseModel):
    success: bool = True
    data: list[StudentCompetencyStatusEventItem]
    total: int = Field(ge=0)


class JobProfile12Dimensions(BaseModel):
    professional_skills: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    professional_background: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    education_requirement: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    teamwork: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    stress_adaptability: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    communication: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    work_experience: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    documentation_awareness: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    responsibility: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    learning_ability: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    problem_solving: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())
    other_special: list[str] = Field(default_factory=lambda: DEFAULT_PROFILE_VALUE.copy())


class StudentCompetencyProfileFieldMeta(BaseModel):
    key: str
    title: str
    description: str


class StudentCompetencyUploadConstraint(BaseModel):
    variable: str
    allowed_file_types: list[str] = Field(default_factory=list)
    allowed_file_extensions: list[str] = Field(default_factory=list)
    allowed_file_upload_methods: list[str] = Field(default_factory=list)
    max_length: int | None = None


class StudentCompetencyRuntimePayload(BaseModel):
    opening_statement: str
    fallback_opening_statement: str
    file_upload_enabled: bool
    file_size_limit_mb: int | None = None
    image_upload: StudentCompetencyUploadConstraint
    document_upload: StudentCompetencyUploadConstraint
    fields: list[StudentCompetencyProfileFieldMeta]


class StudentCompetencyRuntimeResponse(BaseModel):
    success: bool = True
    data: StudentCompetencyRuntimePayload


class StudentCompetencyScorePayload(BaseModel):
    completeness: int = Field(ge=0, le=100)
    competitiveness: int = Field(ge=0, le=100)
    overall: int = Field(ge=0, le=100)


class StudentCompetencyComparisonDimensionItem(BaseModel):
    key: str
    title: str
    user_values: list[str] = Field(default_factory=list)
    market_keywords: list[str] = Field(default_factory=list)
    market_weight: float = Field(ge=0)
    normalized_weight: float = Field(ge=0)
    market_target: float = Field(ge=0)
    user_readiness: float = Field(ge=0)
    gap: float
    presence: int = Field(ge=0, le=1)
    richness: float = Field(ge=0, le=1)
    status_label: str = ""
    matched_market_keywords: list[str] = Field(default_factory=list)
    missing_market_keywords: list[str] = Field(default_factory=list)
    coverage_score: float = Field(default=0, ge=0, le=1)
    alignment_score: float = Field(default=0, ge=0, le=1)


class StudentCompetencyChartSeriesItem(BaseModel):
    key: str
    title: str
    market_importance: float = Field(ge=0)
    user_readiness: float = Field(ge=0)


class StudentCompetencyNarrativePayload(BaseModel):
    overall_review: str
    completeness_explanation: str
    competitiveness_explanation: str
    strength_highlights: list[str] = Field(default_factory=list)
    priority_gap_highlights: list[str] = Field(default_factory=list)


class StudentCompetencyActionAdviceItem(BaseModel):
    key: str
    title: str
    status_label: str
    gap: float
    why_it_matters: str
    current_issue: str
    next_actions: list[str] = Field(default_factory=list)
    example_phrases: list[str] = Field(default_factory=list)
    evidence_sources: list[str] = Field(default_factory=list)
    recommended_keywords: list[str] = Field(default_factory=list)


class StudentCompetencyLatestAnalysisPayload(BaseModel):
    available: bool
    message: str | None = None
    workspace_conversation_id: str | None = None
    profile: JobProfile12Dimensions | None = None
    score: StudentCompetencyScorePayload | None = None
    comparison_dimensions: list[StudentCompetencyComparisonDimensionItem] = Field(default_factory=list)
    chart_series: list[StudentCompetencyChartSeriesItem] = Field(default_factory=list)
    strength_dimensions: list[str] = Field(default_factory=list)
    priority_gap_dimensions: list[str] = Field(default_factory=list)
    recommended_keywords: dict[str, list[str]] = Field(default_factory=dict)
    action_advices: list[StudentCompetencyActionAdviceItem] = Field(default_factory=list)
    narrative: StudentCompetencyNarrativePayload | None = None
    updated_at: datetime | None = None


class StudentCompetencyLatestAnalysisResponse(BaseModel):
    success: bool = True
    data: StudentCompetencyLatestAnalysisPayload


class StudentCompetencyChatPayload(BaseModel):
    workspace_conversation_id: str
    dify_conversation_id: str | None = None
    last_message_id: str = ""
    assistant_message: str
    output_mode: Literal["profile", "chat"] = "profile"
    profile: JobProfile12Dimensions | None = None
    latest_analysis: StudentCompetencyLatestAnalysisPayload | None = None


class StudentCompetencyChatResponse(BaseModel):
    success: bool = True
    data: StudentCompetencyChatPayload


class StudentCompetencyConversationPayload(BaseModel):
    workspace_conversation_id: str
    dify_conversation_id: str | None = None
    last_message_id: str = ""
    profile: JobProfile12Dimensions | None = None
    updated_at: datetime | None = None


class StudentCompetencyConversationResponse(BaseModel):
    success: bool = True
    data: StudentCompetencyConversationPayload


class StudentCompetencyResultSyncRequest(BaseModel):
    workspace_conversation_id: str = Field(min_length=1)
    dify_conversation_id: str | None = None
    profile: JobProfile12Dimensions


class StudentCompetencyResultSyncPayload(BaseModel):
    workspace_conversation_id: str
    dify_conversation_id: str | None = None
    last_message_id: str = ""
    assistant_message: str
    profile: JobProfile12Dimensions
    latest_analysis: StudentCompetencyLatestAnalysisPayload | None = None


class StudentCompetencyResultSyncResponse(BaseModel):
    success: bool = True
    data: StudentCompetencyResultSyncPayload
