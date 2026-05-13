import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import UtilityBar from './UtilityBar';

const mockedOutLogin = jest.fn();
const mockedClearAccessToken = jest.fn();
const mockedHistoryReplace = jest.fn();
const mockedSetInitialState = jest.fn();

let mockInitialState: Record<string, unknown> | null = {
  currentUser: { name: '测试用户' },
};

jest.mock('@umijs/max', () => ({
  history: {
    replace: (...args: unknown[]) => mockedHistoryReplace(...args),
  },
  useModel: () => ({
    initialState: mockInitialState,
    setInitialState: mockedSetInitialState,
  }),
  SelectLang: () =>
    require('react').createElement('div', { 'data-testid': 'select-lang' }),
}));

jest.mock('@/services/ant-design-pro/api', () => ({
  outLogin: (...args: unknown[]) => mockedOutLogin(...args),
}));

jest.mock('@/utils/authToken', () => ({
  clearAccessToken: () => mockedClearAccessToken(),
}));

describe('UtilityBar', () => {
  beforeEach(() => {
    mockedOutLogin.mockReset();
    mockedOutLogin.mockResolvedValue({});
    mockedClearAccessToken.mockReset();
    mockedHistoryReplace.mockReset();
    mockedSetInitialState.mockReset();
    mockInitialState = { currentUser: { name: '测试用户' } };
  });

  it('renders the username', () => {
    render(React.createElement(UtilityBar));
    expect(screen.getByText('测试用户')).toBeTruthy();
  });

  it('renders the language switcher', () => {
    render(React.createElement(UtilityBar));
    expect(screen.getByTestId('select-lang')).toBeTruthy();
  });

  it('shows spinner when no user data', () => {
    mockInitialState = { currentUser: undefined };
    const { container } = render(React.createElement(UtilityBar));
    expect(container.querySelector('.ant-spin')).toBeTruthy();
  });

  it('shows spinner when initialState is null', () => {
    mockInitialState = null;
    const { container } = render(React.createElement(UtilityBar));
    expect(container.querySelector('.ant-spin')).toBeTruthy();
  });

  it('opens dropdown on avatar click and shows logout option', async () => {
    render(React.createElement(UtilityBar));
    const userEntry = screen.getByText('测试用户').closest('div');
    fireEvent.click(userEntry!);
    await waitFor(() => {
      expect(screen.getByText('退出登录')).toBeTruthy();
    });
  });

  it('calls logout when logout menu item is clicked', async () => {
    render(React.createElement(UtilityBar));
    const userEntry = screen.getByText('测试用户').closest('div');
    fireEvent.click(userEntry!);
    await waitFor(() => {
      expect(screen.getByText('退出登录')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('退出登录'));
    await waitFor(() => {
      expect(mockedOutLogin).toHaveBeenCalled();
      expect(mockedClearAccessToken).toHaveBeenCalled();
    });
  });
});
