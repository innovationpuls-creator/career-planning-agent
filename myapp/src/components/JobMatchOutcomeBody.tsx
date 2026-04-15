import { Radar } from '@ant-design/charts';
import { CopyOutlined } from '@ant-design/icons';
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
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
  `,
  sectionHead: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  `,
  sectionTitle: css`
    margin: 0;
  `,
  metricsShell: css`
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  `,
  metricGrid: css`
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(120px, 1.05fr) minmax(140px, 1.2fr) minmax(150px, 1.3fr) repeat(2, minmax(108px, 1fr));
    gap: 8px;

    @media (max-width: 1440px) {
      grid-template-columns: repeat(3, minmax(130px, 1fr));
    }

    @media (max-width: 960px) {
      grid-template-columns: repeat(2, minmax(120px, 1fr));
    }
  `,
  metricCard: css`
    padding: 10px 12px;
    border-radius: 10px;
    background: ${token.colorFillQuaternary};
    transition: all 0.2s ease;
    cursor: default;

    :hover {
      background: ${token.colorFillSecondary};
      transform: scale(1.02);
    }
  `,
  metricLabel: css`
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: ${token.colorTextSecondary};
  `,
  metricValueStrong: css`
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
    color: #0958d9;
  `,
  metricValue: css`
    font-size: 16px;
    line-height: 1.3;
  `,
  metricValuePrimary: css`
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
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
    display: grid;
    grid-template-columns: minmax(320px, 0.95fr) minmax(360px, 1.05fr);
    gap: 16px;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  `,
  chartPanel: css`
    min-width: 0;
  `,
  radarWrap: css`
    height: 360px;
    width: 100%;
  `,
  gapList: css`
    display: grid;
    gap: 8px;
  `,
  gapButton: css`
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
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
      box-shadow: none;
    }
  `,
  gapButtonActive: css`
    border-color: ${token.colorPrimary};
    background: #f5f9ff;
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
    flex-wrap: wrap;
    margin-top: 6px;
  `,
  gapSummary: css`
    flex: 1;
    min-width: 0;
    color: ${token.colorTextSecondary};
  `,
  strengthsCompact: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  strengthTag: css`
    transition: all 0.2s ease;

    :hover {
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(82, 196, 26, 0.3);
    }
  `,
  adviceLayout: css`
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 16px;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  `,
  adviceListTitle: css`
    margin: 0 0 10px;
    font-size: 14px;
  `,
  adviceList: css`
    display: grid;
    gap: 8px;
  `,
  adviceItem: css`
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
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
  adviceDetail: css`
    display: grid;
    gap: 16px;
  `,
  adviceSection: css`
    display: grid;
    gap: 8px;
  `,
  simpleList: css`
    display: grid;
    gap: 6px;
  `,
  tagList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  moreCollapse: css`
    :global(.ant-collapse-header) {
      padding-inline: 0 !important;
      padding-block: 8px !important;
    }

    :global(.ant-collapse-content-box) {
      padding-inline: 0 !important;
      padding-bottom: 0 !important;
      padding-top: 6px !important;
    }
  `,
  copyButton: css`
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

