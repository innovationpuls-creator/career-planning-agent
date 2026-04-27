import { Drawer } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import type { PrerequisiteItem } from '../hooks/usePrerequisites';

type ReportDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  prerequisiteItems: PrerequisiteItem[];
  profile?: {
    full_name?: string;
    school?: string;
    major?: string;
    education_level?: string;
    grade?: string;
    target_job_title?: string;
  };
};

const useStyles = createStyles(({ css, token }) => ({
  drawerSection: css`
    display: grid;
    gap: 12px;
    margin-bottom: 24px;
  `,

  drawerSectionTitle: css`
    font-family: var(--font-heading);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: ${token.colorText};
    margin-bottom: 4px;
  `,

  prerequisiteTimeline: css`
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
  `,

  timelineItem: css`
    display: flex;
    gap: 12px;
    padding: 12px 0;
    position: relative;

    &:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 10px;
      top: 36px;
      bottom: 0;
      width: 2px;
      background: ${token.colorBorderSecondary};
    }

    &:last-child {
      padding-bottom: 0;
    }
  `,

  timelineDot: css`
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 11px;
    z-index: 1;
  `,

  timelineDotReady: css`
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    border: 2px solid ${token.colorSuccessBorder};
  `,

  timelineDotBlocking: css`
    background: ${token.colorErrorBg};
    color: ${token.colorError};
    border: 2px solid ${token.colorErrorBorder};
  `,

  timelineBody: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  `,

  timelineLabel: css`
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorText};
  `,

  timelineDesc: css`
    font-family: var(--font-body);
    font-size: 12px;
    color: ${token.colorTextSecondary};
    line-height: 1.5;
  `,

  timelinePrompt: css`
    font-family: var(--font-body);
    font-size: 12px;
    color: ${token.colorTextTertiary};
    font-style: italic;
  `,

  profileCard: css`
    background: ${token.colorFillQuaternary};
    border-radius: ${token.borderRadius}px;
    padding: 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 24px;

    @media (max-width: 480px) {
      grid-template-columns: 1fr;
    }
  `,

  profileField: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  profileFieldLabel: css`
    font-family: var(--font-body);
    font-size: 11px;
    color: ${token.colorTextTertiary};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,

  profileFieldValue: css`
    font-family: var(--font-body);
    font-size: 13px;
    color: ${token.colorText};
    font-weight: 500;
  `,
}));

const ReportDetailDrawer: React.FC<ReportDetailDrawerProps> = ({
  open,
  onClose,
  prerequisiteItems,
  profile,
}) => {
  const { styles, cx } = useStyles();

  return (
    <Drawer
      title="报告详情"
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      destroyOnClose={false}
    >
      <div className={styles.drawerSection}>
        <div className={styles.drawerSectionTitle}>前置条件</div>
        <div className={styles.prerequisiteTimeline}>
          {prerequisiteItems.map((item) => (
            <div key={item.key} className={styles.timelineItem}>
              <div
                className={cx(
                  styles.timelineDot,
                  item.ready
                    ? styles.timelineDotReady
                    : item.blocking
                      ? styles.timelineDotBlocking
                      : styles.timelineDotReady,
                )}
              >
                {item.ready ? '✓' : '!'}
              </div>
              <div className={styles.timelineBody}>
                <span className={styles.timelineLabel}>{item.label}</span>
                <span className={styles.timelineDesc}>{item.description}</span>
                {!item.ready ? (
                  <span className={styles.timelinePrompt}>{item.prompt}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.drawerSection}>
        <div className={styles.drawerSectionTitle}>我的资料</div>
        <div className={styles.profileCard}>
          <div className={styles.profileField}>
            <span className={styles.profileFieldLabel}>姓名</span>
            <span className={styles.profileFieldValue}>{profile?.full_name || '-'}</span>
          </div>
          <div className={styles.profileField}>
            <span className={styles.profileFieldLabel}>学校</span>
            <span className={styles.profileFieldValue}>{profile?.school || '-'}</span>
          </div>
          <div className={styles.profileField}>
            <span className={styles.profileFieldLabel}>专业</span>
            <span className={styles.profileFieldValue}>{profile?.major || '-'}</span>
          </div>
          <div className={styles.profileField}>
            <span className={styles.profileFieldLabel}>学历</span>
            <span className={styles.profileFieldValue}>{profile?.education_level || '-'}</span>
          </div>
          <div className={styles.profileField}>
            <span className={styles.profileFieldLabel}>年级</span>
            <span className={styles.profileFieldValue}>{profile?.grade || '-'}</span>
          </div>
          <div className={styles.profileField}>
            <span className={styles.profileFieldLabel}>目标岗位</span>
            <span className={styles.profileFieldValue}>{profile?.target_job_title || '-'}</span>
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default ReportDetailDrawer;
