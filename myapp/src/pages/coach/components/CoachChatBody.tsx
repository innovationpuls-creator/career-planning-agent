import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { scaleIn, TRANSITION } from '../motion';
import type { CoachMessage } from '../types';
import { AssistantMessage } from './AssistantMessage';
import { MessageBubble } from './MessageBubble';
import { SystemMessage } from './SystemMessage';

const useStyles = createStyles(({ css }) => ({
  container: css`
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
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
    padding: 32px;
  `,
  emptyCard: css`
    max-width: 400px;
    padding: 28px 32px;
    border-radius: 18px;
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurLight};
    -webkit-backdrop-filter: ${claudeGlass.blurLight};
    border: 1px solid ${claudeGlass.borderGhost};
    text-align: center;
  `,
  emptyTitle: css`
    font-family: Georgia, 'Songti SC', serif;
    font-size: 20px;
    font-weight: 500;
    color: ${claudeColors.oliveGray};
    margin: 0 0 8px;
  `,
  emptyDesc: css`
    color: ${claudeColors.stoneGray};
    font-size: 14px;
    line-height: 1.6;
    margin: 0;
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
    const reduced = prefersReducedMotion();
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <motion.div
            className={styles.emptyCard}
            initial={reduced ? { opacity: 0 } : scaleIn.initial}
            animate={scaleIn.animate}
            transition={TRANSITION.normal}
          >
            <motion.p
              className={styles.emptyTitle}
              initial={reduced ? { opacity: 1 } : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: reduced ? 0 : 0.1 }}
            >
              AI 职业规划教练
            </motion.p>
            <motion.p
              className={styles.emptyDesc}
              initial={reduced ? { opacity: 1 } : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: reduced ? 0 : 0.2 }}
            >
              你好！我是你的 AI 职业规划教练，有什么可以帮你的？
            </motion.p>
          </motion.div>
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
