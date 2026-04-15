import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import LearningPathPage from './index';

const mockGetCareerDevelopmentFavorites = jest.fn();
const mockGetHomeV2 = jest.fn();
const mockGetStudentCompetencyLatestAnalysis = jest.fn();
const mockInitializeSnailLearningPathWorkspace = jest.fn();
const mockGetCareerDevelopmentPlanWorkspace = jest.fn();
const mockCreateSnailLearningPathReview = jest.fn();
const mockListSnailLearningPathReviews = jest.fn();
const mockHistoryPush = jest.fn();

jest.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: any) => require('react').createElement('div', null, children),
}));

jest.mock('@umijs/max', () => ({
  history: {
    push: (...args: any[]) => mockHistoryPush(...args),
  },
}));

jest.mock('@/services/ant-design-pro/api', () => ({
  getCareerDevelopmentFavorites: (...args: any[]) => mockGetCareerDevelopmentFavorites(...args),
  getHomeV2: (...args: any[]) => mockGetHomeV2(...args),
  getStudentCompetencyLatestAnalysis: (...args: any[]) => mockGetStudentCompetencyLatestAnalysis(...args),
  initializeSnailLearningPathWorkspace: (...args: any[]) => mockInitializeSnailLearningPathWorkspace(...args),
  getCareerDevelopmentPlanWorkspace: (...args: any[]) => mockGetCareerDevelopmentPlanWorkspace(...args),
  createSnailLearningPathReview: (...args: any[]) => mockCreateSnailLearningPathReview(...args),
  listSnailLearningPathReviews: (...args: any[]) => mockListSnailLearningPathReviews(...args),
}));

const report = {
  report_id: 'career:frontend',
  target_scope: 'career',
  target_title: 'Frontend Engineer',
  canonical_job_title: 'Frontend Engineer',
  representative_job_title: 'Frontend Developer',
  industry: 'Internet',
  overall_match: 82,
  strength_dimension_count: 1,
  priority_gap_dimension_count: 2,
  group_summaries: [],
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: ['frontend', 'communication'],
  action_advices: [],
  evidence_cards: [],
  narrative: {
    overall_review: '',
    completeness_explanation: '',
    competitiveness_explanation: '',
    strength_highlights: [],
    priority_gap_highlights: [],
  },
} as API.CareerDevelopmentMatchReport;

const favorite = {
  favorite_id: 1,
  target_key: 'frontend::internet',
  source_kind: 'recommendation',
  report_id: report.report_id,
  target_scope: report.target_scope,
  target_title: report.target_title,
  canonical_job_title: report.canonical_job_title,
  representative_job_title: report.representative_job_title,
  industry: report.industry,
  overall_match: report.overall_match,
  report_snapshot: report,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
} as API.CareerDevelopmentFavoritePayload;

const workspace = {
  workspace_id: 'snail-workspace-1',
  favorite,
  generated_report_markdown: '',
  edited_report_markdown: '',
  workspace_overview: {
    current_phase_key: 'short_term',
    current_phase_label: 'Short Term',
    next_milestone_title: 'Build fundamentals',
    readiness_index: 42,
    latest_review_summary: '',
    gap_closure_index: 15,
    uses_latest_profile: true,
  },
  metric_snapshot: {
    learning_completion_rate: 0,
    practice_completion_rate: 0,
    evidence_count: 0,
    gap_closure_index: 15,
    readiness_index: 42,
    uses_latest_profile: true,
  },
  growth_plan_phases: [
    {
      phase_key: 'short_term',
      phase_label: 'Short Term',
      time_horizon: '1-3 months',
      goal_statement: 'Build React fundamentals',
      why_now: 'Close the biggest gaps first',
      learning_modules: [
        {
          module_id: 'm1',
          topic: 'React Basics',
          learning_content: 'Learn components and state management.',
          priority: 'high',
          suggested_resource_types: [],
          resource_recommendations: [
            {
              title: 'React Docs',
              url: 'https://react.dev/learn',
              reason: 'Official React learning path',
              step_label: 'Finish the official basics section',
              why_first: 'This is the most direct foundation.',
              expected_output: 'Build a small stateful component.',
            },
          ],
          resource_status: 'ready',
          resource_error_message: '',
        },
      ],
      practice_actions: [
        {
          action_type: 'project',
          title: 'Build a small showcase page',
          description: 'Ship one visible frontend demo.',
          priority: 'high',
        },
      ],
      deliverables: [],
      entry_gate: [],
      exit_gate: [],
      milestones: [],
      risk_alerts: [],
    },
  ],
  review_framework: {
    weekly_review_cycle: 'weekly',
    monthly_review_cycle: 'monthly',
    metrics: [],
  },
  latest_integrity_check: undefined,
  latest_review: undefined,
  export_meta: {
    available_formats: ['md'],
  },
  current_learning_steps: [],
  phase_flow_summary: [],
  current_action_summary: {
    current_phase_key: 'short_term',
    current_phase_label: 'Short Term',
    headline: '',
    support_text: '',
    audit_summary: '',
  },
  updated_at: '2026-04-01T00:00:00Z',
} as API.PlanWorkspacePayload;

