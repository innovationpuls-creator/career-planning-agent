import { useCallback, useReducer, useRef, useState } from 'react';
import { streamCoachChat, uploadCoachFile } from '../api';
import {
  coachEventReducer,
  initialCoachState,
} from '../eventReducer';
import type {
  Attachment,
  ChatState,
  CoachMessage,
  CoachPageContext,
  PendingUpload,
  SelectedCoachSkill,
} from '../types';

// Backward-compat alias for existing importers (useSessionRecovery)
export type { CoachMessage as ChatMessage } from '../types';

function toAction(
  event: import('../api').CoachChatStreamEvent,
): import('../types').CoachEventAction | null {
  switch (event.event) {
    case 'run_start':
      return {
        type: 'RUN_START',
        sessionId: event.sessionId,
        assistantMessageId: event.assistantMessageId,
        agent: event.activeAgent,
      };
    case 'step':
      return {
        type: 'STEP',
        step: {
          stepId: event.stepId,
          kind: event.kind,
          status: event.status,
          title: event.title,
          summary: event.summary,
          detail: event.detail,
          agent: event.agent,
          toolName: event.toolName,
          startedAt: event.startedAt,
          completedAt: event.completedAt,
          updatedAt: event.updatedAt,
          durationMs: event.durationMs,
          relatedToolCallId: event.relatedToolCallId,
        },
      };
    case 'answer_delta':
      return { type: 'ANSWER_DELTA', delta: event.delta };
    case 'run_error':
      return {
        type: 'RUN_ERROR',
        code: event.code,
        message: event.message,
        failedStepId: event.failedStepId,
      };
    case 'run_done':
      return {
        type: 'RUN_DONE',
        stopReason: event.stopReason,
        sessionId: event.sessionId,
        metrics: event.metrics,
      };
    default:
      return null;
  }
}

interface UseCoachChatOptions {
  initialMessages?: CoachMessage[];
  initialSessionId?: string | null;
  initialActiveAgent?: string | null;
  pipelineStage?: string;
  pageContext?: CoachPageContext;
}

export interface UseCoachChatResult {
  state: ChatState;
  messages: CoachMessage[];
  activeAgent: string | null;
  errorMessage: string | null;
  currentSessionId: string | null;
  pendingUploads: PendingUpload[];
  sendMessage: (
    text: string,
    attachments?: Attachment[],
    selectedSkill?: SelectedCoachSkill,
  ) => Promise<void>;
  abort: () => void;
  clearError: () => void;
  retry: (failedMessageId?: string, options?: { force?: boolean }) => Promise<void>;
  pendingRetry: { failedMessageId: string; lostCount: number } | null;
  confirmRetry: () => void;
  cancelRetry: () => void;
  uploadFile: (file: File) => Promise<Attachment | null>;
  removeUpload: (fileId: string) => void;
  loadSession: (
    messages: CoachMessage[],
    sessionId: string,
    activeAgent?: string | null,
  ) => void;
  newSession: () => void;
}

