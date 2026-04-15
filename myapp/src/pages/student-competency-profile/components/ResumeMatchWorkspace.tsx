import { StarFilled, StarOutlined } from '@ant-design/icons';
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

const useStyles = createStyles(({ css }) => ({
  shell: css`
    display: flex;
    gap: 16px;
    width: 100%;
    min-width: 0;
    align-items: flex-start;

    @media (max-width: 1200px) {
      flex-direction: column;
    }
  `,
  sidebar: css`
    flex: 0 0 320px;
    min-width: 0;
    display: grid;
    gap: 16px;
  `,
  main: css`
    flex: 1;
    min-width: 0;
  `,
  compactCard: css`
    :global(.ant-card-body) {
      padding: 14px 16px;
    }
  `,
  compactList: css`
    :global(.ant-list-item) {
      padding-block: 10px;
      cursor: pointer;
    }
  `,
  recommendationMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  resultCard: css`
    :global(.ant-card-body) {
      padding: 12px 16px 16px;
    }
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
          <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
            当前分析对象
          </Title>
          <Text>{sourceLabel || '当前 12 维画像'}</Text>
        </Card>

        <Card className={styles.compactCard}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
            匹配来源
          </Title>
          <Text type="secondary" style={{ display: 'block' }}>
            更新时间：{sourceUpdatedAt ? new Date(sourceUpdatedAt).toLocaleString('zh-CN') : '--'}
          </Text>
          <Text type="secondary" style={{ display: 'block' }}>
            已识别维度：{activeDimensionCount ?? '--'}
          </Text>
        </Card>

        <Card className={`${styles.compactCard} ${styles.compactList}`}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
            推荐目标
          </Title>
          <List
            dataSource={recommendations}
            renderItem={(item) => (
              <List.Item
                onClick={() => onRecommendationChange?.(item.report_id)}
                style={{
                  background: item.report_id === activeReport.report_id ? '#f5f9ff' : undefined,
                  borderRadius: 8,
                  paddingInline: 8,
                }}
              >
                <List.Item.Meta
                  title={item.target_title}
                  description={
                    <div className={styles.recommendationMeta}>
                      <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                        {item.target_scope === 'industry' ? '行业岗位' : '职业方向'}
                      </Tag>
                      <Text type="secondary">{Math.round(item.overall_match)}%</Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      <div className={styles.main}>
        <Card
          className={styles.resultCard}
          extra={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                aria-label={favoriteLabel}
                icon={favorite ? <StarFilled /> : <StarOutlined />}
                loading={favoriteSubmitting}
                onClick={onToggleFavorite}
              >
                {favoriteLabel}
              </Button>
              <Button type="primary" onClick={onGeneratePlan}>
                生成计划
              </Button>
            </div>
          }
        >
          <Tabs
            activeKey={activeResultTab}
            onChange={(key) => onResultTabChange?.(key as CareerMatchResultTabKey)}
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
                label: '匹配公司',
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
