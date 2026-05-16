import { motion, AnimatePresence } from 'framer-motion';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { fadeInUp, TRANSITION } from '../motion';
import { AgentBadge } from './AgentBadge';

const useStyles = createStyles(({ css }) => ({
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid ${claudeGlass.borderGhost};
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurLight};
    -webkit-backdrop-filter: ${claudeGlass.blurLight};
    min-height: 48px;
    flex-shrink: 0;
  `,
  left: css`
    display: flex;
    align-items: center;
    gap: 10px;
  `,
  dot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${claudeColors.terracotta};
    box-shadow: 0 0 12px ${claudeColors.terracotta}80;
  `,
  title: css`
    font-size: 13px;
    color: ${claudeColors.oliveGray};
  `,
  newBtn: css`
    border-radius: 10px;
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid ${claudeGlass.borderGhost};
    color: ${claudeColors.oliveGray};
    font-size: 12px;
    height: 30px;
    &:hover {
      background: rgba(255, 255, 255, 0.18) !important;
      border-color: rgba(255, 255, 255, 0.35) !important;
    }
  `,
}));

interface CoachChatHeaderProps {
  activeAgent: string | null;
}

export function CoachChatHeader({
  activeAgent,
}: CoachChatHeaderProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.dot} />
        <AnimatePresence mode="wait">
          {activeAgent ? (
            <motion.div
              key="badge"
              initial={reduced ? { opacity: 0 } : fadeInUp.initial}
              animate={fadeInUp.animate}
              exit={reduced ? { opacity: 0 } : { y: -8, opacity: 0 }}
              transition={TRANSITION.fast}
            >
              <AgentBadge agent={activeAgent} />
            </motion.div>
          ) : (
            <motion.div
              key="title"
              initial={reduced ? { opacity: 0 } : fadeInUp.initial}
              animate={fadeInUp.animate}
              exit={reduced ? { opacity: 0 } : { y: -8, opacity: 0 }}
              transition={TRANSITION.fast}
            >
              <span className={styles.title}>AI 职业规划教练</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
