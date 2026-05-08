import { Card, Space, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { CountUpNumber } from '@/components/ui/CountUpNumber';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { claudeColors } from '@/styles/claude-tokens';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    padding: 24px 0;
  `,
  metricsRow: css`
    display: flex;
    align-items: flex-start;
    gap: 20px;
    flex-wrap: wrap;
  `,
  metricCard: css`
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  metricInner: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  `,
  metricLabel: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
    font-weight: 500;
  `,
  metricValue: css`
    font-family: var(--font-heading, "Noto Serif SC", "Songti SC", serif);
    font-size: 28px;
    font-weight: 700;
    color: ${token.colorText};
    line-height: 1;
    letter-spacing: -0.01em;
  `,
  metricSub: css`
    font-size: 11px;
    color: ${token.colorTextTertiary};
  `,
  moduleCard: css`
    border-radius: ${token.borderRadiusLG}px;
    margin-top: 16px;
    padding: 12px 16px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
  `,
}));

interface PathHeroProps {
  currentPhaseLabel: string;
  timeHorizon: string;
  matchPercent: number;
  contentCompletion: number;
  practiceCompletion: number;
  currentModuleName: string;
  moduleCount: { completed: number; total: number };
}

export function PathHero({
  currentPhaseLabel,
  timeHorizon,
  matchPercent,
  contentCompletion,
  practiceCompletion,
  currentModuleName,
  moduleCount,
}: PathHeroProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.metricsRow}>
        {/* 当前阶段 */}
        <Card className={styles.metricCard} size="small" style={{ minWidth: 120 }}>
          <div className={styles.metricInner}>
            <Text className={styles.metricLabel}>当前阶段</Text>
            <div className={styles.metricValue}>{currentPhaseLabel}</div>
            <Text className={styles.metricSub}>{timeHorizon}</Text>
          </div>
        </Card>

        {/* 匹配度 — CountUpNumber */}
        <Card className={styles.metricCard} size="small" style={{ minWidth: 140 }}>
          <div className={styles.metricInner}>
            <Text className={styles.metricLabel}>匹配度</Text>
            <CountUpNumber
              data-testid="hero-match-countup"
              target={matchPercent}
              suffix="%"
              duration={1.2}
            />
            <Text className={styles.metricSub}>目标岗位</Text>
          </div>
        </Card>

        {/* 内容完成度 — ProgressRing */}
        <Card className={styles.metricCard} size="small" style={{ minWidth: 140 }}>
          <div className={styles.metricInner}>
            <Text className={styles.metricLabel}>内容完成度</Text>
            <ProgressRing
              data-testid="hero-content-completion-ring"
              percent={contentCompletion}
              size={96}
              strokeWidth={7}
              color={claudeColors.terracotta}
            />
            <Text className={styles.metricSub}>已学资源</Text>
          </div>
        </Card>

        {/* 练习完成度 — ProgressRing */}
        <Card className={styles.metricCard} size="small" style={{ minWidth: 140 }}>
          <div className={styles.metricInner}>
            <Text className={styles.metricLabel}>实践完成度</Text>
            <ProgressRing
              data-testid="hero-practice-completion-ring"
              percent={practiceCompletion}
              size={96}
              strokeWidth={7}
              color={claudeColors.terracotta}
            />
            <Text className={styles.metricSub}>任务进度</Text>
          </div>
        </Card>
      </div>

      {/* 当前模块 */}
      {currentModuleName && (
        <Card size="small" className={styles.moduleCard}>
          <Space>
            <Text strong>{currentModuleName}</Text>
            <Text type="secondary">
              {moduleCount.completed}/{moduleCount.total}
            </Text>
          </Space>
        </Card>
      )}
    </div>
  );
}
