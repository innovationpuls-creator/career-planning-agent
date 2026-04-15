// @ts-ignore
/* eslint-disable */

declare namespace API {
  type CurrentUser = {
    name?: string;
    avatar?: string;
    userid?: string;
    email?: string;
    signature?: string;
    title?: string;
    group?: string;
    tags?: { key?: string; label?: string }[];
    notifyCount?: number;
    unreadCount?: number;
    country?: string;
    access?: string;
    geographic?: {
      province?: { label?: string; key?: string };
      city?: { label?: string; key?: string };
    };
    address?: string;
    phone?: string;
  };

  type JobPostingItem = {
    id: number;
    industry: string;
    job_title: string;
    address?: string;
    salary_range?: string;
    company_name: string;
    company_size?: string;
    company_type?: string;
    job_detail?: string;
    company_detail?: string;
  };

  type JobPostingQueryParams = {
    current?: number;
    pageSize?: number;
    industry?: string[];
    job_title?: string[];
    company_name?: string;
    address?: string;
    keyword?: string;
  };

  type JobPostingListResponse = {
    success?: boolean;
    data?: JobPostingItem[];
    total?: number;
    current?: number;
    pageSize?: number;
  };

  type JobTitleOption = {
    label: string;
    value: string;
  };

  type IndustryOption = {
    label: string;
    value: string;
  };

  type JobTitleOptionsResponse = {
    success?: boolean;
    data: JobTitleOption[];
  };

  type StudentProfilePayload = {
    full_name: string;
    school: string;
    major: string;
    education_level: string;
    grade: string;
    target_job_title: string;
  };

  type HomeV2Payload = {
    onboarding_completed: boolean;
    current_stage?: string;
    profile?: StudentProfilePayload;
    attachments?: Array<{
      original_name: string;
      stored_name: string;
      content_type: string;
      size_bytes: number;
      file_path: string;
    }>;
    vertical_profile?: VerticalJobProfilePayload;
  };

  type HomeV2Response = {
    success?: boolean;
    data: HomeV2Payload;
  };

  type IndustryOptionsResponse = {
    success?: boolean;
    data: IndustryOption[];
  };

  type JobRequirementComparisonListItem = {
    id: number;
    industry: string;
    job_title: string;
    company_name: string;
    job_detail_count: number;
    non_default_dimension_count: number;
  };

  type JobRequirementComparisonQueryParams = {
    current?: number;
    pageSize?: number;
    industry?: string[];
    job_title?: string[];
    company_name?: string;
  };

  type JobRequirementComparisonListResponse = {
    success?: boolean;
    data?: JobRequirementComparisonListItem[];
    total?: number;
    current?: number;
    pageSize?: number;
  };

  type JobRequirementComparisonDetailItem = {
    id: number;
    industry: string;
    job_title: string;
    company_name: string;
    job_detail_count: number;
    merged_job_detail?: string;
    professional_skills: string[];
    professional_background: string[];
    education_requirement: string[];
    teamwork: string[];
    stress_adaptability: string[];
    communication: string[];
    work_experience: string[];
    documentation_awareness: string[];
    responsibility: string[];
    learning_ability: string[];
    problem_solving: string[];
    other_special: string[];
  };

  type JobRequirementComparisonDetailResponse = {
    success?: boolean;
    data: JobRequirementComparisonDetailItem;
  };

  type JobRequirementGraphNode = {
    id: string;
    type: 'ProfileRoot' | 'DimensionGroup' | 'Dimension';
    title: string;
    description: string;
    icon: string;
    keywords: string[];
    profile_count: number;
    non_default_count: number;
    coverage_ratio: number;
    group_key?: string | null;
  };

  type JobRequirementGraphEdge = {
    source: string;
    target: string;
    type: string;
  };

  type JobRequirementGraphPayload = {
    nodes: JobRequirementGraphNode[];
    edges: JobRequirementGraphEdge[];
    meta: {
      total_profiles: number;
      graph_version: string;
      generated_at: string;
    };
  };

  type JobRequirementGraphResponse = {
    success?: boolean;
    data: JobRequirementGraphPayload;
  };

  type VerticalJobProfileCompany = {
    company_name: string;
    salary_range?: string;
    salary_sort_value?: number | null;
    salary_sort_label: string;
    addresses: string[];
    company_sizes: string[];
    company_types: string[];
  };

