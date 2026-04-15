from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.job_requirement_vertical import VerticalJobProfilePayload
from app.schemas.job_transfer import JobTransferTargetGroupSimilarity
from app.schemas.student_competency_profile import (
    JobProfile12Dimensions,
    StudentCompetencyActionAdviceItem,
    StudentCompetencyChartSeriesItem,
    StudentCompetencyComparisonDimensionItem,
    StudentCompetencyNarrativePayload,
)


# ─────────────────────────────────────────────────────────────
# Career Development Match (used by V2 snail learning path)
# ─────────────────────────────────────────────────────────────


class CareerDevelopmentMatchSourcePayload(BaseModel):
    workspace_conversation_id: str
    updated_at: datetime | None = None
    active_dimension_count: int = Field(ge=0, le=12)
    profile: JobProfile12Dimensions


class CareerDevelopmentMatchGroupSummary(BaseModel):
    group_key: str
    label: str
    match_score: float = Field(ge=0, le=100)
    target_requirement: float = Field(ge=0, le=100)
    gap: float = Field(ge=0)
    status_label: str
    dimension_keys: list[str] = Field(default_factory=list)


class CareerDevelopmentMatchEvidenceCard(BaseModel):
    profile_id: int = Field(ge=1)
    career_title: str
    job_title: str
    company_name: str
    industry: str
    match_score: float = Field(ge=0, le=100)
    professional_threshold_dimension_count: int = Field(ge=0)
    professional_threshold_keyword_count: int = Field(ge=0)
    group_similarities: list[JobTransferTargetGroupSimilarity] = Field(default_factory=list)


class CareerDevelopmentMatchReport(BaseModel):
    report_id: str
    target_scope: Literal["career", "industry"]
    target_title: str
    canonical_job_title: str
    representative_job_title: str | None = None
    industry: str | None = None
    overall_match: float = Field(ge=0, le=100)
    strength_dimension_count: int = Field(ge=0, le=12)
    priority_gap_dimension_count: int = Field(ge=0, le=12)
    group_summaries: list[CareerDevelopmentMatchGroupSummary] = Field(default_factory=list)
    comparison_dimensions: list[StudentCompetencyComparisonDimensionItem] = Field(default_factory=list)
    chart_series: list[StudentCompetencyChartSeriesItem] = Field(default_factory=list)
    strength_dimensions: list[str] = Field(default_factory=list)
    priority_gap_dimensions: list[str] = Field(default_factory=list)
    action_advices: list[StudentCompetencyActionAdviceItem] = Field(default_factory=list)
    evidence_cards: list[CareerDevelopmentMatchEvidenceCard] = Field(default_factory=list)
    industry_supplement: VerticalJobProfilePayload | None = None
    narrative: StudentCompetencyNarrativePayload | None = None


class CareerDevelopmentMatchIndustryReport(BaseModel):
    industry: str
    report: CareerDevelopmentMatchReport


class CareerDevelopmentMatchInitPayload(BaseModel):
    available: bool
    message: str | None = None
    recommendations: list[CareerDevelopmentMatchReport] = Field(default_factory=list)
    default_report_id: str | None = None
    source: CareerDevelopmentMatchSourcePayload | None = None


class CareerDevelopmentMatchInitResponse(BaseModel):
    success: bool = True
    data: CareerDevelopmentMatchInitPayload


class CareerDevelopmentMatchReportRequest(BaseModel):
    job_title: str = Field(min_length=1)
    industries: list[str] = Field(default_factory=list)


class CareerDevelopmentMatchCustomPayload(BaseModel):
    source: CareerDevelopmentMatchSourcePayload
    job_title: str
    selected_industries: list[str] = Field(default_factory=list)
    available_industries: list[str] = Field(default_factory=list)
    graph_payload: VerticalJobProfilePayload | None = None
    reports: list[CareerDevelopmentMatchIndustryReport] = Field(default_factory=list)