describe('LearningPathPage', () => {
  beforeEach(() => {
    mockGetCareerDevelopmentFavorites.mockReset();
    mockGetHomeV2.mockReset();
    mockGetStudentCompetencyLatestAnalysis.mockReset();
    mockInitializeSnailLearningPathWorkspace.mockReset();
    mockGetCareerDevelopmentPlanWorkspace.mockReset();
    mockCreateSnailLearningPathReview.mockReset();
    mockListSnailLearningPathReviews.mockReset();
    mockHistoryPush.mockReset();
    mockGetHomeV2.mockResolvedValue({ data: { onboarding_completed: true, profile: { full_name: 'A' } } });
    mockGetStudentCompetencyLatestAnalysis.mockResolvedValue({ data: { available: true, comparison_dimensions: [], chart_series: [], strength_dimensions: [], priority_gap_dimensions: [], recommended_keywords: {}, action_advices: [] } });
    mockGetCareerDevelopmentFavorites.mockResolvedValue({ data: [favorite] });
    mockInitializeSnailLearningPathWorkspace.mockResolvedValue({ data: workspace });
    mockGetCareerDevelopmentPlanWorkspace.mockResolvedValue({ data: workspace });
    mockCreateSnailLearningPathReview.mockResolvedValue({ data: {} });
    mockListSnailLearningPathReviews.mockResolvedValue({ data: [] });
    window.history.pushState({}, '', '/snail-learning-path?favorite_id=1');
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it('renders saved workspace for the selected favorite', async () => {
    render(React.createElement(LearningPathPage));

    expect(await screen.findByText('React Docs')).toBeTruthy();
    expect(screen.getByText('Frontend Engineer')).toBeTruthy();
    expect(mockGetCareerDevelopmentPlanWorkspace).toHaveBeenCalledWith(1, expect.any(Object));
    expect(mockInitializeSnailLearningPathWorkspace).not.toHaveBeenCalled();
  });

  it('shows skeleton while loading workspace data', async () => {
    let resolveWorkspace: ((value: { data: API.PlanWorkspacePayload }) => void) | undefined;
    mockGetCareerDevelopmentPlanWorkspace.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWorkspace = resolve;
      }),
    );

    render(React.createElement(LearningPathPage));
    expect(screen.getByTestId('learning-path-skeleton')).toBeTruthy();

    resolveWorkspace?.({ data: workspace });
    expect(await screen.findByText('React Docs')).toBeTruthy();
  });

  it('initializes workspace by favorite id when saved workspace is missing', async () => {
    mockGetCareerDevelopmentPlanWorkspace.mockRejectedValueOnce({ response: { status: 404 }, message: '404' });

    render(React.createElement(LearningPathPage));

    expect(await screen.findByText('React Docs')).toBeTruthy();
    expect(mockInitializeSnailLearningPathWorkspace).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it('shows guidance when favorite id is missing', async () => {
    window.history.pushState({}, '', '/snail-learning-path');

    render(React.createElement(LearningPathPage));

    await waitFor(() => {
      expect(mockGetHomeV2).toHaveBeenCalled();
    });
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    expect(mockInitializeSnailLearningPathWorkspace).not.toHaveBeenCalled();
    expect(mockGetCareerDevelopmentPlanWorkspace).not.toHaveBeenCalled();
  });

  it('shows prerequisite guidance when latest analysis is missing', async () => {
    mockGetStudentCompetencyLatestAnalysis.mockResolvedValueOnce({ data: { available: false, comparison_dimensions: [], chart_series: [], strength_dimensions: [], priority_gap_dimensions: [], recommended_keywords: {}, action_advices: [] } });

    render(React.createElement(LearningPathPage));

    await waitFor(() => {
      expect(mockGetStudentCompetencyLatestAnalysis).toHaveBeenCalled();
    });
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    expect(mockInitializeSnailLearningPathWorkspace).not.toHaveBeenCalled();
  });

  it('switches phase and refreshes review scope', async () => {
    const multiPhaseWorkspace = {
      ...workspace,
      growth_plan_phases: [
        workspace.growth_plan_phases[0],
        {
          ...workspace.growth_plan_phases[0],
          phase_key: 'mid_term',
          phase_label: 'Mid Term',
          learning_modules: [
            {
              ...workspace.growth_plan_phases[0].learning_modules[0],
              module_id: 'm2',
              topic: 'Portfolio Projects',
              resource_recommendations: [
                {
                  title: 'Frontend Mentor',
                  url: 'https://www.frontendmentor.io/',
                  reason: 'Real project practice',
                  step_label: 'Complete one challenge',
                  why_first: 'Close to real-world task structure.',
                  expected_output: 'Ship one portfolio-ready project.',
                },
              ],
            },
          ],
        },
      ],
    } as API.PlanWorkspacePayload;
    mockGetCareerDevelopmentPlanWorkspace.mockResolvedValueOnce({ data: multiPhaseWorkspace });

    render(React.createElement(LearningPathPage));

    expect(await screen.findByText('Build a small showcase page')).toBeTruthy();
    fireEvent.click(screen.getByText('Mid Term'));

    await waitFor(() => {
      expect(screen.getByText('Frontend Mentor')).toBeTruthy();
    });

    expect(mockListSnailLearningPathReviews).toHaveBeenCalledWith(
      'snail-workspace-1',
      expect.objectContaining({ phase_key: 'mid_term' }),
      expect.any(Object),
    );
  });
});