  type VerticalJobProfileGroup = {
    industry: string;
    companies: VerticalJobProfileCompany[];
  };

  type VerticalJobProfilePayload = {
    title: string;
    job_title: string;
    selected_industries: string[];
    available_industries: string[];
    groups: VerticalJobProfileGroup[];
    meta: {
      total_industries: number;
      total_companies: number;
      generated_at: string;
    };
  };

  type VerticalJobProfileQueryParams = {
    job_title: string;
    industry?: string[];
  };

  type VerticalJobProfileResponse = {
    success?: boolean;
    data: VerticalJobProfilePayload;
  };

  type VerticalJobProfileCompanyDetailSummary = {
    company_name: string;
    job_title: string;
    industry: string;
    posting_count: number;
    salary_ranges: string[];
  };

  type VerticalJobProfileCompanyDetailOverview = {
    addresses: string[];
    company_sizes: string[];
    company_types: string[];
  };

  type VerticalJobProfilePostingDetailItem = {
    id: number;
    industry: string;
    job_title: string;
    address?: string;
    salary_range?: string;
    company_name: string;
    company_size?: string;
    company_type?: string;
    job_detail?: string;
    company_detail?: string;
  };

  type VerticalJobProfileCompanyDetailPayload = {
    summary: VerticalJobProfileCompanyDetailSummary;
    overview: VerticalJobProfileCompanyDetailOverview;
    postings: VerticalJobProfilePostingDetailItem[];
  };

  type VerticalJobProfileCompanyDetailQueryParams = {
    job_title: string;
    industry: string;
    company_name: string;
  };

  type VerticalJobProfileCompanyDetailResponse = {
    success?: boolean;
    data: VerticalJobProfileCompanyDetailPayload;
  };

  type CareerDevelopmentMatchSourcePayload = {
    workspace_conversation_id: string;
    updated_at?: string;
    active_dimension_count: number;
    profile: Record<string, string[]>;
  };

  type CareerDevelopmentMatchGroupSummary = {
    group_key: string;
    label: string;
    match_score: number;
    target_requirement: number;
    gap: number;
    status_label: string;
    dimension_keys: string[];
  };

  type CareerDevelopmentMatchEvidenceCard = {
    profile_id: number;
    career_title: string;
    job_title: string;
    company_name: string;
    industry: string;
    match_score: number;
    professional_threshold_dimension_count: number;
    professional_threshold_keyword_count: number;
    group_similarities: JobTransferTargetGroupSimilarity[];
  };

  type CareerDevelopmentMatchReport = {
    report_id: string;
    target_scope: 'career' | 'industry';
    target_title: string;
    canonical_job_title: string;
    representative_job_title?: string;
    industry?: string;
    overall_match: number;
    strength_dimension_count: number;
    priority_gap_dimension_count: number;
    group_summaries: CareerDevelopmentMatchGroupSummary[];
    comparison_dimensions: StudentCompetencyComparisonDimensionItem[];
    chart_series: StudentCompetencyChartSeriesItem[];
    strength_dimensions: string[];
    priority_gap_dimensions: string[];
    action_advices: StudentCompetencyActionAdviceItem[];
    evidence_cards: CareerDevelopmentMatchEvidenceCard[];
    industry_supplement?: VerticalJobProfilePayload;
    narrative?: StudentCompetencyNarrativePayload;
  };

  type CareerDevelopmentMatchIndustryReport = {
    industry: string;
    report: CareerDevelopmentMatchReport;
  };

  type CareerDevelopmentMatchInitPayload = {
    available: boolean;
    message?: string;
    source?: CareerDevelopmentMatchSourcePayload;
    recommendations: CareerDevelopmentMatchReport[];
    default_report_id?: string;
  };

  type CareerDevelopmentMatchInitResponse = {
    success?: boolean;
    data: CareerDevelopmentMatchInitPayload;
  };

  type CareerDevelopmentMatchReportRequest = {
    job_title: string;
    industries: string[];
  };

  type CareerDevelopmentMatchCustomPayload = {
    source: CareerDevelopmentMatchSourcePayload;
    job_title: string;
    selected_industries: string[];
    available_industries: string[];
    graph_payload?: VerticalJobProfilePayload;
    reports: CareerDevelopmentMatchIndustryReport[];
  };

