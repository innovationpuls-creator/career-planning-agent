import { getAccessToken } from '@/utils/authToken';

import type {
  AgentRunStep,
  Attachment,
  CoachPageContext,
  CoachSkill,
  CoachStreamEvent,
  SelectedCoachSkill,
} from './types';

export type CoachChatStreamEvent = CoachStreamEvent;

// ── Session API types ──────────────────────────────────────────────

export interface CoachSession {
  id: string;
  studentId: number;
  title: string;
  activeAgent: string | null;
  pipelineStage: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoachMessage {
  id: number;
  sessionId: string;
  role: string;
  content: string;
  clientMessageId: string | null;
  activeAgent: string | null;
  attachments?: Attachment[];
  runTrace?: AgentRunStep[];
  createdAt: string;
}

export interface SessionListResponse {
  data: CoachSession[];
  total: number;
}

export interface SessionDetailResponse {
  data: {
    session: CoachSession;
    messages: CoachMessage[];
    summary: Record<string, unknown> | null;
  };
}

export interface CoachSkillsResponse {
  data: CoachSkill[];
}

// ── Streaming endpoint ────────────────────────────────────────────

export async function* streamCoachChat(
  message: string,
  clientMessageId: string,
  signal: AbortSignal,
  sessionId?: string,
  pipelineStage?: string,
  attachments?: Attachment[],
  pageContext?: CoachPageContext,
  selectedSkill?: SelectedCoachSkill,
): AsyncGenerator<CoachChatStreamEvent, void, void> {
  const token = getAccessToken();
  const response = await fetch('/api/coach/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      clientMessageId,
      sessionId,
      pipelineStage,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      pageContext,
      selectedSkill,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Request failed with status ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error('Stream response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex < 0) break;
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line) as CoachChatStreamEvent;
        } catch {
          yield {
            event: 'run_error',
            code: 'PARSE_ERROR',
            message: `Malformed stream line: ${line.slice(0, 80)}`,
            retryable: false,
          } as CoachChatStreamEvent;
        }
      }
    }

    const tail = `${buffer}${decoder.decode()}`.trim();
    if (tail) {
      try {
        yield JSON.parse(tail) as CoachChatStreamEvent;
      } catch {
        yield {
          event: 'run_error',
          code: 'PARSE_ERROR',
          message: `Malformed stream tail: ${tail.slice(0, 80)}`,
          retryable: false,
        } as CoachChatStreamEvent;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getCoachSkills(): Promise<CoachSkillsResponse> {
  const token = getAccessToken();
  const response = await fetch('/api/coach/skills', {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) {
    throw new Error(`Failed to list coach skills: ${response.status}`);
  }
  return response.json();
}

// ── Session REST API ──────────────────────────────────────────────

export async function listSessions(
  limit = 20,
  offset = 0,
): Promise<SessionListResponse> {
  const token = getAccessToken();
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(`/api/coach/sessions?${params}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok)
    throw new Error(`Failed to list sessions: ${response.status}`);
  return response.json();
}

export async function getSession(
  sessionId: string,
): Promise<SessionDetailResponse> {
  const token = getAccessToken();
  const response = await fetch(`/api/coach/sessions/${sessionId}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok)
    throw new Error(`Failed to get session: ${response.status}`);
  return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`/api/coach/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok)
    throw new Error(`Failed to delete session: ${response.status}`);
}

// ── File upload ────────────────────────────────────────────────────

export interface UploadFileResponse {
  file_id: string;
  name: string;
  type: string;
  size: number;
}

export async function uploadCoachFile(file: File): Promise<UploadFileResponse> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/coach/upload', {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => 'Upload failed');
    throw new Error(text);
  }
  return response.json();
}
