import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import PersonalGrowthReportPage from './index';

const mockedUseCareerGoalPlanningData = jest.fn();
const mockedGetHomeV2 = jest.fn();
const mockedGetStudentCompetencyLatestAnalysis = jest.fn();
const mockedGetCareerDevelopmentPlanWorkspace = jest.fn();
const mockedGetPersonalGrowthReportWorkspace = jest.fn();
const mockedUpdatePersonalGrowthReportWorkspace = jest.fn();
const mockedExportPersonalGrowthReport = jest.fn();
const mockedCreatePersonalGrowthReportTask = jest.fn();
const mockedGetPersonalGrowthReportTask = jest.fn();
const mockedCancelPersonalGrowthReportTask = jest.fn();
const mockedStreamPersonalGrowthReportTask = jest.fn();
const mockedSetActionError = jest.fn();

jest.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('../shared/useCareerGoalPlanningData', () => ({
  useCareerGoalPlanningData: (...args: any[]) =>
    mockedUseCareerGoalPlanningData(...args),
}));

jest.mock('@/services/ant-design-pro/api', () => ({
  getHomeV2: (...args: any[]) => mockedGetHomeV2(...args),
  getStudentCompetencyLatestAnalysis: (...args: any[]) =>
    mockedGetStudentCompetencyLatestAnalysis(...args),
  getCareerDevelopmentPlanWorkspace: (...args: any[]) =>
    mockedGetCareerDevelopmentPlanWorkspace(...args),
  getPersonalGrowthReportWorkspace: (...args: any[]) =>
    mockedGetPersonalGrowthReportWorkspace(...args),
  updatePersonalGrowthReportWorkspace: (...args: any[]) =>
    mockedUpdatePersonalGrowthReportWorkspace(...args),
  exportPersonalGrowthReport: (...args: any[]) =>
    mockedExportPersonalGrowthReport(...args),
  createPersonalGrowthReportTask: (...args: any[]) =>
    mockedCreatePersonalGrowthReportTask(...args),
  getPersonalGrowthReportTask: (...args: any[]) =>
    mockedGetPersonalGrowthReportTask(...args),
  cancelPersonalGrowthReportTask: (...args: any[]) =>
    mockedCancelPersonalGrowthReportTask(...args),
  streamPersonalGrowthReportTask: (...args: any[]) =>
    mockedStreamPersonalGrowthReportTask(...args),
}));

const favorite = {
  favorite_id: 1,
  target_key: 'frontend::',
  source_kind: 'recommendation',
  report_id: 'career:frontend',
  target_scope: 'career',
  target_title: '前端工程师',
  canonical_job_title: '前端工程师',
  representative_job_title: '前端开发',
  industry: '互联网',
  overall_match: 76.66,
  report_snapshot: {
    comparison_dimensions: [],
    priority_gap_dimensions: [],
  },
  created_at: '2026-03-28T00:00:00Z',
  updated_at: '2026-03-28T00:00:00Z',
} as unknown as API.CareerDevelopmentFavoritePayload;

const homePayload = {
  onboarding_completed: true,
  current_stage: 'low',
  profile: {
    full_name: '测试同学',
    school: '示例大学',
    major: '软件工程',
    education_level: '本科',
    grade: '大三',
    target_job_title: '前端工程师',
  },
  attachments: [],
} as API.HomeV2Payload;

const latestAnalysis = {
  available: true,
  message: '画像可用',
  comparison_dimensions: [{ key: 'communication', title: '沟通表达' }],
  chart_series: [],
  strength_dimensions: ['沟通表达'],
  priority_gap_dimensions: ['团队协作'],
  recommended_keywords: {},
  action_advices: [],
} as unknown as API.StudentCompetencyLatestAnalysisPayload;

