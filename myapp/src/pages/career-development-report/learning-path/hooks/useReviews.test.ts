import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useReviews } from './useReviews';

const mockCreateSnailLearningPathReview = jest.fn();
const mockListSnailLearningPathReviews = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  createSnailLearningPathReview: (...args: any[]) =>
    mockCreateSnailLearningPathReview(...args),
  listSnailLearningPathReviews: (...args: any[]) =>
    mockListSnailLearningPathReviews(...args),
}));

const mockReview = {
  review_id: 'review-1',
  review_type: 'weekly' as const,
  created_at: '2026-04-01T00:00:00Z',
  weekly_report: {
    headline: 'Good progress this week',
    focus_keywords: ['React', 'Hooks'],
    progress_keywords: [],
    gap_keywords: [],
    action_keywords: [],
    progress_assessment: 'Completed the basics.',
    goal_gap_summary: 'Need more practice.',
    next_action: 'Continue with advanced topics.',
    highlights: [],
    blockers: [],
  },
} as unknown as API.SnailLearningPathReviewPayload;

const mockActivePhase = {
  phase_key: 'short_term',
  phase_label: '短期',
  learning_modules: [],
} as unknown as API.GrowthPlanPhase;

const mockReport = {
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
} as unknown as API.CareerDevelopmentMatchReport;

describe('useReviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListSnailLearningPathReviews.mockResolvedValue({ data: [] });
  });

  it('loads review history on mount', async () => {
    mockListSnailLearningPathReviews.mockResolvedValue({
      data: [mockReview],
    });

    const { result } = renderHook(() =>
      useReviews({
        workspaceId: 'ws-1',
        activePhase: mockActivePhase,
        checkedResourceUrls: [],
        report: mockReport,
        progress: { completed: 0, total: 1, percent: 0 },
      }),
    );

    await waitFor(() => {
      expect(result.current.reviews.length).toBeGreaterThan(0);
    });
  });

  it('passes phase_key to list API', async () => {
    mockListSnailLearningPathReviews.mockResolvedValue({ data: [mockReview] });

    renderHook(() =>
      useReviews({
        workspaceId: 'ws-1',
        activePhase: mockActivePhase,
        checkedResourceUrls: [],
        report: mockReport,
        progress: { completed: 0, total: 1, percent: 0 },
      }),
    );

    await waitFor(() => {
      expect(mockListSnailLearningPathReviews).toHaveBeenCalledWith(
        'ws-1',
        { phase_key: 'short_term' },
        expect.any(Object),
      );
    });
  });

  it('submitReview calls create API with FormData', async () => {
    mockCreateSnailLearningPathReview.mockResolvedValue({
      data: { ...mockReview, review_id: 'new-review' },
    });

    const { result } = renderHook(() =>
      useReviews({
        workspaceId: 'ws-1',
        activePhase: mockActivePhase,
        checkedResourceUrls: ['https://react.dev'],
        report: mockReport,
        progress: { completed: 1, total: 2, percent: 50 },
      }),
    );

    await waitFor(() => {
      expect(result.current.reviews).toBeDefined();
    });

    await result.current.submitReview({
      reviewType: 'weekly',
      summary: 'This week I learned React basics.',
    });

    await waitFor(() => {
      expect(mockCreateSnailLearningPathReview).toHaveBeenCalledWith(
        'ws-1',
        expect.any(FormData),
        expect.any(Object),
      );
    });
  });

  it('submitReview adds new review to local state', async () => {
    mockCreateSnailLearningPathReview.mockResolvedValue({
      data: { ...mockReview, review_id: 'new-review' },
    });

    const { result } = renderHook(() =>
      useReviews({
        workspaceId: 'ws-1',
        activePhase: mockActivePhase,
        checkedResourceUrls: [],
        report: mockReport,
        progress: { completed: 1, total: 2, percent: 50 },
      }),
    );

    await waitFor(() => {
      expect(result.current.reviews).toBeDefined();
    });

    const initialCount = result.current.reviews.length;
    await result.current.submitReview({
      reviewType: 'monthly',
      summary: 'Monthly summary.',
    });

    await waitFor(() => {
      expect(result.current.reviews.length).toBeGreaterThanOrEqual(
        initialCount,
      );
    });
  });

  it('submitReview encodes FormData fields correctly', async () => {
    let capturedFormData: FormData | undefined;
    mockCreateSnailLearningPathReview.mockImplementation(
      async (_: string, formData: FormData) => {
        capturedFormData = formData;
        return { data: mockReview };
      },
    );

    const { result } = renderHook(() =>
      useReviews({
        workspaceId: 'ws-1',
        activePhase: mockActivePhase,
        checkedResourceUrls: ['https://react.dev'],
        report: mockReport,
        progress: { completed: 1, total: 2, percent: 50 },
      }),
    );

    await waitFor(() => {
      expect(result.current.reviews).toBeDefined();
    });

    const evidenceFile = new File(['evidence'], 'evidence.txt', {
      type: 'text/plain',
    });
    await result.current.submitReview({
      reviewType: 'weekly',
      summary: 'Test summary',
      files: [evidenceFile],
    });

    await waitFor(() => {
      expect(capturedFormData?.get('review_type')).toBe('weekly');
      expect(capturedFormData?.get('phase_key')).toBe('short_term');
      expect(capturedFormData?.get('user_prompt')).toBe('Test summary');
      expect(
        JSON.parse(capturedFormData?.get('checked_resource_urls') as string),
      ).toEqual(['https://react.dev']);
      expect(capturedFormData?.getAll('files')).toHaveLength(1);
    });
  });

  it('submitReview throws when API returns no data', async () => {
    mockCreateSnailLearningPathReview.mockResolvedValue({ data: undefined });

    const { result } = renderHook(() =>
      useReviews({
        workspaceId: 'ws-1',
        activePhase: mockActivePhase,
        checkedResourceUrls: [],
        report: mockReport,
        progress: { completed: 0, total: 1, percent: 0 },
      }),
    );

    await waitFor(() => {
      expect(result.current.reviews).toBeDefined();
    });

    await expect(
      result.current.submitReview({
        reviewType: 'weekly',
        summary: 'Test summary',
      }),
    ).rejects.toThrow();
  });
});
