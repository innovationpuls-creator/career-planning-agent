import React from 'react';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ css }) => ({
  block: css`
    border-radius: 6px;
    margin: 14px 0;
    background: linear-gradient(90deg, #f0ebe0 25%, #e8e0d5 50%, #f0ebe0 75%);
    background-size: 200% 100%;
    animation: skeletonShimmer 1.4s ease-in-out infinite;

    @keyframes skeletonShimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `,
}));

const HEIGHT_MAP: Record<string, string> = {
  table: '140px',
  heading: '24px',
  paragraph: '50px',
  code: '120px',
  divider: '1px',
  list: '80px',
};

interface SkeletonBlockProps {
  type: 'table' | 'heading' | 'paragraph' | 'code' | 'divider' | 'list';
}

export function SkeletonBlock({ type }: SkeletonBlockProps) {
  const { styles } = useStyles();
  const height = HEIGHT_MAP[type] || '50px';

  return (
    <div
      className={styles.block}
      style={{ height }}
      data-testid="skeleton-block"
    />
  );
}
