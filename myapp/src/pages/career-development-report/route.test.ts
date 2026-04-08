import routes from '../../../config/routes';

describe('career development report routes', () => {
  it('should expose all report child routes', () => {
    const reportRoute = routes.find((route: any) => route.path === '/career-development-report');
    if (!reportRoute?.routes) {
      throw new Error('career development report route is missing');
    }

    expect(reportRoute).toBeTruthy();
    expect(reportRoute.name).toBe('构建学生职业生涯发展报告');
    expect(
      reportRoute.routes.some(
        (child: any) =>
          child.path === '/career-development-report/job-exploration-match' &&
          child.name === '职业探索与岗位匹配',
      ),
    ).toBe(true);
    expect(
      reportRoute.routes.some(
        (child: any) =>
          child.path === '/career-development-report/goal-setting-path-planning' &&
          child.name === '职业目标分析报告',
      ),
    ).toBe(true);
    expect(
      reportRoute.routes.some(
        (child: any) =>
          child.path === '/career-development-report/growth-path-planning' &&
          child.name === '成长路径规划',
      ),
    ).toBe(true);
    expect(
      reportRoute.routes.some(
        (child: any) =>
          child.path === '/career-development-report' &&
          child.redirect === '/career-development-report/job-exploration-match',
      ),
    ).toBe(true);
  });
});
