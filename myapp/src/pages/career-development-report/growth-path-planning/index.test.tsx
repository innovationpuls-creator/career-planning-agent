import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message, Modal } from 'antd';
import * as React from 'react';
import JobGoalSettingPathPlanningPage from './index';

const mockedHistoryPush = jest.fn();
const mockedGetCareerDevelopmentFavorites = jest.fn();
const mockedGetCareerDevelopmentPlanWorkspace = jest.fn();
const mockedUpdateCareerDevelopmentPlanWorkspace = jest.fn();
const mockedPolishCareerDevelopmentPlanWorkspace = jest.fn();
const mockedIntegrityCheckCareerDevelopmentPlanWorkspace = jest.fn();
const mockedCreateCareerDevelopmentPlanWorkspaceReview = jest.fn();
const mockedExportCareerDevelopmentPlanWorkspace = jest.fn();
const mockedDeleteCareerDevelopmentFavorite = jest.fn();
const mockedCreateCareerDevelopmentGoalPlanTask = jest.fn();
const mockedGetCareerDevelopmentGoalPlanTask = jest.fn();
const mockedStreamCareerDevelopmentGoalPlanTask = jest.fn();
const mockedSubmitCareerDevelopmentPlanMilestone = jest.fn();

jest.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@umijs/max', () => ({
  history: {
    push: (...args: any[]) => mockedHistoryPush(...args),
  },
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: any) =>
    require('react').createElement('div', { 'data-testid': 'markdown-renderer' }, children),
}));

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => undefined,
}));

