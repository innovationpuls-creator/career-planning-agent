import { useCallback, useEffect, useState } from 'react';
import { getGrowthWorkbench } from '@/services/ant-design-pro/api';

type UseGrowthWorkbenchOptions = {
  favoriteId?: number;
};

const getRequestErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { detail?: string } }; message?: string })
    ?.response?.data?.detail ||
  (error as { message?: string })?.message ||
  fallback;

export function useGrowthWorkbench({ favoriteId }: UseGrowthWorkbenchOptions) {
  const [workbench, setWorkbench] =
    useState<API.GrowthWorkbenchAggregatePayload>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!favoriteId) {
      setWorkbench(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const response = await getGrowthWorkbench(favoriteId, {
        skipErrorHandler: true,
      });
      setWorkbench(response?.data);
    } catch (requestError: unknown) {
      setError(
        getRequestErrorMessage(requestError, '工作台数据加载失败。'),
      );
    } finally {
      setLoading(false);
    }
  }, [favoriteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    workbench,
    loading,
    error,
    refresh,
  };
}
