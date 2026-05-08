import {
  currentUser,
  getCareerDevelopmentFavorites,
  getHomeV2,
  getStudentCompetencyLatestAnalysis,
} from "@/services/ant-design-pro/api";
import { useCallback, useEffect, useState } from "react";

interface UseHomeDataResult {
  homeData: API.HomeV2Payload | undefined;
  currentUserData: API.CurrentUser | undefined;
  favorites: API.CareerDevelopmentFavoritePayload[];
  latestAnalysis: API.StudentCompetencyLatestAnalysisPayload | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useHomeData(): UseHomeDataResult {
  const [homeData, setHomeData] = useState<API.HomeV2Payload>();
  const [currentUserData, setCurrentUserData] = useState<API.CurrentUser>();
  const [favorites, setFavorites] = useState<
    API.CareerDevelopmentFavoritePayload[]
  >([]);
  const [latestAnalysis, setLatestAnalysis] =
    useState<API.StudentCompetencyLatestAnalysisPayload>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [homeResult, userResult, favoritesResult, analysisResult] =
          await Promise.allSettled([
            getHomeV2({ skipErrorHandler: true }),
            currentUser({ skipErrorHandler: true }),
            getCareerDevelopmentFavorites({ skipErrorHandler: true }),
            getStudentCompetencyLatestAnalysis({ skipErrorHandler: true }),
          ]);

        if (!mounted) return;

        if (homeResult.status === "rejected") {
          throw homeResult.reason;
        }

        const homeResponse = homeResult.value;
        if (!homeResponse?.data) {
          setError("获取首页数据失败");
          setLoading(false);
          return;
        }

        setHomeData(homeResponse.data);
        setCurrentUserData(
          userResult.status === "fulfilled" ? userResult.value.data : undefined
        );
        setFavorites(
          favoritesResult.status === "fulfilled"
            ? favoritesResult.value.data || []
            : []
        );
        setLatestAnalysis(
          analysisResult.status === "fulfilled"
            ? analysisResult.value.data
            : undefined
        );
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "获取首页数据失败");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  return {
    homeData,
    currentUserData,
    favorites,
    latestAnalysis,
    loading,
    error,
    refresh,
  };
}
