import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import JobGoalSettingPathPlanningPage from './index';

const mockedHistoryPush = jest.fn();
const mockedGetCareerDevelopmentFavorites = jest.fn();
const mockedGetCareerDevelopmentPlanWorkspace = jest.fn();
const mockedCreateCareerDevelopmentGoalPlanTask = jest.fn();
const mockedGetCareerDevelopmentGoalPlanTask = jest.fn();
const mockedStreamCareerDevelopmentGoalPlanTask = jest.fn();
const mockedDeleteCareerDevelopmentFavorite = jest.fn();

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
  createCareerDevelopmentGoalPlanTask: (...args: any[]) =>
    mockedCreateCareerDevelopmentGoalPlanTask(...args),
  getCareerDevelopmentGoalPlanTask: (...args: any[]) =>
    mockedGetCareerDevelopmentGoalPlanTask(...args),
  streamCareerDevelopmentGoalPlanTask: (...args: any[]) =>
    mockedStreamCareerDevelopmentGoalPlanTask(...args),
  deleteCareerDevelopmentFavorite: (...args: any[]) =>
    mockedDeleteCareerDevelopmentFavorite(...args),
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

const workspace = {
  workspace_id: 'workspace-1',
  favorite,
  generated_report_markdown: '# 系统生成版本',
  edited_report_markdown: '# 当前编辑版本',
  workspace_overview: {
    current_phase_key: 'short_term',
    current_phase_label: '短期计划',
    next_milestone_title: '完成基础学习',
    next_review_at: '2026-04-30T00:00:00Z',
    readiness_index: 42,
    latest_review_summary: '保留基础补强，新增作品展示动作。',
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
  growth_plan_phases: [],
  review_framework: {
    weekly_review_cycle: '每周一次',
    monthly_review_cycle: '每月一次',
    metrics: [],
  },
  current_learning_steps: [],
  phase_flow_summary: [],
  current_action_summary: {
    current_phase_key: 'short_term',
    current_phase_label: '短期计划',
    headline: '先补齐短期基础学习',
    support_text: '完成基础补强后再进入下一阶段。',
    audit_summary: '当前以基础补强为主。',
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
});

beforeEach(() => {
  mockedHistoryPush.mockReset();
  mockedGetCareerDevelopmentFavorites.mockReset();
  mockedGetCareerDevelopmentPlanWorkspace.mockReset();
  mockedCreateCareerDevelopmentGoalPlanTask.mockReset();
  mockedGetCareerDevelopmentGoalPlanTask.mockReset();
  mockedStreamCareerDevelopmentGoalPlanTask.mockReset();
  mockedDeleteCareerDevelopmentFavorite.mockReset();
  window.localStorage.clear();

  window.localStorage.setItem(
    'feature_map_career_goal_workspace_v2',
    JSON.stringify({
      selectedFavoriteId: 1,
      taskIdsByFavorite: { '1': 'task-1' },
    }),
  );

  mockedGetCareerDevelopmentFavorites.mockResolvedValue({ data: [favorite] });
  mockedGetCareerDevelopmentPlanWorkspace.mockResolvedValue({ data: workspace });
  mockedGetCareerDevelopmentGoalPlanTask.mockResolvedValue({
    data: {
      task_id: 'task-1',
      favorite_id: 1,
      status: 'completed',
      progress: 100,
      updated_at: '2026-03-29T00:00:00Z',
      result: {
        favorite,
        trend_markdown: '# 趋势',
        trend_section_markdown: '## 趋势依据',
        path_section_markdown: '',
        correlation_analysis: {},
        strength_directions: [],
        path_stages: [],
        comprehensive_report_markdown: '# 综合报告',
        path_nodes: [],
        stage_recommendations: [],
        growth_plan_phases: [],
        generated_report_markdown: '# 生成版本',
      },
    },
  });
});

describe('JobGoalSettingPathPlanningPage', () => {
  it('renders the analysis report sections and growth path CTA', async () => {
    render(<JobGoalSettingPathPlanningPage />);

    await screen.findByText('综合报告');
    await screen.findByText('趋势依据');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /进入成长路径规划/ }).length).toBeGreaterThan(0);
    }, { timeout: 5000 });
    const growthButtons = screen.getAllByRole('button', { name: /进入成长路径规划/ });
    expect(growthButtons.length).toBeGreaterThan(0);
    expect(screen.getByText('综合报告')).toBeTruthy();
    expect(screen.getByText('趋势依据')).toBeTruthy();
    expect(screen.queryByText('原始路径依据')).toBeNull();
  });

  it('keeps workspace-only tools off the report page and preserves graph entrypoints', async () => {
    render(<JobGoalSettingPathPlanningPage />);

    await screen.findByText('综合报告');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /查看垂直岗位图谱/ })).toBeTruthy();
    }, { timeout: 5000 });

    expect(screen.queryByText('全文编辑')).toBeNull();
    expect(screen.queryByText('完整性检查与导出')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /查看垂直岗位图谱/ }));
    expect(mockedHistoryPush).toHaveBeenCalledWith(
      expect.stringContaining('/job-requirement-profile/vertical?job_title='),
    );
  });

  it('updates task progress from streaming events in real time', async () => {
    mockedGetCareerDevelopmentGoalPlanTask.mockResolvedValue({
      data: {
        task_id: 'task-1',
        favorite_id: 1,
        status: 'running',
        progress: 20,
        updated_at: '2026-03-29T00:00:00Z',
      },
    });
    mockedStreamCareerDevelopmentGoalPlanTask.mockImplementation(async function* () {
      yield {
        stage: 'correlation',
        task_id: 'task-1',
        status: 'running',
        status_text: '正在生成职业目标关联性分析。',
        progress: 62,
        created_at: '2026-03-29T00:10:00Z',
      };
      yield {
        stage: '__end__',
        task_id: 'task-1',
      };
    });

    render(<JobGoalSettingPathPlanningPage />);

    expect(await screen.findByText('任务进度')).toBeTruthy();
    expect(await screen.findByText('正在生成职业目标关联性分析。')).toBeTruthy();
    expect(screen.getByText('更新时间：2026-03-29 08:10')).toBeTruthy();
  });
});

