import { PlusOutlined } from '@ant-design/icons';
import React from 'react';
import { motion } from 'framer-motion';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { springGentle } from '../motion';
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
    position: relative;
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
  skeleton: css`
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  skeletonLine: css`
    height: 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    width: 100%;
  `,
  skeletonLineShort: css`
    height: 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    width: 60%;
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
  const reduced = prefersReducedMotion();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <motion.button
          type="button"
          className={styles.newBtn}
          onClick={onNewSession}
          whileHover={reduced ? undefined : { scale: 1.02 }}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          transition={springGentle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
            height: 32,
          }}
        >
          <PlusOutlined />
          新对话
        </motion.button>
      </div>

      <div className={styles.title}>Sessions</div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.skeleton}>
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLineShort} />
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLineShort} />
          </div>
        ) : sessions.length === 0 ? (
          <div className={styles.empty}>尚无对话</div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <motion.div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                whileTap={reduced ? undefined : { scale: 0.98 }}
                transition={springGentle}
              >
                <div>
                  <div className={styles.itemTitle}>{session.title}</div>
                  <div className={styles.itemMeta}>
                    {session.messageCount} 条消息
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
