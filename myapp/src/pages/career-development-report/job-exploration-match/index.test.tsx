import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import JobExplorationMatchPage from './index';

const mockedHistoryPush = jest.fn();
const mockedGetCareerDevelopmentMatchInit = jest.fn();
const mockedGetCareerDevelopmentFavorites = jest.fn();
const mockedCreateCareerDevelopmentFavorite = jest.fn();
const mockedDeleteCareerDevelopmentFavorite = jest.fn();
const mockedCreateCareerDevelopmentMatchReport = jest.fn();
const mockedGetJobTitleOptions = jest.fn();
const mockedGetIndustryOptionsByJobTitle = jest.fn();
const mockedGetVerticalJobProfileCompanyDetail = jest.fn();
const mockedGraph = jest.fn();
const mockedGraphOn = jest.fn();
const mockedGraphDestroy = jest.fn();
const mockedGraphRender = jest.fn();

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  const ReactLib = jest.requireActual('react');

  return {
    ...actual,
    Select: ({ options = [], mode, value, onChange, disabled, placeholder, id }: any) =>
      ReactLib.createElement(
        'select',
        {
          'aria-label': id,
          'data-testid': id,
          disabled,
          multiple: mode === 'multiple',
          value: value ?? (mode === 'multiple' ? [] : ''),
          onChange: (event: any) => {
            if (mode === 'multiple') {
              const values = Array.from(event.target.selectedOptions).map((item: any) => item.value);
              onChange?.(values);
              return;
            }
            onChange?.(event.target.value || undefined);
          },
        },
        ...(mode !== 'multiple'
          ? [ReactLib.createElement('option', { key: 'placeholder', value: '' }, placeholder)]
          : []),
        ...options.map((option: any) =>
          ReactLib.createElement('option', { key: option.value, value: option.value }, option.label),
        ),
      ),
  };
});

jest.mock('@umijs/max', () => ({
  history: {
    push: (...args: any[]) => mockedHistoryPush(...args),
  },
}));

jest.mock('@ant-design/charts', () => ({
  Radar: () => require('react').createElement('div', { 'data-testid': 'radar-chart' }),
}));

jest.mock('@/services/ant-design-pro/api', () => ({
  getCareerDevelopmentMatchInit: (...args: any[]) => mockedGetCareerDevelopmentMatchInit(...args),
  getCareerDevelopmentFavorites: (...args: any[]) => mockedGetCareerDevelopmentFavorites(...args),
  createCareerDevelopmentFavorite: (...args: any[]) => mockedCreateCareerDevelopmentFavorite(...args),
  deleteCareerDevelopmentFavorite: (...args: any[]) => mockedDeleteCareerDevelopmentFavorite(...args),
  createCareerDevelopmentMatchReport: (...args: any[]) =>
    mockedCreateCareerDevelopmentMatchReport(...args),
  getJobTitleOptions: (...args: any[]) => mockedGetJobTitleOptions(...args),
  getIndustryOptionsByJobTitle: (...args: any[]) => mockedGetIndustryOptionsByJobTitle(...args),
  getVerticalJobProfileCompanyDetail: (...args: any[]) =>
    mockedGetVerticalJobProfileCompanyDetail(...args),
}));

jest.mock('@antv/g6', () => ({
  Graph: function Graph(this: any, options: any) {
    mockedGraph(options);
    this.on = mockedGraphOn;
    this.render = mockedGraphRender;
    this.destroy = mockedGraphDestroy;
  },
}));

const createMatchMedia = () =>
  jest.fn().mockImplementation(() => ({
    matches: true,
    media: '',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

const createReport = (overrides: Partial<API.CareerDevelopmentMatchReport> = {}): API.CareerDevelopmentMatchReport => ({
  report_id: 'career:frontend',
  target_scope: 'career',
  target_title: '前端工程师',
  canonical_job_title: '前端工程师',
  representative_job_title: '前端开发',
  overall_match: 76.66,
  strength_dimension_count: 2,
  priority_gap_dimension_count: 1,
  group_summaries: [
    {
      group_key: 'professional-and-threshold',
      label: '专业与门槛',
      match_score: 70,
      target_requirement: 90,
      gap: 20,
      status_label: '基础契合',
      dimension_keys: ['professional_skills'],
    },
  ],
  comparison_dimensions: [
    {
      key: 'professional_skills',
      title: '专业技能',
      user_values: ['React'],
      market_keywords: ['React', 'TypeScript'],
      market_weight: 1,
      normalized_weight: 1,
      market_target: 100,
      user_readiness: 76,
      gap: 24,
      presence: 1,
      richness: 0.4,
      status_label: '待补强',
      matched_market_keywords: ['React'],
      missing_market_keywords: ['TypeScript'],
      coverage_score: 0.5,
      alignment_score: 0.5,
    },
  ],
  chart_series: [
    {
      key: 'professional_skills',
      title: '专业技能',
      market_importance: 100,
      user_readiness: 76,
    },
  ],
  strength_dimensions: ['professional_skills'],
  priority_gap_dimensions: ['professional_skills'],
  action_advices: [
    {
      key: 'professional_skills',
      title: '专业技能',
      status_label: '待补强',
      gap: 24,
      why_it_matters: '需要用更直接的技能证据支撑目标岗位。',
      current_issue: '缺少 TypeScript 和工程化相关证据。',
      next_actions: ['补充 TypeScript 项目经历', '补充工程化实践情境'],
      example_phrases: ['独立完成 TypeScript 模块拆分'],
      evidence_sources: [],
      recommended_keywords: ['TypeScript', '工程化'],
    },
  ],
  evidence_cards: [
    {
      profile_id: 1,
      career_title: '前端工程师',
      job_title: '前端开发',
      company_name: '示例公司',
      industry: '互联网',
      match_score: 90,
      professional_threshold_dimension_count: 2,
      professional_threshold_keyword_count: 5,
      group_similarities: [],
    },
  ],
  narrative: {
    overall_review: '当前画像与目标岗位整体较为契合。',
    completeness_explanation: '',
    competitiveness_explanation: '',
    strength_highlights: ['专业技能有基础'],
    priority_gap_highlights: ['TypeScript 证据仍需补强'],
  },
  ...overrides,
});

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMedia(),
  });
});

