import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useWorkspace } from './useWorkspace';

const mockGetCareerDevelopmentFavorites = jest.fn();
const mockGetHomeV2 = jest.fn();
const mockGetStudentCompetencyLatestAnalysis = jest.fn();
const mockInitializeSnailLearningPathWorkspace = jest.fn();
const mockGetCareerDevelopmentPlanWorkspace = jest.fn();

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
}));

const mockWorkspace = {
  workspace_id: 'ws-1',
  favorite: {
    favorite_id: 1,
    target_key: 'frontend::internet',
    report_id: 'report-1',
    report_snapshot: {
      report_id: 'report-1',
      target_title: 'Frontend Engineer',
      overall_match: 87,
      comparison_dimensions: [],
      chart_series: [],
      strength_dimensions: [],
      priority_gap_dimensions: [],
      action_advices: [],
      evidence_cards: [],
      narrative: {
        overall_review: '',
        completeness_explanation: '',
        competitiveness_explanation: '',
        strength_highlights: [],
        priority_gap_highlights: [],
      },
    },
  },
  growth_plan_phases: [],
  metric_snapshot: {
    learning_completion_rate: 0,
    practice_completion_rate: 0,
  },
} as unknown as API.PlanWorkspacePayload;

describe('useWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHomeV2.mockResolvedValue({
      data: { onboarding_completed: true, profile: {} },
    });
    mockGetStudentCompetencyLatestAnalysis.mockResolvedValue({
      data: { available: true },
    });
    mockGetCareerDevelopmentFavorites.mockResolvedValue({
      data: [{ favorite_id: 1, report_id: 'report-1' }],
    });
  });

  it('returns loading true initially', () => {
    const { result } = renderHook(() => useWorkspace(1));
    expect(result.current.loading).toBe(true);
  });

  it('loads existing workspace when saved workspace exists', async () => {
    mockGetCareerDevelopmentPlanWorkspace.mockResolvedValue({
      data: mockWorkspace,
    });

    const { result } = renderHook(() => useWorkspace(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspace).toBeTruthy();
    expect(result.current.workspace?.workspace_id).toBe('ws-1');
    expect(mockInitializeSnailLearningPathWorkspace).not.toHaveBeenCalled();
  });

  it('initializes new workspace when saved workspace returns 404', async () => {
    mockGetCareerDevelopmentPlanWorkspace.mockRejectedValue({
      response: { status: 404 },
    });
    mockInitializeSnailLearningPathWorkspace.mockResolvedValue({
      data: mockWorkspace,
    });

    const { result } = renderHook(() => useWorkspace(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspace).toBeTruthy();
    expect(mockInitializeSnailLearningPathWorkspace).toHaveBeenCalledWith(
      1,
      expect.any(Object),
    );
  });

  it('sets error when workspace cannot be loaded', async () => {
    mockGetCareerDevelopmentPlanWorkspace.mockRejectedValue(
      new Error('Network error'),
    );
    mockInitializeSnailLearningPathWorkspace.mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderHook(() => useWorkspace(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('sets preparation state correctly', async () => {
    mockGetCareerDevelopmentPlanWorkspace.mockResolvedValue({
      data: mockWorkspace,
    });

    const { result } = renderHook(() => useWorkspace(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.preparation.hasFavorite).toBe(true);
    expect(result.current.preparation.hasProfile).toBe(true);
    expect(result.current.preparation.hasLatestAnalysis).toBe(true);
    expect(result.current.preparation.hasWorkspace).toBe(true);
  });

  it('reports missing favorite when favorite id not found', async () => {
    mockGetCareerDevelopmentPlanWorkspace.mockResolvedValue({
      data: mockWorkspace,
    });
    mockGetCareerDevelopmentFavorites.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useWorkspace(999));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.preparation.hasFavorite).toBe(false);
  });

  it('refresh function reloads workspace', async () => {
    mockGetCareerDevelopmentPlanWorkspace.mockResolvedValue({
      data: mockWorkspace,
    });

    const { result } = renderHook(() => useWorkspace(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetCareerDevelopmentPlanWorkspace.mockClear();
    result.current.refresh();

    await waitFor(() => {
      expect(mockGetCareerDevelopmentPlanWorkspace).toHaveBeenCalled();
    });
  });
});