class CareerDevelopmentMatchCustomResponse(BaseModel):
    success: bool = True
    data: CareerDevelopmentMatchCustomPayload


# ─────────────────────────────────────────────────────────────
# V1 Goal Planning Schemas (still referenced by service code)
# ─────────────────────────────────────────────────────────────


class CareerDevelopmentGoalPathNode(BaseModel):
    step: int = Field(ge=1)
    title: str
    stage_label: str
    rationale: str


class CareerDevelopmentGoalStageAdvice(BaseModel):
    stage_title: str
    leverage_strengths: list[str] = Field(default_factory=list)
    build_actions: list[str] = Field(default_factory=list)


class CareerDevelopmentGoalInsightCard(BaseModel):
    summary: str
    highlights: list[str] = Field(default_factory=list)


class CareerDevelopmentGoalCorrelationAnalysis(BaseModel):
    foundation: CareerDevelopmentGoalInsightCard
    gaps: CareerDevelopmentGoalInsightCard
    path_impact: CareerDevelopmentGoalInsightCard


class CareerDevelopmentGoalStrengthDirectionItem(BaseModel):
    title: str
    summary: str
    supporting_dimensions: list[str] = Field(default_factory=list)
    matched_keywords: list[str] = Field(default_factory=list)
    evidence_companies: list[str] = Field(default_factory=list)
    supporting_metrics: list[str] = Field(default_factory=list)
    reasoning: str


class CareerDevelopmentGoalPathStage(BaseModel):
    step: int = Field(ge=1)
    title: str
    stage_label: str
    path_summary: str
    focus_tags: list[str] = Field(default_factory=list)
    readiness_label: str = ""
    supporting_evidence: list[str] = Field(default_factory=list)
    gap_notes: list[str] = Field(default_factory=list)


class CareerDevelopmentGoalPlanResultPayload(BaseModel):
    favorite: CareerDevelopmentFavoritePayload
    trend_markdown: str
    trend_section_markdown: str = ""
    path_section_markdown: str = ""
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem] = Field(default_factory=list)
    path_stages: list[CareerDevelopmentGoalPathStage] = Field(default_factory=list)
    comprehensive_report_markdown: str = ""
    path_nodes: list[CareerDevelopmentGoalPathNode] = Field(default_factory=list)
    stage_recommendations: list[CareerDevelopmentGoalStageAdvice] = Field(default_factory=list)
    growth_plan_phases: list[GrowthPlanPhase] = Field(default_factory=list)
    review_framework: ReviewFramework | None = None
    generated_report_markdown: str = ""
    workspace_id: str | None = None
    workspace_overview: PlanWorkspaceOverview | None = None


# ─────────────────────────────────────────────────────────────
# Favorites (shared)
# ─────────────────────────────────────────────────────────────


class CareerDevelopmentFavoriteCreateRequest(BaseModel):
    source_kind: Literal["recommendation", "custom"]
    report: CareerDevelopmentMatchReport


class CareerDevelopmentFavoritePayload(BaseModel):
    favorite_id: int = Field(ge=1)
    target_key: str
    source_kind: Literal["recommendation", "custom"]
    report_id: str
    target_scope: Literal["career", "industry"]
    target_title: str
    canonical_job_title: str
    representative_job_title: str | None = None
    industry: str | None = None
    overall_match: float = Field(ge=0, le=100)
    report_snapshot: CareerDevelopmentMatchReport
    created_at: datetime
    updated_at: datetime


class CareerDevelopmentFavoriteListResponse(BaseModel):
    success: bool = True
    data: list[CareerDevelopmentFavoritePayload] = Field(default_factory=list)


class CareerDevelopmentFavoriteResponse(BaseModel):
    success: bool = True
    data: CareerDevelopmentFavoritePayload


# ─────────────────────────────────────────────────────────────
# Growth Plan Schemas (used by V2 personal growth report + snail learning path)
# ─────────────────────────────────────────────────────────────


