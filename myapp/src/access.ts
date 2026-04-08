/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState: { currentUser?: API.CurrentUser } | undefined,
) {
  const { currentUser } = initialState ?? {};
  const isLoggedIn = !!currentUser;
  const isAdmin = currentUser?.access === 'admin';
  const isUser = currentUser?.access === 'user';
  return {
    canAdmin: isAdmin,
    canUser: isLoggedIn && isUser,
  };
}
