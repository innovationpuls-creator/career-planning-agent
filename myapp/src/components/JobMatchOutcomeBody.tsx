import { Radar } from '@ant-design/charts';
import {
  AimOutlined,
  BankOutlined,
  BarChartOutlined,
  BookOutlined,
  CodeOutlined,
  CopyOutlined,
  FileTextOutlined,
  ReadOutlined,
  StarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Collapse, Empty, Space, Tag, Typography, message } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';

const { Text, Title } = Typography;

const STATUS_COLOR_MAP: Record<string, string> = {
  明显缺失: 'error',
  信息偏弱: 'warning',
  需要补充: 'processing',
  已具备优势: 'success',
  匹配较好: 'success',
  基本匹配: 'processing',
  还需补强: 'warning',
};

const STRENGTH_GROUP_CONFIG = [
  {
    key: 'education-foundation',
    title: '基础背景',
    dimensionKeys: ['professional_background', 'education_requirement', 'work_experience'],
  },
  {
    key: 'professional-skills',
    title: '专业能力',
    dimensionKeys: [
      'professional_skills',
      'documentation_awareness',
      'problem_solving',
      'learning_ability',
      'other_special',
    ],
  },
  {
    key: 'team-collaboration',
    title: '协作与表达',
    dimensionKeys: ['teamwork', 'communication', 'responsibility', 'stress_adaptability'],
  },
] as const;

