import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MatchWorkspace } from './MatchWorkspace';

const recommendations = [
  {
    report_id: 'report-1',
    target_scope: 'career' as const,
    target_title: '前端开发工程师',
    canonical_job_title: '前端开发工程师',
    industry: '互联网',
    overall_match: 85,
    strength_dimension_count: 3,
    priority_gap_dimension_count: 2,
    group_summaries: [],
    comparison_dimensions: [],
    chart_series: [],
    strength_dimensions: [],
    priority_gap_dimensions: [],
    action_advices: [],
    evidence_cards: [],
  },
];

const matchData: API.CareerDevelopmentMatchInitPayload = {
  available: true,
  source: {
    updated_at: '2024-01-01T00:00:00Z',
    active_dimension_count: 10,
    workspace_conversation_id: 'conv-1',
    profile: {},
  },
  default_report_id: 'report-1',
  recommendations,
};

describe('MatchWorkspace', () => {
  const defaultProps = {
    matchData,
    activeRecommendationId: 'report-1',
    activeResultTab: 'comparison' as const,
    activeGapKey: undefined,
    favorites: [] as API.CareerDevelopmentFavoritePayload[],
    favoriteSubmitting: false,
    loading: false,
    onSelectRecommendation: jest.fn(),
    onResultTabChange: jest.fn(),
    onGapSelect: jest.fn(),
    onToggleFavorite: jest.fn(),
    onGeneratePlan: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    render(<MatchWorkspace {...defaultProps} loading={true} />);
    expect(screen.getByText('加载匹配数据中...')).toBeTruthy();
  });

  it('renders empty state when not available', () => {
    render(
      <MatchWorkspace
        {...defaultProps}
        matchData={{ ...matchData, available: false, message: '暂无数据' }}
      />,
    );
    expect(screen.getByText('暂无数据')).toBeTruthy();
  });

  it('renders workspace with recommendations', () => {
    render(<MatchWorkspace {...defaultProps} />);
    expect(screen.getByTestId('match-workspace')).toBeTruthy();
    const titles = screen.getAllByText('前端开发工程师');
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders data source info', () => {
    render(<MatchWorkspace {...defaultProps} />);
    expect(screen.getByText('10 维度分析')).toBeTruthy();
  });

  it('renders recommendation list title', () => {
    render(<MatchWorkspace {...defaultProps} />);
    const matches = screen.getAllByText('推荐职业');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders match percentage badge', () => {
    render(<MatchWorkspace {...defaultProps} />);
    const percents = screen.getAllByText('85%');
    expect(percents.length).toBeGreaterThanOrEqual(1);
  });

  it('renders favorite button', () => {
    render(<MatchWorkspace {...defaultProps} />);
    expect(screen.getByText('收藏')).toBeTruthy();
  });

  it('calls onToggleFavorite when favorite button clicked', () => {
    const onToggleFavorite = jest.fn();
    render(
      <MatchWorkspace {...defaultProps} onToggleFavorite={onToggleFavorite} />,
    );
    fireEvent.click(screen.getByText('收藏'));
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('shows "已收藏" when favorited', () => {
    const favorite: API.CareerDevelopmentFavoritePayload = {
      favorite_id: 1,
      report_id: 'report-1',
      target_key: '前端开发工程师::互联网',
      source_kind: 'recommendation',
      target_scope: 'career',
      target_title: '前端开发工程师',
      canonical_job_title: '前端开发工程师',
      industry: '互联网',
      overall_match: 85,
      report_snapshot: recommendations[0],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };
    render(<MatchWorkspace {...defaultProps} favorites={[favorite]} />);
    expect(screen.getByText('已收藏')).toBeTruthy();
  });

  it('shows generate plan button when favorited', () => {
    const favorite: API.CareerDevelopmentFavoritePayload = {
      favorite_id: 1,
      report_id: 'report-1',
      target_key: '前端开发工程师::互联网',
      source_kind: 'recommendation',
      target_scope: 'career',
      target_title: '前端开发工程师',
      canonical_job_title: '前端开发工程师',
      industry: '互联网',
      overall_match: 85,
      report_snapshot: recommendations[0],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };
    render(<MatchWorkspace {...defaultProps} favorites={[favorite]} />);
    expect(screen.getByText('生成学习计划')).toBeTruthy();
  });

  it('shows disabled generate plan button when not favorited', () => {
    render(<MatchWorkspace {...defaultProps} favorites={[]} />);
    const button = screen.getByText('生成学习计划');
    expect(button).toBeTruthy();
    expect(button.closest('button')?.hasAttribute('disabled')).toBe(true);
  });

  it('calls onSelectRecommendation when recommendation clicked', () => {
    const onSelectRecommendation = jest.fn();
    render(
      <MatchWorkspace
        {...defaultProps}
        onSelectRecommendation={onSelectRecommendation}
      />,
    );
    const items = screen.getAllByText('前端开发工程师');
    fireEvent.click(items[0].closest('[role="button"]') || items[0]);
    expect(onSelectRecommendation).toHaveBeenCalled();
  });

  it('renders tabs with correct labels', () => {
    render(<MatchWorkspace {...defaultProps} />);
    // Sidebar list title still says 推荐职业
    const recommendationLabels = screen.getAllByText('推荐职业');
    expect(recommendationLabels.length).toBeGreaterThanOrEqual(1);
    // Tab label renamed to 维度对比
    expect(screen.getByText('维度对比')).toBeTruthy();
    expect(screen.getByText('和目标的差距')).toBeTruthy();
    expect(screen.getByText('最匹配的工作')).toBeTruthy();
  });

  it('renders comparison content in comparison tab', () => {
    render(
      <MatchWorkspace
        {...defaultProps}
        activeResultTab="comparison"
        comparisonContent={<div>comparison-dimensions-view</div>}
        adviceContent={<div>advice-view</div>}
      />,
    );
    expect(screen.getByText('comparison-dimensions-view')).toBeTruthy();
    expect(screen.queryByText('advice-view')).toBeNull();
  });

  it('renders advice content in advice tab', () => {
    render(
      <MatchWorkspace
        {...defaultProps}
        activeResultTab="advice"
        comparisonContent={<div>comparison-dimensions-view</div>}
        adviceContent={<div>advice-view</div>}
      />,
    );
    expect(screen.getByText('advice-view')).toBeTruthy();
    expect(screen.queryByText('comparison-dimensions-view')).toBeNull();
  });

  it('renders company content in company tab', () => {
    render(
      <MatchWorkspace
        {...defaultProps}
        activeResultTab="company"
        comparisonContent={<div>comparison-dimensions-view</div>}
        adviceContent={<div>advice-view</div>}
      />,
    );
    expect(screen.queryByText('comparison-dimensions-view')).toBeNull();
    expect(screen.queryByText('advice-view')).toBeNull();
  });

  it('renders data source label', () => {
    render(<MatchWorkspace {...defaultProps} />);
    expect(screen.getByText('数据来源')).toBeTruthy();
  });

  it('renders empty state with default message when matchData undefined', () => {
    render(<MatchWorkspace {...defaultProps} matchData={undefined} />);
    expect(screen.getByText('暂无匹配数据，请先完成简历解析')).toBeTruthy();
  });
});
