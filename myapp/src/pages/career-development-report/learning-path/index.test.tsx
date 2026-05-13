import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
  PageContainer: ({ children }: any) =>
    require('react').createElement('div', null, children),
  ProCard: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@umijs/max', () => ({
  history: {
    push: (...args: any[]) => mockHistoryPush(...args),
  },
}));

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: any[]) => args.filter(Boolean).join(' '),
    styles: {},
  }),
}));

jest.mock('@/services/ant-design-pro/api', () => ({
  getCareerDevelopmentFavorites: (...args: any[]) =>
    mockGetCareerDevelopmentFavorites(...args),
  getHomeV2: (...args: any[]) => mockGetHomeV2(...args),
  getStudentCompetencyLatestAnalysis: (...args: any[]) =>
    mockGetStudentCompetencyLatestAnalysis(...args),
  initializeSnailLearningPathWorkspace: (...args: any[]) =>
    mockInitializeSnailLearningPathWorkspace(...args),
  getCareerDevelopmentPlanWorkspace: (...args: any[]) =>
    mockGetCareerDevelopmentPlanWorkspace(...args),
  createSnailLearningPathReview: (...args: any[]) =>
    mockCreateSnailLearningPathReview(...args),
  listSnailLearningPathReviews: (...args: any[]) =>
    mockListSnailLearningPathReviews(...args),
}));

// ── Sub-component mocks ──────────────────────────────────────────────────────
jest.mock('@/components/ui/FadeInWhenVisible', () => ({
  FadeInWhenVisible: ({ children }: any) => children ?? null,
}));

