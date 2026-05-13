import { PageError, PageLoading } from '@/components/ui';
import { createStyles, keyframes } from 'antd-style';
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from '@umijs/max';
import { claudeColors, claudeAlpha, claudeRadius } from '@/styles/claude-tokens';
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

const useStyles = createStyles(({ css }) => {
  const float = keyframes`
    0% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 40px) scale(0.9); }
    100% { transform: translate(0, 0) scale(1); }
  `;

  const floatReverse = keyframes`
    0% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-40px, 30px) scale(1.05); }
    66% { transform: translate(20px, -30px) scale(0.95); }
    100% { transform: translate(0, 0) scale(1); }
  `;

  return {
    shell: css`
      min-height: 100vh;
      margin: -24px;
      padding: 24px;
      position: relative;
      background-color: #fdfbf7;
      overflow: hidden;
    `,
    fixedBackground: css`
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        opacity: 0.03;
        z-index: 3;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      }
    `,
    glassOverlay: css`
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(80px);
      -webkit-backdrop-filter: blur(80px);
      z-index: 1;
    `,
    backgroundBlob1: css`
      position: absolute;
      top: -10vh;
      right: -5vw;
      width: 60vw;
      height: 60vh;
      background: radial-gradient(circle, ${claudeAlpha(claudeColors.terracotta, 0.4)} 0%, transparent 70%);
      filter: blur(80px);
      z-index: 0;
      animation: ${float} 25s infinite ease-in-out;
    `,
    backgroundBlob2: css`
      position: absolute;
      bottom: -15vh;
      left: -10vw;
      width: 55vw;
      height: 55vh;
      background: radial-gradient(circle, ${claudeAlpha('#4a90e2', 0.3)} 0%, transparent 70%);
      filter: blur(80px);
      z-index: 0;
      animation: ${floatReverse} 30s infinite ease-in-out;
    `,
    backgroundBlob3: css`
      position: absolute;
      top: 35vh;
      left: 15vw;
      width: 45vw;
      height: 45vh;
      background: radial-gradient(circle, ${claudeAlpha(claudeColors.success, 0.25)} 0%, transparent 70%);
      filter: blur(70px);
      z-index: 0;
      animation: ${float} 22s infinite ease-in-out;
    `,
    content: css`
      position: relative;
      z-index: 2;
      height: calc(100vh - 112px);
    `,
    layout: css`
      display: flex;
      height: 100%;
      border-radius: ${claudeRadius.lg}px;
      overflow: hidden;
      background: ${claudeAlpha('#ffffff', 0.45)};
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      border: 1px solid ${claudeAlpha('#ffffff', 0.6)};
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.06), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.5)};
    `,
    main: css`
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      min-width: 0;
    `,
  };
});

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
      setSessions(res.data);
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
    return <PageLoading tip="加载对话历史..." />;
  }

  if (sessionError) {
    return <PageError description={sessionError} />;
  }

  return (
    <div className={styles.shell}>
      <div className={styles.fixedBackground}>
        <div className={styles.backgroundBlob1} />
        <div className={styles.backgroundBlob2} />
        <div className={styles.backgroundBlob3} />
        <div className={styles.glassOverlay} />
      </div>
      <div className={styles.content}>
        <div className={styles.layout}>
          <CoachChatSidebar
            sessions={sessions}
            activeSessionId={chat.currentSessionId}
            loading={sessionsLoading}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
          />
          <div className={styles.main}>
            <GlobalErrorBar
              visible={chat.errorMessage !== null}
              message={chat.errorMessage || ''}
              onClose={chat.clearError}
              onRetry={() => chat.retry()}
            />
            <CoachChatHeader
              activeAgent={chat.activeAgent}
              onNewSession={handleNewSession}
            />
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
    </div>
  );
}
