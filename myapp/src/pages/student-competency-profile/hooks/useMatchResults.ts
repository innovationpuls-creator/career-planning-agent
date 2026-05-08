import { useCallback, useEffect, useState } from 'react';
import {
  createCareerDevelopmentFavorite,
  deleteCareerDevelopmentFavorite,
  getCareerDevelopmentFavorites,
  getCareerDevelopmentMatchInit,
} from '@/services/ant-design-pro/api';
import { goToSnailLearningPath } from '../../career-development-report/learning-path/learningPathUtils';
import { extractRequestError } from '../shared';

const buildFavoriteTargetKey = (report: API.CareerDevelopmentMatchReport) =>
  `${report.canonical_job_title}::${report.industry || ''}`;

interface UseMatchResultsResult {
  matchData: API.CareerDevelopmentMatchInitPayload | undefined;
  recommendations: API.CareerDevelopmentMatchReport[];
  favorites: API.CareerDevelopmentFavoritePayload[];
  activeRecommendationId: string | undefined;
  activeRecommendation: API.CareerDevelopmentMatchReport | undefined;
  activeRecommendationFavorite:
    | API.CareerDevelopmentFavoritePayload
    | undefined;
  activeResultTab: 'comparison' | 'advice' | 'company';
  activeGapKey: string | undefined;
  favoriteSubmitting: boolean;
  loading: boolean;
  error: string | undefined;
  setActiveRecommendationId: (id: string) => void;
  setActiveResultTab: (tab: 'comparison' | 'advice' | 'company') => void;
  setActiveGapKey: (key: string | undefined) => void;
  toggleFavorite: () => Promise<void>;
  generatePlan: () => void;
  refresh: () => void;
}

export function useMatchResults(): UseMatchResultsResult {
  const [matchData, setMatchData] =
    useState<API.CareerDevelopmentMatchInitPayload>();
  const [favorites, setFavorites] = useState<
    API.CareerDevelopmentFavoritePayload[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [activeRecommendationId, setActiveRecommendationId] =
    useState<string>();
  const [activeResultTab, setActiveResultTab] = useState<
    'comparison' | 'advice' | 'company'
  >('comparison');
  const [activeGapKey, setActiveGapKey] = useState<string>();
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const [initRes, favoriteRes] = await Promise.all([
          getCareerDevelopmentMatchInit({ skipErrorHandler: true }),
          getCareerDevelopmentFavorites({ skipErrorHandler: true }),
        ]);
        if (!mounted) return;

        setMatchData(initRes.data);
        setFavorites(favoriteRes.data || []);
        setActiveRecommendationId((current) => {
          const nextRecommendations = initRes.data.recommendations || [];
          const stillExists = nextRecommendations.some(
            (item) => item.report_id === current,
          );
          if (stillExists) return current;
          return (
            initRes.data.default_report_id || nextRecommendations[0]?.report_id
          );
        });
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : extractRequestError(err));
        setMatchData(undefined);
        setActiveRecommendationId(undefined);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadData();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const recommendations = matchData?.recommendations || [];
  const activeRecommendation =
    recommendations.find((item) => item.report_id === activeRecommendationId) ||
    recommendations[0];
  const activeRecommendationFavorite = activeRecommendation
    ? favorites.find(
        (item) =>
          item.report_id === activeRecommendation.report_id ||
          item.target_key === buildFavoriteTargetKey(activeRecommendation),
      )
    : undefined;

  useEffect(() => {
    if (!activeRecommendation) return;
    const nextGapKey =
      activeRecommendation.priority_gap_dimensions?.[0] ||
      activeRecommendation.action_advices?.[0]?.key ||
      activeRecommendation.comparison_dimensions?.[0]?.key;
    if (!nextGapKey) return;
    const validKeys = new Set([
      ...(activeRecommendation.priority_gap_dimensions || []),
      ...(activeRecommendation.action_advices || []).map((a) => a.key),
      ...(activeRecommendation.comparison_dimensions || []).map((d) => d.key),
    ]);
    setActiveGapKey((prev) =>
      prev && validKeys.has(prev) ? prev : nextGapKey,
    );
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
            (item) =>
              item.favorite_id !== activeRecommendationFavorite.favorite_id,
          ),
        );
      } else {
        const res = await createCareerDevelopmentFavorite(
          {
            source_kind: 'recommendation',
            report: activeRecommendation,
          },
          { skipErrorHandler: true },
        );
        setFavorites((prev) => {
          const next = prev.filter(
            (item) => item.favorite_id !== res.data.favorite_id,
          );
          return [...next, res.data];
        });
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
    recommendations,
    favorites,
    activeRecommendationId,
    activeRecommendation,
    activeRecommendationFavorite,
    activeResultTab,
    activeGapKey,
    favoriteSubmitting,
    loading,
    error,
    setActiveRecommendationId,
    setActiveResultTab,
    setActiveGapKey,
    toggleFavorite,
    generatePlan,
    refresh,
  };
}
