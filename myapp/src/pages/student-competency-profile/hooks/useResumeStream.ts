import { useCallback, useEffect, useRef, useState } from 'react';
import { streamStudentCompetencyChat } from '@/services/ant-design-pro/api';
import {
  appendStreamLine,
  buildId,
  extractRequestError,
  type WorkspaceConversation,
  type WorkspaceMessage,
  type WorkspaceUpload,
} from '../shared';

type StreamEvent =
  import('@/services/ant-design-pro/api').StudentCompetencyChatStreamEvent;
type DoneEvent = Extract<StreamEvent, { event: 'done' }>;

interface UseResumeStreamResult {
  isStreaming: boolean;
  streamError: string | null;
  messages: WorkspaceMessage[];
  sendMessage: (formData: FormData) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

function extractFileMeta(formData: FormData): WorkspaceUpload[] {
  const raw = formData.get('_file_meta');
  if (!raw || typeof raw !== 'string') return [];
  try {
    const arr = JSON.parse(raw) as Array<{
      name: string;
      size: number;
      type: string;
    }>;
    return arr.map((f) => ({
      id: buildId('upload'),
      name: f.name,
      size: f.size,
      type: f.type,
      kind: f.type.startsWith('image/')
        ? ('image' as const)
        : ('document' as const),
      status: 'submitted' as const,
      createdAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function buildUserMessage(
  prompt: string,
  uploads: WorkspaceUpload[],
): WorkspaceMessage {
  const hasText = prompt.trim().length > 0;
  const hasFiles = uploads.length > 0;
  let content: string;
  if (hasText && hasFiles) {
    content = `${prompt.trim()}（附 ${uploads.length} 个文件）`;
  } else if (hasText) {
    content = prompt.trim();
  } else if (hasFiles) {
    content = uploads.map((u) => u.name).join('、');
  } else {
    content = '上传文件开始解析';
  }
  return {
    id: buildId('user'),
    role: 'user',
    kind: 'chat',
    content,
    uploads,
    createdAt: new Date().toISOString(),
    status: 'completed',
  };
}

function buildAssistantPlaceholder(): WorkspaceMessage {
  return {
    id: buildId('assistant'),
    role: 'assistant',
    kind: 'status',
    content: '',
    createdAt: new Date().toISOString(),
    status: 'streaming',
    stage: 'prepare',
    progress: 0,
  };
}

function handleStreamEvent(
  event: StreamEvent,
  assistantMessageId: string,
  updateMessage: (
    id: string,
    updater: (msg: WorkspaceMessage) => WorkspaceMessage,
  ) => void,
  appendResult: (msg: WorkspaceMessage) => void,
  onComplete: (data: DoneEvent['data']) => void,
  setStreamError: (err: string | null) => void,
): string {
  if (event.event === 'meta') {
    updateMessage(assistantMessageId, (msg) => ({
      ...msg,
      id: event.assistant_message_id,
      createdAt: event.created_at,
    }));
    return event.assistant_message_id;
  }

  if (event.event === 'delta') {
    updateMessage(event.assistant_message_id, (msg) => ({
      ...msg,
      kind: 'status',
      status: 'streaming',
      content: appendStreamLine(msg.content, event.delta),
      stage: event.stage,
      progress: event.progress,
      createdAt: event.created_at,
    }));
  }

  if (event.event === 'done') {
    if (event.data.output_mode === 'profile') {
      // Clear original status message — result bubble carries the content
      updateMessage(event.assistant_message_id, (msg) => ({
        ...msg,
        status: 'completed',
        content: '',
      }));
      appendResult({
        id: buildId('result'),
        role: 'assistant',
        kind: 'result',
        content: event.data.assistant_message,
        createdAt: new Date().toISOString(),
        status: 'completed',
        assetName: `简历解析结果-${Date.now()}.json`,
      });
    } else {
      updateMessage(event.assistant_message_id, (msg) => ({
        ...msg,
        status: 'completed',
        content: event.data.assistant_message,
      }));
    }
    onComplete(event.data);
  }

  if (event.event === 'error') {
    updateMessage(event.assistant_message_id, (msg) => ({
      ...msg,
      status: 'error',
      content: event.detail,
    }));
    setStreamError(event.detail);
  }

  return assistantMessageId;
}

export function useResumeStream(
  conversation: WorkspaceConversation,
  onComplete: (data: DoneEvent['data']) => void,
  onMessagesChange?: (messages: WorkspaceMessage[]) => void,
): UseResumeStreamResult {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkspaceMessage[]>(
    conversation.messages,
  );
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      setMessages(conversation.messages);
    }
  }, [conversation.id, conversation.messages.length, conversation.updatedAt]);

  useEffect(() => {
    if (!onMessagesChange || isStreaming) return;
    if (!messages.length && !conversation.messages.length) return;

    const prev = conversation.messages;
    const same =
      prev.length === messages.length &&
      prev.every(
        (m, i) =>
          m.id === messages[i].id &&
          m.content === messages[i].content &&
          m.status === messages[i].status &&
          m.stage === messages[i].stage,
      );
    if (!same) {
      onMessagesChange(messages);
    }
  }, [isStreaming, messages, conversation.updatedAt]);

  const updateMessage = useCallback(
    (
      messageId: string,
      updater: (message: WorkspaceMessage) => WorkspaceMessage,
    ) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? updater(msg) : msg)),
      );
    },
    [],
  );

  const appendResult = useCallback((msg: WorkspaceMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const sendMessage = useCallback(
    async (formData: FormData) => {
      setStreamError(null);
      setIsStreaming(true);

      const prompt = (formData.get('prompt') as string) || '';
      const uploads = extractFileMeta(formData);
      const userMessage = buildUserMessage(prompt, uploads);
      const assistantPlaceholder = buildAssistantPlaceholder();
      let currentAssistantId = assistantPlaceholder.id;

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        for await (const event of streamStudentCompetencyChat(
          formData,
          controller.signal,
        )) {
          currentAssistantId = handleStreamEvent(
            event,
            currentAssistantId,
            updateMessage,
            appendResult,
            onComplete,
            setStreamError,
          );
        }
      } catch (err: unknown) {
        const detail = extractRequestError(err);
        setStreamError(detail);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAssistantId && msg.status === 'streaming'
              ? { ...msg, status: 'error', content: detail, stage: 'error' }
              : msg,
          ),
        );
      } finally {
        setIsStreaming(false);
        controllerRef.current = null;
      }
    },
    [conversation.id, onComplete, updateMessage, appendResult],
  );

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setIsStreaming(false);
    setStreamError(null);
    setMessages([]);
  }, []);

  return { isStreaming, streamError, messages, sendMessage, abort, reset };
}
