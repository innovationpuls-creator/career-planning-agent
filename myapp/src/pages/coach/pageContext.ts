import type { CoachPageContext, CoachSourcePage } from './types';

const SOURCE_PAGES: CoachSourcePage[] = [
  'student-competency-profile',
  'career-match',
  'snail-learning-path',
  'personal-growth-report',
];

const parseOptionalNumber = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseCoachPageContext = (
  searchParams: URLSearchParams,
): CoachPageContext | undefined => {
  const sourcePage = searchParams.get('source_page');
  if (!sourcePage || !SOURCE_PAGES.includes(sourcePage as CoachSourcePage)) {
    return undefined;
  }
  return {
    sourcePage: sourcePage as CoachSourcePage,
    favoriteId: parseOptionalNumber(searchParams.get('favorite_id')),
    workspaceId: searchParams.get('workspace_id') || undefined,
    reportId: searchParams.get('report_id') || undefined,
    recommendationId: searchParams.get('recommendation_id') || undefined,
  };
};
