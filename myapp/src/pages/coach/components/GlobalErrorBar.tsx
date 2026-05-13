import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { slideDown, TRANSITION } from '../motion';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    position: absolute;
    top: 8px;
    left: 16px;
    right: 16px;
    z-index: 5;
  `,
  bar: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 12px;
    background: ${claudeGlass.errorBg};
    backdrop-filter: ${claudeGlass.blurLight};
    -webkit-backdrop-filter: ${claudeGlass.blurLight};
    border: 1px solid ${claudeGlass.borderError};
    font-size: 13px;
    color: ${claudeColors.error};
  `,
  msg: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  btn: css`
    padding: 3px 10px;
    border-radius: 8px;
    border: 1px solid rgba(181, 51, 51, 0.25);
    background: rgba(181, 51, 51, 0.08);
    color: ${claudeColors.error};
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    &:hover {
      background: rgba(181, 51, 51, 0.15);
    }
  `,
  closeBtn: css`
    background: none;
    border: none;
    color: ${claudeColors.error};
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    opacity: 0.7;
    &:hover {
      opacity: 1;
    }
  `,
}));

interface GlobalErrorBarProps {
  visible: boolean;
  message: string;
  onClose: () => void;
  onRetry: () => void;
}

export function GlobalErrorBar({
  visible,
  message,
  onClose,
  onRetry,
}: GlobalErrorBarProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.shell}
          initial={reduced ? { opacity: 0 } : slideDown.initial}
          animate={slideDown.animate}
          exit={reduced ? { opacity: 0 } : slideDown.initial}
          transition={TRANSITION.fast}
        >
          <div className={styles.bar}>
            <span className={styles.msg}>{message}</span>
            <button className={styles.btn} onClick={onRetry}>
              重试
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
