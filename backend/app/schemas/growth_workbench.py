from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TaskType = Literal[
    "target_validation",
    "gap_diagnosis",
    "report_rewrite",
    "resume_draft",
    "full_queue",
]
TaskStatus = Literal["queued", "running", "completed", "skipped", "blocked", "failed", "cancelled"]
RunMode = Literal["single", "full_queue"]


class GrowthWorkbenchPrerequisiteItem(BaseModel):
    key: str
    label: str
    ready: bool
    blocking: bool = True
    action_label: str = ""
    action_path: str = ""


class GrowthWorkbenchEvidenceSource(BaseModel):
    key: str
    label: str
    status: Literal["available", "partial", "missing"] = "missing"
    summary: str = ""
    href: str = ""
    details: dict[str, object] = Field(default_factory=dict)


class GrowthWorkbenchTaskPayload(BaseModel):
    task_id: str
    favorite_id: int = Field(ge=1)
    queue_id: str = ""
    task_type: TaskType
    status: TaskStatus
    progress: int = Field(ge=0, le=100)
    status_text: str = ""
    result_artifact_id: str = ""
    error_message: str = ""
    can_cancel: bool = False
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class GrowthTargetDiagnosisPayload(BaseModel):
    id: str
    fit_status: str
    risk_level: str
    recommendation: Literal["keep", "adjust", "change_direction"]
    summary: str
    evidence_refs: list[dict[str, object]] = Field(default_factory=list)
    created_at: datetime


class GrowthGapDiagnosisPayload(BaseModel):
    id: str
    priority_dimensions: list[dict[str, object]] = Field(default_factory=list)
    market_keyword_gaps: list[dict[str, object]] = Field(default_factory=list)
    learning_path_suggestions: list[str] = Field(default_factory=list)
    resume_expression_gaps: list[str] = Field(default_factory=list)
    summary: str = ""
    evidence_refs: list[dict[str, object]] = Field(default_factory=list)
    created_at: datetime


class GrowthReportVersionPayload(BaseModel):
    id: str
    task_id: str
    sections: list[dict[str, object]] = Field(default_factory=list)
    markdown: str = ""
    source_summary: dict[str, object] = Field(default_factory=dict)
    accepted: bool = False
    accepted_at: datetime | None = None
    backfilled_workspace_id: str = ""
    created_at: datetime


class GrowthResumeVersionPayload(BaseModel):
    id: str
    task_id: str
    suggestions: list[dict[str, object]] = Field(default_factory=list)
    section_rewrites: dict[str, str] = Field(default_factory=dict)
    resume_markdown: str = ""
    resume_html: str = ""
    source_material_status: Literal["available", "partial", "missing"] = "missing"
    source_summary: dict[str, object] = Field(default_factory=dict)
    accepted: bool = False
    accepted_at: datetime | None = None
    created_at: datetime


class GrowthWorkbenchAggregatePayload(BaseModel):
    target_summary: dict[str, object]
    prerequisites: list[GrowthWorkbenchPrerequisiteItem]
    task_queue: list[GrowthWorkbenchTaskPayload]
    latest_diagnoses: dict[str, object]
    report_versions: list[GrowthReportVersionPayload]
    resume_versions: list[GrowthResumeVersionPayload]
    evidence_sources: list[GrowthWorkbenchEvidenceSource]
    existing_report_workspace: dict[str, object] | None = None


class GrowthWorkbenchAggregateResponse(BaseModel):
    success: bool = True
    data: GrowthWorkbenchAggregatePayload


class GrowthWorkbenchTaskCreateRequest(BaseModel):
    favorite_id: int = Field(ge=1)
    task_type: TaskType
    run_mode: RunMode = "single"


class GrowthWorkbenchTaskResponse(BaseModel):
    success: bool = True
    data: GrowthWorkbenchTaskPayload


class GrowthWorkbenchTaskStreamEvent(BaseModel):
    stage: str
    task_id: str
    queue_id: str = ""
    task_type: TaskType
    status: TaskStatus
    status_text: str
    progress: int = Field(ge=0, le=100)
    snapshot: GrowthWorkbenchTaskPayload | None = None
    created_at: datetime


class GrowthWorkbenchAcceptResponse(BaseModel):
    success: bool = True
    data: dict[str, object]
