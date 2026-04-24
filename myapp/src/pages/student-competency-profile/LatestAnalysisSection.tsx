import { Empty, Spin, Typography } from 'antd';
import React, { useMemo } from 'react';
import {
  buildStrengthGroups,
  getAssessmentLabel,
  JobMatchAdvicePanel,
  JobMatchComparisonPanel,
  type JobMatchOutcomeViewModel,
} from '@/components/JobMatchOutcomeBody';

const buildGapLabel = (gap: number) => {
  if (gap <= 10) return '轻微差距';
  if (gap <= 25) return '需要补充';
  return '信息偏弱';
};

const buildLatestAnalysisViewModel = (
  analysis: API.StudentCompetencyLatestAnalysisPayload,
): JobMatchOutcomeViewModel => {
  const comparisonByKey = Object.fromEntries(
    (analysis.comparison_dimensions || []).map(
      (item) => [item.key, item] as const,
    ),
  );

  const gaps = (analysis.comparison_dimensions || []).map((item) => {
    const advice = (analysis.action_advices || []).find(
      (entry) => entry.key === item.key,
    );
    const nextActions = (advice?.next_actions || [])
      .filter(Boolean)
      .slice(0, 3);
    const missing = (item.missing_market_keywords || [])
      .filter(Boolean)
      .slice(0, 2);
    const current = (item.user_values || []).filter(Boolean).slice(0, 2);

    return {
      key: item.key,
      title: item.title,
      statusLabel: item.status_label || buildGapLabel(item.gap || 0),
      gapValue: Math.round(item.gap || 0),
      gapLabel: buildGapLabel(item.gap || 0),
      readiness: Math.round(item.user_readiness || 0),
      summary: missing.length
        ? `缺 ${missing.join('、')} 相关内容`
        : current.length
          ? `当前仅覆盖 ${current.join('、')}`
          : '缺岗位相关信息',
      whyItMatters: advice?.why_it_matters,
      currentIssue:
        advice?.current_issue ||
        (missing.length
          ? `缺 ${missing.join('、')} 相关内容`
          : '缺岗位相关信息'),
      nextActions:
        nextActions.length > 0
          ? nextActions
          : [
              `补 ${item.title} 相关经历`,
              `补 ${item.title} 相关结果`,
              `补 ${item.title} 相关表达`,
            ],
      examplePhrases: (advice?.example_phrases || [])
        .filter(Boolean)
        .slice(0, 6),
      evidenceSources: (advice?.evidence_sources || [])
        .filter(Boolean)
        .slice(0, 6),
      recommendedKeywords: (
        advice?.recommended_keywords ||
        item.missing_market_keywords ||
        []
      )
        .filter(Boolean)
        .slice(0, 6),
    };
  });

  const primaryGap =
    [...gaps]
      .sort((left, right) => right.gapValue - left.gapValue)
      .find((item) => item.key === analysis.priority_gap_dimensions?.[0]) ||
    [...gaps].sort((left, right) => right.gapValue - left.gapValue)[0];

  return {
    metrics: [
      {
        key: 'overall',
        label: '综合评分',
        value: `${Math.round(analysis.score?.overall || 0)}%`,
        emphasize: true,
      },
      {
        key: 'completeness',
        label: '完整度',
        value: `${Math.round(analysis.score?.completeness || 0)}%`,
      },
      {
        key: 'competitiveness',
        label: '竞争力',
        value: `${Math.round(analysis.score?.competitiveness || 0)}%`,
      },
    ],
    assessmentLabel: getAssessmentLabel(analysis.score?.overall || 0),
    primaryGapKey: primaryGap?.key,
    primaryGapTitle: primaryGap?.title,
    primaryGapGapLabel: primaryGap?.gapLabel,
    radarData: (analysis.chart_series || []).flatMap((item) => [
      {
        dimension: item.title,
        category: '目标要求',
        value: item.market_importance,
      },
      {
        dimension: item.title,
        category: '当前准备度',
        value: item.user_readiness,
      },
    ]),
    gaps,
    priorityGapKeys: analysis.priority_gap_dimensions || [],
    strengthGroups: buildStrengthGroups(
      analysis.strength_dimensions || [],
      comparisonByKey,
    ),
    overallReview: analysis.narrative?.overall_review,
  };
};

type Props = {
  analysis?: API.StudentCompetencyLatestAnalysisPayload;
  loading?: boolean;
  mode?: 'comparison' | 'advice';
  activeGapKey?: string;
  onOpenAdvice?: (key?: string) => void;
  onActiveGapChange?: (key: string) => void;
};

const LatestAnalysisSection: React.FC<Props> = ({
  analysis,
  loading = false,
  mode = 'comparison',
  activeGapKey,
  onOpenAdvice,
  onActiveGapChange,
}) => {
  const viewModel = useMemo(
    () =>
      analysis?.available ? buildLatestAnalysisViewModel(analysis) : undefined,
    [analysis],
  );

  if (loading) {
    return <Spin style={{ width: '100%', padding: '48px 0' }} />;
  }

  if (!analysis?.available || !viewModel) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary">
            {analysis?.message || '暂无岗位对标结果'}
          </Typography.Text>
        }
      />
    );
  }

  if (mode === 'advice') {
    return (
      <JobMatchAdvicePanel
        viewModel={viewModel}
        activeGapKey={activeGapKey}
        onActiveGapChange={onActiveGapChange}
      />
    );
  }

  return (
    <JobMatchComparisonPanel
      viewModel={viewModel}
      onOpenAdvice={(key) => onOpenAdvice?.(key)}
    />
  );
};

export default LatestAnalysisSection;
