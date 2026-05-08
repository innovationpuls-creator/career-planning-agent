import React from 'react';
import { FadeInWhenVisible } from '@/components/ui';
import { CompanyMatchCards } from '@/pages/student-competency-profile/components/CompanyMatchCards';
import { ComparisonPanel } from '@/pages/student-competency-profile/components/ComparisonPanel';
import {
  type MatchResultTabKey,
  MatchWorkspace,
} from '@/pages/student-competency-profile/components/MatchWorkspace';
import { GapAnalysisPanel } from '@/pages/student-competency-profile/components/GapAnalysisPanel';
import { useCompetencyData } from '@/pages/student-competency-profile/hooks/useCompetencyData';
import { useMatchResults } from '@/pages/student-competency-profile/hooks/useMatchResults';
import { useStyles } from './pageStyles';

const CareerMatchPage: React.FC = () => {
  const { styles } = useStyles();
  const competency = useCompetencyData();
  const match = useMatchResults();

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <FadeInWhenVisible>
          <MatchWorkspace
            matchData={match.matchData}
            activeRecommendationId={match.activeRecommendationId}
            activeResultTab={match.activeResultTab}
            favorites={match.favorites}
            favoriteSubmitting={match.favoriteSubmitting}
            loading={match.loading}
            onSelectRecommendation={match.setActiveRecommendationId}
            onResultTabChange={
              match.setActiveResultTab as (tab: MatchResultTabKey) => void
            }
            onGapSelect={match.setActiveGapKey}
            onToggleFavorite={match.toggleFavorite}
            onGeneratePlan={match.generatePlan}
            comparisonContent={
              <ComparisonPanel
                dimensions={
                  match.activeRecommendation?.comparison_dimensions || []
                }
                userProfile={competency.currentProfile}
                careerTitle={match.activeRecommendation?.canonical_job_title}
              />
            }
            adviceContent={
              <GapAnalysisPanel
                advices={match.activeRecommendation?.action_advices || []}
                priorityGaps={
                  match.activeRecommendation?.priority_gap_dimensions || []
                }
                activeGapKey={match.activeGapKey}
                onGapSelect={match.setActiveGapKey}
              />
            }
            companyContent={
              <CompanyMatchCards
                cards={match.activeRecommendation?.evidence_cards || []}
              />
            }
          />
        </FadeInWhenVisible>
      </div>
    </div>
  );
};

export default CareerMatchPage;
