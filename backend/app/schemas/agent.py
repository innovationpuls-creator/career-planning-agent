from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CoachPageContext(BaseModel):
    """Lightweight context passed from the source business page."""

    source_page: str = Field(..., alias="sourcePage")
    favorite_id: int | None = Field(default=None, alias="favoriteId")
    workspace_id: str | None = Field(default=None, alias="workspaceId")
    report_id: str | None = Field(default=None, alias="reportId")
    recommendation_id: str | None = Field(default=None, alias="recommendationId")

    model_config = {"populate_by_name": True}


class CoachChatRequest(BaseModel):
    """POST /api/coach/chat/stream request body."""

    message: str = Field(..., min_length=1, description="User message")
    client_message_id: str = Field(
        ...,
        alias="clientMessageId",
        description="Client-generated unique message identifier",
    )
    session_id: str | None = Field(
        default=None,
        alias="sessionId",
        description="Session ID for conversation continuation",
    )
    pipeline_stage: str | None = Field(
        default=None,
        alias="pipelineStage",
        description="Explicit L1 routing stage (resume/match/learn/report)",
    )
    attachments: list["CoachAttachment"] = Field(
        default_factory=list,
        description="Uploaded files attached to this turn",
    )
    page_context: CoachPageContext | None = Field(
        default=None,
        alias="pageContext",
        description="Lightweight context from the page that opened coach.",
    )
    selected_skill: "CoachSelectedSkill | None" = Field(
        default=None,
        alias="selectedSkill",
        description="Explicit coach skill selected by the slash-command input.",
    )

    model_config = {"populate_by_name": True}


class CoachAttachment(BaseModel):
    """Attachment metadata accepted by /api/coach/chat/stream."""

    file_id: str = Field(..., alias="fileId")
    name: str
    type: str
    size: int

    model_config = {"populate_by_name": True}


class CoachSelectedSkill(BaseModel):
    """Explicit skill selected from the coach slash-command input."""

    name: str = Field(..., min_length=1)
    source: str = Field(default="slash_command")


class CoachSkillItem(BaseModel):
    name: str
    label: str
    description: str
    agent: str
    classification: str
    enabled: bool = True
    requires_evidence: bool = Field(default=False, alias="requiresEvidence")

    model_config = {"populate_by_name": True}


class CoachSkillsResponse(BaseModel):
    data: list[CoachSkillItem]


class SessionListResponse(BaseModel):
    data: list[dict[str, Any]]
    total: int


class SessionDetailData(BaseModel):
    session: dict[str, Any]
    messages: list[dict[str, Any]]
    summary: dict[str, Any] | None = None


class SessionDetailResponse(BaseModel):
    data: SessionDetailData


class DeleteSessionResponse(BaseModel):
    data: dict[str, Any]


class RunStepEvent(BaseModel):
    """Run-oriented step event for /api/coach/chat/stream."""

    event: str = "step"
    stepId: str
    kind: str
    status: str
    title: str
    summary: str = ""
    detail: dict[str, Any] | None = None
    agent: str | None = None
    toolName: str | None = None
    startedAt: str | None = None
    completedAt: str | None = None
    durationMs: int | None = None
    relatedToolCallId: str | None = None