  type CareerDevelopmentMatchCustomResponse = {
    success?: boolean;
    data: CareerDevelopmentMatchCustomPayload;
  };

  type CareerDevelopmentFavoriteCreateRequest = {
    source_kind: 'recommendation' | 'custom';
    report: CareerDevelopmentMatchReport;
  };

  type CareerDevelopmentFavoritePayload = {
    favorite_id: number;
    target_key: string;
    source_kind: 'recommendation' | 'custom';
    report_id: string;
    target_scope: 'career' | 'industry';
    target_title: string;
    canonical_job_title: string;
    representative_job_title?: string;
    industry?: string;
    overall_match: number;
    report_snapshot: CareerDevelopmentMatchReport;
    created_at: string;
    updated_at: string;
  };

  type CareerDevelopmentFavoriteListResponse = {
    success?: boolean;
    data: CareerDevelopmentFavoritePayload[];
  };

  type CareerDevelopmentFavoriteResponse = {
    success?: boolean;
    data: CareerDevelopmentFavoritePayload;
  };

  type CareerDevelopmentGoalPathNode = {
    step: number;
    title: string;
    stage_label: string;
    rationale: string;
  };

  type CareerDevelopmentGoalStageAdvice = {
    stage_title: string;
    leverage_strengths: string[];
    build_actions: string[];
  };

  type CareerDevelopmentGoalInsightCard = {
    summary: string;
    highlights: string[];
  };

  type CareerDevelopmentGoalCorrelationAnalysis = {
    foundation: CareerDevelopmentGoalInsightCard;
    gaps: CareerDevelopmentGoalInsightCard;
    path_impact: CareerDevelopmentGoalInsightCard;
  };

  type CareerDevelopmentGoalStrengthDirectionItem = {
    title: string;
    summary: string;
    supporting_dimensions: string[];
    matched_keywords: string[];
    evidence_companies: string[];
    supporting_metrics: string[];
    reasoning: string;
  };

  type CareerDevelopmentGoalPathStage = {
    step: number;
    title: string;
    stage_label: string;
    path_summary: string;
    focus_tags: string[];
    readiness_label: string;
    supporting_evidence: string[];
    gap_notes: string[];
  };

  type GrowthPlanLearningResourceItem = {
    title: string;
    url: string;
    reason: string;
    step_label: string;
    why_first: string;
    expected_output: string;
  };

  type GrowthPlanSubmissionFile = {
    file_name: string;
    stored_name: string;
    content_type: string;
    size_bytes: number;
    file_path: string;
    text_excerpt: string;
  };

  type GrowthPlanStepAssessment = {
    result: 'passed' | 'needs_more_evidence';
    summary: string;
    missing_points: string[];
    next_action: string;
    assessed_at: string;
  };

  type GrowthPlanLearningModule = {
    module_id: string;
    topic: string;
    learning_content: string;
    priority: 'high' | 'medium' | 'low';
    suggested_resource_types: string[];
    resource_recommendations: GrowthPlanLearningResourceItem[];
    resource_status: 'idle' | 'ready' | 'failed';
    resource_generated_at?: string;
    resource_error_message: string;
  };

  type GrowthPlanPracticeAction = {
    action_type:
      | 'project'
      | 'internship'
      | 'competition'
      | 'open_source'
      | 'certificate'
      | 'job_search_action';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  };

  type GrowthPlanMilestone = {
    milestone_id: string;
    title: string;
    category: 'learning' | 'practice';
    related_learning_module_id?: string;
    step_index?: number;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    planned_date?: string;
    completed_at?: string;
    evidence_note: string;
    blocker_note: string;
    submission_status: 'idle' | 'submitted' | 'passed' | 'needs_more_evidence';
    submission_summary: string;
    submission_files: GrowthPlanSubmissionFile[];
    latest_assessment?: GrowthPlanStepAssessment;
  };

  type GrowthPlanMilestoneSummary = {
    completed_count: number;
    total_count: number;
    blocked_count: number;
  };

  type GrowthPlanPhase = {
    phase_key: 'short_term' | 'mid_term' | 'long_term';
    phase_label: string;
    time_horizon: string;
    goal_statement: string;
    why_now: string;
    learning_modules: GrowthPlanLearningModule[];
    practice_actions: GrowthPlanPracticeAction[];
    deliverables: string[];
    entry_gate: string[];
    exit_gate: string[];
    milestones: GrowthPlanMilestone[];
    milestone_summary?: GrowthPlanMilestoneSummary;
    risk_alerts: string[];
  };

