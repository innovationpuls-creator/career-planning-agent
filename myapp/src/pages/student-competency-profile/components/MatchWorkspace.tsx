import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Empty, Spin, Tabs, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import { ClaudeButton, ProgressRing } from '@/components/ui';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';
export type MatchResultTabKey = 'comparison' | 'advice' | 'company';

const { Text } = Typography;

interface MatchWorkspaceProps {
  matchData: API.CareerDevelopmentMatchInitPayload | undefined;
  activeRecommendationId: string | undefined;
  activeResultTab: MatchResultTabKey;
  favorites: API.CareerDevelopmentFavoritePayload[];
  favoriteSubmitting: boolean;
  loading: boolean;
  onSelectRecommendation: (id: string) => void;
  onResultTabChange: (tab: MatchResultTabKey) => void;
  onGapSelect: (key: string | undefined) => void;
  onToggleFavorite: () => void;
  onGeneratePlan: () => void;
  comparisonContent?: React.ReactNode;
  adviceContent?: React.ReactNode;
  companyContent?: React.ReactNode;
}

const useStyles = createStyles(({ css }) => ({
  workspace: css`
    display: flex;
    gap: 20px;
    width: 100%;
    min-width: 0;
    align-items: flex-start;

    @media (max-width: 1024px) {
      flex-direction: column;
    }
  `,
  sidebar: css`
    flex: 0 0 300px;
    min-width: 0;
    display: grid;
    gap: 12px;

    @media (max-width: 1024px) {
      flex: none;
      width: 100%;
    }
  `,
  main: css`
    flex: 1;
    min-width: 0;
  `,
  infoCard: css`
    background: ${claudeColors.ivory};
    border-radius: ${claudeRadius.xl}px;
    padding: 20px;
  `,
  infoLabel: css`
    font-size: 12px;
    color: ${claudeColors.stoneGray};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  `,
  infoValue: css`
    font-size: 14px;
    color: ${claudeColors.nearBlack};
    font-weight: 600;
  `,
  sourceRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  listCard: css`
    background: ${claudeColors.ivory};
    border-radius: ${claudeRadius.xl}px;
    padding: 20px;
  `,
  listTitle: css`
    font-family: ${claudeFonts.heading};
    font-size: 16px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin: 0 0 12px;
  `,
  recommendationItem: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: ${claudeRadius.lg}px;
    cursor: pointer;
    border: 1px solid ${claudeColors.borderCream};
    background: ${claudeColors.parchment};
    transition: all 0.2s ease;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    &:hover {
      border-color: ${claudeColors.terracotta};
      box-shadow: 0 2px 8px ${claudeAlpha(claudeColors.terracotta, 0.08)};
    }
  `,
  recommendationActive: css`
    border-color: ${claudeColors.terracotta};
    background: ${claudeAlpha(claudeColors.terracotta, 0.04)};
    box-shadow: 0 2px 8px ${claudeAlpha(claudeColors.terracotta, 0.12)};
  `,
  recommendationTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
  `,
  recommendationIndustry: css`
    font-size: 12px;
    color: ${claudeColors.stoneGray};
    margin-top: 2px;
  `,
  scoreBadge: css`
    font-family: ${claudeFonts.heading};
    font-size: 22px;
    font-weight: 700;
    color: ${claudeColors.terracotta};
    line-height: 1;
  `,
  tabs: css`
    :global(.ant-tabs-nav) {
      margin-bottom: 16px;
    }
    :global(.ant-tabs-nav-list) {
      display: flex !important;
      flex: 1 1 auto !important;
      width: 100%;
    }
    :global(.ant-tabs-tab) {
      flex: 1 1 0;
      display: flex;
      justify-content: center;
      margin: 0 !important;
      font-weight: 600 !important;
    }
    :global(.ant-tabs-tab-active .ant-tabs-tab-btn) {
      color: ${claudeColors.terracotta} !important;
    }
    :global(.ant-tabs-ink-bar) {
      background: ${claudeColors.terracotta} !important;
    }
    :global(.ant-tabs-content-holder) {
      width: 100%;
    }
    :global(.ant-tabs-tabpane) {
      width: 100%;
    }
  `,
  actionBar: css`
    display: flex;
    gap: 12px;
    margin-top: 16px;
    flex-wrap: wrap;
  `,
  emptyCard: css`
    background: ${claudeColors.ivory};
    border-radius: ${claudeRadius.xl}px;
    padding: 48px 24px;
    text-align: center;
  `,
}));

function DataSourceCard({
  source,
}: {
  source: API.CareerDevelopmentMatchInitPayload['source'];
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoLabel}>数据来源</div>
      <div className={styles.infoValue}>
        {source?.active_dimension_count || 0} 维度分析
      </div>
      {source?.updated_at && (
        <div className={styles.sourceRow}>
          更新于 {new Date(source.updated_at).toLocaleDateString('zh-CN')}
        </div>
      )}
    </div>
  );
}

