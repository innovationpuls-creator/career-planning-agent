from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.job_requirement_vertical import VerticalJobProfilePayload


class StudentProfilePayload(BaseModel):
    full_name: str
    school: str
    major: str
    education_level: str
    grade: str
    target_job_title: str


class StudentAttachmentPayload(BaseModel):
    original_name: str
    stored_name: str
    content_type: str
    size_bytes: int
    file_path: str


class HomeV2ProgressStep(BaseModel):
    key: str
    label: str
    status: Literal["done", "current", "todo"]
    description: str
    href: str


class HomeV2NextAction(BaseModel):
    label: str
    description: str
    href: str
    button_text: str


class HomeV2ActiveTarget(BaseModel):
    favorite_id: int
    target_title: str
    canonical_job_title: str
    overall_match: float
    industry: str | None = None


class HomeV2PlanningProgress(BaseModel):
    completion_percent: int = Field(default=0, ge=0, le=100)
    active_target: HomeV2ActiveTarget | None = None
    steps: list[HomeV2ProgressStep] = Field(default_factory=list)
    next_action: HomeV2NextAction


class HomeV2Payload(BaseModel):
    onboarding_completed: bool
    current_stage: str | None = None
    profile: StudentProfilePayload | None = None
    attachments: list[StudentAttachmentPayload] = Field(default_factory=list)
    vertical_profile: VerticalJobProfilePayload | None = None
    planning_progress: HomeV2PlanningProgress


class HomeV2Response(BaseModel):
    success: bool = True
    data: HomeV2Payload