beforeEach(() => {
  mockedHistoryPush.mockReset();
  mockedGetCareerDevelopmentMatchInit.mockReset();
  mockedGetCareerDevelopmentFavorites.mockReset();
  mockedCreateCareerDevelopmentFavorite.mockReset();
  mockedDeleteCareerDevelopmentFavorite.mockReset();
  mockedCreateCareerDevelopmentMatchReport.mockReset();
  mockedGetJobTitleOptions.mockReset();
  mockedGetIndustryOptionsByJobTitle.mockReset();
  mockedGetVerticalJobProfileCompanyDetail.mockReset();
  mockedGraph.mockReset();
  mockedGraphOn.mockReset();
  mockedGraphDestroy.mockReset();
  mockedGraphRender.mockReset();
  window.localStorage.clear();

  mockedGetCareerDevelopmentMatchInit.mockResolvedValue({
    data: {
      available: true,
      source: {
        workspace_conversation_id: 'workspace-1',
        active_dimension_count: 8,
        profile: {},
      },
      recommendations: [createReport()],
      default_report_id: 'career:frontend',
    },
  });
  mockedGetCareerDevelopmentFavorites.mockResolvedValue({ data: [] });
  mockedGetJobTitleOptions.mockResolvedValue({
    data: [{ label: 'Java', value: 'Java' }],
  });
  mockedGetIndustryOptionsByJobTitle.mockResolvedValue({
    data: [{ label: '互联网', value: '互联网' }],
  });
  mockedCreateCareerDevelopmentMatchReport.mockResolvedValue({
    data: {
      source: {
        workspace_conversation_id: 'workspace-1',
        active_dimension_count: 8,
        profile: {},
      },
      job_title: 'Java',
      selected_industries: ['互联网'],
      available_industries: ['互联网'],
      graph_payload: {
        title: 'Java 行业图谱',
        job_title: 'Java',
        selected_industries: ['互联网'],
        available_industries: ['互联网'],
        groups: [],
        meta: {
          total_industries: 1,
          total_companies: 0,
          generated_at: '2026-03-28T00:00:00Z',
        },
      },
      reports: [
        {
          industry: '互联网',
          report: createReport({
            report_id: 'industry:java:互联网',
            target_scope: 'industry',
            target_title: '互联网 / Java',
            canonical_job_title: 'Java',
            representative_job_title: 'Java开发',
            industry: '互联网',
          }),
        },
      ],
    },
  });
});

describe('JobExplorationMatchPage', () => {
  it('renders recommendation report and allows creating a favorite', async () => {
    mockedCreateCareerDevelopmentFavorite.mockResolvedValue({
      data: {
        favorite_id: 10,
        target_key: '前端工程师:',
        source_kind: 'recommendation',
        report_id: 'career:frontend',
        target_scope: 'career',
        target_title: '前端工程师',
        canonical_job_title: '前端工程师',
        representative_job_title: '前端开发',
        overall_match: 76.66,
        report_snapshot: createReport(),
        created_at: '2026-03-28T00:00:00Z',
        updated_at: '2026-03-28T00:00:00Z',
      },
    });

    render(<JobExplorationMatchPage />);

    expect(await screen.findByText('自动推荐报告')).toBeTruthy();
    expect((await screen.findAllByText('前端工程师')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('收藏')[0]);

    await waitFor(() => {
      expect(mockedCreateCareerDevelopmentFavorite).toHaveBeenCalledWith(
        expect.objectContaining({
          source_kind: 'recommendation',
        }),
        expect.anything(),
      );
    });
  });

  it('renders diagnostic card details for grouped advice', async () => {
    render(<JobExplorationMatchPage />);

    const [groupHeader] = await screen.findAllByText('专业与门槛');
    fireEvent.click(groupHeader);

    expect(await screen.findByTestId('diagnostic-card-professional_skills')).toBeTruthy();
    expect(screen.getByText('你现在缺什么')).toBeTruthy();
    expect(screen.getAllByText('TypeScript').length).toBeGreaterThan(0);
    expect(screen.getByText('你已经有什么')).toBeTruthy();
    expect(screen.getByText('React')).toBeTruthy();
    expect(screen.getByText('优先补什么')).toBeTruthy();
    expect(screen.getByText('补充 TypeScript 项目经历')).toBeTruthy();
    expect(screen.getByText('可直接补进表达里')).toBeTruthy();
    expect(screen.getByText('独立完成 TypeScript 模块拆分')).toBeTruthy();
  });
});
