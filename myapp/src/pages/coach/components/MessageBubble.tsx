import React from 'react';
import { motion } from 'framer-motion';
import { createStyles } from 'antd-style';
import { Tag } from 'antd';
import { claudeAlpha, claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { fadeInRight, hoverLift, tapScale, TRANSITION } from '../motion';
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
    background: ${claudeAlpha(claudeColors.terracotta, 0.12)};
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid rgba(200, 185, 160, 0.35);
    color: ${claudeColors.oliveGray};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  `,
  bubble: css`
    max-width: 70%;
    padding: 10px 14px;
    border-radius: 18px 18px 6px 18px;
    background: ${claudeGlass.bubbleUser};
    backdrop-filter: ${claudeGlass.blurSubtle};
    -webkit-backdrop-filter: ${claudeGlass.blurSubtle};
    border: 1px solid ${claudeGlass.borderTerracotta};
    color: ${claudeColors.nearBlack};
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  `,
  fileChip: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.30);
    backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid rgba(255, 255, 255, 0.30);
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
      whileHover={reduced ? undefined : hoverLift}
      whileTap={reduced ? undefined : tapScale}
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
                {att.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.avatar}>U</div>
    </motion.div>
  );
}
