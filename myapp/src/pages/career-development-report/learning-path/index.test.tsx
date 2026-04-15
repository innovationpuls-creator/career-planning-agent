import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import LearningPathPage from './index';

const mockGenerateSnailLearningPath = jest.fn();
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
  generateSnailLearningPath: (...args: any[]) => mockGenerateSnailLearningPath(...args),
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

const workspace = {
  workspace_id: 'snail-workspace-1',
  favorite: {
    favorite_id: 1,
    target_key: 'frontend::internet',
    source_kind: 'custom',
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
  },
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
    {
      phase_key: 'mid_term',
      phase_label: 'Mid Term',
      time_horizon: '3-6 months',
      goal_statement: 'Turn learning into portfolio evidence',
      why_now: 'Convert study into visible projects',
      learning_modules: [
        {
          module_id: 'm2',
          topic: 'Portfolio Projects',
          learning_content: 'Organize project write-ups and breakdowns.',
          priority: 'medium',
          suggested_resource_types: [],
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
          resource_status: 'ready',
          resource_error_message: '',
        },
      ],
      practice_actions: [],
      deliverables: [],
      entry_gate: [],
      exit_gate: [],
      milestones: [],
      risk_alerts: [],
    },
    {
      phase_key: 'long_term',
      phase_label: 'Long Term',
      time_horizon: '6-12 months',
      goal_statement: 'Prepare for interviews',
      why_now: 'Consolidate for job search',
      learning_modules: [
        {
          module_id: 'm3',
          topic: 'Interview Sprint',
          learning_content: 'Prepare interview stories and project presentation.',
          priority: 'high',
          suggested_resource_types: [],
          resource_recommendations: [],
          resource_status: 'failed',
          resource_error_message: 'No Dify resources available yet',
        },
      ],
      practice_actions: [],
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

const createMemoryStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => (key in store ? store[key] : null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
  };
};

describe('LearningPathPage', () => {
  beforeEach(() => {
    const localStorageMock = createMemoryStorage();
    const sessionStorageMock = createMemoryStorage();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, configurable: true });
    window.sessionStorage.setItem('snail_pending_report', JSON.stringify(report));
    mockGenerateSnailLearningPath.mockReset();
    mockCreateSnailLearningPathReview.mockReset();
    mockListSnailLearningPathReviews.mockReset();
    mockGenerateSnailLearningPath.mockResolvedValue({ data: workspace });
    mockCreateSnailLearningPathReview.mockResolvedValue({ data: {} });
    mockListSnailLearningPathReviews.mockResolvedValue({ data: [] });
    mockHistoryPush.mockReset();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it('renders the workspace and Dify resource cards', async () => {
    render(React.createElement(LearningPathPage));

    expect(await screen.findByText('React Docs')).toBeTruthy();
    expect(screen.getByText('Frontend Engineer')).toBeTruthy();
    expect(screen.getByText('Build a small showcase page')).toBeTruthy();
  });

  it('shows skeleton while loading workspace data', async () => {
    let resolveWorkspace: ((value: { data: API.PlanWorkspacePayload }) => void) | undefined;
    mockGenerateSnailLearningPath.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWorkspace = resolve;
      }),
    );

    render(React.createElement(LearningPathPage));

    expect(screen.getByTestId('learning-path-skeleton')).toBeTruthy();

    resolveWorkspace?.({ data: workspace });
    expect(await screen.findByText('React Docs')).toBeTruthy();
  });

  it('switches phase and refreshes review scope', async () => {
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

  it('shows module-level empty state instead of fallback resources', async () => {
    render(React.createElement(LearningPathPage));

    fireEvent.click(await screen.findByText('Long Term'));

    await waitFor(() => {
      expect(screen.getByTestId('resource-empty-m3')).toBeTruthy();
    });

    expect(screen.queryByText('Coursera')).toBeNull();
  });

  it('shows empty guidance when report is missing', async () => {
    window.sessionStorage.clear();
    render(React.createElement(LearningPathPage));

    expect(await screen.findByRole('button')).toBeTruthy();
    expect(mockGenerateSnailLearningPath).not.toHaveBeenCalled();
  });
});
