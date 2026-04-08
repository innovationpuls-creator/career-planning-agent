const AUTH_PAGE_PATHS = new Set([
  '/user/login',
  '/user/register',
  '/user/register-result',
]);

const USER_ONLY_PAGE_PATHS = new Set([
  '/',
  '/job-requirement-profile',
  '/job-requirement-profile/overview',
  '/job-requirement-profile/vertical',
  '/job-requirement-profile/transfer',
  '/student-competency-profile',
  '/career-development-report',
]);

export const getDefaultPostLoginPath = (
  currentUser?: API.CurrentUser,
): string => {
  return currentUser?.access === 'admin'
    ? '/admin/job-postings'
    : '/student-competency-profile';
};

const getPathnameFromTarget = (target: string): string => {
  const [pathname] = target.split(/[?#]/, 1);
  return pathname || '/';
};

export const canAccessRedirectTarget = (
  target: string,
  currentUser?: API.CurrentUser,
): boolean => {
  if (!target.startsWith('/')) {
    return false;
  }

  const pathname = getPathnameFromTarget(target);

  if (AUTH_PAGE_PATHS.has(pathname)) {
    return false;
  }

  if (pathname.startsWith('/admin')) {
    return currentUser?.access === 'admin';
  }

  if (USER_ONLY_PAGE_PATHS.has(pathname)) {
    return currentUser?.access === 'user';
  }

  return true;
};

export const resolvePostLoginRedirect = (
  redirectTarget: string | null,
  currentUser?: API.CurrentUser,
): string => {
  const fallbackPath = getDefaultPostLoginPath(currentUser);

  if (!redirectTarget) {
    return fallbackPath;
  }

  return canAccessRedirectTarget(redirectTarget, currentUser)
    ? redirectTarget
    : fallbackPath;
};