  type GrowthPlanMetric = {
    key:
      | 'learning_completion_rate'
      | 'practice_completion_rate'
      | 'evidence_count'
      | 'gap_closure_index'
      | 'readiness_index';
    label: string;
    formula: string;
    description: string;
  };

  type ReviewFramework = {
    weekly_review_cycle: string;
    monthly_review_cycle: string;
    metrics: GrowthPlanMetric[];
  };

  type PlanWorkspaceOverview = {
    current_phase_key: string;
    current_phase_label: string;
    next_milestone_title: string;
    next_review_at?: string;
    readiness_index: number;
    latest_review_summary: string;
    gap_closure_index: number;
    uses_latest_profile: boolean;
  };

  type IntegrityIssue = {
    severity: 'blocking' | 'warning' | 'suggestion';
    section_key: string;
    phase_key?: string;
    message: string;
    suggested_fix?: string;
    anchor?: string;
  };

  type IntegrityCheckPayload = {
    issues: IntegrityIssue[];
    blocking_count: number;
    warning_count: number;
    suggestion_count: number;
    checked_at: string;
    summary: string;
  };

  type GrowthPlanMetricSnapshot = {
    learning_completion_rate: number;
    practice_completion_rate: number;
    evidence_count: number;
    gap_closure_index: number;
    readiness_index: number;
    uses_latest_profile: boolean;
    latest_profile_refreshed_at?: string;
  };

  type GrowthPlanCurrentLearningStep = {
    step_index: number;
    milestone_id: string;
    title: string;
    objective: string;
    status: 'idle' | 'submitted' | 'passed' | 'needs_more_evidence';
    resource?: GrowthPlanLearningResourceItem;
    summary_text: string;
    submission_files: GrowthPlanSubmissionFile[];
    latest_assessment?: GrowthPlanStepAssessment;
  };

  type GrowthPlanPhaseFlowItem = {
    phase_key: 'short_term' | 'mid_term' | 'long_term';
    phase_label: string;
    time_horizon: string;
    status: 'completed' | 'current' | 'upcoming';
    progress_percent: number;
    summary: string;
    next_hint: string;
  };

  type PlanWorkspaceCurrentActionSummary = {
    current_phase_key: string;
    current_phase_label: string;
    headline: string;
    support_text: string;
    audit_summary: string;
    next_review_at?: string;
  };

  type PlanReviewChangeItem = {
    title: string;
    reason: string;
    next_action: string;
    phase_key?: string;
  };

  type PlanReviewPayload = {
    review_id: number;
    review_type: 'weekly' | 'monthly';
    metric_snapshot: GrowthPlanMetricSnapshot;
    keep_items: PlanReviewChangeItem[];
    deprioritized_items: PlanReviewChangeItem[];
    new_items: PlanReviewChangeItem[];
    adjustment_summary: string;
    created_at: string;
  };

  type PlanExportMeta = {
    available_formats: Array<'md' | 'docx' | 'pdf'>;
    last_exported_format?: 'md' | 'docx' | 'pdf';
    last_exported_at?: string;
    last_exported_with_issues?: boolean;
    last_exported_blocking_count?: number;
  };

  type CareerDevelopmentGoalPlanResultPayload = {
    favorite: CareerDevelopmentFavoritePayload;
    trend_markdown: string;
    trend_section_markdown: string;
    path_section_markdown: string;
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis;
    strength_directions: CareerDevelopmentGoalStrengthDirectionItem[];
    path_stages: CareerDevelopmentGoalPathStage[];
    comprehensive_report_markdown: string;
    path_nodes: CareerDevelopmentGoalPathNode[];
    stage_recommendations: CareerDevelopmentGoalStageAdvice[];
    growth_plan_phases: GrowthPlanPhase[];
    review_framework?: ReviewFramework;
    generated_report_markdown: string;
    workspace_id?: string;
    workspace_overview?: PlanWorkspaceOverview;
  };

  type CareerDevelopmentGoalPlanTaskCreateRequest = {
    favorite_id: number;
  };

