import { PageError, PageLoading } from '@/components/ui';
import { createStyles } from 'antd-style';
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from '@umijs/max';
import { claudeColors, claudeAlpha, claudeGlass } from '@/styles/claude-tokens';
import { orbFloat1, orbFloat2 } from './motion';
import { useCoachChat } from './hooks/useCoachChat';
import { useSessionRecovery } from './hooks/useSessionRecovery';
import { CoachChatBody } from './components/CoachChatBody';
import { CoachChatHeader } from './components/CoachChatHeader';
import { CoachChatInput } from './components/CoachChatInput';
import { CoachChatSidebar } from './components/CoachChatSidebar';
import { GlobalErrorBar } from './components/GlobalErrorBar';
import { PendingUploads } from './components/PendingUploads';
import { getCoachSkills, getSession, listSessions } from './api';
import { parseCoachPageContext } from './pageContext';
import type { CoachMessage as ApiCoachMessage, CoachSession } from './api';
import type { CoachMessage, CoachSkill, SelectedCoachSkill } from './types';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    min-height: 100vh;
    margin: -24px;
    position: relative;
    overflow: hidden;
  `,
  canvas: css`
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(
      140deg,
      #f0e9db 0%,
      #e6d9c4 30%,
      #ede4d5 60%,
      #f3ede2 100%
    );
  `,
  orb: css`
    position: absolute;
    border-radius: 50%;
    filter: blur(50px);
    pointer-events: none;
  `,
  orb1: css`
    top: -8%;
    right: -6%;
    width: 42%;
    height: 60%;
    background: radial-gradient(
      ellipse,
      ${claudeAlpha(claudeColors.terracotta, 0.45)} 0%,
      transparent 72%
    );
    animation: ${orbFloat1} 25s infinite ease-in-out;
  `,
  orb2: css`
    bottom: -10%;
    left: 20%;
    width: 38%;
    height: 50%;
    background: radial-gradient(
      ellipse,
      rgba(74, 144, 226, 0.28) 0%,
      transparent 70%
    );
    animation: ${orbFloat2} 30s infinite ease-in-out;
  `,
  orb3: css`
    top: 40%;
    left: 45%;
    width: 30%;
    height: 40%;
    background: radial-gradient(
      ellipse,
      ${claudeAlpha(claudeColors.success, 0.22)} 0%,
      transparent 70%
    );
    filter: blur(45px);
    animation: ${orbFloat2} 22s infinite ease-in-out reverse;
  `,
  noise: css`
    position: absolute;
    inset: 0;
    opacity: 0.022;
    z-index: 3;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  `,
  content: css`
    position: relative;
    z-index: 2;
    height: calc(100vh - 48px);
    padding: 10px 12px;
    display: flex;
    gap: 12px;
  `,
  sidebar: css`
    width: 260px;
    flex-shrink: 0;
    border-radius: 20px;
    background: ${claudeGlass.dark};
    backdrop-filter: ${claudeGlass.blurMedium};
    -webkit-backdrop-filter: ${claudeGlass.blurMedium};
    border: 1px solid ${claudeGlass.borderDark};
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,
  main: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    min-width: 0;
    border-radius: 22px;
    background: ${claudeGlass.light};
    backdrop-filter: ${claudeGlass.blurHeavy} ${claudeGlass.saturate};
    -webkit-backdrop-filter: ${claudeGlass.blurHeavy} ${claudeGlass.saturate};
    border: 1px solid ${claudeGlass.borderLight};
    box-shadow:
      0 12px 48px rgba(0, 0, 0, 0.04),
      ${claudeGlass.innerGlow};
    overflow: hidden;
  `,
}));

export default function CoachPage() {
  const { styles } = useStyles();
  const [searchParams] = useSearchParams();
  const step = searchParams.get('step');
  const pageContext = parseCoachPageContext(searchParams);

  const {
    loading: sessionLoading,
    sessionId,
    initialMessages,
    activeAgent,
    error: sessionError,
  } = useSessionRecovery();

  const chat = useCoachChat({
    initialMessages,
    initialSessionId: sessionId,
    initialActiveAgent: activeAgent,
    pipelineStage: step ?? undefined,
    pageContext,
  });

  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [skills, setSkills] = useState<CoachSkill[]>([]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await listSessions();
      setSessions((res.data ?? []).slice(0, 8));
    } catch {
      // Silently fail — session list is optional UX
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    getCoachSkills()
      .then((res) => setSkills(res.data.filter((skill) => skill.enabled)))
      .catch(() => setSkills([]));
  }, []);

  const handleNewSession = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('session_id');
    url.searchParams.delete('step');
    window.history.replaceState({}, '', url.toString());
    chat.newSession();
    loadSessions();
  }, [chat, loadSessions]);

  const handleSelectSession = useCallback(
    async (sid: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set('session_id', sid);
      url.searchParams.delete('step');
      const detail = await getSession(sid);
      const messages: CoachMessage[] = detail.data.messages.map(
        (message: ApiCoachMessage, index: number) => ({
          id: message.clientMessageId || `history-${message.id}-${index}`,
          role: message.role as 'user' | 'assistant',
          content: message.content,
          status: 'completed',
          activeAgent: message.activeAgent,
          attachments: message.attachments,
          runTrace: message.runTrace,
        }),
      );
      chat.loadSession(messages, sid, detail.data.session.activeAgent);
      window.history.replaceState({}, '', url.toString());
    },
    [chat],
  );

  const handleSend = useCallback(
    async (text: string, selectedSkill?: SelectedCoachSkill) => {
      await chat.sendMessage(text, undefined, selectedSkill);
      loadSessions();
    },
    [chat, loadSessions],
  );

  const isBusy =
    chat.state === 'connecting' || chat.state === 'streaming';

  if (sessionLoading) {
    return (
      <div className={styles.shell}>
        <div className={styles.canvas}>
          <div className={`${styles.orb} ${styles.orb1}`} />
          <div className={`${styles.orb} ${styles.orb2}`} />
          <div className={`${styles.orb} ${styles.orb3}`} />
          <div className={styles.noise} />
        </div>
        <div className={styles.content}>
          <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PageLoading tip="加载对话历史..." />
          </div>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return <PageError description={sessionError} />;
  }

  return (
    <div className={styles.shell}>
      <div className={styles.canvas}>
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
        <div className={`${styles.orb} ${styles.orb3}`} />
        <div className={styles.noise} />
      </div>
      <div className={styles.content}>
        <div className={styles.sidebar}>
          <CoachChatSidebar
            sessions={sessions}
            activeSessionId={chat.currentSessionId}
            loading={sessionsLoading}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
          />
        </div>
        <div className={styles.main}>
          <GlobalErrorBar
            visible={chat.errorMessage !== null}
            message={chat.errorMessage || ''}
            onClose={chat.clearError}
            onRetry={() => chat.retry()}
          />
          <CoachChatHeader
            activeAgent={chat.activeAgent}
          />
          {pageContext && (
            <div
              style={{
                margin: '0 16px',
                padding: '6px 14px',
                borderRadius: 10,
                background: claudeGlass.ghost,
                backdropFilter: claudeGlass.blurMicro,
                border: `1px solid ${claudeGlass.borderGhost}`,
                fontSize: 12,
                color: claudeColors.stoneGray,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: claudeColors.terracotta,
              }} />
              已关联来源页面 — 教练将基于当前上下文回答
            </div>
          )}
          <CoachChatBody
            messages={chat.messages}
            isStreaming={isBusy}
          />
          <PendingUploads
            uploads={chat.pendingUploads}
            onRemove={chat.removeUpload}
          />
          <CoachChatInput
            onSend={handleSend}
            onStop={chat.abort}
            onUpload={chat.uploadFile}
            isBusy={isBusy}
            skills={skills}
          />
        </div>
      </div>
    </div>
  );
}