const goalWorkspace = {
  workspace_id: 'goal-workspace',
  favorite,
  generated_report_markdown: '# 职业规划报告',
  edited_report_markdown: '# 职业规划报告',
  workspace_overview: {
    current_phase_key: 'short_term',
    current_phase_label: '短期行动（0-3个月）',
    next_milestone_title: '',
    readiness_index: 60,
    gap_closure_index: 45,
    uses_latest_profile: true,
  },
  metric_snapshot: {
    learning_completion_rate: 0,
    practice_completion_rate: 0,
    evidence_count: 0,
    gap_closure_index: 45,
    readiness_index: 60,
    uses_latest_profile: true,
  },
  growth_plan_phases: [
    {
      phase_key: 'short_term',
      phase_label: '短期行动（0-3个月）',
      time_horizon: '0-3个月',
      goal_statement: '补齐基础',
    },
  ],
  review_framework: { metrics: [] },
  current_learning_steps: [],
  phase_flow_summary: [],
  current_action_summary: {},
  export_meta: { available_formats: ['md', 'docx', 'pdf'] },
  updated_at: '2026-03-29T00:00:00Z',
} as unknown as API.PlanWorkspacePayload;

const readyWorkspace = {
  workspace_id: 'workspace-1',
  favorite,
  generated_markdown: '# 个人职业成长报告\n\n## 自我认知\n具备基础开发能力。',
  edited_markdown:
    '# 个人职业成长报告\n\n## 自我认知\n### 关键洞察\n> 具备稳定学习习惯。\n\n- 能完成组件开发\n\n| 能力 | 状态 |\n| --- | --- |\n| 沟通 | 已具备 |\n\n## 职业方向分析\n适合前端工程方向。\n\n## 匹配度判断\n项目证据仍需补强。\n\n## 发展建议\n优先补齐项目和工程化能力。\n\n## 行动计划\n### 短期行动（0-3个月）\n- 完成一个组件化项目',
  export_meta: { available_formats: ['md', 'docx', 'pdf'] },
  content_status: 'ready',
  generation_status: 'ready',
  last_generated_at: '2026-03-29T00:00:00Z',
  last_saved_at: '2026-03-29T00:00:00Z',
  updated_at: '2026-03-29T00:00:00Z',
  sections: [
    {
      key: 'self_cognition',
      title: '自我认知',
      content:
        '### 关键洞察\n> 具备稳定学习习惯。\n\n- 能完成组件开发\n\n| 能力 | 状态 |\n| --- | --- |\n| 沟通 | 已具备 |',
      completed: true,
    },
    {
      key: 'career_direction_analysis',
      title: '职业方向分析',
      content: '适合前端工程方向。',
      completed: true,
    },
    {
      key: 'match_assessment',
      title: '匹配度判断',
      content: '项目证据仍需补强。',
      completed: true,
    },
    {
      key: 'development_suggestions',
      title: '发展建议',
      content: '优先补齐项目和工程化能力。',
      completed: true,
    },
    {
      key: 'action_plan',
      title: '行动计划',
      content: '### 短期行动（0-3个月）\n- 完成一个组件化项目',
      completed: true,
    },
  ],
} as API.PersonalGrowthReportPayload;

const emptyWorkspace = {
  ...readyWorkspace,
  generated_markdown: '',
  edited_markdown: '',
  content_status: 'insufficient',
  generation_status: 'not_started',
  sections: readyWorkspace.sections.map((section) => ({
    ...section,
    content: '',
    completed: false,
  })),
} as API.PersonalGrowthReportPayload;

async function* emptyStream() {}

async function* runningStream() {
  yield {
    stage: 'collect_match_report',
    task_id: 'task-running',
    status: 'running',
    status_text: '正在整理职业匹配结果和目标差距。',
    progress: 36,
    created_at: '2026-04-14T10:00:01Z',
  };
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: true,
      media: '',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    value: jest.fn(() => 'blob:test'),
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    value: jest.fn(),
  });
  window.HTMLAnchorElement.prototype.click = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();

  mockedUseCareerGoalPlanningData.mockReturnValue({
    activeFavorite: favorite,
    favoritesLoading: false,
    pageError: undefined,
    actionError: undefined,
    setActionError: mockedSetActionError,
  });
  mockedGetHomeV2.mockResolvedValue({ data: homePayload });
  mockedGetStudentCompetencyLatestAnalysis.mockResolvedValue({
    data: latestAnalysis,
  });
  mockedGetCareerDevelopmentPlanWorkspace.mockResolvedValue({
    data: goalWorkspace,
  });
  mockedGetPersonalGrowthReportWorkspace.mockResolvedValue({
    data: readyWorkspace,
  });
  mockedUpdatePersonalGrowthReportWorkspace.mockResolvedValue({
    data: readyWorkspace,
  });
  mockedStreamPersonalGrowthReportTask.mockReturnValue(emptyStream());
});

