import { TestBrowser } from '@@/testBrowser';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';

let mockMountCount = 0;

jest.mock('@/components/auth/AuthSplitShell', () => {
  const { useEffect } = require('react');
  return {
    AuthSplitShell: ({
      children,
      variant,
    }: {
      children: any;
      variant?: string;
    }) => {
      useEffect(() => {
        mockMountCount += 1;
      }, []);
      return (
        <div data-testid="mock-auth-shell" data-variant={variant}>
          {children}
        </div>
      );
    },
  };
});

describe('Auth Layout — single-route state-driven switching', () => {
  beforeEach(() => {
    mockMountCount = 0;
  });

  it('should render login form by default at /user/login', async () => {
    const rootContainer = render(
      <TestBrowser location={{ pathname: '/user/login' }} />,
    );

    await rootContainer.findByTestId('login-form-card');
    expect(rootContainer.getByTestId('mock-auth-shell')).toBeTruthy();
    expect(mockMountCount).toBe(1);

    rootContainer.unmount();
  });

  it('should render register form when mode=register is in query', async () => {
    const rootContainer = render(
      <TestBrowser
        location={{ pathname: '/user/login', search: '?mode=register' }}
      />,
    );

    await rootContainer.findByTestId('register-form-card');
    expect(rootContainer.getByTestId('mock-auth-shell')).toBeTruthy();

    rootContainer.unmount();
  });

  it('should keep AuthSplitShell mounted when switching from login to register', async () => {
    const rootContainer = render(
      <TestBrowser location={{ pathname: '/user/login' }} />,
    );

    await rootContainer.findByTestId('login-form-card');
    expect(mockMountCount).toBe(1);

    await act(async () => {
      const registerLink = rootContainer.getByTestId('register-account-link');
      registerLink.click();
    });

    await rootContainer.findByTestId('register-form-card');
    expect(mockMountCount).toBe(1);

    rootContainer.unmount();
  });
});