  type CareerDevelopmentGoalPlanStatusEvent = {
    stage: string;
    status_text: string;
    progress: number;
    details?: Record<string, any>;
    created_at: string;
  };

  type CareerDevelopmentGoalPlanTaskSummary = {
    task_id: string;
    favorite_id: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    progress: number;
  };

  type CareerDevelopmentGoalPlanTaskPayload = {
    task_id: string;
    favorite_id: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    progress: number;
    result?: CareerDevelopmentGoalPlanResultPayload;
    latest_event?: CareerDevelopmentGoalPlanStatusEvent;
    error_message?: string;
    completed_at?: string;
    updated_at: string;
  };

  type CareerDevelopmentGoalPlanTaskCreateResponse = {
    success?: boolean;
    data: CareerDevelopmentGoalPlanTaskSummary;
  };

  type CareerDevelopmentGoalPlanTaskResponse = {
    success?: boolean;
    data: CareerDevelopmentGoalPlanTaskPayload;
  };

  type PlanWorkspacePayload = {
    workspace_id: string;
    favorite: CareerDevelopmentFavoritePayload;
    generated_report_markdown: string;
    edited_report_markdown: string;
    workspace_overview: PlanWorkspaceOverview;
    metric_snapshot: GrowthPlanMetricSnapshot;
    growth_plan_phases: GrowthPlanPhase[];
    review_framework: ReviewFramework;
    latest_integrity_check?: IntegrityCheckPayload;
    latest_review?: PlanReviewPayload;
    export_meta: PlanExportMeta;
    current_learning_steps: GrowthPlanCurrentLearningStep[];
    phase_flow_summary: GrowthPlanPhaseFlowItem[];
    current_action_summary: PlanWorkspaceCurrentActionSummary;
    updated_at: string;
  };

  type PlanWorkspaceUpdateRequest = {
    edited_report_markdown: string;
    growth_plan_phases?: GrowthPlanPhase[];
  };

  type PlanWorkspaceResponse = {
    success?: boolean;
    data: PlanWorkspacePayload;
  };

  type PersonalGrowthReportSectionKey =
    | 'self_cognition'
    | 'career_direction_analysis'
    | 'match_assessment'
    | 'development_suggestions'
    | 'action_plan';

  type PersonalGrowthReportSection = {
    key: PersonalGrowthReportSectionKey;
    title: string;
    content: string;
    completed: boolean;
  };

  type PersonalGrowthReportPayload = {
    workspace_id: string;
    favorite: CareerDevelopmentFavoritePayload;
    sections: PersonalGrowthReportSection[];
    generated_markdown: string;
    edited_markdown: string;
    export_meta: PlanExportMeta;
    content_status: 'ready' | 'insufficient';
    generation_status: 'not_started' | 'ready' | 'insufficient';
    active_task?: PersonalGrowthReportTaskSummary;
    last_generated_at?: string;
    last_saved_at?: string;
    updated_at: string;
  };

  type PersonalGrowthReportResponse = {
    success?: boolean;
    data: PersonalGrowthReportPayload;
  };

  type PersonalGrowthReportUpdateRequest = {
    sections: PersonalGrowthReportSection[];
  };

  type PersonalGrowthReportRegenerateRequest = {
    overwrite_current?: boolean;
  };

  type PersonalGrowthReportExportRequest = {
    format: 'md' | 'docx' | 'pdf';
    force_with_issues?: boolean;
  };

  type PersonalGrowthReportTaskCreateRequest = {
    favorite_id: number;
    overwrite_current?: boolean;
  };

  type PersonalGrowthReportTaskSummary = {
    task_id: string;
    favorite_id: number;
    status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
    progress: number;
    overwrite_current: boolean;
    status_text: string;
    started_at: string;
    updated_at: string;
    can_cancel: boolean;
  };

  type PersonalGrowthReportTaskEvent = {
    stage: string;
    status_text: string;
    progress: number;
    details?: Record<string, string | number | boolean | null>;
    created_at: string;
  };

  type PersonalGrowthReportTaskResult = {
    workspace_id: string;
    section_count: number;
    generated_markdown: string;
    updated_at: string;
  };

  type PersonalGrowthReportTaskPayload = {
    task_id: string;
    favorite_id: number;
    status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
    progress: number;
    overwrite_current: boolean;
    latest_event?: PersonalGrowthReportTaskEvent;
    result?: PersonalGrowthReportTaskResult;
    error_message?: string;
    cancel_requested_at?: string;
    completed_at?: string;
    created_at: string;
    updated_at: string;
  };