class GrowthPlanLearningResourceItem(BaseModel):
    title: str
    url: str
    reason: str
    step_label: str = ""
    why_first: str = ""
    expected_output: str = ""


class GrowthPlanSubmissionFile(BaseModel):
    file_name: str
    stored_name: str = ""
    content_type: str = ""
    size_bytes: int = Field(default=0, ge=0)
    file_path: str = ""
    text_excerpt: str = ""


class GrowthPlanStepAssessment(BaseModel):
    result: Literal["passed", "needs_more_evidence"]
    summary: str
    missing_points: list[str] = Field(default_factory=list)
    next_action: str = ""
    assessed_at: datetime


class GrowthPlanLearningModule(BaseModel):
    module_id: str = ""
    topic: str
    learning_content: str
    priority: Literal["high", "medium", "low"] = "medium"
    suggested_resource_types: list[str] = Field(default_factory=list)
    resource_recommendations: list[GrowthPlanLearningResourceItem] = Field(default_factory=list)
    resource_status: Literal["idle", "ready", "failed"] = "idle"
    resource_generated_at: datetime | None = None
    resource_error_message: str = ""


class GrowthPlanPracticeAction(BaseModel):
    action_type: Literal[
        "project",
        "internship",
        "competition",
        "open_source",
        "certificate",
        "job_search_action",
    ]
    title: str
    description: str
    priority: Literal["high", "medium", "low"] = "medium"


class GrowthPlanMilestone(BaseModel):
    milestone_id: str
    title: str
    category: Literal["learning", "practice"]
    related_learning_module_id: str | None = None
    step_index: int | None = Field(default=None, ge=1, le=3)
    status: Literal["pending", "in_progress", "completed", "blocked"] = "pending"
    planned_date: datetime | None = None
    completed_at: datetime | None = None
    evidence_note: str = ""
    blocker_note: str = ""
    submission_status: Literal["idle", "submitted", "passed", "needs_more_evidence"] = "idle"
    submission_summary: str = ""
    submission_files: list[GrowthPlanSubmissionFile] = Field(default_factory=list)
    latest_assessment: GrowthPlanStepAssessment | None = None


class GrowthPlanMilestoneSummary(BaseModel):
    completed_count: int = Field(default=0, ge=0)
    total_count: int = Field(default=0, ge=0)
    blocked_count: int = Field(default=0, ge=0)


class GrowthPlanPhase(BaseModel):
    phase_key: Literal["short_term", "mid_term", "long_term"]
    phase_label: str
    time_horizon: str
    goal_statement: str
    why_now: str = ""
    learning_modules: list[GrowthPlanLearningModule] = Field(default_factory=list)
    practice_actions: list[GrowthPlanPracticeAction] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    entry_gate: list[str] = Field(default_factory=list)
    exit_gate: list[str] = Field(default_factory=list)
    milestones: list[GrowthPlanMilestone] = Field(default_factory=list)
    milestone_summary: GrowthPlanMilestoneSummary | None = None
    risk_alerts: list[str] = Field(default_factory=list)


class GrowthPlanMetric(BaseModel):
    key: Literal[
        "learning_completion_rate",
        "practice_completion_rate",
        "evidence_count",
        "gap_closure_index",
        "readiness_index",
    ]
    label: str
    formula: str
    description: str


class ReviewFramework(BaseModel):
    weekly_review_cycle: str = "每周复盘"
    monthly_review_cycle: str = "每月评估"
    metrics: list[GrowthPlanMetric] = Field(default_factory=list)


class IntegrityIssue(BaseModel):
    severity: Literal["blocking", "warning", "suggestion"]
    section_key: str
    phase_key: str | None = None
    message: str
    suggested_fix: str | None = None
    anchor: str | None = None


class IntegrityCheckPayload(BaseModel):
    issues: list[IntegrityIssue] = Field(default_factory=list)
    blocking_count: int = Field(default=0, ge=0)
    warning_count: int = Field(default=0, ge=0)
    suggestion_count: int = Field(default=0, ge=0)
    checked_at: datetime
    summary: str = ""


