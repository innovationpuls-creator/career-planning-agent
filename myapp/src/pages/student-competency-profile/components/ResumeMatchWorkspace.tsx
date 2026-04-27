import {
  CalendarOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, List, Spin, Tabs, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import {
  JobMatchAdvicePanel,
  JobMatchComparisonPanel,
} from '@/components/JobMatchOutcomeBody';
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
    font-family: var(--font-heading);
    letter-spacing: 0.04em;
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
      padding: 0 !important;
      border: 0;
    }

    :global(.ant-list-item:last-child) {
      margin-bottom: 0;
    }
  `,
  recommendationButton: css`
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 86px;
    padding: 16px 16px 16px 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 14px;
    background: ${token.colorBgContainer};
    color: inherit;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    transition:
      background-color 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 180ms ease;

    &::before {
      content: '';
      position: absolute;
      inset-block: 12px;
      inset-inline-start: 0;
      width: 3px;
      border-radius: 0 999px 999px 0;
      background: transparent;
      transition:
        background-color 180ms ease,
        opacity 180ms ease;
    }

    &:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, ${token.colorPrimaryBorder} 72%, ${token.colorBorderSecondary} 28%);
      background: color-mix(in srgb, ${token.colorPrimaryBg} 34%, ${token.colorBgContainer} 66%);
      box-shadow: 0 12px 26px color-mix(in srgb, ${token.colorPrimary} 10%, transparent);
    }

    &:hover::before,
    &:focus-visible::before {
      background: ${token.colorPrimary};
    }

    &:focus-visible {
      outline: 3px solid color-mix(in srgb, ${token.colorPrimaryBorder} 60%, transparent);
      outline-offset: 2px;
      border-color: ${token.colorPrimaryBorder};
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 6px 16px color-mix(in srgb, ${token.colorPrimary} 9%, transparent);
    }
  `,
  recommendationActive: css`
    border-color: ${token.colorPrimaryBorder} !important;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, ${token.colorPrimaryBg} 74%, ${token.colorBgContainer} 26%),
      color-mix(in srgb, ${token.colorInfoBg} 40%, ${token.colorBgContainer} 60%)
    ) !important;
    box-shadow:
      inset 3px 0 0 ${token.colorPrimary},
      0 12px 26px color-mix(in srgb, ${token.colorPrimary} 10%, transparent);

    &::before {
      background: ${token.colorPrimary};
    }
  `,
  recommendationContent: css`
    display: grid;
    gap: 10px;
    min-width: 0;
  `,
  recommendationTitleRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
  `,
  recommendationTitle: css`
    min-width: 0;
    color: ${token.colorText};
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  `,
  recommendationTag: css`
    margin-inline-end: 0;
    border-radius: 999px;
    padding-inline: 10px;
    line-height: 24px;
    font-weight: 500;
  `,
  scoreText: css`
    justify-self: end;
    color: ${token.colorPrimary};
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0;
    white-space: nowrap;
  `,
  scoreLabel: css`
    display: block;
    margin-top: 6px;
    color: ${token.colorTextTertiary};
    font-size: 12px;
    font-weight: 500;
    text-align: right;
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
  matchWorkspaceItem: css`
    animation: matchWorkspaceItemIn 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--match-stagger, 0ms);

    @keyframes matchWorkspaceItemIn {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  recommendationItemMotion: css`
    animation: recommendationItemIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--match-stagger, 0ms);

    @keyframes recommendationItemIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  motionSafe: css`
    @media (prefers-reduced-motion: reduce) {
      &,
      * {
        animation: none !important;
        transition-duration: 1ms !important;
      }
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
  const { styles, cx } = useStyles();
  const favoriteLabel = favorite ? '取消收藏' : '收藏结果';

  const activeReport = useMemo(
    () =>
      recommendations.find(
        (item) => item.report_id === activeRecommendationId,
      ) || recommendations[0],
    [recommendations, activeRecommendationId],
  );

  const viewModel = useMemo(
    () =>
      activeReport
        ? buildCareerDevelopmentMatchViewModel(activeReport)
        : undefined,
    [activeReport],
  );

  if (loading) {
    return <Spin style={{ width: '100%', padding: '64px 0' }} />;
  }

  if (error) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<Text type="danger">{error}</Text>}
      />
    );
  }

  if (!available) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<Text type="secondary">当前暂无职业匹配结果</Text>}
      />
    );
  }

  if (!recommendations.length || !viewModel) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<Text type="secondary">暂无自动推荐岗位</Text>}
      />
    );
  }

  return (
    <div className={cx(styles.shell, styles.motionSafe)}>
      <div className={styles.sidebar}>
        <Card
          className={cx(styles.compactCard, styles.matchWorkspaceItem)}
          style={{ '--match-stagger': '0ms' } as React.CSSProperties}
        >
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

        <Card
          className={cx(styles.compactCard, styles.matchWorkspaceItem)}
          style={{ '--match-stagger': '70ms' } as React.CSSProperties}
        >
          <Title level={5} className={styles.cardTitle}>
            匹配来源
          </Title>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className={styles.infoRow}>
              <span className={`${styles.infoIcon} ${styles.sourceIcon}`}>
                <CalendarOutlined />
              </span>
              <Text type="secondary">
                更新时间：
                {sourceUpdatedAt
                  ? new Date(sourceUpdatedAt).toLocaleString('zh-CN')
                  : '--'}
              </Text>
            </div>
            <div className={styles.infoRow}>
              <span className={`${styles.infoIcon} ${styles.sourceIcon}`}>
                <DatabaseOutlined />
              </span>
              <Text type="secondary">
                已识别维度：{activeDimensionCount ?? '--'}
              </Text>
            </div>
          </div>
        </Card>

        <Card
          className={cx(
            styles.compactCard,
            styles.compactList,
            styles.matchWorkspaceItem,
          )}
          style={{ '--match-stagger': '140ms' } as React.CSSProperties}
        >
          <Title level={5} className={styles.cardTitle}>
            推荐目标
          </Title>
	          <List
	            dataSource={recommendations}
	            renderItem={(item, index) => (
	              <List.Item
	                className={cx(styles.recommendationItemMotion)}
	                style={
	                  {
	                    '--match-stagger': `${index * 60}ms`,
                  } as React.CSSProperties
                }
              >
                <button
                  type="button"
                  className={cx(
                    styles.recommendationButton,
                    item.report_id === activeReport.report_id
                      ? styles.recommendationActive
                      : undefined,
	                  )}
	                  aria-pressed={item.report_id === activeReport.report_id}
	                  aria-label={`选择推荐目标：${item.target_title}，匹配度 ${Math.round(item.overall_match)}%`}
	                  onClick={() => onRecommendationChange?.(item.report_id)}
	                >
                  <span className={styles.recommendationContent}>
                    <span className={styles.recommendationTitleRow}>
                      <span className={styles.recommendationTitle}>
                        {item.target_title}
                      </span>
                    </span>
                    <Tag color="processing" className={styles.recommendationTag}>
                      {item.target_scope === 'industry'
                        ? '行业岗位'
                        : '职业方向'}
                    </Tag>
                  </span>
                  <span className={styles.scoreText}>
                    {Math.round(item.overall_match)}%
                    <span className={styles.scoreLabel}>匹配度</span>
                  </span>
                </button>
	              </List.Item>
	            )}
	          />
	        </Card>
	      </div>

	      <div className={styles.main}>
        <Card
          className={cx(styles.resultCard, styles.matchWorkspaceItem)}
          style={{ '--match-stagger': '220ms' } as React.CSSProperties}
        >
          <Tabs
            activeKey={activeResultTab}
            onChange={(key) =>
              onResultTabChange?.(key as CareerMatchResultTabKey)
            }
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
                <Button
                  type="primary"
                  onClick={onGeneratePlan}
                  className={styles.primaryButton}
                >
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
                children: (
                  <CompanyMatchPanel
                    items={activeReport.evidence_cards || []}
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

export default ResumeMatchWorkspace;
