import routes from '../../../config/routes';

describe('job requirement profile routes', () => {
  it('should expose the knowledge-base menu with job-competency-graph and same-job-cross-industry routes', () => {
    const overviewRoute = routes.find(
      (route: any) => route.path === '/job-competency-graph',
    );
    const verticalRoute = routes.find(
      (route: any) => route.path === '/same-job-cross-industry',
    );

    if (!overviewRoute || !verticalRoute) {
      throw new Error('Expected routes are missing');
    }

    expect(overviewRoute.name).toBe('岗位能力图谱');
    expect(overviewRoute.component).toBe('./job-requirement-profile/overview');

    expect(verticalRoute.name).toBe('同岗行业对比');
    expect(verticalRoute.component).toBe('./job-requirement-profile/vertical');
  });
});