const useStyles = createStyles(({ css, token }) => ({
  section: css`
    padding: 20px 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
    box-shadow: 0 8px 20px rgba(15, 35, 70, 0.035);
  `,
  summarySection: css`
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  `,
  sectionHead: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  `,
  sectionTitle: css`
    margin: 0;
    color: ${token.colorText};
    font-size: 17px !important;
    font-weight: 600 !important;
  `,
  metricsShell: css`
    display: block;
  `,
  metricGrid: css`
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;

    @media (max-width: 1440px) {
      grid-template-columns: repeat(3, minmax(130px, 1fr));
    }

    @media (max-width: 960px) {
      grid-template-columns: repeat(2, minmax(120px, 1fr));
    }
  `,
  metricCard: css`
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 64px;
    align-items: center;
    min-height: 118px;
    padding: 22px 24px;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
    box-shadow: 0 8px 20px rgba(15, 35, 70, 0.045);
    transition: all 0.2s ease;
    cursor: default;

    :hover {
      border-color: ${token.colorPrimaryBorder};
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(22, 85, 204, 0.08);
    }
  `,
  metricIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 26px;
  `,
  metricIconWarm: css`
    background: ${token.colorWarningBg};
    color: ${token.colorWarning};
  `,
  metricIconSuccess: css`
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
  `,
  metricLabel: css`
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  metricValueStrong: css`
    font-size: 30px;
    font-weight: 700;
    line-height: 1.15;
    color: ${token.colorPrimary};
  `,
  metricValue: css`
    color: ${token.colorText};
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
  `,
  metricValuePrimary: css`
    font-size: 21px;
    font-weight: 700;
    line-height: 1.3;
    color: ${token.colorText};
  `,
  assessmentValue: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  primaryAction: css`
    flex: 0 0 auto;
    align-self: center;
    border-radius: 8px;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
    }

    :active {
      transform: translateY(0);
    }
  `,
  comparisonBody: css`
    position: relative;
    display: grid;
    grid-template-columns: minmax(330px, 0.95fr) minmax(420px, 1.05fr);
    gap: 26px;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  `,
  chartPanel: css`
    min-width: 0;
  `,
  radarWrap: css`
    height: 318px;
    width: 100%;
  `,
  gapPanel: css`
    min-width: 0;
    padding-left: 26px;
    border-left: 1px dashed ${token.colorBorderSecondary};

    @media (max-width: 1200px) {
      padding-left: 0;
      border-left: 0;
    }
  `,
  gapList: css`
    display: grid;
    gap: 12px;
  `,
  gapButton: css`
    width: 100%;
    display: grid;
    gap: 8px;
    padding: 16px 18px;
    border-radius: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-2px);
      border-color: ${token.colorPrimaryBorder};
      box-shadow: 0 8px 18px rgba(22, 85, 204, 0.09);
    }

    :active {
      transform: translateY(0);
      box-shadow: none;
    }
  `,
  gapButtonActive: css`
    border-color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    transition: all 0.2s ease;
  `,
  gapTop: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  `,
  gapMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  `,
  gapLeading: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: ${token.colorWarningBg};
    color: ${token.colorWarning};
    font-size: 20px;
  `,
  gapLeadingBlue: css`
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  gapLeadingGreen: css`
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
  `,
  gapLeadingPurple: css`
    background: rgba(126, 104, 200, 0.12);
    color: #7e68c8;
  `,
  gapContent: css`
    min-width: 0;
    flex: 1;
  `,
  gapSummary: css`
    flex: 1;
    min-width: 0;
    color: ${token.colorTextSecondary};
  `,
  strengthsCompact: css`
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  `,
  strengthTag: css`
    margin-inline-end: 0 !important;
    padding: 3px 12px;
    border-color: ${token.colorSuccessBorder};
    border-radius: 6px;
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    font-size: 13px;
    line-height: 20px;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(31, 142, 61, 0.12);
    }
  `,
  adviceLayout: css`
    display: grid;
    grid-template-columns: 286px minmax(0, 1fr);
    gap: 18px;
    align-items: start;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  `,
  adviceListTitle: css`
    margin: 0 0 14px !important;
    color: ${token.colorText};
    font-size: 17px !important;
    font-weight: 600 !important;
  `,
  adviceList: css`
    display: grid;
    gap: 10px;
  `,
  adviceItem: css`
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
    padding: 14px 14px;
    border-radius: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-2px);
      border-color: ${token.colorPrimary};
      box-shadow: 0 4px 12px rgba(22, 119, 255, 0.15);
    }

    :active {
      transform: translateY(0);
    }
  `,
  adviceItemActive: css`
    border-color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    box-shadow: 0 8px 18px rgba(22, 85, 204, 0.08);
  `,
  adviceItemMain: css`
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 6px;
  `,
  adviceItemTop: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
  `,
  adviceItemSummary: css`
    color: ${token.colorTextSecondary};
    font-size: 13px;
    line-height: 1.55;
  `,
  adviceDetailPanel: css`
    min-width: 0;
  `,
  adviceDetail: css`
    display: grid;
    gap: 14px;
  `,
  adviceHero: css`
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 14px;
    align-items: flex-start;
    padding: 16px 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: linear-gradient(180deg, ${token.colorBgContainer} 0%, ${token.colorPrimaryBg} 180%);
  `,
  adviceHeroIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 22px;
  `,
  adviceHeroBody: css`
    min-width: 0;
    display: grid;
    gap: 8px;
  `,
  adviceHeroMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  adviceBlock: css`
    display: grid;
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
  `,
  adviceBlockTitle: css`
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${token.colorText};
    font-weight: 600;
  `,
  adviceSection: css`
    display: grid;
    gap: 8px;
  `,
  simpleList: css`
    display: grid;
    gap: 8px;
  `,
  simpleListItem: css`
    position: relative;
    padding-left: 14px;
    color: ${token.colorText};
    line-height: 1.65;

    &::before {
      position: absolute;
      top: 0.75em;
      left: 0;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: ${token.colorPrimary};
      content: '';
    }
  `,
  tagList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  moreCollapse: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};

    :global(.ant-collapse-header) {
      padding: 12px 16px !important;
    }

    :global(.ant-collapse-content-box) {
      padding: 0 16px 14px !important;
    }

    :global(.ant-collapse-item) {
      border-bottom: 0 !important;
    }
  `,
  copyButton: css`
    border-radius: 8px;
    border-color: ${token.colorPrimaryBorder};
    color: ${token.colorPrimary};
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(22, 85, 204, 0.12);
    }

    :active {
      transform: translateY(0);
    }
  `,
}));

export type JobMatchOutcomeMetric = {
  key: string;
  label: string;
  value: string;
  emphasize?: boolean;
};

export type JobMatchOutcomeRadarDatum = {
  dimension: string;
  category: string;
  value: number;
};

export type JobMatchOutcomeGapItem = {
  key: string;
  title: string;
  statusLabel: string;
  gapValue: number;
  gapLabel: string;
  readiness: number;
  summary: string;
  whyItMatters?: string;
  currentIssue?: string;
  nextActions: string[];
  examplePhrases: string[];
  evidenceSources: string[];
  recommendedKeywords: string[];
};

export type JobMatchOutcomeStrengthGroup = {
  key: string;
  title: string;
  tags: string[];
  overflowCount: number;
};

