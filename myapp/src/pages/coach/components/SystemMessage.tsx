import React from 'react';
import { motion } from 'framer-motion';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { fadeInUp, TRANSITION } from '../motion';

const useStyles = createStyles(({ css }) => ({
  row: css`
    display: flex;
    justify-content: center;
    padding: 4px 0;
  `,
  bubble: css`
    padding: 6px 14px;
    border-radius: 10px;
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid ${claudeGlass.borderGhost};
    font-size: 12px;
    color: ${claudeColors.stoneGray};
    text-align: center;
    max-width: 80%;
  `,
  error: css`
    background: ${claudeGlass.errorBg};
    border-color: ${claudeGlass.borderError};
    color: ${claudeColors.error};
  `,
  success: css`
    background: rgba(74, 124, 63, 0.08);
    border-color: rgba(74, 124, 63, 0.20);
    color: ${claudeColors.success};
  `,
}));

interface SystemMessageProps {
  kind?: 'info' | 'error' | 'success';
  content: string;
}

export function SystemMessage({ kind = 'info', content }: SystemMessageProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();

  const kindClass =
    kind === 'error'
      ? styles.error
      : kind === 'success'
        ? styles.success
        : undefined;

  return (
    <motion.div
      className={styles.row}
      initial={reduced ? { opacity: 0 } : fadeInUp.initial}
      animate={fadeInUp.animate}
      exit={reduced ? { opacity: 0 } : { y: -4, opacity: 0 }}
      transition={TRANSITION.normal}
    >
      <div className={`${styles.bubble} ${kindClass || ''}`}>{content}</div>
    </motion.div>
  );
}