jest.mock('@/services/ant-design-pro/api', () => ({
  getCareerDevelopmentFavorites: (...args: any[]) => mockedGetCareerDevelopmentFavorites(...args),
  getCareerDevelopmentPlanWorkspace: (...args: any[]) =>
    mockedGetCareerDevelopmentPlanWorkspace(...args),
  updateCareerDevelopmentPlanWorkspace: (...args: any[]) =>
    mockedUpdateCareerDevelopmentPlanWorkspace(...args),
  polishCareerDevelopmentPlanWorkspace: (...args: any[]) =>
    mockedPolishCareerDevelopmentPlanWorkspace(...args),
  integrityCheckCareerDevelopmentPlanWorkspace: (...args: any[]) =>
    mockedIntegrityCheckCareerDevelopmentPlanWorkspace(...args),
  createCareerDevelopmentPlanWorkspaceReview: (...args: any[]) =>
    mockedCreateCareerDevelopmentPlanWorkspaceReview(...args),
  exportCareerDevelopmentPlanWorkspace: (...args: any[]) =>
    mockedExportCareerDevelopmentPlanWorkspace(...args),
  deleteCareerDevelopmentFavorite: (...args: any[]) =>
    mockedDeleteCareerDevelopmentFavorite(...args),
  createCareerDevelopmentGoalPlanTask: (...args: any[]) =>
    mockedCreateCareerDevelopmentGoalPlanTask(...args),
  getCareerDevelopmentGoalPlanTask: (...args: any[]) =>
    mockedGetCareerDevelopmentGoalPlanTask(...args),
  streamCareerDevelopmentGoalPlanTask: (...args: any[]) =>
    mockedStreamCareerDevelopmentGoalPlanTask(...args),
  submitCareerDevelopmentPlanMilestone: (...args: any[]) =>
    mockedSubmitCareerDevelopmentPlanMilestone(...args),
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

const buildPhase = (
  phase_key: API.GrowthPlanPhase['phase_key'],
  phase_label: string,
): API.GrowthPlanPhase => ({
  phase_key,
  phase_label,
  time_horizon:
    phase_key === 'short_term' ? '0-3 个月' : phase_key === 'mid_term' ? '3-9 个月' : '9-24 个月',
  goal_statement: `${phase_label}目标`,
  why_now: `${phase_label}原因`,
  learning_modules: [
    {
      module_id: `${phase_key}-module-1`,
      topic: `${phase_label}学习模块`,
      learning_content: `${phase_label}学习内容`,
      priority: 'high',
      suggested_resource_types: ['课程'],
      resource_recommendations: [],
      resource_status: 'idle',
      resource_error_message: '',
    },
  ],
  practice_actions: [
    {
      action_type: 'project',
      title: `${phase_label}项目`,
      description: `${phase_label}实践安排`,
      priority: 'high',
    },
  ],
  deliverables: [`${phase_label}成果物`],
  entry_gate: [`${phase_label}进入门槛`],
  exit_gate: [`${phase_label}退出门槛`],
  milestones: [
    {
      milestone_id: `${phase_key}-learning-1`,
      title: `${phase_label}里程碑`,
      category: 'learning',
      related_learning_module_id: `${phase_key}-module-1`,
      step_index: 1,
      status: phase_key === 'short_term' ? 'in_progress' : 'pending',
      planned_date: '2026-04-15T00:00:00Z',
      evidence_note: '',
      blocker_note: '',
      submission_status: 'idle',
      submission_summary: '',
      submission_files: [],
    },
  ],
  milestone_summary: {
    completed_count: 0,
    total_count: 1,
    blocked_count: 0,
  },
  risk_alerts: [`${phase_label}风险提醒`],
});

const workspace = {
  workspace_id: 'workspace-1',
  favorite,
  generated_report_markdown: '# 系统生成版本',
  edited_report_markdown: '# 当前编辑版本',
  workspace_overview: {
    current_phase_key: 'short_term',
    current_phase_label: '短期计划',
    next_milestone_title: '完成短期里程碑',
    next_review_at: '2026-04-30T00:00:00Z',
    readiness_index: 42,
    latest_review_summary: '保留基础补强，新增项目展示动作。',
    gap_closure_index: 18,
    uses_latest_profile: true,
  },
  metric_snapshot: {
    learning_completion_rate: 50,
    practice_completion_rate: 25,
    evidence_count: 2,
    gap_closure_index: 18,
    readiness_index: 42,
    uses_latest_profile: true,
    latest_profile_refreshed_at: '2026-03-27T00:00:00Z',
  },
  growth_plan_phases: [
    buildPhase('short_term', '短期计划'),
    buildPhase('mid_term', '中期计划'),
    buildPhase('long_term', '长期计划'),
  ],
  review_framework: {
    weekly_review_cycle: '每周一次',
    monthly_review_cycle: '每月一次',
    metrics: [],
  },
  latest_integrity_check: {
    issues: [
      {
        severity: 'blocking',
        section_key: 'target_overview',
        message: '缺少目标概述',
        suggested_fix: '补充目标岗位与阶段说明',
        anchor: '目标概述',
      },
    ],
    blocking_count: 1,
    warning_count: 0,
    suggestion_count: 0,
    checked_at: '2026-03-29T00:00:00Z',
    summary: '发现 1 个阻塞项，建议先修复。',
  },
  latest_review: {
    review_id: 1,
    review_type: 'monthly',
    metric_snapshot: {
      learning_completion_rate: 50,
      practice_completion_rate: 25,
      evidence_count: 2,
      gap_closure_index: 18,
      readiness_index: 42,
      uses_latest_profile: true,
      latest_profile_refreshed_at: '2026-03-27T00:00:00Z',
    },
    keep_items: [{ title: '基础补强', reason: '短板仍然关键', next_action: '继续推进短期学习' }],
    deprioritized_items: [{ title: '泛读内容', reason: '与岗位关联较弱', next_action: '缩减到每周一次' }],
    new_items: [{ title: '展示型项目', reason: '需要形成作品证据', next_action: '本月完成一期项目输出' }],
    adjustment_summary: '保留基础补强，新增项目展示动作。',
    created_at: '2026-03-29T00:00:00Z',
  },
  current_learning_steps: [
    {
      step_index: 1,
      milestone_id: 'short_term-learning-1',
      title: '完成「短期计划里程碑」学习整理',
      objective: '围绕当前学习网站完成基础学习，并整理一份学习小结。',
      status: 'idle',
      resource: {
        title: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/',
        reason: '适合当前模块的基础知识补强。',
        step_label: '第 1 步',
        why_first: '先完成最基础的概念与规范补齐。',
        expected_output: '提交学习笔记或基础练习结果。',
      },
      summary_text: '',
      submission_files: [],
    },
    {
      step_index: 2,
      milestone_id: 'short_term-learning-2',
      title: '完成「短期计划第二步」学习整理',
      objective: '补充第二步的基础知识和表达。',
      status: 'idle',
      resource: {
        title: 'JavaScript Style Guide',
        url: 'https://github.com/airbnb/javascript',
        reason: '补齐规范表达与团队协作约定。',
        step_label: '第 2 步',
        why_first: '在第一步基础上继续补齐规范表达。',
        expected_output: '提交规范要点总结或练习结果。',
      },
      summary_text: '',
      submission_files: [],
    },
    {
      step_index: 3,
      milestone_id: 'short_term-learning-3',
      title: '完成「短期计划第三步」学习整理',
      objective: '完成第三步的基础巩固。',
      status: 'idle',
      resource: {
        title: 'freeCodeCamp',
        url: 'https://www.freecodecamp.org/',
        reason: '通过练习巩固基础能力。',
        step_label: '第 3 步',
        why_first: '最后用练习巩固并形成基础输出。',
        expected_output: '提交练习记录或学习总结。',
      },
      summary_text: '',
      submission_files: [],
    },
  ],
  phase_flow_summary: [
    {
      phase_key: 'short_term',
      phase_label: '短期计划',
      time_horizon: '0-3 个月',
      status: 'current',
      progress_percent: 35,
      summary: '当前聚焦基础补强和第一批可引用证据。',
      next_hint: '先完成第 1 步并提交学习小结。',
    },
    {
      phase_key: 'mid_term',
      phase_label: '中期计划',
      time_horizon: '3-9 个月',
      status: 'upcoming',
      progress_percent: 0,
      summary: '下一阶段开始转向展示型项目与实习证据。',
      next_hint: '完成一个展示型项目并沉淀项目说明。',
    },
    {
      phase_key: 'long_term',
      phase_label: '长期计划',
      time_horizon: '9-24 个月',
      status: 'upcoming',
      progress_percent: 0,
      summary: '长期阶段会转向岗位迁移与稳定升级。',
      next_hint: '开始整理投递材料与长期升级动作。',
    },
  ],
  current_action_summary: {
    current_phase_key: 'short_term',
    current_phase_label: '短期计划',
    headline: '本周先完成第 1 步基础学习',
    support_text: '先学完网站基础内容，再提交小结给系统判断是否达标。',
    audit_summary: '当前以基础通过为目标，不要求高阶掌握。',
    next_review_at: '2026-04-30T00:00:00Z',
  },
  export_meta: {
    available_formats: ['md', 'docx', 'pdf'],
  },
  updated_at: '2026-03-29T00:00:00Z',
} as API.PlanWorkspacePayload;

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
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
  mockedHistoryPush.mockReset();
  mockedGetCareerDevelopmentFavorites.mockReset();
  mockedGetCareerDevelopmentPlanWorkspace.mockReset();
  mockedUpdateCareerDevelopmentPlanWorkspace.mockReset();
  mockedPolishCareerDevelopmentPlanWorkspace.mockReset();
  mockedIntegrityCheckCareerDevelopmentPlanWorkspace.mockReset();
  mockedCreateCareerDevelopmentPlanWorkspaceReview.mockReset();
  mockedExportCareerDevelopmentPlanWorkspace.mockReset();
  mockedDeleteCareerDevelopmentFavorite.mockReset();
  mockedCreateCareerDevelopmentGoalPlanTask.mockReset();
  mockedGetCareerDevelopmentGoalPlanTask.mockReset();
  mockedStreamCareerDevelopmentGoalPlanTask.mockReset();
  mockedSubmitCareerDevelopmentPlanMilestone.mockReset();
  window.localStorage.clear();
  mockedGetCareerDevelopmentFavorites.mockResolvedValue({ data: [favorite] });
  mockedGetCareerDevelopmentPlanWorkspace.mockResolvedValue({ data: workspace });
});

afterEach(() => {
  message.destroy();
});

describe('JobGoalSettingPathPlanningPage', () => {
  it('renders the growth planning workspace and keeps report entrypoint visible', async () => {
    render(<JobGoalSettingPathPlanningPage />);

    expect(await screen.findByText('运行月评')).toBeTruthy();
    expect(screen.getByText('已收藏目标')).toBeTruthy();
    expect(screen.getAllByText('前端工程师').length).toBeGreaterThan(0);
    expect(screen.getByText('本周下一步')).toBeTruthy();
    expect(screen.getAllByText('第 1 步').length).toBeGreaterThan(0);
    expect(screen.queryByText('对应学习模块')).toBeNull();
    expect(screen.queryByText('对应实践动作')).toBeNull();
    expect(screen.getByText('编辑、检查与导出')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /查看职业目标分析报告/ }));
    expect(mockedHistoryPush).toHaveBeenCalledWith('/career-development-report/goal-setting-path-planning');
  });

  it('shows the audit sidebar and inserts a missing section skeleton into markdown', async () => {
    render(<JobGoalSettingPathPlanningPage />);

    await screen.findByText('审计摘要');
    expect(screen.getByText('章节修复清单')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '插入章节骨架' }));

    const editor = screen.getByPlaceholderText('在这里编辑成长路径规划 Markdown。') as HTMLTextAreaElement;
    await waitFor(() => expect(editor.value).toContain('## 目标概述'));
    expect(screen.getAllByText('存在未保存修改').length).toBeGreaterThan(0);
    expect(screen.getByText('检查结果已过期，请重新运行完整性检查')).toBeTruthy();
  });

  it('confirms and forces docx export when blocking issues still exist', async () => {
    const confirmSpy = jest.spyOn(Modal, 'confirm').mockImplementation((config: any) => {
      void config?.onOk?.();
      return {
        destroy: jest.fn(),
        update: jest.fn(),
      } as any;
    });
    mockedExportCareerDevelopmentPlanWorkspace.mockResolvedValue({
      blob: new Blob(['docx']),
      filename: 'growth-plan.docx',
    });

    render(<JobGoalSettingPathPlanningPage />);

    await screen.findByText('导出');
    fireEvent.click(screen.getByRole('button', { name: /导出 DOCX/ }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockedExportCareerDevelopmentPlanWorkspace).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ format: 'docx', force_with_issues: true }),
      ),
    );
    confirmSpy.mockRestore();
  });

  it('shows polish preview and applies it back to the editor', async () => {
    mockedPolishCareerDevelopmentPlanWorkspace.mockResolvedValue({
      data: {
        polished_markdown: '# 润色稿',
        mode: 'formal',
        fact_guard_notice: '只改写表达，不补造事实。',
      },
    });

    render(<JobGoalSettingPathPlanningPage />);

    await screen.findByText('全文编辑与预览');
    fireEvent.click(screen.getByRole('button', { name: '正式报告' }));

    expect(await screen.findByText('只改写表达，不补造事实。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /应用到编辑器/ }));

    const editor = screen.getByPlaceholderText('在这里编辑成长路径规划 Markdown。') as HTMLTextAreaElement;
    await waitFor(() => expect(editor.value).toBe('# 润色稿'));
  });

  it('renders the linear phase flow instead of the old detailed phase collapse', async () => {
    render(<JobGoalSettingPathPlanningPage />);

    await screen.findByText('运行月评');
    expect(screen.getByText('三阶段线性流程图')).toBeTruthy();
    expect(screen.queryByText('学习内容')).toBeNull();
    expect(screen.queryByText('实践安排')).toBeNull();
    expect(screen.getByRole('link', { name: /打开链接/ }).getAttribute('href')).toBe(
      'https://developer.mozilla.org/',
    );
    fireEvent.click(screen.getByRole('button', { name: /中期计划 3-9 个月 下一阶段/ }));
    expect(
      await screen.findByText('下一个阶段先做：完成一个展示型项目并沉淀项目说明。'),
    ).toBeTruthy();
  });

  it('collapses empty monthly review groups into a single summary and offers profile refresh entry', async () => {
    mockedGetCareerDevelopmentPlanWorkspace.mockResolvedValue({
      data: {
        ...workspace,
        metric_snapshot: {
          ...workspace.metric_snapshot,
          uses_latest_profile: false,
          latest_profile_refreshed_at: undefined,
        },
        latest_review: {
          ...workspace.latest_review!,
          keep_items: [],
          deprioritized_items: [],
          new_items: [],
          adjustment_summary: '当前继续按原计划推进。',
        },
      },
    });

    render(<JobGoalSettingPathPlanningPage />);

    expect(await screen.findByText('本月暂无重点变化')).toBeTruthy();
    expect(screen.queryByText('保留项')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '去刷新学生画像' }));
    expect(mockedHistoryPush).toHaveBeenCalledWith('/student-competency-profile');
  });

  it('shows an empty state and starts generation when no workspace exists', async () => {
    mockedGetCareerDevelopmentPlanWorkspace.mockRejectedValue({
      response: { status: 404 },
      message: '404',
    });
    mockedCreateCareerDevelopmentGoalPlanTask.mockResolvedValue({
      data: {
        task_id: 'task-2',
        favorite_id: 1,
        status: 'queued',
        progress: 0,
      },
    });
    mockedStreamCareerDevelopmentGoalPlanTask.mockImplementation(async function* () {
      yield {
        stage: 'queued',
        task_id: 'task-2',
        status: 'running',
        status_text: '已开始准备职业目标与成长路径规划请求。',
        progress: 5,
        created_at: '2026-03-29T00:00:00Z',
      };
      yield {
        stage: '__end__',
        task_id: 'task-2',
      };
    });

    render(<JobGoalSettingPathPlanningPage />);

    expect(await screen.findByText('当前目标还没有成长路径规划工作台，点击后才会开始生成，不会自动初始化。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /生成成长路径规划/ }));
    expect(mockedCreateCareerDevelopmentGoalPlanTask).toHaveBeenCalledWith(
      { favorite_id: 1 },
      expect.any(Object),
    );
  });

  it('submits the selected learning step and shows the assessment result', async () => {
    mockedSubmitCareerDevelopmentPlanMilestone.mockResolvedValue({
      data: {
        ...workspace,
        current_learning_steps: workspace.current_learning_steps.map((step) =>
          step.step_index === 1
            ? {
                ...step,
                status: 'needs_more_evidence',
                summary_text: '我已经完成了 MDN 的基础学习，并整理了知识点。',
                submission_files: [
                  {
                    file_name: 'notes.md',
                    stored_name: 'stored-notes.md',
                    content_type: 'text/markdown',
                    size_bytes: 128,
                    file_path: 'career_plan_step_uploads/notes.md',
                    text_excerpt: 'HTML 语义化与基础规范总结',
                  },
                ],
                latest_assessment: {
                  result: 'needs_more_evidence',
                  summary: '当前已经完成基础学习，但还需要补充更明确的学习输出。',
                  missing_points: ['补充一份更具体的学习笔记或练习结果'],
                  next_action: '补充学习笔记后再次提交评估。',
                  assessed_at: '2026-03-29T00:00:00Z',
                },
              }
            : step,
        ),
      },
    });

    render(<JobGoalSettingPathPlanningPage />);

    await screen.findByText('步骤执行台');
    fireEvent.change(screen.getByPlaceholderText('补充你学了什么、记住了什么、产出了什么。'), {
      target: { value: '我已经完成了 MDN 的基础学习，并整理了知识点。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交并判断是否达标' }));

    await waitFor(() =>
      expect(mockedSubmitCareerDevelopmentPlanMilestone).toHaveBeenCalledWith(
        1,
        'short_term-learning-1',
        expect.any(FormData),
        expect.any(Object),
      ),
    );
    expect(
      await screen.findByText('当前已经完成基础学习，但还需要补充更明确的学习输出。'),
    ).toBeTruthy();
    expect(screen.getByText(/待补充：补充一份更具体的学习笔记或练习结果/)).toBeTruthy();
  });
});

