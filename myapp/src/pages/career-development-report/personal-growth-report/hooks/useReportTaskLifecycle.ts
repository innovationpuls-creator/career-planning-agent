import { useEffect, useRef, useState, useCallback } from 'react';
import { message } from 'antd';
import {
  createPersonalGrowthReportTask,
  getPersonalGrowthReportTask,
  cancelPersonalGrowthReportTask,
  streamPersonalGrowthReportTask,
} from '@/services/ant-design-pro/api';
import {
  clearPersonalGrowthDraft,
  clearPersonalGrowthTaskId,
  readPersonalGrowthTaskId,
  savePersonalGrowthTaskId,
} from '../personalGrowthReportUtils';

const getRequestErrorMessage = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
  (error as { message?: string })?.message ||
  fallback;

type UseReportTaskLifecycleOptions = {
  favoriteId?: number;
  hasReportContent: boolean;
  workspaceId?: string;
  activeTaskId?: string;
  onReportReady: () => Promise<void>;
};

export function useReportTaskLifecycle({
  favoriteId,
  hasReportContent,
  workspaceId,
  activeTaskId,
  onReportReady,
}: UseReportTaskLifecycleOptions) {
  const taskAbortRef = useRef<AbortController | null>(null);

  const [taskSnapshot, setTaskSnapshot] = useState<API.PersonalGrowthReportTaskPayload>();
  const [creatingTask, setCreatingTask] = useState(false);
  const [cancellingTask, setCancellingTask] = useState(false);

  const generating =
    creatingTask ||
    taskSnapshot?.status === 'queued' ||
    taskSnapshot?.status === 'running';

  const stopTaskStream = useCallback(() => {
    taskAbortRef.current?.abort();
    taskAbortRef.current = null;
  }, []);

  const restoreTask = useCallback(
    async (
      targetFavoriteId: number,
      taskId?: string,
      setActionError?: (msg: string) => void,
    ) => {
      const restoredTaskId = taskId || readPersonalGrowthTaskId(targetFavoriteId);
      if (!restoredTaskId) {
        setTaskSnapshot(undefined);
        return;
      }
      try {
        const response = await getPersonalGrowthReportTask(restoredTaskId, {
          skipErrorHandler: true,
        });
        const snapshot = response?.data;
        setTaskSnapshot(snapshot);
        if (!snapshot) return;
        if (snapshot.status === 'failed') {
          setActionError?.(
            snapshot.error_message ||
              snapshot.latest_event?.status_text ||
              '报告生成失败。',
          );
          clearPersonalGrowthTaskId(targetFavoriteId);
          return;
        }
        if (snapshot.status === 'cancelled' || snapshot.status === 'completed') {
          clearPersonalGrowthTaskId(targetFavoriteId);
          return;
        }
        if (snapshot.status === 'queued' || snapshot.status === 'running') {
          savePersonalGrowthTaskId(targetFavoriteId, snapshot.task_id);
          stopTaskStream();
          const controller = new AbortController();
          taskAbortRef.current = controller;
          for await (const event of streamPersonalGrowthReportTask(
            snapshot.task_id,
            controller.signal,
          )) {
            if (event.snapshot) {
              setTaskSnapshot(event.snapshot);
            } else {
              setTaskSnapshot((current) =>
                current
                  ? {
                      ...current,
                      status: (event.status || current.status) as API.PersonalGrowthReportTaskPayload['status'],
                      progress: event.progress ?? current.progress,
                      latest_event: current.latest_event
                        ? {
                            ...current.latest_event,
                            stage: event.stage,
                            status_text:
                              event.status_text ||
                              current.latest_event.status_text,
                            progress:
                              event.progress ?? current.latest_event.progress,
                            created_at:
                              event.created_at ||
                              current.latest_event.created_at,
                          }
                        : undefined,
                    }
                  : current,
              );
            }

            const terminal = ['completed', 'task_cancelled', 'error', 'failed'].includes(
              event.stage,
            );
            if (!terminal) continue;

            if (event.stage === 'completed') {
              clearPersonalGrowthDraft(targetFavoriteId);
            }
            await onReportReady();
            if (event.stage === 'completed') {
              message.success('个人职业成长报告已生成完成。');
              clearPersonalGrowthTaskId(targetFavoriteId);
            }
            if (event.stage === 'task_cancelled') {
              message.info('已取消个人职业成长报告生成。');
              clearPersonalGrowthTaskId(targetFavoriteId);
            }
            if (
              event.stage === 'error' ||
              event.stage === 'failed' ||
              event.status === 'failed'
            ) {
              setActionError?.(event.status_text || '报告生成失败。');
              clearPersonalGrowthTaskId(targetFavoriteId);
            }
            break;
          }
        }
      } catch (error: unknown) {
        clearPersonalGrowthTaskId(targetFavoriteId);
        setActionError?.(
          getRequestErrorMessage(error, '任务状态恢复失败。'),
        );
      }
    },
    [stopTaskStream, onReportReady],
  );

  const handleStartAnalysis = useCallback(
    async (setActionError?: (msg: string) => void) => {
      if (!favoriteId) return;
      clearPersonalGrowthDraft(favoriteId, workspaceId);
      setCreatingTask(true);
      setActionError?.(undefined as unknown as string);
      try {
        const response = await createPersonalGrowthReportTask(
          { favorite_id: favoriteId, overwrite_current: hasReportContent },
          { skipErrorHandler: true },
        );
        const task = response?.data;
        if (!task?.task_id) throw new Error('任务创建失败。');
        savePersonalGrowthTaskId(favoriteId, task.task_id);
        setTaskSnapshot({
          task_id: task.task_id,
          favorite_id: favoriteId,
          status: task.status,
          progress: task.progress,
          overwrite_current: task.overwrite_current,
          created_at: task.started_at,
          updated_at: task.updated_at,
          latest_event: {
            stage: task.status,
            status_text: task.status_text,
            progress: task.progress,
            created_at: task.updated_at,
          },
        });
        await restoreTask(favoriteId, task.task_id, setActionError);
      } catch (error: unknown) {
        setActionError?.(
          getRequestErrorMessage(error, '报告生成失败。'),
        );
      } finally {
        setCreatingTask(false);
      }
    },
    [favoriteId, hasReportContent, workspaceId, restoreTask],
  );

  const handleCancelTask = useCallback(
    async (setActionError?: (msg: string) => void) => {
      if (!taskSnapshot?.task_id) return;
      setCancellingTask(true);
      try {
        await cancelPersonalGrowthReportTask(taskSnapshot.task_id, {
          skipErrorHandler: true,
        });
        if (favoriteId) clearPersonalGrowthTaskId(favoriteId);
        setTaskSnapshot((c) => (c ? { ...c, status: 'cancelled' as const } : c));
        message.info('已取消个人职业成长报告生成。');
      } catch (error: unknown) {
        setActionError?.(
          getRequestErrorMessage(error, '取消任务失败。'),
        );
      } finally {
        setCancellingTask(false);
      }
    },
    [taskSnapshot?.task_id, favoriteId],
  );

  // Restore task on mount
  useEffect(() => {
    if (!favoriteId) return;
    const taskId = activeTaskId;
    if (taskId) {
      savePersonalGrowthTaskId(favoriteId, taskId);
    }
    void restoreTask(favoriteId, taskId);
    // Run only when favoriteId or activeTaskId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteId, activeTaskId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTaskStream();
  }, [stopTaskStream]);

  return {
    taskSnapshot,
    setTaskSnapshot,
    creatingTask,
    cancellingTask,
    generating,
    restoreTask,
    handleStartAnalysis,
    handleCancelTask,
    stopTaskStream,
  };
}
