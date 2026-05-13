import React, { useEffect, useRef } from 'react';
import { createStyles } from 'antd-style';
import { claudeColors } from '@/styles/claude-tokens';
import type { CoachMessage } from '../types';
import { AssistantMessage } from './AssistantMessage';
import { MessageBubble } from './MessageBubble';
import { SystemMessage } from './SystemMessage';

const useStyles = createStyles(({ css }) => ({
  container: css`
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-behavior: smooth;
    background: transparent;
  `,
  empty: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: ${claudeColors.stoneGray};
    font-size: 14px;
    text-align: center;
    padding: 32px;
  `,
}));

interface CoachChatBodyProps {
  messages: CoachMessage[];
  isStreaming: boolean;
}

export function CoachChatBody({
  messages,
  isStreaming,
}: CoachChatBodyProps) {
  const { styles } = useStyles();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);

  // Track whether user has scrolled up
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    isUserScrolledUpRef.current = !isNearBottom;
  }, [messages.length]);

  // Auto-scroll to bottom when new messages arrive, unless user scrolled up
  useEffect(() => {
    if (!isUserScrolledUpRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>你好！我是你的 AI 职业规划教练，有什么可以帮你的？</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      {messages.map((msg) => {
        switch (msg.role) {
          case 'user':
            return <MessageBubble key={msg.id} message={msg} />;
          case 'assistant':
            return <AssistantMessage key={msg.id} message={msg} />;
          case 'system':
            return (
              <SystemMessage
                key={msg.id}
                kind="info"
                content={msg.content}
              />
            );
          default:
            return null;
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
