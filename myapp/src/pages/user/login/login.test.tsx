import { TestBrowser } from '@@/testBrowser';
import { fireEvent, render, waitFor } from '@testing-library/react';
import * as React from 'react';

const { act } = React;

const mockedLogin = jest.fn();
const mockedCurrentUser = jest.fn();
const mockedRegister = jest.fn();
const mockedSubmitOnboardingProfile = jest.fn();
const mockedGetJobTitleOptions = jest.fn();

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

jest.mock('@/services/ant-design-pro/api', () => ({
  currentUser: (...args: any[]) => mockedCurrentUser(...args),
  login: (...args: any[]) => mockedLogin(...args),
  register: (...args: any[]) => mockedRegister(...args),
  submitOnboardingProfile: (...args: any[]) => mockedSubmitOnboardingProfile(...args),
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
        ReactLib.createElement('option', { key: 'placeholder', value: '' }, placeholder),
        ...options.map((option: any) =>
          ReactLib.createElement('option', { key: option.value, value: option.value }, option.label),
        ),
      ),
  };
});

const createMockLocation = (href: string) => {
  const url = new URL(href);
  return {
    href,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    origin: url.origin,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  } as unknown as Location;
};

const fillLoginForm = (
  rootContainer: any,
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

describe('Login And Register Pages', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    mockedLogin.mockReset();
    mockedCurrentUser.mockReset();
    mockedRegister.mockReset();
    mockedSubmitOnboardingProfile.mockReset();
    mockedGetJobTitleOptions.mockReset();
    localStorageMock.clear();
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

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('should show login form', async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{
          pathname: '/user/login',
        }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');
    expect(rootContainer.getByTestId('register-account-link')).toBeTruthy();
    rootContainer.unmount();
  });

  it('should navigate to register page when clicking register link', async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{
          pathname: '/user/login',
        }}
      />,
    );

    await rootContainer.findByTestId('login-form-card');

    await act(async () => {
      fireEvent.click(rootContainer.getByTestId('register-account-link'));
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
      <TestBrowser historyRef={historyRef} location={{ pathname: '/user/login' }} />,
    );

    await rootContainer.findByTestId('login-form-card');
    fillLoginForm(rootContainer, { username: 'admin', password: '123456' });

    await act(async () => {
      fireEvent.click(await rootContainer.findByText('Login'));
    });

    await waitFor(() => {
      expect(historyRef.current?.location?.pathname).toBe('/admin/job-postings');
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
      <TestBrowser historyRef={historyRef} location={{ pathname: '/user/login' }} />,
    );

    await rootContainer.findByTestId('login-form-card');
    fillLoginForm(rootContainer, { username: 'user-demo', password: 'user-password' });

    await act(async () => {
      fireEvent.click(await rootContainer.findByText('Login'));
    });

    await waitFor(() => {
      expect(historyRef.current?.location?.pathname).toBe('/home-v2');
    });

    rootContainer.unmount();
  });

  it('should register with multi-step form and redirect to home v2', async () => {
    mockedRegister.mockResolvedValue({
      status: 'ok',
      currentAuthority: 'user',
      success: true,
    });
    mockedLogin.mockResolvedValue({
      success: true,
      status: 'ok',
      currentAuthority: 'user',
      token: 'user-access-token',
    });
    mockedSubmitOnboardingProfile.mockResolvedValue({
      success: true,
      data: {
        onboarding_completed: true,
        profile: {
          full_name: '张三',
          school: '测试大学',
          major: '计算机',
          education_level: '本科',
          grade: '大三',
          target_job_title: 'Java',
        },
        attachments: [],
        vertical_profile: null,
      },
    });

    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser historyRef={historyRef} location={{ pathname: '/user/register' }} />,
    );

    await rootContainer.findByTestId('register-page-title');

    fireEvent.change(rootContainer.getByPlaceholderText('请输入用户名'), {
      target: { value: 'fresh-user' },
    });
    fireEvent.change(rootContainer.getByPlaceholderText('请输入密码'), {
      target: { value: 'ant.design' },
    });
    fireEvent.click(rootContainer.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(rootContainer.getByPlaceholderText('请输入姓名')).toBeTruthy();
    });

    fireEvent.change(rootContainer.getByPlaceholderText('请输入姓名'), {
      target: { value: '张三' },
    });
    fireEvent.change(rootContainer.getByPlaceholderText('请输入学校'), {
      target: { value: '测试大学' },
    });
    fireEvent.change(rootContainer.getByPlaceholderText('请输入专业'), {
      target: { value: '计算机' },
    });
    fireEvent.change(rootContainer.getByPlaceholderText('请输入学历'), {
      target: { value: '本科' },
    });
    fireEvent.change(rootContainer.getByPlaceholderText('请输入年级'), {
      target: { value: '大三' },
    });
    fireEvent.change(rootContainer.getByTestId('target_job_title'), {
      target: { value: 'Java' },
    });
    fireEvent.click(rootContainer.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(rootContainer.getByRole('button', { name: '完成注册' })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(rootContainer.getByRole('button', { name: '完成注册' }));
    });

    await waitFor(() => {
      expect(mockedRegister).toHaveBeenCalledWith({
        username: 'fresh-user',
        password: 'ant.design',
      });
      expect(mockedSubmitOnboardingProfile).toHaveBeenCalled();
      expect(historyRef.current?.location?.pathname).toBe('/home-v2');
    });

    rootContainer.unmount();
  });
});
