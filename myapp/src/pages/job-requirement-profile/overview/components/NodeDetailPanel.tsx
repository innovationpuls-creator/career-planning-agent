import { ApartmentOutlined, FileTextOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Empty, Progress, Skeleton, Space, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import { ClaudeCard, ClaudeTag } from '@/components/ui';
import { getVerticalJobProfileCompanyDetail } from '@/services/ant-design-pro/api';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  panel: css`
    position: absolute;
    top: 24px;
    right: 24px;
    z-index: 4;
    width: min(380px, calc(100% - 48px));
    max-height: calc(100% - 48px);
    overflow: auto;
    animation: panelIn 0.32s ease;

    @keyframes panelIn {
      from {
        opacity: 0;
        transform: translateX(18px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `,
  card: css`
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)};
  `,
  title: css`
    margin: 0;
    font-family: ${claudeFonts.heading};
    color: ${claudeColors.nearBlack};
  `,
  description: css`
    margin: 10px 0 0;
    color: ${claudeColors.oliveGray};
    line-height: 1.8;
  `,
  section: css`
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid ${claudeColors.borderCream};
  `,
  sectionTitle: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: ${claudeColors.nearBlack};
    font-weight: 600;
  `,
  stats: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  `,
  statBox: css`
    padding: 12px;
    border-radius: ${claudeRadius.sm}px;
    background: ${claudeColors.parchment};
  `,
  statLabel: css`
    margin: 0 0 6px;
    color: ${claudeColors.stoneGray};
    font-size: 12px;
  `,
  statValue: css`
    color: ${claudeColors.nearBlack};
    font-family: ${claudeFonts.heading};
    font-size: 22px;
    line-height: 1.1;
  `,
  coverage: css`
    color: ${claudeColors.terracotta};
    font-family: ${claudeFonts.heading};
    font-size: 42px;
    line-height: 1;
  `,
  detailItem: css`
    padding: 12px;
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.sm}px;
    background: ${claudeColors.ivory};
  `,
  detailText: css`
    margin: 8px 0 0;
    color: ${claudeColors.oliveGray};
    font-size: 12px;
    line-height: 1.7;
    white-space: pre-wrap;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,
}));

export interface NodeDetailPanelProps {
  node?: API.JobRequirementGraphNode;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ node }) => {
  const { styles } = useStyles();
  const [detail, setDetail] =
    useState<API.VerticalJobProfileCompanyDetailPayload>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setDetail(undefined);
    const query = node?.company_detail_query;
    if (!query) return undefined;

    setLoading(true);
    void getVerticalJobProfileCompanyDetail(query, { skipErrorHandler: true })
      .then((response) => {
        if (mounted) setDetail(response.data);
      })
      .catch(() => {
        if (mounted) setDetail(undefined);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [node?.company_detail_query]);

  const coverage = Math.round((node?.coverage_ratio || 0) * 1000) / 10;

  return (
    <aside className={styles.panel} data-testid="node-detail-panel">
      <ClaudeCard elevation="elevated" className={styles.card}>
        {node ? (
          <>
            <Typography.Title level={3} className={styles.title}>
              {node.title}
            </Typography.Title>
            <p className={styles.description}>{node.description}</p>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <InfoCircleOutlined />
                招聘关键词
              </div>
              <Space wrap size={[8, 8]}>
                {(node.keywords.length ? node.keywords : ['暂无明确招聘关键词']).map(
                  (keyword) => (
                    <ClaudeTag key={keyword}>{keyword}</ClaudeTag>
                  ),
                )}
              </Space>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <ApartmentOutlined />
                聚合统计
              </div>
              <div className={styles.stats}>
                <div className={styles.statBox}>
                  <p className={styles.statLabel}>画像数量</p>
                  <div className={styles.statValue}>{node.profile_count}</div>
                </div>
                <div className={styles.statBox}>
                  <p className={styles.statLabel}>非默认数量</p>
                  <div className={styles.statValue}>{node.non_default_count}</div>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>覆盖度百分比</div>
              <div className={styles.coverage}>{coverage.toFixed(1)}%</div>
              <Progress
                percent={coverage}
                showInfo={false}
                strokeColor={claudeColors.terracotta}
                trailColor={claudeColors.borderCream}
              />
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <FileTextOutlined />
                代表招聘样本
              </div>
              {loading ? (
                <Skeleton active paragraph={{ rows: 3 }} />
              ) : detail?.postings.length ? (
                detail.postings.slice(0, 2).map((posting) => (
                  <div key={posting.id} className={styles.detailItem}>
                    <Typography.Text strong>
                      {detail.summary.company_name} · {posting.salary_range || '薪资未披露'}
                    </Typography.Text>
                    {posting.job_detail ? (
                      <p className={styles.detailText}>{posting.job_detail}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无代表样本"
                />
              )}
            </div>
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择节点" />
        )}
      </ClaudeCard>
    </aside>
  );
};
