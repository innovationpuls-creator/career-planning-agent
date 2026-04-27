import {
  BulbOutlined,
  FieldNumberOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { Card, Skeleton, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';

const { Text } = Typography;

const ASSESSMENT_CONFIG = {
  匹配较好: { ringColor: '#00b4d8', glow: 'rgba(0,180,216,0.5)' },
  基本匹配: { ringColor: '#f59e0b', glow: 'rgba(245,158,11,0.5)' },
  还需补强: { ringColor: '#f87171', glow: 'rgba(248,113,113,0.5)' },
};

const useStyles = createStyles(({ css }) => ({
  hero: css`
    width: 100%;
    margin-bottom: 16px;
    animation: heroEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;

    @keyframes heroEntrance {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,

  heroCard: css`
    background: rgba(11, 17, 35, 0.9);
    border: 1px solid rgba(0, 180, 216, 0.15);
    border-radius: 16px;
    overflow: hidden;
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 180, 216, 0.04);
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(0, 180, 216, 0.4), transparent);
    }

    :global(.ant-card-body) { padding: 0; }
  `,

  heroMain: css`
    display: flex;
    align-items: stretch;
    gap: 16px;
    padding: 20px 24px;
    flex-wrap: wrap;
    position: relative;
  `,

  metricsRow: css`
    display: flex;
    align-items: stretch;
    gap: 8px;
    flex: 1;
    flex-wrap: wrap;
  `,

  metricBox: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 16px 20px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 180, 216, 0.1);
    min-width: 110px;
    flex: 1;
    position: relative;
    overflow: hidden;
    transition: all 0.25s ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, var(--glow, transparent) 0%, transparent 70%);
      opacity: 0.12;
      pointer-events: none;
    }

    &:hover {
      border-color: rgba(0, 180, 216, 0.28);
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }
  `,

  metricBoxPrimary: css`
    border-color: rgba(0, 180, 216, 0.28);
    background: linear-gradient(135deg, rgba(0, 180, 216, 0.1), rgba(0, 119, 182, 0.05));
  `,

  metricLabel: css`
    font-size: 11px;
    color: #475569;
    line-height: 1.4;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
    font-family: var(--font-heading);
  `,

  metricValue: css`
    font-size: 26px;
    font-weight: 800;
    color: #e2e8f0;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    font-family: var(--font-heading);
  `,

  metricValuePrimary: css`
    font-size: 34px;
    font-weight: 800;
    color: #00b4d8;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    text-shadow: 0 0 20px rgba(0, 180, 216, 0.5);
    font-family: var(--font-heading);
  `,

  metricUnit: css`
    font-size: 11px;
    color: #334155;
    font-weight: 500;
  `,

  radialScore: css`
    width: 84px;
    height: 84px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    align-self: center;
  `,

  radialInner: css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `,

  radialValue: css`
    font-size: 22px;
    font-weight: 800;
    color: #00b4d8;
    line-height: 1;
    letter-spacing: -0.02em;
    text-shadow: 0 0 12px rgba(0, 180, 216, 0.5);
  `,

  radialLabel: css`
    font-size: 10px;
    color: #475569;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-top: 2px;
  `,

  assessmentBox: css`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 10px;
    flex-shrink: 0;
    padding-left: 20px;
    border-left: 1px solid rgba(0, 180, 216, 0.08);
    align-self: center;
  `,

  assessmentLabel: css`
    font-family: var(--font-heading);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.05em;
  `,

  gapRow: css`
    display: flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
    font-size: 12.5px;
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.15);
    border-radius: 8px;
    padding: 4px 10px;
  `,

  gapIcon: css`
    color: #f59e0b;
    font-size: 12px;
  `,

  divider: css`
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 180, 216, 0.1), transparent);
  `,

  footer: css`
    display: flex;
    align-items: flex-start;
    gap: 24px;
    padding: 14px 24px;
    flex-wrap: wrap;
  `,

  footerGroup: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    animation: fadeIn 0.4s ease both;
  `,

  footerIcon: css`
    font-size: 13px;
    margin-top: 5px;
    flex-shrink: 0;
  `,

  footerContent: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,

  footerLabel: css`
    font-size: 10px;
    color: #334155;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
  `,

  footerTags: css`
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  `,

  strengthTag: css`
    border: 1px solid rgba(0, 180, 216, 0.22);
    background: rgba(0, 180, 216, 0.08);
    color: #00b4d8;
    font-size: 12px;
    border-radius: 6px;
    padding: 2px 8px;
    margin: 0;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(0, 180, 216, 0.15);
      border-color: rgba(0, 180, 216, 0.38);
      box-shadow: 0 0 8px rgba(0, 180, 216, 0.2);
    }
  `,

  gapTag: css`
    border: 1px solid rgba(245, 158, 11, 0.22);
    background: rgba(245, 158, 11, 0.06);
    color: #f59e0b;
    font-size: 12px;
    border-radius: 6px;
    padding: 2px 8px;
    margin: 0;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(245, 158, 11, 0.38);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
    }
  `,

  updatedAt: css`
    margin-left: auto;
    font-size: 11px;
    color: #1e293b;
    flex-shrink: 0;
    margin-top: 6px;
  `,
}));

type HeroAnalysisSectionProps = {
  analysis?: API.StudentCompetencyLatestAnalysisPayload;
  loading?: boolean;
};

