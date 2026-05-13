import { Button } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
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
        <span className={styles.dot} />
        {activeAgent ? (
          <AgentBadge agent={activeAgent} />
        ) : (
          <span className={styles.title}>AI 职业规划教练</span>
        )}
      </div>
      <Button className={styles.newBtn} size="small" onClick={onNewSession}>
        新对话
      </Button>
    </div>
  );
}