export type JobMatchOutcomeViewModel = {
  metrics: JobMatchOutcomeMetric[];
  assessmentLabel: string;
  primaryGapTitle?: string;
  primaryGapGapLabel?: string;
  primaryGapKey?: string;
  radarData: JobMatchOutcomeRadarDatum[];
  gaps: JobMatchOutcomeGapItem[];
  priorityGapKeys: string[];
  strengthGroups: JobMatchOutcomeStrengthGroup[];
  overallReview?: string;
};

type StrengthSourceItem = {
  user_values: string[];
};

type JobMatchComparisonPanelProps = {
  viewModel: JobMatchOutcomeViewModel;
  onOpenAdvice: (key?: string) => void;
};

type JobMatchAdvicePanelProps = {
  viewModel: JobMatchOutcomeViewModel;
  activeGapKey?: string;
  onActiveGapChange?: (key: string) => void;
  titlePrefix?: string;
  listTitle?: string;
  problemTitle?: string;
  suggestionTitle?: string;
  writableTitle?: string;
  copyButtonLabel?: string;
  referenceTitle?: string;
  showOverallReview?: boolean;
  overallReviewTitle?: string;
};

type CombinedBodyProps = {
  viewModel: JobMatchOutcomeViewModel;
};

type RadarChartProps = {
  config: Record<string, any>;
};

const RADAR_LABEL_MAP: Array<[string, string]> = [
  ['professional_skills', '专业技能'],
  ['professional_background', '专业背景'],
  ['education_requirement', '学历背景'],
  ['teamwork', '团队协作'],
  ['stress_adaptability', '抗压适应'],
  ['communication', '沟通表达'],
  ['work_experience', '工作经验'],
  ['documentation_awareness', '文档意识'],
  ['responsibility', '责任态度'],
  ['learning_ability', '学习能力'],
  ['problem_solving', '问题解决'],
  ['other_special', '特殊要求'],
  ['专业技能', '专业技能'],
  ['专业背景', '专业背景'],
  ['学历', '学历背景'],
  ['学业', '学历背景'],
  ['团队', '团队协作'],
  ['协作', '团队协作'],
  ['抗压', '抗压适应'],
  ['适应', '抗压适应'],
  ['沟通', '沟通表达'],
  ['表达', '沟通表达'],
  ['工作经验', '工作经验'],
  ['实习', '工作经验'],
  ['文档', '文档意识'],
  ['责任', '责任态度'],
  ['学习', '学习能力'],
  ['问题', '问题解决'],
  ['其他', '特殊要求'],
  ['特殊', '特殊要求'],
  ['补充', '特殊要求'],
  ['岗位', '岗位匹配'],
];

const truncateRadarLabel = (value: string) => {
  const normalized = value.trim();
  const matched = RADAR_LABEL_MAP.find(([keyword]) => normalized.includes(keyword));
  const display = matched?.[1] || normalized;
  if (display.length <= 6) return display;
  return `${display.slice(0, 6)}...`;
};

const getGapVisual = (key: string, index: number) => {
  if (key.includes('other') || key.includes('special') || key.includes('documentation')) {
    return { className: 'warm', icon: <FileTextOutlined /> };
  }
  if (key.includes('skill') || key.includes('professional_skills')) {
    return { className: 'blue', icon: <CodeOutlined /> };
  }
  if (key.includes('work') || key.includes('experience')) {
    return { className: 'green', icon: <BankOutlined /> };
  }
  if (key.includes('team') || key.includes('communication')) {
    return { className: 'purple', icon: <TeamOutlined /> };
  }
  if (key.includes('learning')) {
    return { className: 'blue', icon: <BookOutlined /> };
  }
  if (key.includes('background') || key.includes('education')) {
    return { className: 'warm', icon: <ReadOutlined /> };
  }
  return {
    className: index % 3 === 1 ? 'blue' : index % 3 === 2 ? 'purple' : 'warm',
    icon: <StarOutlined />,
  };
};

const isMeaningfulTag = (value?: string) => {
  const normalized = (value || '').trim();
  return !!normalized && normalized !== '暂无补充信息';
};

