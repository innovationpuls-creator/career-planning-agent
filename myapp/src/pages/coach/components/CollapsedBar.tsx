import React from 'react';
import { motion } from 'framer-motion';
import { createStyles } from 'antd-style';
import { claudeColors, claudeRadius } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { springGentle } from '../motion';
import { formatRunSummary } from './stepLabels';

const useStyles = createStyles(({ css }) => ({
  bar: css`
    margin: 0 12px 12px;
    padding: 8px 14px;
    border-radius: ${claudeRadius.md}px;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
    color: ${claudeColors.oliveGray};
    cursor: pointer;
    width: 100%;
    text-align: left;

    &:hover {
      background: rgba(245, 240, 232, 0.25);
    }
  `,
  chevron: css`
    color: ${claudeColors.stoneGray};
    font-size: 11px;
    margin-left: auto;
    flex-shrink: 0;
  `,
}));

interface CollapsedBarProps {
  agent: string;
  runStatus: 'running' | 'completed' | 'failed';
  stepCount: number;
  toolCount: number;
  memoryCount: number;
  duration: string;
  onClick: () => void;
}

export function CollapsedBar({
  agent,
  runStatus,
  stepCount,
  toolCount,
  memoryCount,
  duration,
  onClick,
}: CollapsedBarProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();
  const summary = formatRunSummary({
    agent,
    runStatus,
    stepCount,
    toolCount,
    memoryCount,
    duration,
  });

  return (
    <motion.button
      type="button"
      className={styles.bar}
      onClick={onClick}
      whileHover={reduced ? undefined : { background: 'rgba(245,240,232,0.25)' }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      transition={springGentle}
    >
      <span>{summary}</span>
      <span className={styles.chevron}>▸ expand</span>
    </motion.button>
  );
}
