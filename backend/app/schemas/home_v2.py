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


class HomeV2Payload(BaseModel):
    onboarding_completed: bool
    current_stage: str | None = None
    profile: StudentProfilePayload | None = None
    attachments: list[StudentAttachmentPayload] = Field(default_factory=list)
    vertical_profile: VerticalJobProfilePayload | None = None


class HomeV2Response(BaseModel):
    success: bool = True
    data: HomeV2Payload
