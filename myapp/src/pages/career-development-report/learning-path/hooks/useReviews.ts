import { useCallback, useEffect, useState } from 'react';
import {
  createSnailLearningPathReview,
  listSnailLearningPathReviews,
} from '@/services/ant-design-pro/api';
import { buildSnailReviewFormData } from '../learningPathUtils';

export interface UseReviewsOptions {
  workspaceId: string;
  activePhase: API.GrowthPlanPhase;
  checkedResourceUrls: string[];
  report: API.CareerDevelopmentMatchReport;
  progress: { completed: number; total: number; percent: number };
}

export interface UseReviewsResult {
  reviews: API.SnailLearningPathReviewPayload[];
  loading: boolean;
  submittingType: 'weekly' | 'monthly' | undefined;
  submitReview: (input: {
    reviewType: 'weekly' | 'monthly';
    summary: string;
    files?: File[];
  }) => Promise<void>;
}

export function useReviews({
  workspaceId,
  activePhase,
  checkedResourceUrls,
  report,
  progress,
}: UseReviewsOptions): UseReviewsResult {
  const [reviews, setReviews] = useState<API.SnailLearningPathReviewPayload[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [submittingType, setSubmittingType] = useState<
    'weekly' | 'monthly'
  >();

  useEffect(() => {
    if (!workspaceId || !activePhase?.phase_key) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listSnailLearningPathReviews(
      workspaceId,
      { phase_key: activePhase.phase_key },
      { skipErrorHandler: true },
    )
      .then((response) => setReviews(response?.data || []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [workspaceId, activePhase?.phase_key]);

  const submitReview = useCallback(
    async ({
      reviewType,
      summary,
      files = [],
    }: {
      reviewType: 'weekly' | 'monthly';
      summary: string;
      files?: File[];
    }) => {
      if (!workspaceId || !activePhase) return;
      const formData = buildSnailReviewFormData({
        reviewType,
        phase: activePhase,
        checkedResourceUrls,
        userPrompt: summary,
        report,
        progress,
        files,
      });
      setSubmittingType(reviewType);
      try {
        const response = await createSnailLearningPathReview(
          workspaceId,
          formData,
          { skipErrorHandler: true },
        );
        if (!response?.data) throw new Error('未收到检查结果。');
        setReviews((current) => [
          response.data,
          ...current.filter(
            (item) => item.review_id !== response.data.review_id,
          ),
        ]);
      } finally {
        setSubmittingType(undefined);
      }
    },
    [workspaceId, activePhase, checkedResourceUrls, report, progress],
  );

  return { reviews, loading, submittingType, submitReview };
}
