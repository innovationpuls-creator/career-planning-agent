import { CalendarOutlined, DatabaseOutlined, FileTextOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, Card, Empty, List, Spin, Tabs, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import { JobMatchAdvicePanel, JobMatchComparisonPanel } from '@/components/JobMatchOutcomeBody';
import {
  buildCareerDevelopmentMatchViewModel,
  type CareerMatchResultTabKey,
} from '@/components/jobMatchReportAdapter';
import CompanyMatchPanel from './CompanyMatchPanel';

const { Text, Title } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    display: flex;
    gap: 20px;
    width: 100%;
    min-width: 0;
    align-items: flex-start;

    @media (max-width: 1200px) {
      flex-direction: column;
    }
  `,
  sidebar: css`
    flex: 0 0 312px;
    min-width: 0;
    display: grid;
    gap: 14px;
  `,
  main: css`
    flex: 1;
    min-width: 0;
  `,
  compactCard: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    box-shadow: 0 6px 18px rgba(15, 35, 70, 0.035);

    :global(.ant-card-body) {
      padding: 18px 20px;
    }
  `,
  cardTitle: css`
    margin: 0 0 14px !important;
    color: ${token.colorText};
    font-size: 17px !important;
    font-weight: 600 !important;
  `,
  infoRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    color: ${token.colorTextSecondary};
  `,
  infoIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  sourceIcon: css`
    background: rgba(126, 104, 200, 0.12);
    color: #7e68c8;
  `,
  compactList: css`
    :global(.ant-list-item) {
      margin-bottom: 10px;
      padding: 14px 12px !important;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: 10px;
      cursor: pointer;
      transition: border-color 0.2s ease, background-color 0.2s ease;
    }

    :global(.ant-list-item:last-child) {
      margin-bottom: 0;
    }

    :global(.ant-list-item-meta-title) {
      margin-bottom: 8px;
      color: ${token.colorText};
      font-weight: 600;
    }
  `,
  recommendationActive: css`
    border-color: ${token.colorPrimaryBorder} !important;
    background: ${token.colorPrimaryBg} !important;
  `,
  recommendationMeta: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  `,
  scoreText: css`
    margin-left: auto;
    color: ${token.colorPrimary};
    font-size: 22px;
    font-weight: 700;
  `,
  resultCard: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    box-shadow: 0 8px 22px rgba(15, 35, 70, 0.045);

    :global(.ant-card-body) {
      padding: 16px 24px 22px;
    }

    :global(.ant-tabs-nav) {
      min-height: 44px;
      margin-bottom: 0;
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }

    :global(.ant-tabs-tab) {
      padding: 0 0 12px;
      font-size: 15px;
      font-weight: 500;
    }

    :global(.ant-tabs-extra-content) {
      padding-bottom: 10px;
    }
  `,
  resultActions: css`
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  `,
  actionButton: css`
    height: 38px;
    border-radius: 8px;
    border-color: ${token.colorBorder};
    font-weight: 500;
  `,
  primaryButton: css`
    height: 38px;
    border-radius: 8px;
    font-weight: 500;
  `,
}));

type Props = {
  sourceLabel?: string;
  sourceUpdatedAt?: string;
  activeDimensionCount?: number;
  recommendations: API.CareerDevelopmentMatchReport[];
  loading?: boolean;
  error?: string;
  available?: boolean;
  activeRecommendationId?: string;
  activeResultTab?: CareerMatchResultTabKey;
  activeGapKey?: string;
  favorite?: API.CareerDevelopmentFavoritePayload;
  favoriteSubmitting?: boolean;
  onRecommendationChange?: (reportId: string) => void;
  onResultTabChange?: (tab: CareerMatchResultTabKey) => void;
  onActiveGapChange?: (key: string) => void;
  onToggleFavorite?: () => void;
  onGeneratePlan?: () => void;
};

const ResumeMatchWorkspace: React.FC<Props> = ({
  sourceLabel,
  sourceUpdatedAt,
  activeDimensionCount,
  recommendations,
  loading,
  error,
  available,
  activeRecommendationId,
  activeResultTab = 'comparison',
  activeGapKey,
  favorite,
  favoriteSubmitting,
  onRecommendationChange,
  onResultTabChange,
  onActiveGapChange,
  onToggleFavorite,
  onGeneratePlan,
}) => {
  const { styles } = useStyles();
  const favoriteLabel = favorite ? '取消收藏' : '收藏结果';

  const activeReport = useMemo(
    () => recommendations.find((item) => item.report_id === activeRecommendationId) || recommendations[0],
    [recommendations, activeRecommendationId],
  );

  const viewModel = useMemo(
    () => (activeReport ? buildCareerDevelopmentMatchViewModel(activeReport) : undefined),
    [activeReport],
  );

  if (loading) {
    return <Spin style={{ width: '100%', padding: '64px 0' }} />;
  }

  if (error) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="danger">{error}</Text>} />;
  }

  if (!available) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">当前暂无职业匹配结果</Text>} />;
  }

  if (!recommendations.length || !viewModel) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">暂无自动推荐岗位</Text>} />;
  }

  return (
    <div className={styles.shell}>
      <div className={styles.sidebar}>
        <Card className={styles.compactCard}>
          <Title level={5} className={styles.cardTitle}>
            当前分析对象
          </Title>
          <div className={styles.infoRow}>
            <span className={styles.infoIcon}>
              <FileTextOutlined />
            </span>
            <Text>{sourceLabel || '当前 12 维画像'}</Text>
          </div>
        </Card>

        <Card className={styles.compactCard}>
          <Title level={5} className={styles.cardTitle}>
            匹配来源
          </Title>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className={styles.infoRow}>
              <span className={`${styles.infoIcon} ${styles.sourceIcon}`}>
                <CalendarOutlined />
              </span>
              <Text type="secondary">更新时间：{sourceUpdatedAt ? new Date(sourceUpdatedAt).toLocaleString('zh-CN') : '--'}</Text>
            </div>
            <div className={styles.infoRow}>
              <span className={`${styles.infoIcon} ${styles.sourceIcon}`}>
                <DatabaseOutlined />
              </span>
              <Text type="secondary">已识别维度：{activeDimensionCount ?? '--'}</Text>
            </div>
          </div>
        </Card>

        <Card className={`${styles.compactCard} ${styles.compactList}`}>
          <Title level={5} className={styles.cardTitle}>
            推荐目标
          </Title>
          <List
            dataSource={recommendations}
            renderItem={(item) => (
              <List.Item
                onClick={() => onRecommendationChange?.(item.report_id)}
                className={item.report_id === activeReport.report_id ? styles.recommendationActive : undefined}
              >
                <List.Item.Meta
                  title={item.target_title}
                  description={
                    <div className={styles.recommendationMeta}>
                      <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                        {item.target_scope === 'industry' ? '行业岗位' : '职业方向'}
                      </Tag>
                      <span className={styles.scoreText}>{Math.round(item.overall_match)}%</span>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      <div className={styles.main}>
        <Card className={styles.resultCard}>
          <Tabs
            activeKey={activeResultTab}
            onChange={(key) => onResultTabChange?.(key as CareerMatchResultTabKey)}
            tabBarExtraContent={
              <div className={styles.resultActions}>
                <Button
                  aria-label={favoriteLabel}
                  icon={favorite ? <StarFilled /> : <StarOutlined />}
                  loading={favoriteSubmitting}
                  onClick={onToggleFavorite}
                  className={styles.actionButton}
                >
                  {favoriteLabel}
                </Button>
                <Button type="primary" onClick={onGeneratePlan} className={styles.primaryButton}>
                  生成计划
                </Button>
              </div>
            }
            items={[
              {
                key: 'comparison',
                label: '推荐职业',
                children: (
                  <JobMatchComparisonPanel
                    viewModel={viewModel}
                    onOpenAdvice={(key) => {
                      if (key) onActiveGapChange?.(key);
                      onResultTabChange?.('advice');
                    }}
                  />
                ),
              },
              {
                key: 'advice',
                label: '和目标的差距',
                children: (
                  <JobMatchAdvicePanel
                    viewModel={viewModel}
                    activeGapKey={activeGapKey}
                    onActiveGapChange={onActiveGapChange}
                  />
                ),
              },
              {
                key: 'company',
                label: '最匹配的工作',
                children: <CompanyMatchPanel items={activeReport.evidence_cards || []} />,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

export default ResumeMatchWorkspace;
