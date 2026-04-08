import access from './access';

describe('access', () => {
  it('should only allow admin to open admin pages', () => {
    const result = access({
      currentUser: { access: 'admin' } as API.CurrentUser,
    });

    expect(result.canAdmin).toBe(true);
    expect(result.canUser).toBe(false);
  });

  it('should allow normal user to open user pages only', () => {
    const result = access({
      currentUser: { access: 'user' } as API.CurrentUser,
    });

    expect(result.canAdmin).toBe(false);
    expect(result.canUser).toBe(true);
  });
});