jest.mock('./components/PhaseTimeline', () => ({
  PhaseTimeline: ({ phases, onPhaseChange }: any) => (
    <div data-testid="phase-timeline">
      {phases?.map((phase: any) => (
        <button
          type="button"
          key={phase.phase_key}
          data-testid={`phase-btn-${phase.phase_key}`}
          onClick={() => onPhaseChange(phases.indexOf(phase))}
        >
          {phase.phase_label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('./components/ModuleList', () => ({
  ModuleList: ({ modules, practiceActions, onModuleComplete }: any) => (
    <div data-testid="module-list">
      {modules?.map((module: any, idx: number) => (
        <div key={module.module_id} data-testid={`module-${idx}`}>
          <span>{module.topic}</span>
          {practiceActions && practiceActions.length > 0 && idx === 0 && (
            <div data-testid="practice-actions">
              {practiceActions.map((action: any) => (
                <div key={action.title}>{action.title}</div>
              ))}
            </div>
          )}
          <input
            type="checkbox"
            aria-label="标记完成"
            onChange={(e: any) =>
              onModuleComplete(module.module_id, e.target.checked)
            }
          />
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./components/ResourceCards', () => ({
  ResourceCards: ({ resources, onResourceDetail }: any) => (
    <div data-testid="resource-cards">
      {resources?.map((resource: any, idx: number) => (
        <div key={resource.url || resource.title}>
          <span data-testid={`resource-title-${idx}`}>{resource.title}</span>
          <img alt={resource.logoAlt} src={resource.logoUrl} />
          <button
            type="button"
            data-testid="resource-detail-trigger"
            onClick={() => onResourceDetail(idx)}
          >
            详情
          </button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./components/ResourceDetail', () => ({
  ResourceDetail: ({ resource, open, onClose, onCheckToggle, checked }: any) =>
    open ? (
      <div data-testid="resource-detail-drawer">
        <div>{resource?.title}</div>
        <div data-testid="detail-whyLearn">
          <span>为什么学这条资源？</span>
          <span>{resource?.whyLearn}</span>
        </div>
        <div data-testid="detail-learnWhat">
          <span>学习内容</span>
          <span>{resource?.learnWhat}</span>
        </div>
        <div data-testid="detail-doneWhen">
          <span>完成后你能做到</span>
          <span>{resource?.doneWhen}</span>
        </div>
        <div data-testid="detail-status">{checked ? '已完成' : '未完成'}</div>
        <input
          type="checkbox"
          aria-label="已打卡"
          checked={checked}
          onChange={onCheckToggle}
        />
        <a href={resource?.url} target="_blank" rel="noopener">
          去学习 →
        </a>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    ) : null,
}));

jest.mock('./components/ReviewPanel', () => ({
  ReviewPanel: ({ activeReviewType }: any) => (
    <div data-testid="review-panel">ReviewPanel:{activeReviewType}</div>
  ),
}));

jest.mock('./components/PathHero', () => ({
  PathHero: ({
    currentPhaseLabel,
    matchPercent,
    contentCompletion,
    practiceCompletion,
    currentModuleName,
  }: any) => (
    <div data-testid="path-hero">
      <span data-testid="hero-phase">{currentPhaseLabel}</span>
      <span data-testid="hero-match">{matchPercent}%</span>
      <span data-testid="hero-content-completion">{contentCompletion}</span>
      <span data-testid="hero-practice-completion">{practiceCompletion}</span>
      {currentModuleName && (
        <span data-testid="hero-module">{currentModuleName}</span>
      )}
    </div>
  ),
}));

jest.mock('./hooks/useWorkspace', () => ({
  useWorkspace: jest.fn(),
}));

jest.mock('./hooks/useModuleProgress', () => ({
  useModuleProgress: jest.fn(),
}));

jest.mock('./hooks/useReviews', () => ({
  useReviews: jest.fn(),
}));

// ── Shared test data ──────────────────────────────────────────────────────────
const report = {
  report_id: 'career:frontend',
  target_scope: 'career',
  target_title: 'Frontend Engineer',
  canonical_job_title: 'Frontend Engineer',
  representative_job_title: 'Frontend Developer',
  industry: 'Internet',
  overall_match: 87,
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
              logo_url: '/static/resource-logos/react-docs.png',
              logo_alt: 'React Docs logo',
              logo_source: 'local',
            },
          ],
          resource_status: 'ready',
          resource_error_message: '',
        },
        {
          module_id: 'm2',
          topic: 'TypeScript Basics',
          learning_content: 'Learn type annotations and interfaces.',
          priority: 'medium',
          suggested_resource_types: [],
          resource_recommendations: [
            {
              title: 'TypeScript Handbook',
              url: 'https://www.typescriptlang.org/docs/',
              reason: 'Official TypeScript learning material',
              step_label: 'Finish the everyday types section',
              why_first: 'Types are required for stable frontend work.',
              expected_output: 'Annotate a small React component.',
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

function buildMockModules(workspaceData: typeof workspace) {
  const firstPhase = workspaceData.growth_plan_phases[0];
  const firstModule = firstPhase.learning_modules[0];
  return [
    {
      ...firstModule,
      status: { total: 1, completed: 0, done: false },
    },
  ];
}

function setupWorkspaceMocks(
  overrides: Partial<{
    loading: boolean;
    hasFavorite: boolean;
    hasProfile: boolean;
    hasLatestAnalysis: boolean;
    hasWorkspace: boolean;
    error: string | undefined;
  }> = {},
) {
  const { useWorkspace } = jest.requireMock('./hooks/useWorkspace');
  const { useModuleProgress } = jest.requireMock('./hooks/useModuleProgress');
  const { useReviews } = jest.requireMock('./hooks/useReviews');

  useWorkspace.mockReturnValue({
    workspace,
    loading: false,
    error: undefined,
    preparation: {
      hasFavorite: true,
      hasProfile: true,
      hasLatestAnalysis: true,
      hasWorkspace: true,
      ...overrides,
    },
    refresh: jest.fn(),
  });

  useModuleProgress.mockReturnValue({
    modules: buildMockModules(workspace),
    currentModule: workspace.growth_plan_phases[0].learning_modules[0],
    selectedModuleId: 'm1',
    setSelectedModuleId: jest.fn(),
    resourceCompletedSet: new Set(),
    toggleResourceComplete: jest.fn(),
    toggleModuleComplete: jest.fn(),
    submitProgress: jest.fn(),
  });

  useReviews.mockReturnValue({
    reviews: [],
    loading: false,
    submittingType: undefined,
    submitReview: jest.fn(),
  });
}

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
    window.localStorage.clear();
    mockGetHomeV2.mockResolvedValue({
      data: { onboarding_completed: true, profile: { full_name: 'A' } },
    });
    mockGetStudentCompetencyLatestAnalysis.mockResolvedValue({
      data: {
        available: true,
        comparison_dimensions: [],
        chart_series: [],
        strength_dimensions: [],
        priority_gap_dimensions: [],
        recommended_keywords: {},
        action_advices: [],
      },
    });
    mockGetCareerDevelopmentFavorites.mockResolvedValue({ data: [favorite] });
    mockInitializeSnailLearningPathWorkspace.mockResolvedValue({
      data: workspace,
    });
    mockGetCareerDevelopmentPlanWorkspace.mockResolvedValue({
      data: workspace,
    });
    mockCreateSnailLearningPathReview.mockResolvedValue({ data: {} });
    mockListSnailLearningPathReviews.mockResolvedValue({ data: [] });
    window.history.pushState({}, '', '/snail-learning-path?favorite_id=1');
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    setupWorkspaceMocks();
  });

  it('renders saved workspace for the selected favorite', async () => {
    render(React.createElement(LearningPathPage));

    expect(await screen.findByText('React Docs')).toBeTruthy();
    expect(screen.getByAltText('React Docs logo')).toBeTruthy();
    expect(screen.getAllByText('Frontend Engineer').length).toBeGreaterThan(0);
  });

  it('displays hero metrics for the active phase', async () => {
    render(React.createElement(LearningPathPage));

    const hero = await screen.findByTestId('path-hero');
    expect(within(hero).getByTestId('hero-phase').textContent).toBe(
      'Short Term',
    );
    expect(within(hero).getByTestId('hero-match').textContent).toBe('87%');
    expect(
      within(hero).getByTestId('hero-content-completion').textContent,
    ).toBe('0');
    expect(
      within(hero).getByTestId('hero-practice-completion').textContent,
    ).toBe('0');
  });

  it('moves header review shortcuts to the matching review panel tab', async () => {
    const { useModuleProgress } = jest.requireMock('./hooks/useModuleProgress');
    const submitProgress = jest.fn();
    useModuleProgress.mockReturnValue({
      modules: buildMockModules(workspace),
      currentModule: workspace.growth_plan_phases[0].learning_modules[0],
      selectedModuleId: 'm1',
      setSelectedModuleId: jest.fn(),
      resourceCompletedSet: new Set(),
      toggleResourceComplete: jest.fn(),
      toggleModuleComplete: jest.fn(),
      submitProgress,
    });

    render(React.createElement(LearningPathPage));

    fireEvent.click(await screen.findByRole('button', { name: '月检查' }));
    expect(screen.getByTestId('review-panel').textContent).toContain('monthly');
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '周检查' }));
    expect(screen.getByTestId('review-panel').textContent).toContain('weekly');
    expect(submitProgress).not.toHaveBeenCalled();
  });

  it('routes edit plan to personal growth report workspace', async () => {
    render(React.createElement(LearningPathPage));

    fireEvent.click(await screen.findByRole('button', { name: '编辑计划' }));
    expect(mockHistoryPush).toHaveBeenCalledWith(
      '/personal-growth-report?favorite_id=1',
    );
  });

  it('opens detail drawer when detail trigger is clicked', async () => {
    render(React.createElement(LearningPathPage));

    const resourceCard = await screen.findByText('React Docs');
    expect(resourceCard).toBeTruthy();

    const detailTrigger = screen.getByTestId('resource-detail-trigger');
    await fireEvent.click(detailTrigger);

    const drawer = await screen.findByTestId('resource-detail-drawer');
    expect(within(drawer).getAllByText('React Docs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('React Basics').length).toBeGreaterThan(0);
  });

  it('detail drawer shows whyLearn, learnWhat, and doneWhen', async () => {
    render(React.createElement(LearningPathPage));

    const detailTrigger = await screen.findByTestId('resource-detail-trigger');
    await fireEvent.click(detailTrigger);

    const drawer = await screen.findByTestId('resource-detail-drawer');
    expect(within(drawer).getByText('为什么学这条资源？')).toBeTruthy();
    expect(
      within(drawer).getByText('This is the most direct foundation.'),
    ).toBeTruthy();
    expect(within(drawer).getByText('学习内容')).toBeTruthy();
    expect(
      within(drawer).getByText('Finish the official basics section'),
    ).toBeTruthy();
    expect(within(drawer).getByText('完成后你能做到')).toBeTruthy();
    expect(
      within(drawer).getByText('Build a small stateful component.'),
    ).toBeTruthy();
  });

  it('detail drawer shows unchecked state initially', async () => {
    render(React.createElement(LearningPathPage));

    const detailTrigger = await screen.findByTestId('resource-detail-trigger');
    await fireEvent.click(detailTrigger);

    const drawer = await screen.findByTestId('resource-detail-drawer');
    expect(within(drawer).getByText('未完成')).toBeTruthy();
    expect(
      (within(drawer).getByLabelText('已打卡') as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('study button in drawer links to correct resource URL', async () => {
    render(React.createElement(LearningPathPage));

    const detailTrigger = await screen.findByTestId('resource-detail-trigger');
    await fireEvent.click(detailTrigger);
    const drawer = await screen.findByTestId('resource-detail-drawer');

    const studyButton = within(drawer).getByRole('link', {
      name: /去学习/,
    });
    expect(studyButton).toBeTruthy();
    expect(studyButton.getAttribute('href')).toBe('https://react.dev/learn');
    expect(studyButton.getAttribute('target')).toBe('_blank');
  });

  it('shows skeleton while loading workspace data', async () => {
    const { useWorkspace } = jest.requireMock('./hooks/useWorkspace');
    const { useModuleProgress } = jest.requireMock('./hooks/useModuleProgress');
    const { useReviews } = jest.requireMock('./hooks/useReviews');

    // Override to loading state
    useWorkspace.mockReturnValue({
      workspace: undefined,
      loading: true,
      error: undefined,
      preparation: {
        hasFavorite: true,
        hasProfile: true,
        hasLatestAnalysis: true,
        hasWorkspace: true,
      },
      refresh: jest.fn(),
    });
    useModuleProgress.mockReturnValue({
      modules: [],
      currentModule: undefined,
      selectedModuleId: undefined,
      setSelectedModuleId: jest.fn(),
      resourceCompletedSet: new Set(),
      toggleResourceComplete: jest.fn(),
      toggleModuleComplete: jest.fn(),
      submitProgress: jest.fn(),
    });
    useReviews.mockReturnValue({
      reviews: [],
      loading: false,
      submittingType: undefined,
      submitReview: jest.fn(),
    });

    render(React.createElement(LearningPathPage));
    expect(screen.getByTestId('learning-path-skeleton')).toBeTruthy();
  });

  it('shows guidance when favorite id is missing', async () => {
    const { useWorkspace } = jest.requireMock('./hooks/useWorkspace');
    useWorkspace.mockReturnValue({
      workspace: undefined,
      loading: false,
      error: undefined,
      preparation: {
        hasFavorite: false,
        hasProfile: true,
        hasLatestAnalysis: true,
        hasWorkspace: false,
      },
      refresh: jest.fn(),
    });

    window.history.pushState({}, '', '/snail-learning-path');

    render(React.createElement(LearningPathPage));

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });

  it('shows guidance when latest analysis is missing', async () => {
    const { useWorkspace } = jest.requireMock('./hooks/useWorkspace');
    useWorkspace.mockReturnValue({
      workspace: undefined,
      loading: false,
      error: undefined,
      preparation: {
        hasFavorite: true,
        hasProfile: true,
        hasLatestAnalysis: false,
        hasWorkspace: false,
      },
      refresh: jest.fn(),
    });

    render(React.createElement(LearningPathPage));

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });

  it('switches phase and updates displayed content', async () => {
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

    const { useWorkspace } = jest.requireMock('./hooks/useWorkspace');
    const { useModuleProgress } = jest.requireMock('./hooks/useModuleProgress');

    useWorkspace.mockReturnValue({
      workspace: multiPhaseWorkspace,
      loading: false,
      error: undefined,
      preparation: {
        hasFavorite: true,
        hasProfile: true,
        hasLatestAnalysis: true,
        hasWorkspace: true,
      },
      refresh: jest.fn(),
    });
    // Capture the workspaceRef so the mock uses the multi-phase workspace
    const workspaceRef = multiPhaseWorkspace;
    useModuleProgress.mockImplementation((_phases: any, phaseKey: string) => ({
      modules: buildMockModules(workspaceRef).map((m) => ({
        ...m,
        ...(phaseKey === 'mid_term'
          ? {
              ...workspaceRef.growth_plan_phases[1].learning_modules[0],
              status: { total: 1, completed: 0, done: false },
            }
          : {}),
      })),
      currentModule:
        workspaceRef.growth_plan_phases[phaseKey === 'mid_term' ? 1 : 0]
          .learning_modules[0],
      selectedModuleId: phaseKey === 'mid_term' ? 'm2' : 'm1',
      setSelectedModuleId: jest.fn(),
      resourceCompletedSet: new Set(),
      toggleResourceComplete: jest.fn(),
      toggleModuleComplete: jest.fn(),
      submitProgress: jest.fn(),
    }));

    render(React.createElement(LearningPathPage));

    expect(await screen.findByText('Build a small showcase page')).toBeTruthy();

    const midTermBtn = await screen.findByText('Mid Term');
    await fireEvent.click(midTermBtn);

    await waitFor(() => {
      expect(screen.getByText('Frontend Mentor')).toBeTruthy();
    });
  });
});
