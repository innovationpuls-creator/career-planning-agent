import { message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acceptGrowthWorkbenchArtifact,
  cancelGrowthWorkbenchTask,
  createGrowthWorkbenchTask,
  skipGrowthWorkbenchTask,
  streamGrowthWorkbenchTask,
} from '@/services/ant-design-pro/api';

type UseWorkbenchTaskQueueOptions = {
  favoriteId?: number;
  onRefresh: () => Promise<void>;
};

const terminalStatuses = new Set([
  'completed',
  'failed',
  'cancelled',
  'skipped',
  'blocked',
]);

const getRequestErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { detail?: string } }; message?: string })
    ?.response?.data?.detail ||
  (error as { message?: string })?.message ||
  fallback;

export function useWorkbenchTaskQueue({
  favoriteId,
  onRefresh,
}: UseWorkbenchTaskQueueOptions) {
  const abortRef = useRef<AbortController | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string>();
  const [taskError, setTaskError] = useState<string>();
  const [taskSnapshots, setTaskSnapshots] = useState<
    Record<string, API.GrowthWorkbenchTaskPayload>
  >({});

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const streamTask = useCallback(
    async (taskId: string) => {
      stopStream();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        for await (const event of streamGrowthWorkbenchTask(
          taskId,
          controller.signal,
        )) {
          if (event.stage === '__end__') break;
          if (event.snapshot) {
            setTaskSnapshots((current) => ({
              ...current,
              [event.snapshot!.task_id]: event.snapshot!,
            }));
          }
          if (terminalStatuses.has(event.status)) {
            await onRefresh();
            break;
          }
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [onRefresh, stopStream],
  );

  const runTask = useCallback(
    async (
      taskType: API.GrowthWorkbenchTaskType,
      runMode: 'single' | 'full_queue' = 'single',
    ) => {
      if (!favoriteId) return;
      setTaskError(undefined);
      try {
        const response = await createGrowthWorkbenchTask(
          { favorite_id: favoriteId, task_type: taskType, run_mode: runMode },
          { skipErrorHandler: true },
        );
        const task = response?.data;
        if (!task?.task_id) {
          throw new Error('任务创建失败。');
        }
        setRunningTaskId(task.task_id);
        setTaskSnapshots((current) => ({
          ...current,
          [task.task_id]: task,
        }));
        await streamTask(task.task_id);
      } catch (error: unknown) {
        setTaskError(getRequestErrorMessage(error, '任务运行失败。'));
      } finally {
        setRunningTaskId(undefined);
      }
    },
    [favoriteId, streamTask],
  );

  const runFullQueue = useCallback(
    () => runTask('full_queue', 'full_queue'),
    [runTask],
  );

  const skipTask = useCallback(
    async (taskId: string) => {
      setTaskError(undefined);
      try {
        await skipGrowthWorkbenchTask(taskId, { skipErrorHandler: true });
        await onRefresh();
      } catch (error: unknown) {
        setTaskError(getRequestErrorMessage(error, '跳过任务失败。'));
      }
    },
    [onRefresh],
  );

  const cancelTask = useCallback(
    async (taskId: string) => {
      setTaskError(undefined);
      try {
        await cancelGrowthWorkbenchTask(taskId, { skipErrorHandler: true });
        stopStream();
        await onRefresh();
      } catch (error: unknown) {
        setTaskError(getRequestErrorMessage(error, '取消任务失败。'));
      }
    },
    [onRefresh, stopStream],
  );

  const acceptArtifact = useCallback(
    async (artifactId: string) => {
      setTaskError(undefined);
      try {
        await acceptGrowthWorkbenchArtifact(artifactId, {
          skipErrorHandler: true,
        });
        message.success('已接受产物。');
        await onRefresh();
      } catch (error: unknown) {
        setTaskError(getRequestErrorMessage(error, '接受产物失败。'));
      }
    },
    [onRefresh],
  );

  return {
    runningTaskId,
    taskError,
    taskSnapshots,
    runTask,
    runFullQueue,
    skipTask,
    cancelTask,
    acceptArtifact,
  };
}
