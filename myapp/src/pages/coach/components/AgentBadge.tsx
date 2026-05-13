import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  badge: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 10px;
    background: rgba(201, 100, 66, 0.12);
    border: 1px solid rgba(201, 100, 66, 0.22);
    font-size: 12px;
    color: ${claudeColors.terracotta};
    font-weight: 500;
  `,
}));

interface AgentBadgeProps {
  agent: string;
}

export function AgentBadge({ agent }: AgentBadgeProps) {
  const { styles } = useStyles();
  return <span className={styles.badge}>{agent}</span>;
}
