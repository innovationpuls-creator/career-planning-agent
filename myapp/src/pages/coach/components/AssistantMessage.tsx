import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import React from 'react';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { fadeInUp, springGentle, TRANSITION } from '../motion';
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
    background: rgba(48, 48, 46, 0.60);
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    color: ${claudeColors.warmSilver};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
  `,
  body: css`
    flex: 1;
    min-width: 0;
    font-size: 14px;
    line-height: 1.6;
    color: ${claudeColors.nearBlack};
    & > *:first-child { margin-top: 0; }
    & > *:last-child { margin-bottom: 0; }
  `,
  answer: css`
    padding: 10px 14px;
    background: ${claudeGlass.bubbleAI};
    backdrop-filter: ${claudeGlass.blurSubtle};
    -webkit-backdrop-filter: ${claudeGlass.blurSubtle};
    border: 1px solid ${claudeGlass.borderLight};
    border-radius: 18px 18px 18px 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    margin-top: 4px;
  `,
  errorText: css`
    color: ${claudeColors.error};
    font-size: 12px;
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
        <motion.div
          className={styles.answer}
          whileHover={reduced ? undefined : { borderColor: 'rgba(200,185,160,0.45)' }}
          transition={springGentle}
        >
          <StreamingText content={message.content} status={message.status} />
        </motion.div>
        {message.error && (
          <div className={styles.errorText}>{message.error}</div>
        )}
      </div>
    </motion.div>
  );
}
