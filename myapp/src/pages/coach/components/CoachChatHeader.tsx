import { Button } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeAlpha, claudeRadius } from '@/styles/claude-tokens';
import { AgentBadge } from './AgentBadge';

const useStyles = createStyles(({ css }) => ({
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid ${claudeAlpha(claudeColors.borderCream, 0.7)};
    background: ${claudeAlpha(claudeColors.ivory, 0.5)};
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: ${claudeRadius.md}px ${claudeRadius.md}px 0 0;
    min-height: 48px;
  `,
  left: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
}));

interface CoachChatHeaderProps {
  activeAgent: string | null;
  onNewSession: () => void;
}

export function CoachChatHeader({
  activeAgent,
  onNewSession,
}: CoachChatHeaderProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        {activeAgent && <AgentBadge agent={activeAgent} />}
        {!activeAgent && (
          <span style={{ fontSize: 14, color: claudeColors.oliveGray }}>
            AI 职业规划教练
          </span>
        )}
      </div>
      <Button size="small" onClick={onNewSession}>
        新对话
      </Button>
    </div>
  );
}
