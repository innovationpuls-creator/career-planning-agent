import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import React from 'react';
import { claudeColors } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { fadeInUp, TRANSITION } from '../motion';
import type { CoachMessage } from '../types';
import { AgentRunTimeline } from './AgentRunTimeline';
import { StreamingText } from './StreamingText';

const useStyles = createStyles(({ css }) => ({
  row: css`
    display: flex;
    gap: 8px;
  `,
  avatar: css`
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: ${claudeColors.darkSurface};
    color: ${claudeColors.warmSilver};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  `,
  body: css`
    flex: 1;
    min-width: 0;
    font-size: 15px;
    line-height: 1.6;
    color: ${claudeColors.nearBlack};

    /* Ensure first and last children of markdown content don't have extra margins */
    & > *:first-child {
      margin-top: 0;
    }
    & > *:last-child {
      margin-bottom: 0;
    }
  `,
  answer: css`
    padding-top: 2px;

    &:not(:first-child) {
      border-top: 1px solid ${claudeColors.borderCream};
      padding-top: 12px;
    }
  `,
  errorText: css`
    color: ${claudeColors.error};
    font-size: 13px;
    margin-top: 4px;
  `,
}));

interface AssistantMessageProps {
  message: CoachMessage;
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();
  return (
    <motion.div
      className={styles.row}
      initial={reduced ? { opacity: 0 } : fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={TRANSITION.normal}
    >
      <div className={styles.avatar}>AI</div>
      <div className={styles.body}>
        <AgentRunTimeline
          steps={message.runTrace}
          status={message.status}
          metrics={message.metrics}
        />

        <div className={styles.answer}>
          <StreamingText content={message.content} status={message.status} />
        </div>

        {message.error && (
          <div className={styles.errorText}>{message.error}</div>
        )}
      </div>
    </motion.div>
  );
}
