import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createCareerDevelopmentGoalPlanTask,
  deleteCareerDevelopmentFavorite,
  getCareerDevelopmentFavorites,
  getCareerDevelopmentGoalPlanTask,
  getCareerDevelopmentPlanWorkspace,
  streamCareerDevelopmentGoalPlanTask,
} from '@/services/ant-design-pro/api';

export const GOAL_PLAN_STORAGE_KEY = 'feature_map_career_goal_workspace_v2';
const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

export type GoalPlanningSharedState = {
  selectedFavoriteId?: number;
  taskIdsByFavorite?: Record<string, string>;
  activeTab?: string;
};

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const parseUtcLikeDate = (value?: string) => {
  if (!value) return undefined;
  const text = value.trim();
  if (!text) return undefined;
  const normalized = /(?:z|[+-]\d{2}:\d{2})$/i.test(text) ? text : `${text}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatInTimeZone = (
  value: string | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback: string,
) => {
  const date = parseUtcLikeDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIME_ZONE,
    hour12: false,
    ...options,
  })
    .format(date)
    .replace(/\//g, '-');
};

export const readGoalPlanningSharedState = (): GoalPlanningSharedState => {
  if (!canUseStorage()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(GOAL_PLAN_STORAGE_KEY) || '{}') as GoalPlanningSharedState;
  } catch {
    return {};
  }
};

export const writeGoalPlanningSharedState = (patch: GoalPlanningSharedState) => {
  if (!canUseStorage()) return;
  const current = readGoalPlanningSharedState();
  window.localStorage.setItem(
    GOAL_PLAN_STORAGE_KEY,
    JSON.stringify({
      ...current,
      ...patch,
    }),
  );
};

export const formatGoalPlanDate = (value?: string) =>
  formatInTimeZone(
    value,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    '待安排',
  );

export const formatGoalPlanDateTime = (value?: string) =>
  formatInTimeZone(
    value,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    },
    '待更新',
  );

export const buildGoalGraphPaths = (favorite?: API.CareerDevelopmentFavoritePayload) => {
  if (!favorite) {
    return {
      vertical: '/job-requirement-profile/vertical',
      learningPath: '/snail-learning-path',
    };
  }
  const vertical = new URLSearchParams({
    job_title: favorite.representative_job_title || favorite.canonical_job_title,
  });
  if (favorite.industry) vertical.set('industry', favorite.industry);
  return {
    vertical: `/job-requirement-profile/vertical?${vertical.toString()}`,
    learningPath: `/snail-learning-path?favorite_id=${favorite.favorite_id}`,
  };
};

export const useCareerGoalPlanningData = (
  options?: {
    workspaceMode?: 'goal-plan' | 'none';
  },
) => {
  const workspaceMode = options?.workspaceMode || 'goal-plan';
  const [favorites, setFavorites] = useState<API.CareerDevelopmentFavoritePayload[]>([]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<number | undefined>(
    () => readGoalPlanningSharedState().selectedFavoriteId,
  );
  const [taskIdsByFavorite, setTaskIdsByFavorite] = useState<Record<string, string>>(
    () => readGoalPlanningSharedState().taskIdsByFavorite || {},
  );
  const [taskSnapshot, setTaskSnapshot] = useState<API.CareerDevelopmentGoalPlanTaskPayload>();
  const [workspace, setWorkspace] = useState<API.PlanWorkspacePayload>();
  const [pageError, setPageError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [deletingFavoriteId, setDeletingFavoriteId] = useState<number>();
  const abortRef = useRef<AbortController | null>(null);

  const activeFavorite = useMemo(
    () => favorites.find((item) => item.favorite_id === selectedFavoriteId),
    [favorites, selectedFavoriteId],
  );
  const favoriteForView = workspace?.favorite || activeFavorite;

  useEffect(() => {
    writeGoalPlanningSharedState({ selectedFavoriteId, taskIdsByFavorite });
  }, [selectedFavoriteId, taskIdsByFavorite]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadFavorites = async () => {
    setFavoritesLoading(true);
    setPageError(undefined);
    try {
      const response = await getCareerDevelopmentFavorites({ skipErrorHandler: true });
      const items = response?.data || [];
      setFavorites(items);
      setSelectedFavoriteId((current) =>
        current && items.some((item) => item.favorite_id === current)
          ? current
          : items[0]?.favorite_id,
      );
    } catch (error: any) {
      setPageError(error?.message || '加载收藏目标失败。');
    } finally {
      setFavoritesLoading(false);
    }
  };

  const loadWorkspace = async (favoriteId: number) => {
    try {
      const response = await getCareerDevelopmentPlanWorkspace(favoriteId, {
        skipErrorHandler: true,
      });
      setWorkspace(response?.data);
    } catch (error: any) {
      const statusCode = error?.response?.status;
      if (statusCode === 404 || String(error?.message || '').includes('404')) {
        setWorkspace(undefined);
      } else {
        setActionError(error?.message || '工作台加载失败。');
      }
    }
  };

  const mergeTaskEvent = (
    taskId: string,
    favoriteId: number,
    event: import('@/services/ant-design-pro/api').CareerDevelopmentGoalPlanStreamEvent,
  ) => {
    setTaskSnapshot((current) => {
      const snapshotFromEvent = event.snapshot;
      if (snapshotFromEvent) {
        return snapshotFromEvent;
      }
      const base =
        current && current.task_id === taskId
          ? current
          : ({
              task_id: taskId,
              favorite_id: favoriteId,
              status: event.status || 'running',
              progress: event.progress || 0,
              updated_at: event.created_at || new Date().toISOString(),
            } as API.CareerDevelopmentGoalPlanTaskPayload);

      return {
        ...base,
        status: event.status || base.status,
        progress: event.progress ?? base.progress,
        updated_at: event.created_at || base.updated_at,
        latest_event: event.status_text
          ? {
              stage: event.stage,
              status_text: event.status_text,
              progress: event.progress ?? base.progress,
              created_at: event.created_at || base.updated_at,
            }
          : base.latest_event,
      };
    });
  };

  const streamTask = async (taskId: string, favoriteId: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const event of streamCareerDevelopmentGoalPlanTask(taskId, controller.signal)) {
        if (event.stage === '__end__') break;
        mergeTaskEvent(taskId, favoriteId, event);
        const nextStatus = event.snapshot?.status || event.status;
        if (nextStatus === 'completed') {
          await loadWorkspace(favoriteId);
          break;
        }
      }
    } catch (error: any) {
      if (!controller.signal.aborted) {
        setActionError(error?.message || '任务进度流加载失败。');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    if (!activeFavorite) {
      setWorkspace(undefined);
      setTaskSnapshot(undefined);
      return;
    }

    if (workspaceMode === 'none') {
      setWorkspace(undefined);
      setTaskSnapshot(undefined);
      return;
    }

    void loadWorkspace(activeFavorite.favorite_id);
    const taskId = taskIdsByFavorite[String(activeFavorite.favorite_id)];
    if (!taskId) {
      setTaskSnapshot(undefined);
      return;
    }

    void getCareerDevelopmentGoalPlanTask(taskId, { skipErrorHandler: true })
      .then(async (response) => {
        const snapshot = response?.data;
        setTaskSnapshot(snapshot);
        if (!snapshot) return;
        if (snapshot.status === 'completed') {
          await loadWorkspace(activeFavorite.favorite_id);
          return;
        }
        if (snapshot.status === 'queued' || snapshot.status === 'running') {
          await streamTask(taskId, activeFavorite.favorite_id);
        }
      })
      .catch(() => setTaskSnapshot(undefined));
  }, [activeFavorite?.favorite_id, taskIdsByFavorite, workspaceMode]);

  const startAnalysis = async () => {
    if (!activeFavorite) return;
    setActionError(undefined);
    try {
      const response = await createCareerDevelopmentGoalPlanTask(
        { favorite_id: activeFavorite.favorite_id },
        { skipErrorHandler: true },
      );
      const task = response?.data;
      if (!task?.task_id) throw new Error('任务创建失败。');
      setTaskIdsByFavorite((current) => ({
        ...current,
        [String(activeFavorite.favorite_id)]: task.task_id,
      }));
      setTaskSnapshot({
        task_id: task.task_id,
        favorite_id: activeFavorite.favorite_id,
        status: task.status,
        progress: task.progress,
        updated_at: new Date().toISOString(),
      });
      await streamTask(task.task_id, activeFavorite.favorite_id);
    } catch (error: any) {
      setActionError(error?.message || '生成分析报告失败。');
    }
  };

  const removeFavorite = async (favorite: API.CareerDevelopmentFavoritePayload) => {
    setDeletingFavoriteId(favorite.favorite_id);
    setActionError(undefined);
    try {
      await deleteCareerDevelopmentFavorite(favorite.favorite_id, { skipErrorHandler: true });
      await loadFavorites();
      if (selectedFavoriteId === favorite.favorite_id) {
        setWorkspace(undefined);
        setTaskSnapshot(undefined);
      }
    } catch (error: any) {
      setActionError(error?.message || '删除收藏目标失败。');
    } finally {
      setDeletingFavoriteId(undefined);
    }
  };

  return {
    favorites,
    favoritesLoading,
    pageError,
    activeFavorite,
    favoriteForView,
    selectedFavoriteId,
    setSelectedFavoriteId,
    taskIdsByFavorite,
    taskSnapshot,
    workspace,
    setWorkspace,
    actionError,
    setActionError,
    deletingFavoriteId,
    loadFavorites,
    loadWorkspace,
    startAnalysis,
    removeFavorite,
  };
};