class GrowthPlanMetricSnapshot(BaseModel):
    learning_completion_rate: float = Field(default=0, ge=0, le=100)
    practice_completion_rate: float = Field(default=0, ge=0, le=100)
    evidence_count: int = Field(default=0, ge=0)
    gap_closure_index: float = Field(default=0, ge=0, le=100)
    readiness_index: float = Field(default=0, ge=0, le=100)
    uses_latest_profile: bool = False
    latest_profile_refreshed_at: datetime | None = None


class GrowthPlanCurrentLearningStep(BaseModel):
    step_index: int = Field(ge=1, le=3)
    milestone_id: str
    title: str
    objective: str
    status: Literal["idle", "submitted", "passed", "needs_more_evidence"]
    resource: GrowthPlanLearningResourceItem | None = None
    summary_text: str = ""
    submission_files: list[GrowthPlanSubmissionFile] = Field(default_factory=list)
    latest_assessment: GrowthPlanStepAssessment | None = None


class GrowthPlanPhaseFlowItem(BaseModel):
    phase_key: Literal["short_term", "mid_term", "long_term"]
    phase_label: str
    time_horizon: str
    status: Literal["completed", "current", "upcoming"]
    progress_percent: int = Field(default=0, ge=0, le=100)
    summary: str = ""
    next_hint: str = ""


class PlanReviewChangeItem(BaseModel):
    title: str
    reason: str
    next_action: str
    phase_key: str | None = None


class PlanReviewPayload(BaseModel):
    review_id: int = Field(ge=1)
    review_type: Literal["weekly", "monthly"] = "monthly"
    metric_snapshot: GrowthPlanMetricSnapshot
    keep_items: list[PlanReviewChangeItem] = Field(default_factory=list)
    deprioritized_items: list[PlanReviewChangeItem] = Field(default_factory=list)
    new_items: list[PlanReviewChangeItem] = Field(default_factory=list)
    adjustment_summary: str
    created_at: datetime


class PlanExportMeta(BaseModel):
    available_formats: list[Literal["md", "docx", "pdf"]] = Field(
        default_factory=lambda: ["md", "docx", "pdf"]
    )
    last_exported_format: Literal["md", "docx", "pdf"] | None = None
    last_exported_at: datetime | None = None
    last_exported_with_issues: bool = False
    last_exported_blocking_count: int = Field(default=0, ge=0)


class PlanWorkspaceCurrentActionSummary(BaseModel):
    current_phase_key: str = ""
    current_phase_label: str = ""
    headline: str = ""
    support_text: str = ""
    audit_summary: str = ""
    next_review_at: datetime | None = None


class PlanWorkspaceOverview(BaseModel):
    current_phase_key: str = ""
    current_phase_label: str = ""
    next_milestone_title: str = ""
    next_review_at: datetime | None = None
    readiness_index: float = Field(default=0, ge=0, le=100)
    latest_review_summary: str = ""
    gap_closure_index: float = Field(default=0, ge=0, le=100)
    uses_latest_profile: bool = False


class PlanWorkspacePayload(BaseModel):
    workspace_id: str
    favorite: CareerDevelopmentFavoritePayload
    generated_report_markdown: str
    edited_report_markdown: str
    workspace_overview: PlanWorkspaceOverview
    metric_snapshot: GrowthPlanMetricSnapshot
    growth_plan_phases: list[GrowthPlanPhase] = Field(default_factory=list)
    review_framework: ReviewFramework
    latest_integrity_check: IntegrityCheckPayload | None = None
    latest_review: PlanReviewPayload | None = None
    export_meta: PlanExportMeta = Field(default_factory=PlanExportMeta)
    current_learning_steps: list[GrowthPlanCurrentLearningStep] = Field(default_factory=list)
    phase_flow_summary: list[GrowthPlanPhaseFlowItem] = Field(default_factory=list)
    current_action_summary: PlanWorkspaceCurrentActionSummary = Field(
        default_factory=PlanWorkspaceCurrentActionSummary
    )
    updated_at: datetime


