import {
  canAccessRedirectTarget,
  getDefaultPostLoginPath,
  resolvePostLoginRedirect,
} from './postLoginRedirect';

describe('postLoginRedirect', () => {
  it('should return role-based default landing pages', () => {
    expect(getDefaultPostLoginPath({ access: 'user' } as API.CurrentUser)).toBe(
      '/student-competency-profile',
    );
    expect(
      getDefaultPostLoginPath({ access: 'admin' } as API.CurrentUser),
    ).toBe('/admin/job-postings');
  });

  it('should only allow student feature redirects for normal users', () => {
    expect(
      canAccessRedirectTarget(
        '/job-requirement-profile/overview',
        { access: 'user' } as API.CurrentUser,
      ),
    ).toBe(true);
    expect(
      canAccessRedirectTarget(
        '/job-requirement-profile/overview',
        { access: 'admin' } as API.CurrentUser,
      ),
    ).toBe(false);
  });

  it('should keep admin pages restricted to admins', () => {
    expect(
      canAccessRedirectTarget(
        '/admin/job-postings',
        { access: 'admin' } as API.CurrentUser,
      ),
    ).toBe(true);
    expect(
      canAccessRedirectTarget(
        '/admin/job-postings',
        { access: 'user' } as API.CurrentUser,
      ),
    ).toBe(false);
  });

  it('should fall back to admin home when admin redirect points to a student page', () => {
    expect(
      resolvePostLoginRedirect(
        '/career-development-report',
        { access: 'admin' } as API.CurrentUser,
      ),
    ).toBe('/admin/job-postings');
  });
});
