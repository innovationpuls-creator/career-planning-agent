import { FileTextOutlined } from '@ant-design/icons';
import { Descriptions, Drawer, Empty, Skeleton, Tabs, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo, useState } from 'react';
import { ClaudeCard, ClaudeTag, FadeInWhenVisible } from '@/components/ui';
import { getVerticalJobProfileCompanyDetail } from '@/services/ant-design-pro/api';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

const LEVEL_ORDER = ['低级', '中级', '高级'];
const LEVEL_LABELS: Record<string, string> = {
  低级: '初级',
  中级: '中级',
  高级: '高级',
};
const INDUSTRY_COLORS = [
  claudeColors.terracotta,
  claudeColors.warmSand,
  claudeColors.success,
];

const useStyles = createStyles(({ css }) => ({
  card: css`
    :global(.ant-tabs-nav) {
      margin-bottom: 18px;
    }

    :global(.ant-tabs-ink-bar) {
      height: 3px;
      background: ${claudeColors.terracotta};
    }

    :global(.ant-tabs-tab-active .ant-tabs-tab-btn) {
      color: ${claudeColors.terracotta} !important;
    }
  `,
  tierGrid: css`
    display: grid;
    gap: 18px;
  `,
  companyGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 1100px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 720px) {
      grid-template-columns: 1fr;
    }
  `,
  companyButton: css`
    display: grid;
    gap: 8px;
    width: 100%;
    min-height: 116px;
    padding: 14px;
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.md}px;
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: ${claudeColors.terracotta};
      box-shadow: 0 10px 26px ${claudeAlpha(claudeColors.terracotta, 0.14)};
      transform: translateY(-2px);
    }
  `,
  companyName: css`
    color: ${claudeColors.nearBlack};
    font-family: ${claudeFonts.heading};
    font-size: 17px;
  `,
  muted: css`
    color: ${claudeColors.oliveGray};
    font-size: 13px;
  `,
  dimensionCard: css`
    display: grid;
    gap: 12px;
  `,
  dimensionRow: css`
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 12px;
    align-items: start;

    @media (max-width: 720px) {
      grid-template-columns: 1fr;
    }
  `,
  dimensionTitle: css`
    color: ${claudeColors.nearBlack};
    font-weight: 600;
  `,
  bars: css`
    display: grid;
    gap: 8px;
  `,
  barRow: css`
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) 46px;
    gap: 8px;
    align-items: center;
    color: ${claudeColors.oliveGray};
    font-size: 12px;
  `,
  barTrack: css`
    height: 9px;
    border-radius: 999px;
    background: ${claudeColors.borderCream};
    overflow: hidden;
  `,
  barFill: css`
    height: 100%;
    min-width: 4px;
    border-radius: inherit;
  `,
  drawerBody: css`
    display: grid;
    gap: 16px;
  `,
  detailText: css`
    margin: 0;
    white-space: pre-wrap;
    color: ${claudeColors.oliveGray};
    line-height: 1.8;
  `,
}));

const orderTiers = (tiers: API.SalaryTierGroup[] = []) =>
  [...tiers].sort(
    (left, right) =>
      LEVEL_ORDER.indexOf(left.level) - LEVEL_ORDER.indexOf(right.level),
  );

const getDimensionRows = (
  tier?: API.VerticalTierDimensionComparison,
): API.VerticalDimensionComparisonItem[] => tier?.industries[0]?.dimensions || [];

export const TierComparison: React.FC<{
  data?: API.VerticalJobProfilePayload;
  loading?: boolean;
}> = ({ data, loading }) => {
  const { styles } = useStyles();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] =
    useState<API.VerticalJobProfileCompanyDetailPayload>();
  const tiers = useMemo(() => orderTiers(data?.tiered_comparison?.tiers), [data]);

  const openCompany = async (item: API.SalaryTierItem) => {
    if (!data?.job_title) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(undefined);
    try {
      const response = await getVerticalJobProfileCompanyDetail(
        {
          job_title: data.job_title,
          industry: item.industry,
          company_name: item.company_name,
        },
        { skipErrorHandler: true },
      );
      setDetail(response.data);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <ClaudeCard elevation="glass">
        <Skeleton active paragraph={{ rows: 8 }} />
      </ClaudeCard>
    );
  }

  if (!data?.tiered_comparison) {
    return (
      <ClaudeCard elevation="glass">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择条件后查询" />
      </ClaudeCard>
    );
  }

  return (
    <ClaudeCard elevation="glass" className={styles.card}>
      <Tabs
        items={tiers.map((tier) => {
          const dimensionTier = data.dimension_comparison?.find(
            (item) => item.level === tier.level,
          );
          const dimensionRows = getDimensionRows(dimensionTier);

          return {
            key: tier.level,
            label: LEVEL_LABELS[tier.level] || tier.level,
            children: (
              <div className={styles.tierGrid} data-testid="vertical-tier-comparison">
                {tier.items.length ? (
                  <div className={styles.companyGrid}>
                    {tier.items.map((item, companyIndex) => (
                      <FadeInWhenVisible
                        key={`${item.industry}-${item.company_name}`}
                        stagger
                        staggerIndex={companyIndex}
                        staggerInterval={0.06}
                      >
                        <button
                          type="button"
                          className={styles.companyButton}
                          onClick={() => void openCompany(item)}
                        >
                          <span className={styles.companyName}>
                            {item.company_name}
                          </span>
                          <span className={styles.muted}>{item.industry}</span>
                          <ClaudeTag>
                            {item.salary_sort_label || item.salary_range || '薪资未披露'}
                          </ClaudeTag>
                        </button>
                      </FadeInWhenVisible>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无公司数据" />
                )}

                <ClaudeCard elevation="flat" className={styles.dimensionCard}>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    12 维度行业覆盖度
                  </Typography.Title>
                  {dimensionRows.length ? (
                    dimensionRows.map((dimension, index) => (
                      <FadeInWhenVisible
                        key={dimension.key}
                        stagger
                        staggerIndex={index}
                        staggerInterval={0.04}
                      >
                        <div className={styles.dimensionRow}>
                          <div className={styles.dimensionTitle}>
                            {dimension.title}
                          </div>
                          <div className={styles.bars}>
                            {dimensionTier?.industries.map(
                              (industry, industryIndex) => {
                                const item = industry.dimensions.find(
                                  (dim) => dim.key === dimension.key,
                                );
                                const percent = Math.round(
                                  (item?.coverage_ratio || 0) * 100,
                                );
                                return (
                                  <div
                                    className={styles.barRow}
                                    key={`${industry.industry}-${dimension.key}`}
                                  >
                                    <span>{industry.industry}</span>
                                    <span className={styles.barTrack}>
                                      <span
                                        className={styles.barFill}
                                        style={{
                                          width: `${percent}%`,
                                          background:
                                            INDUSTRY_COLORS[
                                              industryIndex % INDUSTRY_COLORS.length
                                            ],
                                        }}
                                      />
                                    </span>
                                    <span>{percent}%</span>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      </FadeInWhenVisible>
                    ))
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无维度统计" />
                  )}
                </ClaudeCard>
              </div>
            ),
          };
        })}
      />

      <Drawer
        width={860}
        title={
          detail
            ? `${detail.summary.company_name} · ${detail.summary.job_title}`
            : '公司详情'
        }
        open={detailOpen}
        destroyOnClose
        onClose={() => {
          setDetailOpen(false);
          setDetail(undefined);
        }}
      >
        {detailLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : detail ? (
          <div className={styles.drawerBody}>
            <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
              <Descriptions.Item label="行业">
                {detail.summary.industry}
              </Descriptions.Item>
              <Descriptions.Item label="招聘帖子">
                {detail.summary.posting_count}
              </Descriptions.Item>
              <Descriptions.Item label="薪资范围" span={2}>
                {detail.summary.salary_ranges.join('、') || '未披露'}
              </Descriptions.Item>
            </Descriptions>
            {detail.postings.slice(0, 6).map((posting) => (
              <ClaudeCard elevation="flat" key={posting.id}>
                <Typography.Title level={5}>
                  <FileTextOutlined /> 招聘详情
                </Typography.Title>
                <p className={styles.detailText}>
                  {posting.job_detail || posting.company_detail || '暂无原文详情'}
                </p>
              </ClaudeCard>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无详情数据" />
        )}
      </Drawer>
    </ClaudeCard>
  );
};
