import { parseCoachPageContext } from './pageContext';

describe('parseCoachPageContext', () => {
  it('parses the current business page context from query params', () => {
    const params = new URLSearchParams({
      source_page: 'snail-learning-path',
      favorite_id: '77',
      workspace_id: 'ws-77',
      report_id: 'report-77',
      recommendation_id: 'rec-77',
    });

    expect(parseCoachPageContext(params)).toEqual({
      sourcePage: 'snail-learning-path',
      favoriteId: 77,
      workspaceId: 'ws-77',
      reportId: 'report-77',
      recommendationId: 'rec-77',
    });
  });

  it('ignores unknown source pages', () => {
    expect(parseCoachPageContext(new URLSearchParams({
      source_page: 'unknown',
      favorite_id: '77',
    }))).toBeUndefined();
  });
});
