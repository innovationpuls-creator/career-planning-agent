import { TestBrowser } from '@@/testBrowser';
import { fireEvent, render, waitFor } from '@testing-library/react';
import * as React from 'react';

const { act } = React;

const mockedLogin = jest.fn();
const mockedCurrentUser = jest.fn();
const mockedRegister = jest.fn();

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
  getJobPostings: jest.fn(),
  outLogin: jest.fn(),
  getNotices: jest.fn(),
  rule: jest.fn(),
  updateRule: jest.fn(),
  addRule: jest.fn(),
  removeRule: jest.fn(),
}));

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

describe('Login Page', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    mockedLogin.mockReset();
    mockedCurrentUser.mockReset();
    mockedRegister.mockReset();
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

    await rootContainer.findByTestId('login-page-title');

    act(() => {
      historyRef.current?.push('/user/login');
    });

    expect(
      rootContainer.baseElement?.querySelector('.ant-pro-form-login-desc'),
    ).toBeNull();
    expect(rootContainer.queryByText('Phone Login')).toBeNull();
    expect(rootContainer.queryByText('Forgot Password')).toBeNull();
    expect(rootContainer.queryByText('Auto Login')).toBeNull();
    expect(
      rootContainer.baseElement?.querySelector('.ant-pro-form-login-logo'),
    ).toBeNull();
    expect(rootContainer.getByTestId('register-account-link')).toBeTruthy();

    const loginShell = rootContainer.getByTestId('login-page-shell');
    expect(loginShell).toBeTruthy();

    const loginMain = rootContainer.baseElement?.querySelector(
      '.ant-pro-form-login-main',
    ) as HTMLDivElement | null;
    expect(loginMain).not.toBeNull();
    expect(loginMain?.style.position).toBe('absolute');
    expect(loginMain?.style.top).toBe('50%');
    expect(loginMain?.style.left).toBe('50%');
    expect(loginMain?.style.transform).toBe('translate(-50%, -50%)');

    const loginTitle = rootContainer.getByTestId('login-page-title');
    expect(loginTitle).toBeTruthy();
    expect(loginTitle.style.display).toBe('inline-block');
    expect(loginTitle.style.transform).toBe('translateY(calc(50vh - 250px))');

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
        location={{
          pathname: '/user/login',
        }}
      />,
    );

    await rootContainer.findByTestId('login-page-title');

    fillLoginForm(rootContainer, {
      username: 'admin',
      password: '123456',
    });

    await act(async () => {
      fireEvent.click(await rootContainer.findByText('Login'));
    });

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith({
        username: 'admin',
        password: '123456',
        type: 'account',
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'feature_map_access_token',
        'test-access-token',
      );
      expect(mockedCurrentUser).toHaveBeenCalled();
      expect(historyRef.current?.location?.pathname).toBe('/admin/job-postings');
    });

    rootContainer.unmount();
  });

  it('should keep normal user redirect to home page', async () => {
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
        location={{
          pathname: '/user/login',
        }}
      />,
    );

    await rootContainer.findByTestId('login-page-title');

    fillLoginForm(rootContainer, {
      username: 'user-demo',
      password: 'user-password',
    });

    await act(async () => {
      fireEvent.click(await rootContainer.findByText('Login'));
    });

    await waitFor(() => {
      expect(historyRef.current?.location?.pathname).toBe('/');
    });

    rootContainer.unmount();
  });

  it('should ignore admin redirect for normal user after login', async () => {
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
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: createMockLocation(
        'http://localhost/user/login?redirect=%2Fadmin%2Fjob-postings',
      ),
    });

    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{
          pathname: '/user/login',
          search: '?redirect=%2Fadmin%2Fjob-postings',
        }}
      />,
    );

    await rootContainer.findByTestId('login-page-title');

    fillLoginForm(rootContainer, {
      username: 'user-demo',
      password: 'user-password',
    });

    await act(async () => {
      fireEvent.click(await rootContainer.findByText('Login'));
    });

    await waitFor(() => {
      expect(historyRef.current?.location?.pathname).toBe('/');
    });

    rootContainer.unmount();
  });

  it('should keep valid redirect for admin after login', async () => {
    mockedLogin.mockResolvedValue({
      success: true,
      status: 'ok',
      type: 'account',
      currentAuthority: 'admin',
      token: 'test-access-token',
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: createMockLocation(
        'http://localhost/user/login?redirect=%2Fadmin%2Fjob-postings',
      ),
    });

    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{
          pathname: '/user/login',
          search: '?redirect=%2Fadmin%2Fjob-postings',
        }}
      />,
    );

    await rootContainer.findByTestId('login-page-title');

    fillLoginForm(rootContainer, {
      username: 'admin',
      password: '123456',
    });

    await act(async () => {
      fireEvent.click(await rootContainer.findByText('Login'));
    });

    await waitFor(() => {
      expect(historyRef.current?.location?.pathname).toBe('/admin/job-postings');
    });

    rootContainer.unmount();
  });

  it('should register success', async () => {
    mockedRegister.mockResolvedValue({
      status: 'ok',
      currentAuthority: 'user',
      success: true,
    });

    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{
          pathname: '/user/register',
        }}
      />,
    );

    await rootContainer.findByTestId('register-page-title');

    act(() => {
      historyRef.current?.push('/user/register');
    });

    fireEvent.change(rootContainer.getByPlaceholderText('Choose a username'), {
      target: { value: 'fresh-user' },
    });
    fireEvent.change(rootContainer.getByPlaceholderText('Create a password'), {
      target: { value: 'ant.design' },
    });

    await act(async () => {
      fireEvent.click(rootContainer.getByRole('button', { name: '创建账户' }));
    });

    await waitFor(() => {
      expect(mockedRegister).toHaveBeenCalledWith({
        username: 'fresh-user',
        password: 'ant.design',
      });
      expect(historyRef.current?.location?.pathname).toBe('/user/login');
    });

    rootContainer.unmount();
  });
});