  type PersonalGrowthReportTaskCreateResponse = {
    success?: boolean;
    data: PersonalGrowthReportTaskSummary;
  };

  type PersonalGrowthReportTaskResponse = {
    success?: boolean;
    data: PersonalGrowthReportTaskPayload;
  };

  type PersonalGrowthReportTaskCancelResponse = {
    success?: boolean;
    data: PersonalGrowthReportTaskPayload;
  };

  type SnailUploadedFileSummary = {
    file_name: string;
    content_type: string;
    text_excerpt: string;
  };

  type SnailWeeklyReviewReport = {
    headline: string;
    focus_keywords: string[];
    progress_assessment: string;
    progress_keywords: string[];
    goal_gap_summary: string;
    gap_keywords: string[];
    highlights: string[];
    blockers: string[];
    next_action: string;
    action_keywords: string[];
  };

  type SnailMonthlyReviewReport = {
    headline: string;
    focus_keywords: string[];
    monthly_summary: string;
    phase_progress_summary: string;
    progress_keywords: string[];
    gap_assessment: string;
    gap_keywords: string[];
    recommendation: 'continue' | 'strengthen' | 'advance';
    focus_points: string[];
    next_actions: string[];
    action_keywords: string[];
  };

  type SnailLearningPathReviewPayload = {
    review_id: number;
    workspace_id: string;
    review_type: 'weekly' | 'monthly';
    phase_key: LearningPathPhaseKey;
    checked_resource_urls: string[];
    uploaded_files: SnailUploadedFileSummary[];
    user_prompt: string;
    weekly_report?: SnailWeeklyReviewReport;
    monthly_report?: SnailMonthlyReviewReport;
    created_at: string;
  };

  type SnailLearningPathReviewResponse = {
    success?: boolean;
    data: SnailLearningPathReviewPayload;
  };

  type SnailLearningPathReviewListResponse = {
    success?: boolean;
    data: SnailLearningPathReviewPayload[];
  };

  type PlanWorkspacePolishRequest = {
    markdown: string;
    mode: 'formal' | 'concise' | 'mentor_facing';
  };

  type PlanWorkspacePolishPayload = {
    polished_markdown: string;
    mode: 'formal' | 'concise' | 'mentor_facing';
    fact_guard_notice: string;
  };

  type PlanWorkspacePolishResponse = {
    success?: boolean;
    data: PlanWorkspacePolishPayload;
  };

  type PlanWorkspaceIntegrityCheckRequest = {
    markdown: string;
  };

  type PlanWorkspaceIntegrityCheckResponse = {
    success?: boolean;
    data: IntegrityCheckPayload;
  };

  type PlanWorkspaceReviewRequest = {
    review_type: 'weekly' | 'monthly';
  };

  type PlanWorkspaceReviewResponse = {
    success?: boolean;
    data: PlanReviewPayload;
  };

  type PlanLearningResourceRequest = {
    phase_key: 'short_term' | 'mid_term' | 'long_term';
    module_id: string;
    force_refresh?: boolean;
    exclude_urls?: string[];
  };

  type PlanLearningResourceResponse = {
    success?: boolean;
    data: PlanWorkspacePayload;
  };

  type PlanWorkspaceMilestoneSubmissionResponse = {
    success?: boolean;
    data: PlanWorkspacePayload;
  };

  type PlanWorkspaceExportRequest = {
    format: 'md' | 'docx' | 'pdf';
    force_with_issues?: boolean;
  };

  type JobTransferOptionItem = {
    career_id: number;
    job_title: string;
    label: string;
  };

  type JobTransferOptionsPayload = {
    items: JobTransferOptionItem[];
  };

  type JobTransferOptionsResponse = {
    success?: boolean;
    data: JobTransferOptionsPayload;
  };

  type JobTransferGroupWeightItem = {
    group_key: string;
    label: string;
    coverage_ratio: number;
    weight: number;
  };

