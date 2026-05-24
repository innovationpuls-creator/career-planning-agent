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

const isNotFoundError = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status === 404 ||
  String((error as { message?: string })?.message || '').includes('404');

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
      if (isNotFoundError(requestError)) {
        setWorkbench(undefined);
        return;
      }
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
