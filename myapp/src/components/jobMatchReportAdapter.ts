import type { CareerDevelopmentMatchReport } from '@/services/ant-design-pro/typings';
import type {
  JobMatchOutcomeGapItem,
  JobMatchOutcomeMetric,
  JobMatchOutcomeRadarDatum,
  JobMatchOutcomeStrengthGroup,
  JobMatchOutcomeViewModel,
} from './JobMatchOutcomeBody';
import { buildStrengthGroups, getAssessmentLabel } from './JobMatchOutcomeBody';

export type CareerMatchResultTabKey = 'comparison' | 'advice' | 'company';

const buildGapLabel = (gap: number): string => {
  if (gap <= 10) return '轻微差距';
  if (gap <= 25) return '需要补充';
  return '信息偏弱';
};

const buildGapSummary = (reportItem: CareerDevelopmentMatchReport['comparison_dimensions'][number]) => {
  const missing = (reportItem.missing_market_keywords || []).filter(Boolean).slice(0, 2);
  if (missing.length) {
    return `缺 ${missing.join('、')} 相关内容`;
  }

  const current = (reportItem.user_values || []).filter(Boolean).slice(0, 2);
  if (current.length) {
    return `当前仅覆盖 ${current.join('、')}`;
  }

  return '缺岗位相关信息';
};

const buildNextActions = (
  reportItem: CareerDevelopmentMatchReport['comparison_dimensions'][number],
  advice: CareerDevelopmentMatchReport['action_advices'][number] | undefined,
) => {
  const fromAdvice = (advice?.next_actions || []).filter(Boolean).slice(0, 3);
  if (fromAdvice.length) return fromAdvice;

  return [
    `补 ${reportItem.title} 相关经历`,
    `补 ${reportItem.title} 相关结果`,
    `补 ${reportItem.title} 相关表达`,
  ];
};

export const buildCareerDevelopmentMatchViewModel = (
  report: CareerDevelopmentMatchReport,
): JobMatchOutcomeViewModel => {
  const { comparison_dimensions, chart_series, strength_dimensions, priority_gap_dimensions, narrative } = report;

  const comparisonByKey = Object.fromEntries(
    (comparison_dimensions || []).map((item) => [item.key, item] as const),
  );

  const metrics: JobMatchOutcomeMetric[] = [
    {
      key: 'overall_match',
      label: '综合评分',
      value: `${Math.round(report.overall_match)}%`,
      emphasize: true,
    },
    {
      key: 'completeness',
      label: '完整度',
      value: `${Math.round(report.group_summaries?.[0]?.match_score || report.overall_match)}%`,
    },
    {
      key: 'competitiveness',
      label: '竞争力',
      value: `${Math.round(report.overall_match)}%`,
    },
  ];

  const radarData: JobMatchOutcomeRadarDatum[] = (chart_series || []).flatMap((item) => [
    { dimension: item.title, category: '目标要求', value: item.market_importance },
    { dimension: item.title, category: '当前准备度', value: item.user_readiness },
  ]);

  const gaps: JobMatchOutcomeGapItem[] = (comparison_dimensions || []).map((item) => {
    const advice = (report.action_advices || []).find((entry) => entry.key === item.key);
    return {
      key: item.key,
      title: item.title,
      statusLabel: item.status_label || buildGapLabel(item.gap || 0),
      gapValue: Math.round(item.gap || 0),
      gapLabel: buildGapLabel(item.gap || 0),
      readiness: Math.round(item.user_readiness || 0),
      summary: buildGapSummary(item),
      whyItMatters: advice?.why_it_matters,
      currentIssue: advice?.current_issue || buildGapSummary(item),
      nextActions: buildNextActions(item, advice),
      examplePhrases: (advice?.example_phrases || []).filter(Boolean).slice(0, 6),
      evidenceSources: (advice?.evidence_sources || []).filter(Boolean).slice(0, 6),
      recommendedKeywords: (advice?.recommended_keywords || item.missing_market_keywords || []).filter(Boolean).slice(0, 6),
    };
  });

  const strengthGroups: JobMatchOutcomeStrengthGroup[] = buildStrengthGroups(
    strength_dimensions || [],
    comparisonByKey,
  );

  const primaryGap = [...gaps]
    .sort((left, right) => right.gapValue - left.gapValue)
    .find((item) => item.key === priority_gap_dimensions?.[0]) || [...gaps].sort((left, right) => right.gapValue - left.gapValue)[0];

  return {
    metrics,
    assessmentLabel: getAssessmentLabel(report.overall_match),
    primaryGapKey: primaryGap?.key,
    primaryGapTitle: primaryGap?.title,
    primaryGapGapLabel: primaryGap?.gapLabel,
    radarData,
    gaps,
    priorityGapKeys: priority_gap_dimensions || [],
    strengthGroups,
    overallReview: narrative?.overall_review,
  };
};