class PlanWorkspaceResponse(BaseModel):
    success: bool = True
    data: PlanWorkspacePayload


# ─────────────────────────────────────────────────────────────
# Personal Growth Report (V2)
# ─────────────────────────────────────────────────────────────


PersonalGrowthReportSectionKey = Literal[
    "self_cognition",
    "career_direction_analysis",
    "match_assessment",
    "development_suggestions",
    "action_plan",
]


class PersonalGrowthReportSection(BaseModel):
    key: PersonalGrowthReportSectionKey
    title: str
    content: str = ""
    completed: bool = False


class PersonalGrowthReportStoredPayload(BaseModel):
    version: int = 1
    sections: list[PersonalGrowthReportSection] = Field(default_factory=list)
    source_workspace_updated_at: datetime | None = None


class PersonalGrowthReportPayload(BaseModel):
    workspace_id: str
    favorite: CareerDevelopmentFavoritePayload
    sections: list[PersonalGrowthReportSection] = Field(default_factory=list)
    generated_markdown: str = ""
    edited_markdown: str = ""
    export_meta: PlanExportMeta = Field(default_factory=PlanExportMeta)
    content_status: Literal["ready", "insufficient"] = "insufficient"
    generation_status: Literal["not_started", "ready", "insufficient"] = "insufficient"
    active_task: "PersonalGrowthReportTaskSummary | None" = None
    last_generated_at: datetime | None = None
    last_saved_at: datetime | None = None
    updated_at: datetime


class PersonalGrowthReportResponse(BaseModel):
    success: bool = True
    data: PersonalGrowthReportPayload


class PersonalGrowthReportUpdateRequest(BaseModel):
    sections: list[PersonalGrowthReportSection] = Field(default_factory=list)


class PersonalGrowthReportRegenerateRequest(BaseModel):
    overwrite_current: bool = False


class PersonalGrowthReportExportRequest(BaseModel):
    format: Literal["md", "docx", "pdf"]
    force_with_issues: bool = False


class PersonalGrowthReportTaskCreateRequest(BaseModel):
    favorite_id: int = Field(ge=1)
    overwrite_current: bool = False


class PersonalGrowthReportTaskSummary(BaseModel):
    task_id: str
    favorite_id: int = Field(ge=1)
    status: Literal["queued", "running", "completed", "cancelled", "failed"]
    progress: int = Field(ge=0, le=100)
    overwrite_current: bool = False
    status_text: str = ""
    started_at: datetime
    updated_at: datetime
    can_cancel: bool = False


class PersonalGrowthReportTaskEvent(BaseModel):
    stage: str
    status_text: str
    progress: int = Field(ge=0, le=100)
    details: dict[str, str | int | float | bool | None] | None = None
    created_at: datetime


class PersonalGrowthReportTaskResult(BaseModel):
    workspace_id: str
    section_count: int = Field(ge=0)
    generated_markdown: str = ""
    updated_at: datetime


class PersonalGrowthReportTaskPayload(BaseModel):
    task_id: str
    favorite_id: int = Field(ge=1)
    status: Literal["queued", "running", "completed", "cancelled", "failed"]
    progress: int = Field(ge=0, le=100)
    overwrite_current: bool = False
    latest_event: PersonalGrowthReportTaskEvent | None = None
    result: PersonalGrowthReportTaskResult | None = None
    error_message: str | None = None
    cancel_requested_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PersonalGrowthReportTaskCreateResponse(BaseModel):
    success: bool = True
    data: PersonalGrowthReportTaskSummary


class PersonalGrowthReportTaskResponse(BaseModel):
    success: bool = True
    data: PersonalGrowthReportTaskPayload


class PersonalGrowthReportTaskCancelResponse(BaseModel):
    success: bool = True
    data: PersonalGrowthReportTaskPayload
