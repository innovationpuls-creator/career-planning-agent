import { TestBrowser } from '@@/testBrowser';
import { AUTH_MORPH } from '@/components/auth';
import { fireEvent, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import {
  createMockLocation,
  localStorageMock,
  mockedCurrentUser,
  mockedGetJobTitleOptions,
  mockedLogin,
  resetAllMocks,
} from '../auth-test-utils';

const { act } = React;

jest.mock('@/services/ant-design-pro/api', () => ({
  currentUser: (...args: any[]) => mockedCurrentUser(...args),
  login: (...args: any[]) => mockedLogin(...args),
  register: (...args: any[]) => jest.fn()(...args),
  submitOnboardingProfile: (...args: any[]) => jest.fn()(...args),
  getJobTitleOptions: (...args: any[]) => mockedGetJobTitleOptions(...args),
  getHomeV2: jest.fn(),
  getVerticalJobProfile: jest.fn(),
  getIndustryOptionsByJobTitle: jest.fn(),
  getJobPostings: jest.fn(),
  outLogin: jest.fn(),
  getNotices: jest.fn(),
  rule: jest.fn(),
  updateRule: jest.fn(),
  addRule: jest.fn(),
  removeRule: jest.fn(),
}));

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  const ReactLib = jest.requireActual('react');

  return {
    ...actual,
    Select: ({ options = [], value, onChange, placeholder, id }: any) =>
      ReactLib.createElement(
        'select',
        {
          'data-testid': id,
          'aria-label': id,
          value: value ?? '',
          onChange: (event: any) => onChange?.(event.target.value || undefined),
        },
        ReactLib.createElement(
          'option',
          { key: 'placeholder', value: '' },
          placeholder,
        ),
        ...options.map((option: any) =>
          ReactLib.createElement(
            'option',
            { key: option.value, value: option.value },
            option.label,
          ),
        ),
      ),
  };
});

const fillLoginForm = (
  rootContainer: { baseElement: HTMLElement },
  values: { username: string; password: string },
) => {
  const usernameInput = rootContainer.baseElement.querySelector(
    '#username',
  ) as HTMLInputElement | null;
  const passwordInput = rootContainer.baseElement.querySelector(
    '#password',
  ) as HTMLInputElement | null;

  expect(usernameInput).not.toBeNull();
  expect(passwordInput).not.toBeNull();

  fireEvent.change(usernameInput as HTMLInputElement, {
    target: { value: values.username },
  });
  fireEvent.change(passwordInput as HTMLInputElement, {
    target: { value: values.password },
  });
};

describe('Login Page', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    resetAllMocks();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    mockedCurrentUser.mockResolvedValue({
      data: {
        name: 'Admin User',
        avatar: '',
        userid: '1',
        access: 'admin',
      },
    });
    mockedGetJobTitleOptions.mockResolvedValue({
      data: [{ label: 'Java', value: 'Java' }],
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: createMockLocation('http://localhost/user/login'),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  // ── Layout: Claude split-screen ────────────────────────────

  it('should render split-screen layout with left brand panel and right form panel', async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: '/user/login' }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');

    expect(rootContainer.getByTestId('login-page-shell')).toBeTruthy();
    expect(rootContainer.getByTestId('auth-art-console')).toBeTruthy();
    expect(rootContainer.getByTestId('auth-right-surface')).toBeTruthy();
    expect(rootContainer.getByTestId('login-form-card')).toBeTruthy();

    rootContainer.unmount();
  });

  it('should show product features in the left panel', async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: '/user/login' }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');

    expect(rootContainer.getByText('「 归 序 」')).toBeTruthy();
    expect(rootContainer.getByText('将旷野，收敛为轨道。')).toBeTruthy();
    expect(rootContainer.getByText(/read_profile/)).toBeTruthy();
    expect(rootContainer.getByText(/读取能力画像/)).toBeTruthy();

    rootContainer.unmount();
  });

  // ── Claude component integration ──────────────────────────

  it('should render login form with form fields', async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: '/user/login' }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');

    expect(rootContainer.getByTestId('register-account-link')).toBeTruthy();

    const usernameInput = rootContainer.baseElement.querySelector('#username');
    const passwordInput = rootContainer.baseElement.querySelector('#password');
    expect(usernameInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();

    rootContainer.unmount();
  });

  // ── Preserved functionality ────────────────────────────────

  it('should navigate to register page when clicking register link', async () => {
    jest.useFakeTimers();
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: '/user/login' }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');

    await act(async () => {
      fireEvent.click(rootContainer.getByTestId('register-account-link'));
    });

    expect(historyRef.current?.location?.pathname).toBe('/user/login');
    act(() => {
      jest.advanceTimersByTime(AUTH_MORPH.durationMs);
    });

    await waitFor(() => {
      expect(historyRef.current?.location?.pathname).toBe('/user/register');
    });

    rootContainer.unmount();
  });

  it('should redirect admin to job postings page after login', async () => {
    mockedLogin.mockResolvedValue({
      success: true,
      status: 'ok',
      type: 'account',
      currentAuthority: 'admin',
      token: 'test-access-token',
    });

    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: '/user/login' }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');
    fillLoginForm(rootContainer, { username: 'admin', password: '123456' });

    await act(async () => {
      fireEvent.click(await rootContainer.findByText('Login'));
    });

    await waitFor(() => {
      expect(historyRef.current?.location?.pathname).toBe(
        '/admin/job-postings',
      );
    });

    rootContainer.unmount();
  });

  it('should redirect normal user to home v2 after login', async () => {
    mockedCurrentUser.mockResolvedValueOnce({
      data: {
        name: 'Normal User',
        avatar: '',
        userid: '2',
        access: 'user',
      },
    });
    mockedLogin.mockResolvedValue({
      success: true,
      status: 'ok',
      type: 'account',
      currentAuthority: 'user',
      token: 'user-access-token',
    });

    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: '/user/login' }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');
    fillLoginForm(rootContainer, {
      username: 'user-demo',
      password: 'user-password',
    });

    await act(async () => {
      fireEvent.click(await rootContainer.findByText('Login'));
    });

    await waitFor(() => {
      expect(historyRef.current?.location?.pathname).toBe('/home-v2');
    });

    rootContainer.unmount();
  });

  it('should show remember me checkbox and forgot password link', async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: '/user/login' }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');

    const checkbox = rootContainer.baseElement.querySelector(
      '.ant-checkbox-wrapper',
    );
    expect(checkbox).not.toBeNull();

    expect(rootContainer.getByTestId('forgot-password-link')).toBeTruthy();

    rootContainer.unmount();
  });
});
