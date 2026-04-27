import { Button, Spin, Typography } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import type { PrerequisiteItem } from '../hooks/usePrerequisites';

const { Text } = Typography;

type ReportEmptyStateProps = {
  activeFavorite?: API.CareerDevelopmentFavoritePayload;
  prerequisites: PrerequisiteItem[];
  blockingCount: number;
  generating: boolean;
  taskProgress?: number;
  taskStatusText?: string;
  onCreateTask: () => void;
  onViewDetails: () => void;
  onCancelTask?: () => void;
  cancellingTask?: boolean;
  loading?: boolean;
};

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    display: flex;
    flex-direction: column;
    gap: 24px;
  `,

  hero: css`
    position: relative;
    overflow: hidden;
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(160deg, #0F2060 0%, #1A3A8F 50%, #0F4299 100%);
    padding: 56px 48px 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 32px;

    @media (max-width: 768px) {
      padding: 40px 24px 36px;
      gap: 24px;
      border-radius: ${token.borderRadiusLG}px;
    }
  `,

  heroTexture: css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(
      ellipse at 20% 50%,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 60%
    ),
    radial-gradient(
      ellipse at 80% 50%,
      rgba(255, 255, 255, 0.03) 0%,
      transparent 50%
    );
    background-size: 100% 100%;
  `,

  heroBody: css`
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  `,

  heroTitle: css`
    font-family: var(--font-heading);
    font-size: 32px;
    font-weight: var(--font-weight-display, 900);
    letter-spacing: 0.06em;
    color: #ffffff;
    margin: 0;
    line-height: 1.12;

    @media (max-width: 768px) {
      font-size: 24px;
    }
  `,

  heroSubtitle: css`
    font-family: var(--font-body);
    font-size: 15px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    line-height: 1.6;
    max-width: 480px;
  `,

  stepsRow: css`
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0;
    width: 100%;
    max-width: 640px;

    @media (max-width: 768px) {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
  `,

  stepItem: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    flex: 1;
    position: relative;

    &:not(:last-child)::after {
      content: '';
      position: absolute;
      top: 14px;
      left: calc(50% + 18px);
      width: calc(100% - 36px);
      height: 1px;
      background: rgba(255, 255, 255, 0.15);

      @media (max-width: 768px) {
        display: none;
      }
    }

    @media (max-width: 768px) {
      flex-direction: row;
      gap: 10px;
    }
  `,

  stepDot: css`
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
    transition: all var(--motion-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));
  `,

  stepDotReady: css`
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    border: 2px solid rgba(255, 255, 255, 0.3);
  `,

  stepDotDone: css`
    background: ${token.colorSuccess};
    color: #ffffff;
    border: 2px solid ${token.colorSuccess};
  `,

  stepDotMissing: css`
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    border: 2px dashed rgba(255, 255, 255, 0.25);
  `,

  stepLabel: css`
    font-family: var(--font-body);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
    text-align: center;
    line-height: 1.4;

    @media (max-width: 768px) {
      text-align: left;
    }
  `,

  stepLabelActive: css`
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  `,

  heroActions: css`
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  `,

  primaryBtn: css`
    height: 48px !important;
    padding: 0 36px !important;
    font-size: 16px !important;
    font-weight: 600 !important;
    border-radius: ${token.borderRadiusLG}px !important;
    background: #ffffff !important;
    border-color: #ffffff !important;
    color: #0F2060 !important;

    &:hover {
      background: rgba(255, 255, 255, 0.9) !important;
      border-color: rgba(255, 255, 255, 0.9) !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    &:active {
      transform: translateY(0);
    }

    transition: all var(--motion-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));
  `,

  secondaryLink: css`
    font-family: var(--font-body);
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    background: none;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    transition: color var(--motion-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));

    &:hover {
      color: rgba(255, 255, 255, 0.8);
    }
  `,

  progressWrap: css`
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    max-width: 400px;
  `,

  progressPercent: css`
    font-family: var(--font-heading);
    font-size: 64px;
    font-weight: var(--font-weight-display, 900);
    color: #ffffff;
    line-height: 1;
    letter-spacing: 0.02em;
    transition: all 0.5s var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));
  `,

  progressBar: css`
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  `,

  progressFill: css`
    height: 100%;
    border-radius: 2px;
    background: #ffffff;
    transition: width 0.3s var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));
  `,

  progressText: css`
    font-family: var(--font-body);
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  `,

  cancelBtn: css`
    color: rgba(255, 255, 255, 0.7) !important;
    border-color: rgba(255, 255, 255, 0.25) !important;

    &:hover {
      color: #ffffff !important;
      border-color: rgba(255, 255, 255, 0.5) !important;
    }
  `,

  loadingShell: css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 360px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
  `,
}));

const CHINESE_STEP_NUMBERS = ['①', '②', '③', '④'];

const ReportEmptyState: React.FC<ReportEmptyStateProps> = ({
  activeFavorite,
  prerequisites,
  generating,
  taskProgress = 0,
  taskStatusText = '正在准备...',
  onCreateTask,
  onViewDetails,
  onCancelTask,
  cancellingTask = false,
  loading = false,
}) => {
  const { styles, cx } = useStyles();

  if (loading) {
    return (
      <div className={styles.loadingShell}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.hero}>
        <div className={styles.heroTexture} />

        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>个人职业成长报告</h1>
          <p className={styles.heroSubtitle}>
            系统将基于我的资料、12维能力解析、职业匹配差距和蜗牛学习路径，生成一份可编辑的个人职业发展分析报告。
          </p>
          {activeFavorite ? (
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
              {activeFavorite.canonical_job_title}
              {activeFavorite.industry ? ` · ${activeFavorite.industry}` : ''}
              {activeFavorite.overall_match !== undefined
                ? ` · 匹配度 ${Math.round(activeFavorite.overall_match)}%`
                : ''}
            </Text>
          ) : null}
        </div>

        {generating ? (
          <div className={styles.progressWrap}>
            <div className={styles.progressPercent}>{taskProgress}%</div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${taskProgress}%` }}
              />
            </div>
            <p className={styles.progressText}>{taskStatusText}</p>
            {onCancelTask ? (
              <Button
                className={styles.cancelBtn}
                onClick={onCancelTask}
                loading={cancellingTask}
              >
                取消生成
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className={styles.stepsRow}>
              {prerequisites.map((item, index) => {
                const dotClass = item.ready
                  ? styles.stepDotDone
                  : item.blocking
                    ? styles.stepDotMissing
                    : styles.stepDotReady;

                return (
                  <div key={item.key} className={styles.stepItem}>
                    <div className={cx(styles.stepDot, dotClass)}>
                      {item.ready ? '✓' : CHINESE_STEP_NUMBERS[index]}
                    </div>
                    <span className={cx(styles.stepLabel, !item.blocking || item.ready ? styles.stepLabelActive : undefined)}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={styles.heroActions}>
              <button
                className={styles.primaryBtn}
                onClick={onCreateTask}
                type="button"
              >
                开始分析
              </button>
              <button
                className={styles.secondaryLink}
                onClick={onViewDetails}
                type="button"
              >
                查看前置条件详情
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportEmptyState;
