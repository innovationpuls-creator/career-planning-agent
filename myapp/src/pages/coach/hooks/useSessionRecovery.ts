import { useCallback, useEffect, useMemo, useState } from 'react';
import { type CoachMessage as ApiCoachMessage, getSession } from '../api';
import type { ChatMessage } from './useCoachChat';

interface UseSessionRecoveryResult {
  loading: boolean;
  sessionId: string | null;
  initialMessages: ChatMessage[];
  activeAgent: string | null;
  error: string | null;
}

export function useSessionRecovery(): UseSessionRecoveryResult {
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  const loadSession = useCallback(async (sid: string) => {
    try {
      const detail = await getSession(sid);
      const msgs: ChatMessage[] = detail.data.messages.map(
        (m: ApiCoachMessage, i: number) => ({
          id: m.clientMessageId || `msg-${sid}-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          status: 'completed' as const,
          activeAgent: m.activeAgent,
          attachments: m.attachments,
          runTrace: m.runTrace,
        }),
      );
      setInitialMessages(msgs);
      setActiveAgent(detail.data.session.activeAgent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load session';
      setError(msg);
    }
  }, []);

  useEffect(() => {
    const sid = params.get('session_id');
    if (!sid) {
      setLoading(false);
      return;
    }

    setSessionId(sid);
    loadSession(sid).finally(() => setLoading(false));
  }, [params, loadSession]);

  return { loading, sessionId, initialMessages, activeAgent, error };
}