describe('PersonalGrowthReportPage', () => {
  it('renders the empty report hero and creates a task from the CTA', async () => {
    mockedGetPersonalGrowthReportWorkspace.mockResolvedValue({
      data: emptyWorkspace,
    });
    mockedCreatePersonalGrowthReportTask.mockResolvedValue({
      data: {
        task_id: 'task-1',
        favorite_id: 1,
        status: 'queued',
        progress: 0,
        overwrite_current: false,
        status_text: '已开始准备个人职业成长报告生成任务。',
        started_at: '2026-04-14T10:00:00Z',
        updated_at: '2026-04-14T10:00:00Z',
        can_cancel: true,
      },
    });
    mockedGetPersonalGrowthReportTask.mockResolvedValue({
      data: {
        task_id: 'task-1',
        favorite_id: 1,
        status: 'running',
        progress: 12,
        overwrite_current: false,
        latest_event: {
          stage: 'prepare_base_workspace',
          status_text: '正在准备职业规划工作台基础数据。',
          progress: 12,
          created_at: '2026-04-14T10:00:01Z',
        },
        created_at: '2026-04-14T10:00:00Z',
        updated_at: '2026-04-14T10:00:01Z',
      },
    });

    render(<PersonalGrowthReportPage />);

    expect(await screen.findByText('生成报告')).toBeTruthy();
    expect(screen.getByTestId('prerequisite-check')).toBeTruthy();

    fireEvent.click(screen.getByText('生成报告'));

    await waitFor(() =>
      expect(mockedCreatePersonalGrowthReportTask).toHaveBeenCalledWith(
        { favorite_id: 1, overwrite_current: false },
        expect.any(Object),
      ),
    );
  });

  it('shows generation progress preview and cancels a running task', async () => {
    mockedGetPersonalGrowthReportWorkspace.mockResolvedValue({
      data: {
        ...emptyWorkspace,
        active_task: {
          task_id: 'task-running',
          favorite_id: 1,
          status: 'running',
          progress: 24,
          overwrite_current: false,
          status_text: '正在收集简历解析与 12 维画像结果。',
          started_at: '2026-04-14T10:00:00Z',
          updated_at: '2026-04-14T10:00:00Z',
          can_cancel: true,
        },
      },
    });
    mockedGetPersonalGrowthReportTask.mockResolvedValue({
      data: {
        task_id: 'task-running',
        favorite_id: 1,
        status: 'running',
        progress: 24,
        overwrite_current: false,
        latest_event: {
          stage: 'collect_resume_analysis',
          status_text: '正在收集简历解析与 12 维画像结果。',
          progress: 24,
          created_at: '2026-04-14T10:00:00Z',
        },
        created_at: '2026-04-14T10:00:00Z',
        updated_at: '2026-04-14T10:00:00Z',
      },
    });
    mockedStreamPersonalGrowthReportTask.mockReturnValue(runningStream());
    mockedCancelPersonalGrowthReportTask.mockResolvedValue({
      data: {
        task_id: 'task-running',
        favorite_id: 1,
        status: 'cancelled',
        progress: 36,
        overwrite_current: false,
        latest_event: {
          stage: 'task_cancelled',
          status_text: '已取消个人职业成长报告生成。',
          progress: 36,
          created_at: '2026-04-14T10:00:02Z',
        },
        created_at: '2026-04-14T10:00:00Z',
        updated_at: '2026-04-14T10:00:02Z',
      },
    });

    render(<PersonalGrowthReportPage />);

    expect(await screen.findByTestId('generation-progress')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByText('正在整理职业匹配结果和目标差距。').length).toBeGreaterThan(0),
    );

    fireEvent.click(screen.getByText('取消'));

    await waitFor(() =>
      expect(mockedCancelPersonalGrowthReportTask).toHaveBeenCalledWith(
        'task-running',
        expect.any(Object),
      ),
    );
  });

  it('renders chapter navigation, mobile selector, and markdown content', async () => {
    render(<PersonalGrowthReportPage />);

    const nav = await screen.findByTestId('chapter-nav');
    expect(screen.getByTestId('chapter-nav-select')).toBeTruthy();
    expect(screen.getByText('关键洞察')).toBeTruthy();
    expect(screen.getByText('具备稳定学习习惯。')).toBeTruthy();
    expect(screen.getByText('能力')).toBeTruthy();

    const buttons = nav.querySelectorAll('button');
    const careerButton = Array.from(buttons).find((button) =>
      button.textContent?.includes('职业方向分析'),
    )!;
    fireEvent.click(careerButton);

    expect(careerButton.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('适合前端工程方向。')).toBeTruthy();
  });

  it('marks dirty after rich text editing and saves the report', async () => {
    const { container } = render(<PersonalGrowthReportPage />);
    await screen.findByTestId('chapter-content');

    fireEvent.click(screen.getByText('编辑本章'));

    const tiptap = container.querySelector('.tiptap') as HTMLElement;
    expect(tiptap).toBeTruthy();
    fireEvent.click(tiptap);
    tiptap.innerHTML = '<p>新的自我认知内容</p>';
    fireEvent.input(tiptap);

    expect(await screen.findByText('有未保存的更改')).toBeTruthy();

    fireEvent.click(screen.getByText('保存报告'));

    await waitFor(() => {
      expect(mockedUpdatePersonalGrowthReportWorkspace).toHaveBeenCalled();
    });
  });

  it('saves the current report from editor even when no local draft is dirty', async () => {
    render(<PersonalGrowthReportPage />);
    await screen.findByTestId('chapter-content');

    fireEvent.click(screen.getByText('编辑本章'));
    const saveButton = await screen.findByRole('button', { name: /保存报告/ });
    expect(saveButton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockedUpdatePersonalGrowthReportWorkspace).toHaveBeenCalled();
    });
  });

  it('restores the structure template after local edits', async () => {
    const { container } = render(<PersonalGrowthReportPage />);
    await screen.findByTestId('chapter-content');

    fireEvent.click(screen.getByText('编辑本章'));
    const tiptap = container.querySelector('.tiptap') as HTMLElement;
    fireEvent.click(tiptap);
    tiptap.innerHTML = '<p>临时改动</p>';
    fireEvent.input(tiptap);

    fireEvent.click(screen.getByText('恢复结构模板'));

    expect(await screen.findByText('有未保存的更改')).toBeTruthy();
    expect(
      await screen.findByText('围绕兴趣、优势、性格、能力特点展开。'),
    ).toBeTruthy();
  });

  it('exports Word and PDF from the hero actions', async () => {
    mockedExportPersonalGrowthReport.mockResolvedValue({
      blob: new Blob(['test'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      filename: 'test.docx',
    });

    render(<PersonalGrowthReportPage />);
    await screen.findByTestId('chapter-content');

    fireEvent.click(screen.getByText('导出 Word'));
    await waitFor(() =>
      expect(mockedExportPersonalGrowthReport).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ format: 'docx' }),
      ),
    );

    fireEvent.click(screen.getByText('导出 PDF'));
    await waitFor(() =>
      expect(mockedExportPersonalGrowthReport).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ format: 'pdf' }),
      ),
    );
  });

  it('creates a regenerate task with overwrite_current when report exists', async () => {
    mockedCreatePersonalGrowthReportTask.mockResolvedValue({
      data: {
        task_id: 'task-regenerate',
        favorite_id: 1,
        status: 'queued',
        progress: 0,
        overwrite_current: true,
        status_text: '已开始准备个人职业成长报告生成任务。',
        started_at: '2026-04-14T10:00:00Z',
        updated_at: '2026-04-14T10:00:00Z',
        can_cancel: true,
      },
    });
    mockedGetPersonalGrowthReportTask.mockResolvedValue({
      data: {
        task_id: 'task-regenerate',
        favorite_id: 1,
        status: 'running',
        progress: 5,
        overwrite_current: true,
        latest_event: {
          stage: 'queued',
          status_text: '已开始准备个人职业成长报告生成任务。',
          progress: 5,
          created_at: '2026-04-14T10:00:00Z',
        },
        created_at: '2026-04-14T10:00:00Z',
        updated_at: '2026-04-14T10:00:00Z',
      },
    });

    render(<PersonalGrowthReportPage />);
    await screen.findByTestId('chapter-content');

    fireEvent.click(screen.getByText('重新生成'));

    await waitFor(() =>
      expect(mockedCreatePersonalGrowthReportTask).toHaveBeenCalledWith(
        { favorite_id: 1, overwrite_current: true },
        expect.any(Object),
      ),
    );
  });
});
