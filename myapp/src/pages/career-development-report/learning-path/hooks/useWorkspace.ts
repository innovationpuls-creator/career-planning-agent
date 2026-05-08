import { useCallback, useEffect, useState } from 'react';
import {
  getCareerDevelopmentFavorites,
  getCareerDevelopmentPlanWorkspace,
  getHomeV2,
  getStudentCompetencyLatestAnalysis,
  initializeSnailLearningPathWorkspace,
} from '@/services/ant-design-pro/api';
import { saveFavoriteId } from '../learningPathUtils';

export type PreparationState = {
  hasFavorite: boolean;
  hasProfile: boolean;
  hasLatestAnalysis: boolean;
  hasWorkspace: boolean;
};

export interface UseWorkspaceResult {
  workspace: API.PlanWorkspacePayload | undefined;
  loading: boolean;
  error: string | undefined;
  preparation: PreparationState;
  refresh: () => void;
}

export function useWorkspace(favoriteId: number): UseWorkspaceResult {
  const [workspace, setWorkspace] = useState<API.PlanWorkspacePayload>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [preparation, setPreparation] = useState<PreparationState>({
    hasFavorite: false,
    hasProfile: false,
    hasLatestAnalysis: false,
    hasWorkspace: false,
  });

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [homeRes, analysisRes, favoritesRes] = await Promise.all([
        getHomeV2({ skipErrorHandler: true }),
        getStudentCompetencyLatestAnalysis({ skipErrorHandler: true }),
        getCareerDevelopmentFavorites({ skipErrorHandler: true }),
      ]);

      const favorites = favoritesRes?.data || [];
      const matchedFavorite = favoriteId
        ? favorites.find((item) => item.favorite_id === favoriteId)
        : undefined;

      const nextPreparation: PreparationState = {
        hasFavorite: favoriteId
          ? Boolean(matchedFavorite)
          : favorites.length > 0,
        hasProfile: Boolean(
          homeRes?.data?.onboarding_completed && homeRes.data.profile,
        ),
        hasLatestAnalysis: Boolean(analysisRes?.data?.available),
        hasWorkspace: false,
      };
      setPreparation(nextPreparation);

      if (!favoriteId) {
        setWorkspace(undefined);
        setLoadError(
          '请先在"职业匹配"中选择并收藏目标岗位，再进入蜗牛学习路径。',
        );
        return;
      }
      if (!matchedFavorite) {
        setWorkspace(undefined);
        setLoadError(
          '当前目标岗位不存在或不属于当前账号，请先在"职业匹配"中重新收藏目标岗位。',
        );
        return;
      }
      if (!nextPreparation.hasProfile) {
        setWorkspace(undefined);
        setLoadError('请先前往"首页"补充我的资料，再生成蜗牛学习路径。');
        return;
      }
      if (!nextPreparation.hasLatestAnalysis) {
        setWorkspace(undefined);
        setLoadError('请先前往"简历解析"完成 12 维解析，再生成蜗牛学习路径。');
        return;
      }

      // Try existing workspace first
      try {
        const response = await getCareerDevelopmentPlanWorkspace(favoriteId, {
          skipErrorHandler: true,
        });
        if (response?.data) {
          setWorkspace(response.data);
          setPreparation((current) => ({ ...current, hasWorkspace: true }));
          return;
        }
      } catch (error: any) {
        const statusCode = error?.response?.status;
        if (
          statusCode !== 404 &&
          !String(error?.message || '').includes('404')
        ) {
          throw error;
        }
      }

      // Initialize new workspace (404 fallback path)
      const created = await initializeSnailLearningPathWorkspace(favoriteId, {
        skipErrorHandler: true,
      });
      setWorkspace(created?.data);
      setPreparation((current) => ({
        ...current,
        hasWorkspace: Boolean(created?.data),
      }));
    } catch (error: any) {
      setWorkspace(undefined);
      setLoadError(error?.message || '加载蜗牛学习路径失败。');
    } finally {
      setLoading(false);
    }
  }, [favoriteId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (favoriteId) saveFavoriteId(favoriteId);
  }, [favoriteId]);

  const refresh = useCallback(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  return { workspace, loading, error: loadError, preparation, refresh };
}
