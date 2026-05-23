import { Radar } from '@ant-design/charts';
import { Empty, Spin } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import { studentCompetencyRadarColors } from '@/styles/chart-tokens';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

interface RadarComparisonPanelProps {
  chartSeries: API.StudentCompetencyChartSeriesItem[];
  dimensions: API.StudentCompetencyComparisonDimensionItem[];
  loading?: boolean;
}

const DIMENSION_SHORT: Record<string, string> = {
  professional_skills: '专业技能',
  professional_background: '专业背景',
  education_requirement: '教育要求',
  teamwork: '团队协作',
  stress_adaptability: '抗压适应',
  problem_solving: '解决问题',
  communication: '沟通表达',
  work_experience: '工作经验',
  documentation_awareness: '文档意识',
  responsibility: '责任心',
  learning_ability: '学习能力',
  other_special: '其他特长',
};

const useStyles = createStyles(({ css }) => ({
  panel: css`
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    padding: 24px;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin-bottom: 16px;
  `,
  chartWrap: css`
    width: 100%;
    height: 320px;
    position: relative;
  `,
  legend: css`
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
    margin-top: 8px;
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  legendItem: css`display: flex; align-items: center; gap: 6px;`,
  legendDot: css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid ${studentCompetencyRadarColors.marketImportance};
    background: ${studentCompetencyRadarColors.marketImportance};
  `,
  scoreGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid ${claudeColors.borderCream};
  `,
  scoreItem: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.4);
    border-radius: ${claudeRadius.md}px;
    transition: background 0.2s ease;
    &:hover {
      background: ${claudeColors.borderCream};
    }
  `,
  scoreItemHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  scoreLabel: css`
    font-size: 13px;
    font-weight: 500;
    color: ${claudeColors.nearBlack};
  `,
  scoreValue: css`
    font-family: ${claudeFonts.heading};
    font-size: 14px;
    font-weight: 700;
  `,
  scoreBar: css`
    height: 4px;
    border-radius: 2px;
    background: ${claudeColors.borderCream};
    overflow: hidden;
  `,
  scoreBarFill: css`
    height: 100%;
    border-radius: 2px;
    transition: width 0.6s ease;
  `,
  emptyWrap: css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 280px;
  `,
}));

export function RadarComparisonPanel({
  chartSeries,
  dimensions,
  loading,
}: RadarComparisonPanelProps) {
  const { styles } = useStyles();

  const chartData = useMemo(
    () =>
      chartSeries.flatMap((item) => [
        {
          dimension: DIMENSION_SHORT[item.key] || item.title,
          key: item.key,
          value: item.market_importance,
          category: '市场重要度',
        },
        {
          dimension: DIMENSION_SHORT[item.key] || item.title,
          key: item.key,
          value: item.user_readiness,
          category: '个人准备度',
        },
      ]),
    [chartSeries],
  );

  const config = useMemo(
    () => ({
      data: chartData,
      xField: 'dimension',
      yField: 'value',
      colorField: 'category',
      scale: {
        y: { domain: [0, 100] },
        color: {
          range: [
            studentCompetencyRadarColors.marketImportance,
            studentCompetencyRadarColors.userReadiness,
          ],
        },
      },
      style: { lineWidth: 2 },
      area: { style: { fillOpacity: 0.2 } },
      point: { size: 3 },
      axis: {
        x: {
          labelFontSize: 11,
          labelSpacing: 6,
          labelFill: claudeColors.oliveGray,
        },
        y: {
          labelFontSize: 11,
          labelFill: claudeColors.oliveGray,
          labelFormatter: (v: number) => `${v}%`,
        },
      },
      legend: false,
      padding: [16, 16, 24, 16],
    }),
    [chartData],
  );

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyWrap}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!chartSeries.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyWrap}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无维度数据"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel} data-testid="radar-comparison-panel">
      <div className={styles.title}>能力雷达图</div>
      <div className={styles.chartWrap}>
        <Radar {...config} />
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} /> 市场重要度
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{
              borderColor: studentCompetencyRadarColors.userReadiness,
              background: studentCompetencyRadarColors.userReadiness,
            }}
          />
          个人准备度
        </span>
      </div>
      <div className={styles.scoreGrid}>
        {dimensions.map((d) => {
          const value = Math.round(d.user_readiness);
          const barColor =
            value >= 70
              ? claudeColors.success
              : value >= 40
                ? claudeColors.terracotta
                : claudeColors.error;
          return (
            <div key={d.key} className={styles.scoreItem}>
              <div className={styles.scoreItemHeader}>
                <span className={styles.scoreLabel}>{d.title}</span>
                <span className={styles.scoreValue} style={{ color: barColor }}>
                  {value}
                </span>
              </div>
              <div className={styles.scoreBar}>
                <div
                  className={styles.scoreBarFill}
                  style={{ width: `${value}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
