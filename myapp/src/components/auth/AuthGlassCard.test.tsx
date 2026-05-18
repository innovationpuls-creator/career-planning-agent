import { fireEvent, render, screen } from '@testing-library/react';
import { AuthGlassCard } from './AuthGlassCard';

describe('AuthGlassCard', () => {
  it('renders active tab and fixed error slot', () => {
    const onTabChange = jest.fn();
    render(
      <AuthGlassCard
        variant="login"
        title="欢迎回来"
        subtitle="登录以继续使用"
        onTabChange={onTabChange}
      >
        <div>fields</div>
      </AuthGlassCard>,
    );

    expect(screen.getByTestId('auth-glass-card')).toBeTruthy();
    expect(screen.getByTestId('auth-error-slot')).toBeTruthy();
    expect(screen.getByTestId('auth-tab-login').getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('fields')).toBeTruthy();

    fireEvent.click(screen.getByTestId('auth-tab-register'));
    expect(onTabChange).toHaveBeenCalledWith('register');
    expect(onTabChange).not.toHaveBeenCalledWith('注册');
  });

  it('passes login key when the login tab is clicked from register state', () => {
    const onTabChange = jest.fn();
    render(
      <AuthGlassCard
        variant="register"
        title="创建账号"
        subtitle="开始构建你的职业轨道"
        onTabChange={onTabChange}
      >
        <div>fields</div>
      </AuthGlassCard>,
    );

    expect(
      screen.getByTestId('auth-tab-register').getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.click(screen.getByTestId('auth-tab-login'));
    expect(onTabChange).toHaveBeenCalledWith('login');
    expect(onTabChange).not.toHaveBeenCalledWith('登录');
  });
});