export function useCoachChat(
  options?: UseCoachChatOptions,
): UseCoachChatResult {
  const counterRef = useRef(0);
  function nextId(): string {
    counterRef.current += 1;
    return `msg-${Date.now()}-${counterRef.current}`;
  }

  const [coachState, dispatch] = useReducer(coachEventReducer, {
    ...initialCoachState,
    ...(options?.initialMessages
      ? { messages: options.initialMessages }
      : {}),
    ...(options?.initialSessionId
      ? { currentSessionId: options.initialSessionId }
      : {}),
    ...(options?.initialActiveAgent
      ? { activeAgent: options.initialActiveAgent }
      : {}),
  });

  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const pipelineStageRef = useRef(options?.pipelineStage);
  const pageContextRef = useRef(options?.pageContext);
  const [pendingRetry, setPendingRetry] = useState<{
    failedMessageId: string;
    lostCount: number;
  } | null>(null);

  const sendMessage = useCallback(
    async (
      text: string,
      attachments?: Attachment[],
      selectedSkill?: SelectedCoachSkill,
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const outgoingAttachments =
        attachments ??
        coachState.pendingUploads
          .filter((upload) => upload.uploadState === 'ready')
          .map((upload) => ({
            fileId: upload.fileId,
            name: upload.name,
            type: upload.type,
            size: upload.size,
          }));

      const clientMessageId = nextId();
      dispatch({
        type: 'ADD_USER_MESSAGE',
        id: clientMessageId,
        content: trimmed,
        attachments: outgoingAttachments,
        selectedSkill,
      });

      const assistantId = `assistant-${clientMessageId}`;
      dispatch({ type: 'ADD_ASSISTANT_MESSAGE', id: assistantId });

      const controller = new AbortController();
      controllerRef.current = controller;
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;

      try {
        let runDoneSessionId: string | undefined;
        for await (const event of streamCoachChat(
          trimmed,
          clientMessageId,
          controller.signal,
          coachState.currentSessionId ?? undefined,
          pipelineStageRef.current,
          outgoingAttachments,
          pageContextRef.current,
          selectedSkill,
        )) {
          if (controller.signal.aborted || runIdRef.current !== runId) break;
          if (event.event === 'run_done' && event.sessionId) {
            runDoneSessionId = event.sessionId;
          }
          const action = toAction(event);
          if (action) dispatch(action);
        }
        if (runIdRef.current !== runId) return;
        if (controller.signal.aborted) {
          dispatch({
            type: 'SYSTEM_MESSAGE',
            id: `sys-${nextId()}`,
            kind: 'abort',
            content: '已停止生成',
          });
          return;
        }
        // Persist session_id to URL so page reloads resume the conversation
        if (runDoneSessionId) {
          const url = new URL(window.location.href);
          url.searchParams.set('session_id', runDoneSessionId);
          window.history.replaceState({}, '', url.toString());
        }
        // Clear pipeline stage after first send — subsequent turns use L2/L4 routing
        pipelineStageRef.current = undefined;
        // Clear uploaded files that were attached to this message
        dispatch({ type: 'CLEAR_READY_UPLOADS' });
      } catch (err: unknown) {
        if (runIdRef.current !== runId) return;
        if (controller.signal.aborted) {
          dispatch({
            type: 'SYSTEM_MESSAGE',
            id: `sys-${nextId()}`,
            kind: 'abort',
            content: '已停止生成',
          });
          return;
        }
        const message =
          err instanceof Error ? err.message : '发生未知错误';
        dispatch({ type: 'RUN_ERROR', code: 'STREAM_ERROR', message });
      } finally {
        if (runIdRef.current === runId) {
          controllerRef.current = null;
        }
      }
    },
    [coachState.currentSessionId, coachState.pendingUploads],
  );

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const retry = useCallback(
    async (failedMessageId?: string, options?: { force?: boolean }) => {
      const text = failedMessageId
        ? coachState.messages.find(
            (m) => m.id === failedMessageId && m.role === 'user',
          )?.content || coachState.lastUserMessage
        : coachState.lastUserMessage;
      if (!text) return;
      if (failedMessageId) {
        const idx = coachState.messages.findIndex(
          (m) => m.id === failedMessageId,
        );
        if (idx >= 0) {
          const lostCount = coachState.messages.length - 1 - idx;
          if (lostCount > 0 && !options?.force) {
            setPendingRetry({ failedMessageId, lostCount });
            return;
          }
          dispatch({
            type: 'LOAD_SESSION',
            messages: coachState.messages.slice(0, idx),
            sessionId: coachState.currentSessionId || '',
            activeAgent: coachState.activeAgent,
          });
        }
      }
      await sendMessage(text);
    },
    [coachState, sendMessage],
  );

  const confirmRetry = useCallback(() => {
    if (!pendingRetry) return;
    const msgId = pendingRetry.failedMessageId;
    setPendingRetry(null);
    retry(msgId, { force: true });
  }, [pendingRetry, retry]);

  const cancelRetry = useCallback(() => {
    setPendingRetry(null);
  }, []);

  const uploadFile = useCallback(
    async (file: File): Promise<Attachment | null> => {
      const tempId = `upload-${Date.now()}`;
      const pending: PendingUpload = {
        fileId: tempId,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadState: 'uploading',
        progress: 0,
        file,
      };
      dispatch({ type: 'ADD_UPLOAD', upload: pending });

      try {
        const result = await uploadCoachFile(file);
        const attachment: Attachment = {
          fileId: result.file_id,
          name: result.name,
          type: result.type,
          size: result.size,
        };
        dispatch({
          type: 'UPDATE_UPLOAD',
          fileId: tempId,
          updates: {
            fileId: result.file_id,
            uploadState: 'ready',
            progress: 100,
          },
        });
        return attachment;
      } catch (err) {
        dispatch({
          type: 'UPDATE_UPLOAD',
          fileId: tempId,
          updates: {
            uploadState: 'error',
            errorDetail: err instanceof Error ? err.message : '上传失败',
          },
        });
        return null;
      }
    },
    [],
  );

  const removeUpload = useCallback((fileId: string) => {
    dispatch({ type: 'REMOVE_UPLOAD', fileId });
  }, []);

  const loadSession = useCallback(
    (
      messages: CoachMessage[],
      sessionId: string,
      activeAgent?: string | null,
    ) => {
      dispatch({
        type: 'LOAD_SESSION',
        messages,
        sessionId,
        activeAgent,
      });
    },
    [],
  );

  const newSession = useCallback(() => {
    runIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    pipelineStageRef.current = undefined;
    dispatch({ type: 'NEW_SESSION' });
  }, []);

  return {
    state: coachState.state,
    messages: coachState.messages,
    activeAgent: coachState.activeAgent,
    errorMessage: coachState.errorMessage,
    currentSessionId: coachState.currentSessionId,
    pendingUploads: coachState.pendingUploads,
    sendMessage,
    abort,
    clearError,
    retry,
    pendingRetry,
    confirmRetry,
    cancelRetry,
    uploadFile,
    removeUpload,
    loadSession,
    newSession,
  };
}
