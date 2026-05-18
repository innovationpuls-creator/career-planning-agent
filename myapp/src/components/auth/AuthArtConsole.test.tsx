import { render, screen } from '@testing-library/react';
import { AuthArtConsole } from './AuthArtConsole';

describe('AuthArtConsole', () => {
  it('renders login art copy and mixed coach tool rows', () => {
    render(<AuthArtConsole variant="login" />);

    expect(screen.getByTestId('auth-art-console')).toBeTruthy();
    expect(screen.getByTestId('auth-console-log')).toBeTruthy();
    expect(screen.getByText('「 归 序 」')).toBeTruthy();
    expect(screen.getByText('将旷野，收敛为轨道。')).toBeTruthy();
    expect(screen.getByText(/read_profile/)).toBeTruthy();
    expect(screen.getByText(/读取能力画像/)).toBeTruthy();
  });

  it('renders register art copy', () => {
    render(<AuthArtConsole variant="register" />);

    expect(screen.getByText('「 构 筑 」')).toBeTruthy();
    expect(screen.getByText(/予 灵 魂/)).toBeTruthy();
    expect(screen.getByText(/以 算 法 的 脉 络/)).toBeTruthy();
  });
});