const copyText = async (value: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') return;

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const StableRadarChart: React.FC<RadarChartProps> = ({ config }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 300 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const updateSize = () => {
      const nextWidth = Math.max(Math.floor(element.clientWidth), 0);
      const nextHeight = Math.max(Math.floor(element.clientHeight), 300);
      setChartSize((current) =>
        current.width === nextWidth && current.height === nextHeight ? current : { width: nextWidth, height: nextHeight },
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {chartSize.width > 0 ? (
        <Radar
          key={`${chartSize.width}-${chartSize.height}-${config.data?.length || 0}`}
          {...config}
          autoFit={false}
          width={chartSize.width}
          height={chartSize.height}
        />
      ) : null}
    </div>
  );
};

const getPrioritizedGaps = (viewModel: JobMatchOutcomeViewModel) => {
  const prioritySet = new Set(viewModel.priorityGapKeys);
  const priorityItems = viewModel.priorityGapKeys
    .map((key) => viewModel.gaps.find((item) => item.key === key))
    .filter((item): item is JobMatchOutcomeGapItem => !!item);
  const fallbackItems = [...viewModel.gaps]
    .filter((item) => !prioritySet.has(item.key))
    .sort((left, right) => right.gapValue - left.gapValue);
  return [...priorityItems, ...fallbackItems].slice(0, 3);
};

export const getAssessmentLabel = (score: number) => {
  if (score >= 85) return '匹配较好';
  if (score >= 70) return '基本匹配';
  return '还需补强';
};

export const buildStrengthGroups = (
  strengthKeys: string[],
  comparisonByKey: Record<string, StrengthSourceItem | undefined>,
): JobMatchOutcomeStrengthGroup[] =>
  STRENGTH_GROUP_CONFIG.map((group) => {
    const tags = Array.from(
      new Set(
        group.dimensionKeys.flatMap((key) =>
          strengthKeys.includes(key) ? (comparisonByKey[key]?.user_values || []).filter(isMeaningfulTag) : [],
        ),
      ),
    );

    return {
      key: group.key,
      title: group.title,
      tags: tags.slice(0, 6),
      overflowCount: Math.max(tags.length - 6, 0),
    };
  }).filter((group) => group.tags.length > 0);

export const JobMatchComparisonPanel: React.FC<JobMatchComparisonPanelProps> = ({ viewModel, onOpenAdvice }) => {
  const { styles, cx } = useStyles();
  const prioritizedGaps = useMemo(() => getPrioritizedGaps(viewModel), [viewModel]);
  const [mainMetric] = viewModel.metrics;

  const radarConfig = useMemo(
    () => ({
      data: viewModel.radarData,
      xField: 'dimension',
      yField: 'value',
      colorField: 'category',
      scale: { y: { domain: [0, 100] } },
      area: { style: { fillOpacity: 0.12 } },
      point: { size: 2 },
      axis: {
        x: {
          labelFormatter: (value: string) => truncateRadarLabel(value),
          labelFontSize: 11,
          labelSpacing: 6,
        },
        y: {
          labelFormatter: (value: string) => `${value}%`,
          labelFontSize: 11,
        },
      },
      legend: {
        position: 'top',
      },
      padding: [12, 10, 22, 10],
    }),
    [viewModel.radarData],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <section className={`${styles.section} ${styles.summarySection}`} data-testid="job-match-summary-strip">
        <div className={styles.metricsShell}>
          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <div>
                <Text className={styles.metricLabel}>{mainMetric?.label || '综合评分'}</Text>
                <div className={styles.metricValueStrong}>{mainMetric?.value || '--'}</div>
              </div>
              <span className={styles.metricIcon}>
                <BarChartOutlined />
              </span>
            </div>
            <div className={styles.metricCard}>
              <div>
                <Text className={styles.metricLabel}>当前判断</Text>
                <div className={styles.assessmentValue}>
                  <Text className={styles.metricValuePrimary} data-testid="job-match-assessment-level">
                    {viewModel.assessmentLabel}
                  </Text>
                  <Tag color={STATUS_COLOR_MAP[viewModel.assessmentLabel] || 'default'}>{viewModel.assessmentLabel}</Tag>
                </div>
              </div>
              <span className={`${styles.metricIcon} ${styles.metricIconSuccess}`}>
                <AimOutlined />
              </span>
            </div>
            <div className={styles.metricCard}>
              <div>
                <Text className={styles.metricLabel}>当前最需补强</Text>
                <div className={styles.assessmentValue}>
                  <Text className={styles.metricValuePrimary}>{viewModel.primaryGapTitle || '暂无'}</Text>
                  {viewModel.primaryGapGapLabel ? <Tag color="warning">{viewModel.primaryGapGapLabel}</Tag> : null}
                </div>
              </div>
              <span className={`${styles.metricIcon} ${styles.metricIconWarm}`}>
                <StarOutlined />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.comparisonBody}>
          <div className={styles.chartPanel}>
            <div className={styles.sectionHead}>
              <Title level={5} className={styles.sectionTitle}>
                能力对比
              </Title>
            </div>
            {viewModel.radarData.length ? (
              <div className={styles.radarWrap}>
                <StableRadarChart config={radarConfig} />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无能力对比数据" />
            )}
          </div>

          <div className={styles.gapPanel}>
            <div className={styles.sectionHead}>
              <Title level={5} className={styles.sectionTitle}>
                当前最需要关注的差距
              </Title>
            </div>
            <div className={styles.gapList}>
              {prioritizedGaps.map((item, index) => {
                const gapVisual = getGapVisual(item.key, index);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={styles.gapButton}
                    data-testid={`gap-item-${item.key}`}
                    onClick={() => onOpenAdvice(item.key)}
                  >
                    <div className={styles.gapMeta}>
                      <span
                        className={cx(
                          styles.gapLeading,
                          gapVisual.className === 'blue' && styles.gapLeadingBlue,
                          gapVisual.className === 'green' && styles.gapLeadingGreen,
                          gapVisual.className === 'purple' && styles.gapLeadingPurple,
                        )}
                      >
                        {gapVisual.icon}
                      </span>
                      <div className={styles.gapContent}>
                        <div className={styles.gapTop}>
                          <Space size={8} wrap>
                            <Text strong>{item.title}</Text>
                            <Tag color={STATUS_COLOR_MAP[item.statusLabel] || 'default'}>{item.statusLabel}</Tag>
                            <Text type="secondary">gap {item.gapValue}</Text>
                          </Space>
                          <Text type="secondary">去看建议</Text>
                        </div>
                        <Text className={styles.gapSummary}>{item.summary}</Text>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {viewModel.strengthGroups.length ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <Title level={5} className={styles.sectionTitle}>
              已具备优势
            </Title>
          </div>
          <div className={styles.strengthsCompact}>
            {viewModel.strengthGroups.flatMap((group) =>
              group.tags.map((tag) => (
                <Tag key={`${group.key}-${tag}`} className={styles.strengthTag}>
                  {tag}
                </Tag>
              )),
            )}
          </div>
        </section>
      ) : null}
    </Space>
  );
};

export const JobMatchAdvicePanel: React.FC<JobMatchAdvicePanelProps> = ({
  viewModel,
  activeGapKey,
  onActiveGapChange,
  titlePrefix = '优先修改',
  listTitle = '优先修改项',
  problemTitle = '当前问题',
  suggestionTitle = '建议补充',
  writableTitle = '可写入内容',
  copyButtonLabel = '复制内容',
  referenceTitle = '更多参考',
  showOverallReview = false,
  overallReviewTitle = '补充说明',
}) => {
  const { styles, cx } = useStyles();
  const [messageApi, contextHolder] = message.useMessage();
  const prioritizedGaps = useMemo(() => getPrioritizedGaps(viewModel), [viewModel]);
  const activeGap = prioritizedGaps.find((item) => item.key === activeGapKey) || prioritizedGaps[0];

  const copyCandidates = [
    ...(activeGap?.examplePhrases || []),
    ...(activeGap?.recommendedKeywords || []),
  ].filter(Boolean).slice(0, 6);

  return (
    <>
      {contextHolder}
      <div className={styles.adviceLayout}>
        <section className={styles.section}>
          <Title level={5} className={styles.adviceListTitle}>
            {listTitle}
          </Title>
          <div className={styles.adviceList}>
            {prioritizedGaps.map((item, index) => {
              const active = item.key === activeGap?.key;
              const gapVisual = getGapVisual(item.key, index);
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cx(styles.adviceItem, active && styles.adviceItemActive)}
                  data-testid={`job-match-action-card-${item.key}`}
                  onClick={() => onActiveGapChange?.(item.key)}
                >
                  <span
                    className={cx(
                      styles.gapLeading,
                      gapVisual.className === 'blue' && styles.gapLeadingBlue,
                      gapVisual.className === 'green' && styles.gapLeadingGreen,
                      gapVisual.className === 'purple' && styles.gapLeadingPurple,
                    )}
                  >
                    {gapVisual.icon}
                  </span>
                  <span className={styles.adviceItemMain}>
                    <span className={styles.adviceItemTop}>
                      <Text strong>{item.title}</Text>
                      <Tag color={STATUS_COLOR_MAP[item.statusLabel] || 'default'}>{item.statusLabel}</Tag>
                      <Text type="secondary">gap {item.gapValue}</Text>
                    </span>
                    <Text className={styles.adviceItemSummary}>{item.summary}</Text>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className={`${styles.section} ${styles.adviceDetailPanel}`}
          data-testid="job-match-action-card"
          data-active-gap={activeGap?.key || ''}
        >
          {activeGap ? (
            <div className={styles.adviceDetail}>
              <div className={styles.adviceHero}>
                <span className={styles.adviceHeroIcon}>
                  {getGapVisual(activeGap.key, prioritizedGaps.findIndex((item) => item.key === activeGap.key)).icon}
                </span>
                <div className={styles.adviceHeroBody}>
                  <Title level={4} className={styles.sectionTitle}>
                    {titlePrefix}：{activeGap.title}
                  </Title>
                  <div className={styles.adviceHeroMeta}>
                    <Tag color={STATUS_COLOR_MAP[activeGap.statusLabel] || 'default'}>{activeGap.statusLabel}</Tag>
                    <Text type="secondary">gap {activeGap.gapValue}</Text>
                    <Text type="secondary">准备度 {activeGap.readiness}%</Text>
                  </div>
                </div>
              </div>

              <div className={styles.adviceBlock}>
                <Text className={styles.adviceBlockTitle}>{problemTitle}</Text>
                <Text>{activeGap.currentIssue || activeGap.summary}</Text>
              </div>

              <div className={styles.adviceBlock}>
                <Text className={styles.adviceBlockTitle}>{suggestionTitle}</Text>
                <div className={styles.simpleList}>
                  {(activeGap.nextActions || []).slice(0, 3).map((item) => (
                    <Text key={item} className={styles.simpleListItem}>
                      {item}
                    </Text>
                  ))}
                </div>
              </div>

              <div className={styles.adviceBlock}>
                <div className={styles.sectionHead}>
                  <Text className={styles.adviceBlockTitle}>{writableTitle}</Text>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    className={styles.copyButton}
                    onClick={async () => {
                      if (!copyCandidates.length) return;
                      await copyText(copyCandidates.join('\n'));
                      messageApi.success('内容已复制');
                    }}
                    disabled={!copyCandidates.length}
                  >
                    {copyButtonLabel}
                  </Button>
                </div>
                <div className={styles.tagList}>
                  {copyCandidates.map((item) => (
                    <Tag key={item} color="processing" style={{ marginInlineEnd: 0 }}>
                      {item}
                    </Tag>
                  ))}
                </div>
              </div>

              <Collapse
                ghost
                className={styles.moreCollapse}
                items={[
                  {
                    key: 'more',
                    label: <Text data-testid="advice-supplementary-toggle">{referenceTitle}</Text>,
                    children: (
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        {(activeGap.evidenceSources || []).length ? (
                          <div className={styles.adviceSection}>
                            <Text strong>可补素材</Text>
                            <div className={styles.tagList}>
                              {activeGap.evidenceSources.slice(0, 6).map((item) => (
                                <Tag key={item}>{item}</Tag>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {(activeGap.recommendedKeywords || []).length ? (
                          <div className={styles.adviceSection}>
                            <Text strong>对齐关键词</Text>
                            <div className={styles.tagList}>
                              {activeGap.recommendedKeywords.slice(0, 6).map((item) => (
                                <Tag key={item} color="gold">
                                  {item}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {showOverallReview && viewModel.overallReview ? (
                          <div className={styles.adviceSection} data-testid="advice-overall-review">
                            <Text strong>{overallReviewTitle}</Text>
                            <Text>{viewModel.overallReview}</Text>
                          </div>
                        ) : (
                          <div style={{ display: 'none' }} data-testid="advice-overall-review">
                            {viewModel.overallReview || ''}
                          </div>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无修改建议" />
          )}
        </section>
      </div>
    </>
  );
};

const JobMatchOutcomeBody: React.FC<CombinedBodyProps> = ({ viewModel }) => (
  <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <JobMatchComparisonPanel viewModel={viewModel} onOpenAdvice={() => undefined} />
    <JobMatchAdvicePanel viewModel={viewModel} />
  </Space>
);

export default JobMatchOutcomeBody;
