import { Button, List, Skeleton } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import React from 'react';
import { claudeColors, claudeAlpha } from '@/styles/claude-tokens';
import type { CoachSession } from '../api';

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
  return (
    <div
      style={{
        width: 260,
        borderRight: `1px solid ${claudeAlpha('#ffffff', 0.5)}`,
        display: 'flex',
        flexDirection: 'column',
        background: claudeAlpha(claudeColors.ivory, 0.6),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ padding: '12px', borderBottom: `1px solid ${claudeColors.borderCream}` }}>
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={onNewSession}
        >
          新对话
        </Button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 12 }}>
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: claudeColors.stoneGray,
              fontSize: 13,
            }}
          >
            尚无对话
          </div>
        ) : (
          <List
            size="small"
            dataSource={sessions}
            renderItem={(session) => (
              <List.Item
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background:
                    session.id === activeSessionId
                      ? claudeColors.borderCream
                      : 'transparent',
                }}
              >
                <List.Item.Meta
                  title={
                    <span style={{ fontSize: 13 }}>
                      {session.title}
                    </span>
                  }
                  description={
                    <span style={{ fontSize: 11 }}>
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
