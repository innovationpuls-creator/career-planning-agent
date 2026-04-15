from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.career_development_report import CareerDevelopmentMatchReport


class SnailLearningPathReviewCreateRequest(BaseModel):
    review_type: Literal["weekly", "monthly"]
    phase_key: Literal["short_term", "mid_term", "long_term"]
    checked_resource_urls: list[str] = Field(default_factory=list)
    user_prompt: str = ""
    report_snapshot: CareerDevelopmentMatchReport
    completed_module_count: int = Field(default=0, ge=0)
    total_module_count: int = Field(default=0, ge=0)
    phase_progress_percent: int = Field(default=0, ge=0, le=100)


class SnailUploadedFileSummary(BaseModel):
    file_name: str
    content_type: str
    text_excerpt: str = ""


class SnailWeeklyReviewReport(BaseModel):
    headline: str
    focus_keywords: list[str] = Field(default_factory=list)
    progress_assessment: str
    progress_keywords: list[str] = Field(default_factory=list)
    goal_gap_summary: str
    gap_keywords: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    next_action: str
    action_keywords: list[str] = Field(default_factory=list)


class SnailMonthlyReviewReport(BaseModel):
    headline: str
    focus_keywords: list[str] = Field(default_factory=list)
    monthly_summary: str
    phase_progress_summary: str
    progress_keywords: list[str] = Field(default_factory=list)
    gap_assessment: str
    gap_keywords: list[str] = Field(default_factory=list)
    recommendation: Literal["continue", "strengthen", "advance"] = "continue"
    focus_points: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    action_keywords: list[str] = Field(default_factory=list)


class SnailLearningPathReviewPayload(BaseModel):
    review_id: int = Field(ge=1)
    workspace_id: str
    review_type: Literal["weekly", "monthly"]
    phase_key: Literal["short_term", "mid_term", "long_term"]
    checked_resource_urls: list[str] = Field(default_factory=list)
    uploaded_files: list[SnailUploadedFileSummary] = Field(default_factory=list)
    user_prompt: str = ""
    weekly_report: SnailWeeklyReviewReport | None = None
    monthly_report: SnailMonthlyReviewReport | None = None
    created_at: datetime


class SnailLearningPathReviewResponse(BaseModel):
    success: bool = True
    data: SnailLearningPathReviewPayload


class SnailLearningPathReviewListResponse(BaseModel):
    success: bool = True
    data: list[SnailLearningPathReviewPayload] = Field(default_factory=list)