function RecommendationList({
  recommendations,
  activeId,
  onSelect,
}: {
  recommendations: API.CareerDevelopmentMatchReport[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const { styles, cx } = useStyles();
  return (
    <div className={styles.listCard}>
      <div className={styles.listTitle}>推荐职业</div>
      {recommendations.map((report) => {
        const isActive =
          report.report_id === (activeId || recommendations[0]?.report_id);
        return (
          <div
            key={report.report_id}
            className={cx(
              styles.recommendationItem,
              isActive && styles.recommendationActive,
            )}
            onClick={() => onSelect(report.report_id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                onSelect(report.report_id);
            }}
          >
            <div>
              <div className={styles.recommendationTitle}>
                {report.canonical_job_title}
              </div>
              {report.industry && (
                <div className={styles.recommendationIndustry}>
                  {report.industry}
                </div>
              )}
            </div>
            <div className={styles.scoreBadge}>
              {Math.round(report.overall_match)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportHeader({
  report,
  isFavorited,
  favoriteSubmitting,
  onToggleFavorite,
  onGeneratePlan,
}: {
  report: API.CareerDevelopmentMatchReport;
  isFavorited: boolean;
  favoriteSubmitting: boolean;
  onToggleFavorite: () => void;
  onGeneratePlan: () => void;
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.infoCard} style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 12,
        }}
      >
        <ProgressRing
          percent={Math.round(report.overall_match)}
          size={64}
          color={claudeColors.terracotta}
        />
        <div>
          <Text className={styles.recommendationTitle} style={{ fontSize: 18 }}>
            {report.canonical_job_title}
          </Text>
          <div className={styles.recommendationIndustry}>
            匹配度 {Math.round(report.overall_match)}%
            {report.industry && ` · ${report.industry}`}
          </div>
        </div>
      </div>
      <div className={styles.actionBar}>
        <ClaudeButton
          variant={isFavorited ? 'terracotta' : 'ghost'}
          icon={isFavorited ? <StarFilled /> : <StarOutlined />}
          loading={favoriteSubmitting}
          onClick={onToggleFavorite}
        >
          {isFavorited ? '已收藏' : '收藏'}
        </ClaudeButton>
        <ClaudeButton
          variant="terracotta"
          disabled={!isFavorited}
          onClick={onGeneratePlan}
          title={!isFavorited ? '请先收藏该职业推荐' : undefined}
        >
          生成学习计划
        </ClaudeButton>
      </div>
    </div>
  );
}

export function MatchWorkspace({
  matchData,
  activeRecommendationId,
  activeResultTab,
  favorites,
  favoriteSubmitting,
  loading,
  onSelectRecommendation,
  onResultTabChange,
  onToggleFavorite,
  onGeneratePlan,
  comparisonContent,
  adviceContent,
  companyContent,
}: MatchWorkspaceProps) {
  const { styles } = useStyles();

  const recommendations = matchData?.recommendations || [];
  const activeReport =
    recommendations.find((r) => r.report_id === activeRecommendationId) ||
    recommendations[0];
  const isFavorited = activeReport
    ? favorites.some((f) => f.report_id === activeReport.report_id)
    : false;

  const tabItems = useMemo(
    () => [
      { key: 'comparison', label: '维度对比', children: comparisonContent },
      { key: 'advice', label: '和目标的差距', children: adviceContent },
      { key: 'company', label: '最匹配的工作', children: companyContent },
    ],
    [comparisonContent, adviceContent, companyContent],
  );

  if (loading) {
    return (
      <Spin tip="加载匹配数据中..." size="large">
        <div className={styles.emptyCard} />
      </Spin>
    );
  }

  if (!matchData?.available || !recommendations.length) {
    return (
      <div className={styles.emptyCard}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={matchData?.message || '暂无匹配数据，请先完成简历解析'}
        />
      </div>
    );
  }

  return (
    <div className={styles.workspace} data-testid="match-workspace">
      <div className={styles.sidebar}>
        <DataSourceCard source={matchData.source} />
        <RecommendationList
          recommendations={recommendations}
          activeId={activeRecommendationId}
          onSelect={onSelectRecommendation}
        />
      </div>

      <div className={styles.main}>
        {activeReport && (
          <>
            <ReportHeader
              report={activeReport}
              isFavorited={isFavorited}
              favoriteSubmitting={favoriteSubmitting}
              onToggleFavorite={onToggleFavorite}
              onGeneratePlan={onGeneratePlan}
            />
            <Tabs
              className={styles.tabs}
              activeKey={activeResultTab}
              onChange={(key) => onResultTabChange(key as MatchResultTabKey)}
              items={tabItems}
            />
          </>
        )}
      </div>
    </div>
  );
}
