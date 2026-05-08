import { message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelPersonalGrowthReportTask,
  createPersonalGrowthReportTask,
  getPersonalGrowthReportTask,
  streamPersonalGrowthReportTask,
  type PersonalGrowthReportTaskStreamEvent,
} from '@/services/ant-design-pro/api';
import {
  clearPersonalGrowthDraft,
  clearPersonalGrowthTaskId,
  readPersonalGrowthTaskId,
  savePersonalGrowthTaskId,
} from '../personalGrowthReportUtils';

const terminalStages = new Set(['completed', 'task_cancelled', 'error', 'failed']);
const terminalStatuses = new Set(['completed', 'cancelled', 'failed']);

const getRequestErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { detail?: string } }; message?: string })
    ?.response?.data?.detail ||
  (error as { message?: string })?.message ||
  fallback;

export type ReportTaskPreviewEvent = {
  key: string;
  stage: string;
  text: string;
  progress: number;
  createdAt?: string;
};

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
  const onReportReadyRef = useRef(onReportReady);
  const [taskSnapshot, setTaskSnapshot] =
    useState<API.PersonalGrowthReportTaskPayload>();
  const [previewEvents, setPreviewEvents] = useState<ReportTaskPreviewEvent[]>(
    [],
  );
  const [creatingTask, setCreatingTask] = useState(false);
  const [cancellingTask, setCancellingTask] = useState(false);

  const progress = taskSnapshot?.progress || 0;
  const statusText = taskSnapshot?.latest_event?.status_text || '正在准备...';
  const generating =
    creatingTask ||
    taskSnapshot?.status === 'queued' ||
    taskSnapshot?.status === 'running';

  useEffect(() => {
    onReportReadyRef.current = onReportReady;
  }, [onReportReady]);

  const stopTaskStream = useCallback(() => {
    taskAbortRef.current?.abort();
    taskAbortRef.current = null;
  }, []);

  const appendPreviewEvent = useCallback(
    (event: PersonalGrowthReportTaskStreamEvent) => {
      if (!event.status_text) return;
      setPreviewEvents((current) => {
        const key = `${event.stage}-${event.progress ?? 0}-${event.created_at || current.length}`;
        if (current.some((item) => item.key === key)) return current;
        return [
          ...current,
          {
            key,
            stage: event.stage,
            text: event.status_text || '',
            progress: event.progress ?? 0,
            createdAt: event.created_at,
          },
        ].slice(-6);
      });
    },
    [],
  );

  const mergeStreamEvent = useCallback(
    (event: PersonalGrowthReportTaskStreamEvent) => {
      appendPreviewEvent(event);
      if (event.snapshot) {
        setTaskSnapshot(event.snapshot);
        return event.snapshot;
      }

      let nextSnapshot: API.PersonalGrowthReportTaskPayload | undefined;
      setTaskSnapshot((current) => {
        if (!current) return current;
        nextSnapshot = {
          ...current,
          status: (event.status || current.status) as API.PersonalGrowthReportTaskPayload['status'],
          progress: event.progress ?? current.progress,
          updated_at: event.created_at || current.updated_at,
          latest_event: event.status_text
            ? {
                stage: event.stage,
                status_text: event.status_text,
                progress: event.progress ?? current.progress,
                created_at: event.created_at || current.updated_at,
              }
            : current.latest_event,
        };
        return nextSnapshot;
      });
      return nextSnapshot;
    },
    [appendPreviewEvent],
  );

  const finishTask = useCallback(
    async (
      targetFavoriteId: number,
      event: PersonalGrowthReportTaskStreamEvent,
      setActionError?: (message?: string) => void,
    ) => {
      await onReportReadyRef.current();
      if (event.stage === 'completed' || event.status === 'completed') {
        clearPersonalGrowthDraft(targetFavoriteId);
        clearPersonalGrowthTaskId(targetFavoriteId);
        message.success('个人职业成长报告已生成完成。');
        return;
      }
      if (event.stage === 'task_cancelled' || event.status === 'cancelled') {
        clearPersonalGrowthTaskId(targetFavoriteId);
        message.info('已取消个人职业成长报告生成。');
        return;
      }
      clearPersonalGrowthTaskId(targetFavoriteId);
      setActionError?.(event.status_text || '报告生成失败。');
    },
    [],
  );

  const streamTask = useCallback(
    async (
      targetFavoriteId: number,
      taskId: string,
      setActionError?: (message?: string) => void,
    ) => {
      stopTaskStream();
      const controller = new AbortController();
      taskAbortRef.current = controller;
      try {
        for await (const event of streamPersonalGrowthReportTask(
          taskId,
          controller.signal,
        )) {
          if (event.stage === '__end__') break;
          const snapshot = mergeStreamEvent(event);
          const nextStatus = event.snapshot?.status || event.status || snapshot?.status;
          const isTerminal =
            terminalStages.has(event.stage) ||
            (nextStatus ? terminalStatuses.has(nextStatus) : false);
          if (isTerminal) {
            await finishTask(targetFavoriteId, event, setActionError);
            break;
          }
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          clearPersonalGrowthTaskId(targetFavoriteId);
          setActionError?.(
            getRequestErrorMessage(error, '任务进度流加载失败。'),
          );
        }
      } finally {
        if (taskAbortRef.current === controller) {
          taskAbortRef.current = null;
        }
      }
    },
    [finishTask, mergeStreamEvent, stopTaskStream],
  );

  const restoreTask = useCallback(
    async (
      targetFavoriteId: number,
      taskId?: string,
      setActionError?: (message?: string) => void,
    ) => {
      const restoredTaskId = taskId || readPersonalGrowthTaskId(targetFavoriteId);
      if (!restoredTaskId) {
        setTaskSnapshot(undefined);
        setPreviewEvents([]);
        return;
      }

      try {
        const response = await getPersonalGrowthReportTask(restoredTaskId, {
          skipErrorHandler: true,
        });
        const snapshot = response?.data;
        setTaskSnapshot(snapshot);
        if (!snapshot) return;
        if (terminalStatuses.has(snapshot.status)) {
          clearPersonalGrowthTaskId(targetFavoriteId);
          if (snapshot.status === 'failed') {
            setActionError?.(
              snapshot.error_message ||
                snapshot.latest_event?.status_text ||
                '报告生成失败。',
            );
          }
          return;
        }
        savePersonalGrowthTaskId(targetFavoriteId, snapshot.task_id);
        await streamTask(targetFavoriteId, snapshot.task_id, setActionError);
      } catch (error: unknown) {
        clearPersonalGrowthTaskId(targetFavoriteId);
        setActionError?.(getRequestErrorMessage(error, '任务状态恢复失败。'));
      }
    },
    [streamTask],
  );

  const handleStartAnalysis = useCallback(
    async (setActionError?: (message?: string) => void) => {
      if (!favoriteId) return;
      clearPersonalGrowthDraft(favoriteId, workspaceId);
      setCreatingTask(true);
      setPreviewEvents([]);
      setActionError?.(undefined);
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
        setActionError?.(getRequestErrorMessage(error, '报告生成失败。'));
      } finally {
        setCreatingTask(false);
      }
    },
    [favoriteId, hasReportContent, restoreTask, workspaceId],
  );

  const handleCancelTask = useCallback(
    async (setActionError?: (message?: string) => void) => {
      if (!taskSnapshot?.task_id) return;
      setCancellingTask(true);
      try {
        const response = await cancelPersonalGrowthReportTask(
          taskSnapshot.task_id,
          { skipErrorHandler: true },
        );
        if (favoriteId) clearPersonalGrowthTaskId(favoriteId);
        setTaskSnapshot(response?.data);
        stopTaskStream();
        message.info('已取消个人职业成长报告生成。');
      } catch (error: unknown) {
        setActionError?.(getRequestErrorMessage(error, '取消任务失败。'));
      } finally {
        setCancellingTask(false);
      }
    },
    [favoriteId, stopTaskStream, taskSnapshot?.task_id],
  );

  useEffect(() => {
    if (!favoriteId) return;
    if (activeTaskId) {
      savePersonalGrowthTaskId(favoriteId, activeTaskId);
    }
    void restoreTask(favoriteId, activeTaskId);
  }, [activeTaskId, favoriteId, restoreTask]);

  useEffect(() => () => stopTaskStream(), [stopTaskStream]);

  return useMemo(
    () => ({
      taskSnapshot,
      setTaskSnapshot,
      previewEvents,
      creatingTask,
      cancellingTask,
      generating,
      progress,
      statusText,
      restoreTask,
      handleStartAnalysis,
      handleCancelTask,
      stopTaskStream,
    }),
    [
      cancellingTask,
      creatingTask,
      generating,
      handleCancelTask,
      handleStartAnalysis,
      previewEvents,
      progress,
      restoreTask,
      statusText,
      stopTaskStream,
      taskSnapshot,
    ],
  );
}