  type JobTransferSourceSnapshot = {
    career_id: number;
    job_title: string;
    source_job_titles: string[];
    sample_count: number;
    group_weights: JobTransferGroupWeightItem[];
    professional_skills: string[];
    professional_background: string[];
    education_requirement: string[];
    teamwork: string[];
    stress_adaptability: string[];
    communication: string[];
    work_experience: string[];
    documentation_awareness: string[];
    responsibility: string[];
    learning_ability: string[];
    problem_solving: string[];
    other_special: string[];
  };

  type JobTransferTargetGroupSimilarity = {
    group_key: string;
    label: string;
    similarity_score: number;
  };

  type JobTransferTargetItem = {
    profile_id: number;
    industry: string;
    job_title: string;
    company_name: string;
    weighted_similarity_score: number;
    professional_threshold_dimension_count: number;
    professional_threshold_keyword_count: number;
    group_similarities: JobTransferTargetGroupSimilarity[];
  };

  type JobTransferComparisonRow = {
    key: string;
    label: string;
    group_key: string;
    source_values: string[];
    target_values: string[];
  };

  type JobTransferComparisonItem = {
    target_profile_id: number;
    weighted_similarity_score: number;
    group_similarities: JobTransferTargetGroupSimilarity[];
    rows: JobTransferComparisonRow[];
  };

  type JobTransferPayload = {
    source: JobTransferSourceSnapshot;
    targets: JobTransferTargetItem[];
    comparisons: JobTransferComparisonItem[];
    meta: {
      vector_version: string;
      merged_candidate_count: number;
      shortlisted_candidate_count: number;
      selected_target_count: number;
      generated_at: string;
    };
  };

  type JobTransferResponse = {
    success?: boolean;
    data: JobTransferPayload;
  };

  type JobTransferSourceResponse = {
    success?: boolean;
    data: JobTransferSourceSnapshot;
  };

  type JobTransferTaskSummary = {
    task_id: string;
    career_id: number;
    status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
    reused_existing: boolean;
  };

  type JobTransferTaskSnapshot = {
    task_id: string;
    career_id: number;
    status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
    processed_candidates: number;
    total_candidates: number;
    payload?: JobTransferPayload;
    latest_event?: Record<string, any>;
    error_message?: string;
    cancel_requested_at?: string;
    completed_at?: string;
    updated_at: string;
  };

  type JobTransferTaskCreateResponse = {
    success?: boolean;
    data: JobTransferTaskSummary;
  };

  type JobTransferTaskSnapshotResponse = {
    success?: boolean;
    data: JobTransferTaskSnapshot;
  };

  type StudentCompetencyScorePayload = {
    completeness: number;
    competitiveness: number;
    overall: number;
  };

  type StudentCompetencyComparisonDimensionItem = {
    key: string;
    title: string;
    user_values: string[];
    market_keywords: string[];
    market_weight: number;
    normalized_weight: number;
    market_target: number;
    user_readiness: number;
    gap: number;
    presence: number;
    richness: number;
    status_label: string;
    matched_market_keywords: string[];
    missing_market_keywords: string[];
    coverage_score: number;
    alignment_score: number;
  };

  type StudentCompetencyChartSeriesItem = {
    key: string;
    title: string;
    market_importance: number;
    user_readiness: number;
  };

  type StudentCompetencyNarrativePayload = {
    overall_review: string;
    completeness_explanation: string;
    competitiveness_explanation: string;
    strength_highlights: string[];
    priority_gap_highlights: string[];
  };

  type StudentCompetencyActionAdviceItem = {
    key: string;
    title: string;
    status_label: string;
    gap: number;
    why_it_matters: string;
    current_issue: string;
    next_actions: string[];
    example_phrases: string[];
    evidence_sources: string[];
    recommended_keywords: string[];
  };

  type StudentCompetencyLatestAnalysisPayload = {
    available: boolean;
    message?: string;
    workspace_conversation_id?: string;
    profile?: Record<string, string[]>;
    score?: StudentCompetencyScorePayload;
    comparison_dimensions: StudentCompetencyComparisonDimensionItem[];
    chart_series: StudentCompetencyChartSeriesItem[];
    strength_dimensions: string[];
    priority_gap_dimensions: string[];
    recommended_keywords: Record<string, string[]>;
    action_advices: StudentCompetencyActionAdviceItem[];
    narrative?: StudentCompetencyNarrativePayload;
    updated_at?: string;
  };

  type StudentCompetencyLatestAnalysisResponse = {
    success?: boolean;
    data: StudentCompetencyLatestAnalysisPayload;
  };

