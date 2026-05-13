import { act, renderHook, waitFor } from '@testing-library/react';
import { useMatchResults } from './useMatchResults';

const mockGetCareerMatchInit = jest.fn();
const mockGetCareerFavorites = jest.fn();
const mockCreateCareerFavorite = jest.fn();
const mockDeleteCareerFavorite = jest.fn();
const mockGoToSnailLearningPath = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getCareerDevelopmentMatchInit: (...args: unknown[]) =>
    mockGetCareerMatchInit(...args),
  getCareerDevelopmentFavorites: (...args: unknown[]) =>
    mockGetCareerFavorites(...args),
  createCareerDevelopmentFavorite: (...args: unknown[]) =>
    mockCreateCareerFavorite(...args),
  deleteCareerDevelopmentFavorite: (...args: unknown[]) =>
    mockDeleteCareerFavorite(...args),
}));

jest.mock(
  '../../career-development-report/learning-path/learningPathUtils',
  () => ({
    goToSnailLearningPath: (...args: unknown[]) =>
      mockGoToSnailLearningPath(...args),
  }),
);

const recommendations: API.CareerDevelopmentMatchReport[] = [
  {
    report_id: 'report-1',
    target_scope: 'career',
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
  {
    report_id: 'report-2',
    target_scope: 'career',
    target_title: '全栈开发工程师',
    canonical_job_title: '全栈开发工程师',
    industry: '互联网',
    overall_match: 78,
    strength_dimension_count: 2,
    priority_gap_dimension_count: 3,
    group_summaries: [],
    comparison_dimensions: [],
    chart_series: [],
    strength_dimensions: [],
    priority_gap_dimensions: [],
    action_advices: [],
    evidence_cards: [],
  },
];

const matchInitData: API.CareerDevelopmentMatchInitPayload = {
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

const favorite: API.CareerDevelopmentFavoritePayload = {
  favorite_id: 101,
  report_id: 'report-1',
  target_key: '前端开发工程师::互联网',
  source_kind: 'recommendation',
  target_scope: 'career',
  target_title: '前端开发工程师',
  canonical_job_title: '前端开发工程师',
  industry: '互联网',
  overall_match: 85,
  report_snapshot: recommendations[0],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('useMatchResults', () => {
  beforeEach(() => {
    mockGetCareerMatchInit.mockReset();
    mockGetCareerFavorites.mockReset();
    mockCreateCareerFavorite.mockReset();
    mockDeleteCareerFavorite.mockReset();
    mockGoToSnailLearningPath.mockReset();

    mockGetCareerMatchInit.mockResolvedValue({
      success: true,
      data: matchInitData,
    });
    mockGetCareerFavorites.mockResolvedValue({
      success: true,
      data: [favorite],
    });
    mockCreateCareerFavorite.mockResolvedValue({
      success: true,
      data: {
        favorite_id: 102,
        report_id: 'report-2',
        target_key: '全栈开发工程师::互联网',
        source_kind: 'recommendation',
        target_scope: 'career',
        target_title: '全栈开发工程师',
        canonical_job_title: '全栈开发工程师',
        industry: '互联网',
        overall_match: 78,
        report_snapshot: recommendations[1],
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    });
    mockDeleteCareerFavorite.mockResolvedValue(undefined);
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useMatchResults());
    expect(result.current.loading).toBe(true);
  });

  it('fetches match data and favorites', async () => {
    const { result } = renderHook(() => useMatchResults());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.matchData?.available).toBe(true);
    expect(result.current.recommendations).toHaveLength(2);
    expect(result.current.favorites).toHaveLength(1);
    expect(mockGetCareerMatchInit).toHaveBeenCalledTimes(1);
    expect(mockGetCareerFavorites).toHaveBeenCalledTimes(1);
  });

  it('sets default selected recommendation', async () => {
    const { result } = renderHook(() => useMatchResults());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activeRecommendationId).toBe('report-1');
  });

  it('switches active recommendation', async () => {
    const { result } = renderHook(() => useMatchResults());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setActiveRecommendationId('report-2');
    });

    expect(result.current.activeRecommendationId).toBe('report-2');
    expect(result.current.activeRecommendation?.canonical_job_title).toBe(
      '全栈开发工程师',
    );
  });

  it('toggleFavorite adds favorite when not favorited', async () => {
    const { result } = renderHook(() => useMatchResults());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setActiveRecommendationId('report-2');
    });

    await act(async () => {
      await result.current.toggleFavorite();
    });

    expect(mockCreateCareerFavorite).toHaveBeenCalledTimes(1);
    expect(result.current.favorites).toHaveLength(2);
  });

  it('toggleFavorite removes favorite when already favorited', async () => {
    const { result } = renderHook(() => useMatchResults());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleFavorite();
    });

    expect(mockDeleteCareerFavorite).toHaveBeenCalledWith(101, {
      skipErrorHandler: true,
    });
    expect(result.current.favorites).toHaveLength(0);
  });

  it('handles fetch error', async () => {
    mockGetCareerMatchInit.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMatchResults());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
  });

  it('refresh re-fetches data', async () => {
    const { result } = renderHook(() => useMatchResults());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(mockGetCareerMatchInit).toHaveBeenCalledTimes(2);
    });
  });
});
