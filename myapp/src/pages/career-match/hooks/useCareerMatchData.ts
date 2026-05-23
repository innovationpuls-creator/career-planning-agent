import { useCallback, useEffect, useState } from 'react';
import {
  createCareerDevelopmentFavorite,
  deleteCareerDevelopmentFavorite,
  getCareerDevelopmentFavorites,
  getCareerDevelopmentMatchInit,
  getStudentCompetencyLatestAnalysis,
} from '@/services/ant-design-pro/api';
import { goToSnailLearningPath } from '../../career-development-report/learning-path/learningPathUtils';

export type MatchTabKey = 'comparison' | 'advice' | 'company';

interface UseCareerMatchDataResult {
  matchData: API.CareerDevelopmentMatchInitPayload | undefined;
  competencyProfile: Record<string, string[]> | undefined;
  favorites: API.CareerDevelopmentFavoritePayload[];
  activeRecommendationId: string | undefined;
  activeRecommendation: API.CareerDevelopmentMatchReport | undefined;
  activeRecommendationFavorite: API.CareerDevelopmentFavoritePayload | undefined;
  activeTab: MatchTabKey;
  activeGapKey: string | undefined;
  favoriteSubmitting: boolean;
  loading: boolean;
  error: string | undefined;
  sourceUpdatedAt: string | undefined;
  setActiveRecommendationId: (id: string) => void;
  setActiveTab: (tab: MatchTabKey) => void;
  setActiveGapKey: (key: string | undefined) => void;
  toggleFavorite: () => Promise<void>;
  generatePlan: () => void;
}

function extractRequestError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err)
    return String((err as { message: unknown }).message);
  return '未知错误';
}

const buildFavoriteTargetKey = (report: API.CareerDevelopmentMatchReport) =>
  `${report.canonical_job_title}::${report.industry || ''}`;

export function useCareerMatchData(): UseCareerMatchDataResult {
  const [matchData, setMatchData] =
    useState<API.CareerDevelopmentMatchInitPayload>();
  const [competencyProfile, setCompetencyProfile] =
    useState<Record<string, string[]>>();
  const [favorites, setFavorites] = useState<
    API.CareerDevelopmentFavoritePayload[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [activeRecommendationId, setActiveRecommendationId] =
    useState<string>();
  const [activeTab, setActiveTab] = useState<MatchTabKey>('comparison');
  const [activeGapKey, setActiveGapKey] = useState<string>();
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState<string>();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const [initRes, favRes, compRes] = await Promise.all([
          getCareerDevelopmentMatchInit({ skipErrorHandler: true }),
          getCareerDevelopmentFavorites({ skipErrorHandler: true }),
          getStudentCompetencyLatestAnalysis({ skipErrorHandler: true }),
        ]);
        if (!mounted) return;
        setMatchData(initRes.data);
        setFavorites(favRes.data || []);
        setCompetencyProfile(compRes.data.profile);
        setSourceUpdatedAt(initRes.data.source?.updated_at);
        setActiveRecommendationId((current) => {
          const recs = initRes.data.recommendations || [];
          if (recs.some((r) => r.report_id === current)) return current;
          return initRes.data.default_report_id || recs[0]?.report_id;
        });
      } catch (err: unknown) {
        if (!mounted) return;
        setError(
          err instanceof Error ? err.message : extractRequestError(err),
        );
        setMatchData(undefined);
        setActiveRecommendationId(undefined);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const recommendations = matchData?.recommendations || [];
  const activeRecommendation =
    recommendations.find((r) => r.report_id === activeRecommendationId) ||
    recommendations[0];
  const activeRecommendationFavorite = activeRecommendation
    ? favorites.find(
        (f) =>
          f.report_id === activeRecommendation.report_id ||
          f.target_key === buildFavoriteTargetKey(activeRecommendation),
      )
    : undefined;

  useEffect(() => {
    if (!activeRecommendation) return;
    const nextKey =
      activeRecommendation.priority_gap_dimensions?.[0] ||
      activeRecommendation.action_advices?.[0]?.key ||
      activeRecommendation.comparison_dimensions?.[0]?.key;
    if (!nextKey) return;
    const valid = new Set([
      ...(activeRecommendation.priority_gap_dimensions || []),
      ...(activeRecommendation.action_advices || []).map((a) => a.key),
      ...(activeRecommendation.comparison_dimensions || []).map((d) => d.key),
    ]);
    setActiveGapKey((prev) => (prev && valid.has(prev) ? prev : nextKey));
  }, [activeRecommendation?.report_id]);

  const toggleFavorite = useCallback(async () => {
    if (!activeRecommendation) return;
    setFavoriteSubmitting(true);
    try {
      if (activeRecommendationFavorite) {
        await deleteCareerDevelopmentFavorite(
          activeRecommendationFavorite.favorite_id,
          { skipErrorHandler: true },
        );
        setFavorites((prev) =>
          prev.filter(
            (f) =>
              f.favorite_id !== activeRecommendationFavorite.favorite_id,
          ),
        );
      } else {
        const res = await createCareerDevelopmentFavorite(
          { source_kind: 'recommendation', report: activeRecommendation },
          { skipErrorHandler: true },
        );
        setFavorites((prev) => [
          ...prev.filter((f) => f.favorite_id !== res.data.favorite_id),
          res.data,
        ]);
      }
    } catch (err) {
      throw new Error(extractRequestError(err));
    } finally {
      setFavoriteSubmitting(false);
    }
  }, [activeRecommendation, activeRecommendationFavorite]);

  const generatePlan = useCallback(() => {
    if (!activeRecommendationFavorite) return;
    goToSnailLearningPath(activeRecommendationFavorite.favorite_id);
  }, [activeRecommendationFavorite]);

  return {
    matchData,
    competencyProfile,
    favorites,
    activeRecommendationId,
    activeRecommendation,
    activeRecommendationFavorite,
    activeTab,
    activeGapKey,
    favoriteSubmitting,
    loading,
    error,
    sourceUpdatedAt,
    setActiveRecommendationId,
    setActiveTab,
    setActiveGapKey,
    toggleFavorite,
    generatePlan,
  };
}