  type LoginResult = {
    success?: boolean;
    status?: string;
    type?: string;
    currentAuthority?: string;
    token?: string;
    errorMessage?: string;
  };

  type PageParams = {
    current?: number;
    pageSize?: number;
  };

  type RuleListItem = {
    key?: number;
    disabled?: boolean;
    href?: string;
    avatar?: string;
    name?: string;
    owner?: string;
    desc?: string;
    callNo?: number;
    status?: number;
    updatedAt?: string;
    createdAt?: string;
    progress?: number;
  };

  type RuleList = {
    data?: RuleListItem[];
    total?: number;
    success?: boolean;
  };

  type FakeCaptcha = {
    code?: number;
    status?: string;
  };

  type LoginParams = {
    username?: string;
    password?: string;
    autoLogin?: boolean;
    type?: string;
  };

  type RegisterParams = {
    username?: string;
    password?: string;
  };

  type RegisterResult = {
    status?: string;
    currentAuthority?: string;
    success?: boolean;
    errorMessage?: string;
  };

  type ErrorResponse = {
    errorCode: string;
    errorMessage?: string;
    success?: boolean;
  };

  type NoticeIconList = {
    data?: NoticeIconItem[];
    total?: number;
    success?: boolean;
  };

  type NoticeIconItemType = 'notification' | 'message' | 'event';

  type NoticeIconItem = {
    id?: string;
    extra?: string;
    key?: string;
    read?: boolean;
    avatar?: string;
    title?: string;
    status?: string;
    datetime?: string;
    description?: string;
    type?: NoticeIconItemType;
  };

  type AdminUserItem = {
    id: number;
    username: string;
    display_name: string;
    role: string;
    avatar?: string;
    is_active: boolean;
    created_at: string;
    last_login_at?: string;
  };

  type AdminUserListResponse = {
    success?: boolean;
    data?: AdminUserItem[];
    total?: number;
  };

  type AdminUserDetailResponse = {
    success?: boolean;
    data: AdminUserItem;
  };

  type AdminProfileResponse = {
    success?: boolean;
    data: AdminUserItem;
  };

  type AdminUserQueryParams = {
    page?: number;
    page_size?: number;
    username?: string;
    role?: string;
    is_active?: boolean;
  };

  type AdminUserUpdateParams = {
    user_id: number;
    role?: string;
    is_active?: boolean;
    display_name?: string;
  };

  type AdminUserDeleteResponse = { success?: boolean };

  type AdminUserCreateParams = {
    username: string;
    password: string;
    display_name?: string;
    role?: string;
    is_active?: boolean;
  };

  type AdminProfileUpdateParams = {
    display_name?: string;
    avatar?: string;
    password?: string;
  };

  // ---- Data Dashboard ----

  type MajorDistributionItem = {
    major: string;
    count: number;
  };

  type SchoolDistributionItem = {
    school: string;
    count: number;
  };

  type EducationDistributionItem = {
    level: string;
    count: number;
  };

  type MajorDistributionResponse = {
    success?: boolean;
    total_users: number;
    profiles_completed: number;
    completion_rate: number;
    major_distribution: MajorDistributionItem[];
    school_distribution: SchoolDistributionItem[];
    education_distribution: EducationDistributionItem[];
  };

  type ScoreDistributionItem = {
    dimension: string;
    high: number;
    medium: number;
    low: number;
  };

  type TopStudentItem = {
    user_id: number;
    display_name: string;
    overall_score: number;
  };

  type CompetencyAnalysisResponse = {
    success?: boolean;
    total_assessments: number;
    average_scores: Record<string, number>;
    score_distribution: ScoreDistributionItem[];
    top_students: TopStudentItem[];
  };

  type IndustryDistributionItem = {
    industry: string;
    count: number;
  };

  type JobTitleDistributionItem = {
    job_title: string;
    count: number;
  };

  type SalaryDistribution = {
    below_15k: number;
    from_15k_to_25k: number;
    from_25k_to_35k: number;
    above_35k: number;
  };

  type EmploymentTrendsResponse = {
    success?: boolean;
    total_jobs: number;
    total_companies: number;
    industry_distribution: IndustryDistributionItem[];
    job_title_distribution: JobTitleDistributionItem[];
    salary_distribution: SalaryDistribution;
  };
}
