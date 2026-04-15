import routes from '../../../config/routes';

describe('job requirement profile routes', () => {
  it('should expose the knowledge-base menu with three default child entries', () => {
    const jobRequirementRoute = routes.find(
      (route: any) => route.path === '/job-requirement-profile',
    );
    if (!jobRequirementRoute?.routes) {
      throw new Error('job requirement profile route is missing');
    }

    expect(jobRequirementRoute).toBeTruthy();
    expect(jobRequirementRoute.name).toBe('就业信息知识库');
    expect(jobRequirementRoute.routes).toHaveLength(3);
    expect(
      jobRequirementRoute.routes.some(
        (child: any) =>
          child.path === '/job-requirement-profile/overview' && child.name === '岗位要求图谱总览',
      ),
    ).toBe(true);
    expect(
      jobRequirementRoute.routes.some(
        (child: any) =>
          child.path === '/job-requirement-profile/vertical' && child.name === '垂直岗位图谱',
      ),
    ).toBe(true);
  });
});
