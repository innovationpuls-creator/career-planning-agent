import React from 'react';
import { motion } from 'framer-motion';
import { createStyles } from 'antd-style';
import { Tag } from 'antd';
import { claudeColors, claudeRadius, claudeShadows } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { fadeInRight, TRANSITION } from '../motion';
import type { CoachMessage } from '../types';

const useStyles = createStyles(({ css }) => ({
  row: css`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `,
  avatar: css`
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: ${claudeColors.ivory};
    border: 1px solid ${claudeColors.borderCream};
    color: ${claudeColors.oliveGray};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  `,
  bubble: css`
    max-width: 75%;
    padding: 12px 18px;
    border-radius: ${claudeRadius.xl}px ${claudeRadius.xl}px
      ${claudeRadius.md}px ${claudeRadius.xl}px;
    background: ${claudeColors.ivory};
    border: 1px solid ${claudeColors.borderCream};
    color: ${claudeColors.nearBlack};
    font-size: 15px;
    line-height: 1.6;
    word-break: break-word;
    box-shadow: ${claudeShadows.flat};
  `,
  fileChip: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 4px 10px;
    border-radius: ${claudeRadius.md}px;
    background: ${claudeColors.parchment};
    border: 1px solid ${claudeColors.borderCream};
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  skillTag: css`
    margin-bottom: 8px;
  `,
}));

interface MessageBubbleProps {
  message: CoachMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();

  return (
    <motion.div
      className={styles.row}
      initial={reduced ? { opacity: 0 } : fadeInRight.initial}
      animate={fadeInRight.animate}
      transition={TRANSITION.fast}
    >
      <div className={styles.bubble}>
        {message.selectedSkill && (
          <div className={styles.skillTag}>
            <Tag>{message.selectedSkill.label || message.selectedSkill.name}</Tag>
          </div>
        )}
        <div>{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {message.attachments.map((att) => (
              <span key={att.fileId} className={styles.fileChip}>
                📄 {att.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.avatar}>👤</div>
    </motion.div>
  );
}