const HeroAnalysisSection: React.FC<HeroAnalysisSectionProps> = ({
  analysis,
  loading = false,
}) => {
  const { styles, cx } = useStyles();

  if (loading) {
    return (
      <div className={styles.hero}>
        <Card className={styles.heroCard}>
          <div className={styles.heroMain}>
            <Skeleton active paragraph={{ rows: 1 }} />
          </div>
        </Card>
      </div>
    );
  }

  if (!analysis?.available) {
    return null;
  }

  const { score } = analysis;
  const overallScore = Math.round(score?.overall ?? 0);
  const completenessScore = Math.round(score?.completeness ?? 0);
  const competitivenessScore = Math.round(score?.competitiveness ?? 0);

  const assessmentLabel =
    overallScore >= 85
      ? '匹配较好'
      : overallScore >= 70
        ? '基本匹配'
        : '还需补强';

  const cfg =
    ASSESSMENT_CONFIG[assessmentLabel as keyof typeof ASSESSMENT_CONFIG];

  const strengthDims = analysis.strength_dimensions ?? [];
  const priorityGaps = analysis.priority_gap_dimensions ?? [];
  const topGap =
    analysis.comparison_dimensions?.find(
      (d: { key: string }) => d.key === priorityGaps[0],
    )?.title ??
    priorityGaps[0] ??
    null;

  const updatedAtLabel = analysis.updated_at
    ? new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(analysis.updated_at))
    : null;

  const circumference = 2 * Math.PI * 34; // r=34

  return (
    <div className={styles.hero}>
      <Card className={styles.heroCard}>
        {/* Top row */}
        <div className={styles.heroMain}>
          {/* Score metric boxes */}
          <div className={styles.metricsRow}>
            <div
              className={cx(styles.metricBox, styles.metricBoxPrimary)}
              style={{ '--glow': '#00b4d8' } as React.CSSProperties}
            >
              <Text className={styles.metricLabel}>综合评分</Text>
              <Text className={styles.metricValuePrimary}>{overallScore}</Text>
              <Text className={styles.metricUnit}>分</Text>
            </div>
            <div
              className={styles.metricBox}
              style={{ '--glow': '#10b981' } as React.CSSProperties}
            >
              <Text className={styles.metricLabel}>简历完整度</Text>
              <Text className={styles.metricValue}>{completenessScore}</Text>
              <Text className={styles.metricUnit}>分</Text>
            </div>
            <div
              className={styles.metricBox}
              style={{ '--glow': '#8b5cf6' } as React.CSSProperties}
            >
              <Text className={styles.metricLabel}>市场竞争力</Text>
              <Text className={styles.metricValue}>{competitivenessScore}</Text>
              <Text className={styles.metricUnit}>分</Text>
            </div>
          </div>

          {/* Radial score ring */}
          <div className={styles.radialScore}>
            <svg
              width="84"
              height="84"
              viewBox="0 0 84 84"
              role="img"
              aria-label="综合评分环形图"
            >
              <circle
                cx="42"
                cy="42"
                r="34"
                fill="none"
                stroke="rgba(0,180,216,0.08)"
                strokeWidth="4"
              />
              <circle
                cx="42"
                cy="42"
                r="34"
                fill="none"
                stroke={cfg.ringColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={`${circumference * (1 - overallScore / 100)}`}
                transform="rotate(-90 42 42)"
                style={{
                  filter: `drop-shadow(0 0 4px ${cfg.glow})`,
                  transition:
                    'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </svg>
            <div className={styles.radialInner}>
              <Text className={styles.radialValue}>{overallScore}</Text>
              <Text className={styles.radialLabel}>综合</Text>
            </div>
          </div>

          {/* Assessment + gap */}
          <div className={styles.assessmentBox}>
            <Text
              className={styles.assessmentLabel}
              style={{ color: cfg.ringColor }}
            >
              {assessmentLabel}
            </Text>
            {topGap && (
              <div className={styles.gapRow}>
                <BulbOutlined className={styles.gapIcon} />
                <Text style={{ fontSize: 12.5, color: '#94a3b8' }}>
                  优先补强：
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                    {topGap}
                  </span>
                </Text>
              </div>
            )}
          </div>
        </div>

        <div className={styles.divider} />

        {/* Footer tags */}
        <div className={styles.footer}>
          {strengthDims.length > 0 && (
            <div className={styles.footerGroup}>
              <RadarChartOutlined
                className={styles.footerIcon}
                style={{ color: '#00b4d8' }}
              />
              <div className={styles.footerContent}>
                <Text className={styles.footerLabel}>优势维度</Text>
                <div className={styles.footerTags}>
                  {strengthDims.slice(0, 4).map((dim: string) => {
                    const dimTitle =
                      analysis.comparison_dimensions?.find(
                        (d: { key: string }) => d.key === dim,
                      )?.title ?? dim;
                    return (
                      <Tag key={dim} className={styles.strengthTag}>
                        {dimTitle}
                      </Tag>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {priorityGaps.length > 0 && (
            <div className={styles.footerGroup}>
              <FieldNumberOutlined
                className={styles.footerIcon}
                style={{ color: '#f59e0b' }}
              />
              <div className={styles.footerContent}>
                <Text className={styles.footerLabel}>待补方向</Text>
                <div className={styles.footerTags}>
                  {priorityGaps.slice(0, 3).map((key: string) => {
                    const dimTitle =
                      analysis.comparison_dimensions?.find(
                        (d: { key: string }) => d.key === key,
                      )?.title ?? key;
                    return (
                      <Tag key={key} className={styles.gapTag}>
                        {dimTitle}
                      </Tag>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {updatedAtLabel && (
            <Text className={styles.updatedAt}>更新于 {updatedAtLabel}</Text>
          )}
        </div>
      </Card>
    </div>
  );
};

export default HeroAnalysisSection;
