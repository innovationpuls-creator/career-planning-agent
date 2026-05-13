import { buildCoachUrl } from './AskCoachButton';

const searchParams = (url: string) => new URL(`https://example.test${url}`).searchParams;

describe('buildCoachUrl', () => {
  it('adds the resume source page context without ids', () => {
    const params = searchParams(buildCoachUrl('resume'));

    expect(params.get('step')).toBe('resume');
    expect(params.get('source_page')).toBe('student-competency-profile');
    expect(params.has('favorite_id')).toBe(false);
  });

  it('adds the active career match recommendation context', () => {
    const params = searchParams(buildCoachUrl('match', {
      sourcePage: 'career-match',
      favoriteId: 12,
      reportId: 'report-12',
      recommendationId: 'report-12',
    }));

    expect(params.get('step')).toBe('match');
    expect(params.get('source_page')).toBe('career-match');
    expect(params.get('favorite_id')).toBe('12');
    expect(params.get('report_id')).toBe('report-12');
    expect(params.get('recommendation_id')).toBe('report-12');
  });

  it('adds learning path workspace context', () => {
    const params = searchParams(buildCoachUrl('learning', {
      favoriteId: 34,
      workspaceId: 'ws-34',
    }));

    expect(params.get('step')).toBe('learning');
    expect(params.get('source_page')).toBe('snail-learning-path');
    expect(params.get('favorite_id')).toBe('34');
    expect(params.get('workspace_id')).toBe('ws-34');
  });

  it('adds personal growth report workspace context', () => {
    const params = searchParams(buildCoachUrl('report', {
      favoriteId: 56,
      workspaceId: 'report-ws-56',
    }));

    expect(params.get('step')).toBe('report');
    expect(params.get('source_page')).toBe('personal-growth-report');
    expect(params.get('favorite_id')).toBe('56');
    expect(params.get('workspace_id')).toBe('report-ws-56');
  });
});
