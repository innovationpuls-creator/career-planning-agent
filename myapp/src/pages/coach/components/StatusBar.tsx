import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors, claudeRadius } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  bar: css`
    margin: 0 12px 12px;
    padding: 6px 14px;
    border-radius: 0 0 ${claudeRadius.md}px ${claudeRadius.md}px;
    background: rgba(250, 249, 245, 0.30);
    border: 1px solid rgba(200, 185, 160, 0.20);
    border-top: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
  `,
  dot: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  `,
  dotRunning: css`
    background: ${claudeColors.terracotta};
    box-shadow: 0 0 6px ${claudeColors.terracotta};
    animation: statusBarPulse 1s ease-in-out infinite;

    @keyframes statusBarPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `,
  dotDone: css`
    background: ${claudeColors.success};
  `,
  text: css`
    color: ${claudeColors.oliveGray};
  `,
  time: css`
    color: ${claudeColors.stoneGray};
    margin-left: auto;
    flex-shrink: 0;
  `,
}));

interface StatusBarProps {
  text: string;
  time?: string;
  status?: 'running' | 'done' | 'none';
}

export function StatusBar({ text, time, status = 'running' }: StatusBarProps) {
  const { styles } = useStyles();

  const dotClass = status === 'running'
    ? `${styles.dot} ${styles.dotRunning}`
    : status === 'done'
      ? `${styles.dot} ${styles.dotDone}`
      : '';

  return (
    <div className={styles.bar}>
      {status !== 'none' && (
        <span className={dotClass} data-testid="status-dot" />
      )}
      <span className={styles.text}>{text}</span>
      {time && <span className={styles.time}>{time}</span>}
    </div>
  );
}
