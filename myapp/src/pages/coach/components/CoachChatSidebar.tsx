import { Button, List, Skeleton } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import type { CoachSession } from '../api';

const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
  `,
  header: css`
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.10);
  `,
  newBtn: css`
    width: 100%;
    border: 1px dashed rgba(255, 255, 255, 0.20);
    background: rgba(255, 255, 255, 0.08);
    color: ${claudeColors.warmSilver};
    border-radius: 10px;
    &:hover {
      border-color: rgba(255, 255, 255, 0.35) !important;
      color: ${claudeColors.ivory} !important;
      background: rgba(255, 255, 255, 0.12) !important;
    }
  `,
  list: css`
    flex: 1;
    overflow-y: auto;
  `,
  title: css`
    color: ${claudeColors.warmSilver};
    font-size: 11px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 14px 14px 8px;
  `,
  item: css`
    cursor: pointer;
    padding: 8px 14px !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
    transition: background 0.15s;
    &:hover {
      background: rgba(255, 255, 255, 0.06) !important;
    }
  `,
  itemActive: css`
    background: rgba(201, 100, 66, 0.18) !important;
    border-left: 2px solid ${claudeColors.terracotta};
  `,
  itemTitle: css`
    color: ${claudeColors.warmSilver} !important;
    font-size: 13px !important;
  `,
  itemMeta: css`
    color: rgba(176, 174, 165, 0.6) !important;
    font-size: 11px !important;
  `,
  empty: css`
    padding: 24px;
    text-align: center;
    color: rgba(176, 174, 165, 0.5);
    font-size: 13px;
  `,
}));

interface CoachChatSidebarProps {
  sessions: CoachSession[];
  activeSessionId?: string | null;
  loading?: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function CoachChatSidebar({
  sessions,
  activeSessionId,
  loading,
  onSelectSession,
  onNewSession,
}: CoachChatSidebarProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          className={styles.newBtn}
          icon={<PlusOutlined />}
          onClick={onNewSession}
        >
          新对话
        </Button>
      </div>

      <div className={styles.title}>Sessions</div>

      <div className={styles.list}>
        {loading ? (
          <div style={{ padding: 12 }}>
            <Skeleton
              active
              paragraph={{ rows: 3 }}
              title={false}
            />
          </div>
        ) : sessions.length === 0 ? (
          <div className={styles.empty}>尚无对话</div>
        ) : (
          <List
            size="small"
            dataSource={sessions}
            renderItem={(session) => (
              <List.Item
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`${styles.item} ${
                  session.id === activeSessionId ? styles.itemActive : ''
                }`}
              >
                <List.Item.Meta
                  title={
                    <span className={styles.itemTitle}>
                      {session.title}
                    </span>
                  }
                  description={
                    <span className={styles.itemMeta}>
                      {session.messageCount} 条消息
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
}
