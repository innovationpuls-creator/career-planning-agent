import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeColors } from '@/styles/claude-tokens';

export interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

const useStyles = createStyles(({ css }) => ({
  container: css`
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `,
  text: css`
    position: absolute;
    font-size: 14px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
  `,
}));

export function ProgressRing({
  percent,
  size = 120,
  strokeWidth = 8,
  color = claudeColors.terracotta,
  className,
}: ProgressRingProps) {
  const { styles, cx } = useStyles();
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cx(styles.container, className)}>
      <svg
        data-testid="progress-ring"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={claudeColors.borderCream}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>
      <span className={styles.text}>{Math.round(clamped)}%</span>
    </div>
  );
}