const truncateRadarLabel = (value: string) => {
  const normalized = value.trim();
  if (normalized.length <= 8) return normalized;
  return `${normalized.slice(0, 8)}...`;
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
  const { styles } = useStyles();
  const prioritizedGaps = useMemo(() => getPrioritizedGaps(viewModel), [viewModel]);
  const [mainMetric, ...restMetrics] = viewModel.metrics;

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
        },
        y: {
          labelFormatter: (value: string) => `${value}%`,
        },
      },
      legend: {
        position: 'top',
      },
      padding: [16, 16, 32, 16],
    }),
    [viewModel.radarData],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <section className={styles.section} data-testid="job-match-summary-strip">
        <div className={styles.metricsShell}>
          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <Text className={styles.metricLabel}>{mainMetric?.label || '综合评分'}</Text>
              <div className={styles.metricValueStrong}>{mainMetric?.value || '--'}</div>
            </div>
            <div className={styles.metricCard}>
              <Text className={styles.metricLabel}>当前判断</Text>
              <div className={styles.assessmentValue}>
                <Text className={styles.metricValuePrimary} data-testid="job-match-assessment-level">
                  {viewModel.assessmentLabel}
                </Text>
                <Tag color={STATUS_COLOR_MAP[viewModel.assessmentLabel] || 'default'}>{viewModel.assessmentLabel}</Tag>
              </div>
            </div>
            <div className={styles.metricCard}>
              <Text className={styles.metricLabel}>当前最需补强</Text>
              <div className={styles.assessmentValue}>
                <Text className={styles.metricValuePrimary}>{viewModel.primaryGapTitle || '暂无'}</Text>
                {viewModel.primaryGapGapLabel ? <Tag color="warning">{viewModel.primaryGapGapLabel}</Tag> : null}
              </div>
            </div>
            {restMetrics.map((metric) => (
              <div key={metric.key} className={styles.metricCard}>
                <Text className={styles.metricLabel}>{metric.label}</Text>
                <div className={styles.metricValue}>{metric.value}</div>
              </div>
            ))}
          </div>

          <Button type="primary" className={styles.primaryAction} onClick={() => onOpenAdvice(viewModel.primaryGapKey)}>
            去看补强建议
          </Button>
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

          <div>
            <div className={styles.sectionHead}>
              <Title level={5} className={styles.sectionTitle}>
                当前最需要关注的差距
              </Title>
            </div>
            <div className={styles.gapList}>
              {prioritizedGaps.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={styles.gapButton}
                  data-testid={`gap-item-${item.key}`}
                  onClick={() => onOpenAdvice(item.key)}
                >
                  <div className={styles.gapTop}>
                    <Space size={8} wrap>
                      <Text strong>{item.title}</Text>
                      <Tag color={STATUS_COLOR_MAP[item.statusLabel] || 'default'}>{item.statusLabel}</Tag>
                      <Text type="secondary">gap {item.gapValue}</Text>
                    </Space>
                    <Text type="secondary">去看建议</Text>
                  </div>
                  <div className={styles.gapMeta}>
                    <Text className={styles.gapSummary}>{item.summary}</Text>
                  </div>
                </button>
              ))}
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
                <Tag key={`${group.key}-${tag}`} color="success" className={styles.strengthTag} style={{ marginInlineEnd: 0 }}>
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
  writableTitle = '可直接写入简历',
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
            {prioritizedGaps.map((item) => {
              const active = item.key === activeGap?.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cx(styles.adviceItem, active && styles.gapButtonActive)}
                  data-testid={`job-match-action-card-${item.key}`}
                  onClick={() => onActiveGapChange?.(item.key)}
                >
                  <Space size={6} wrap>
                    <Text strong>{item.title}</Text>
                    <Tag color={STATUS_COLOR_MAP[item.statusLabel] || 'default'}>{item.statusLabel}</Tag>
                    <Text type="secondary">gap {item.gapValue}</Text>
                  </Space>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.section} data-testid="job-match-action-card" data-active-gap={activeGap?.key || ''}>
          {activeGap ? (
            <div className={styles.adviceDetail}>
              <div className={styles.sectionHead}>
                <Title level={4} className={styles.sectionTitle}>
                  {titlePrefix}：{activeGap.title}
                </Title>
              </div>

              <div className={styles.adviceSection}>
                <Text strong>{problemTitle}</Text>
                <Text>{activeGap.currentIssue || activeGap.summary}</Text>
              </div>

              <div className={styles.adviceSection}>
                <Text strong>{suggestionTitle}</Text>
                <div className={styles.simpleList}>
                  {(activeGap.nextActions || []).slice(0, 3).map((item) => (
                    <Text key={item}>• {item}</Text>
                  ))}
                </div>
              </div>

              <div className={styles.adviceSection}>
                <div className={styles.sectionHead}>
                  <Text strong>{writableTitle}</Text>
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
