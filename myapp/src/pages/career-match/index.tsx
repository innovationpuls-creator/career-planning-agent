import { Spin } from 'antd';
import React from 'react';
import { history } from '@umijs/max';
import {
  AskCoachButton,
  FadeInWhenVisible,
  GlassShell,
  PageError,
} from '@/components/ui';
import { CompanyGallery } from './components/CompanyGallery';
import { DataSourceFooter } from './components/DataSourceFooter';
import { GapAdvicePanel } from './components/GapAdvicePanel';
import { MatchOverviewCard } from './components/MatchOverviewCard';
import { RadarComparisonPanel } from './components/RadarComparisonPanel';
import { ScoreNav } from './components/ScoreNav';
import {
  type MatchTabKey,
  useCareerMatchData,
} from './hooks/useCareerMatchData';
import { useStyles } from './pageStyles';

const CareerMatchPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const data = useCareerMatchData();

  if (data.loading) {
    return (
      <GlassShell>
        <div className={styles.shell}>
          <div className={styles.page}>
            <div className={styles.loading}>
              <Spin size="large" />
            </div>
          </div>
        </div>
      </GlassShell>
    );
  }

  if (data.error) {
    return (
      <GlassShell>
        <div className={styles.shell}>
          <div className={styles.page}>
            <PageError
              description={data.error}
              onRetry={() => window.location.reload()}
            />
          </div>
        </div>
      </GlassShell>
    );
  }

  const recommendations = data.matchData?.recommendations || [];
  const activeReport = data.activeRecommendation;
  const isFavorited = Boolean(data.activeRecommendationFavorite);
  const tabCounts = {
    comparison: activeReport?.comparison_dimensions?.length || 0,
    advice: activeReport?.action_advices?.length || 0,
    company: activeReport?.evidence_cards?.length || 0,
  };

  const tabs: { key: MatchTabKey; label: string }[] = [
    { key: 'comparison', label: '能力对比' },
    { key: 'advice', label: '提升建议' },
    { key: 'company', label: '最匹配工作' },
  ];

  return (
    <GlassShell>
      <div className={styles.shell}>
        <div className={styles.page}>
          <div className={styles.header}>
            <div className={styles.headerLabel}>Career Match</div>
            <h1 className={styles.headerTitle}>职业匹配分析</h1>
            <p className={styles.headerSub}>
              基于你的 12 维能力画像，匹配最适合的职业方向
            </p>
          </div>

          <div className={styles.coachRow}>
            <AskCoachButton
              step="match"
              context={{
                sourcePage: 'career-match',
                favoriteId: data.activeRecommendationFavorite?.favorite_id,
                reportId: activeReport?.report_id,
                recommendationId: data.activeRecommendationId,
              }}
            />
          </div>

          <FadeInWhenVisible>
            <div className={styles.workspace}>
              <ScoreNav
                recommendations={recommendations}
                activeId={data.activeRecommendationId}
                onSelect={data.setActiveRecommendationId}
              />

              <div className={styles.contentArea}>
                {activeReport && (
                  <MatchOverviewCard
                    report={activeReport}
                    isFavorited={isFavorited}
                    favoriteSubmitting={data.favoriteSubmitting}
                    onToggleFavorite={data.toggleFavorite}
                    onGeneratePlan={data.generatePlan}
                  />
                )}

                <div className={styles.tabsBar}>
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      className={cx(
                        styles.tab,
                        data.activeTab === t.key && styles.tabActive,
                      )}
                      onClick={() => data.setActiveTab(t.key)}
                    >
                      {t.label}
                      <span
                        className={cx(
                          styles.tabCount,
                          data.activeTab === t.key && styles.tabCountActive,
                        )}
                      >
                        {tabCounts[t.key]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className={styles.tabPanel} key={data.activeTab}>
                  {data.activeTab === 'comparison' && (
                    <RadarComparisonPanel
                      chartSeries={activeReport?.chart_series || []}
                      dimensions={activeReport?.comparison_dimensions || []}
                    />
                  )}
                  {data.activeTab === 'advice' && (
                    <GapAdvicePanel
                      advices={activeReport?.action_advices || []}
                      priorityGaps={activeReport?.priority_gap_dimensions || []}
                      activeGapKey={data.activeGapKey}
                      onGapSelect={data.setActiveGapKey}
                    />
                  )}
                  {data.activeTab === 'company' && (
                    <CompanyGallery
                      cards={activeReport?.evidence_cards || []}
                      onCardClick={(card) =>
                        history.push(
                          `/job-competency-graph?profile_id=${card.profile_id}`,
                        )
                      }
                    />
                  )}
                </div>

                <DataSourceFooter
                  dimensionCount={
                    data.matchData?.source?.active_dimension_count || 12
                  }
                  updatedAt={data.sourceUpdatedAt}
                />
              </div>
            </div>
          </FadeInWhenVisible>
        </div>
      </div>
    </GlassShell>
  );
};

export default CareerMatchPage;
