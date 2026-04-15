import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import UserManagementPage from './index';

const mockedGetAdminUsers = jest.fn();
const mockedGetAdminUser = jest.fn();
const mockedCreateAdminUser = jest.fn();
const mockedUpdateAdminUser = jest.fn();
const mockedDeleteAdminUser = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getAdminUsers: (...args: any[]) => mockedGetAdminUsers(...args),
  getAdminUser: (...args: any[]) => mockedGetAdminUser(...args),
  createAdminUser: (...args: any[]) => mockedCreateAdminUser(...args),
  updateAdminUser: (...args: any[]) => mockedUpdateAdminUser(...args),
  deleteAdminUser: (...args: any[]) => mockedDeleteAdminUser(...args),
}));

describe('UserManagementPage', () => {
  beforeEach(() => {
    mockedGetAdminUsers.mockReset();
    mockedGetAdminUser.mockReset();
    mockedCreateAdminUser.mockReset();
    mockedUpdateAdminUser.mockReset();
    mockedDeleteAdminUser.mockReset();

    mockedGetAdminUsers.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          username: 'alice',
          display_name: 'Alice',
          role: 'user',
          is_active: true,
          avatar: null,
          created_at: '2024-01-01T00:00:00',
          last_login_at: null,
        },
        {
          id: 2,
          username: 'bob',
          display_name: 'Bob',
          role: 'admin',
          is_active: false,
          avatar: null,
          created_at: '2024-01-02T00:00:00',
          last_login_at: null,
        },
      ],
      total: 2,
    });
    mockedGetAdminUser.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        username: 'alice',
        display_name: 'Alice',
        role: 'user',
        is_active: true,
        avatar: null,
        created_at: '2024-01-01T00:00:00',
        last_login_at: '2024-01-10T00:00:00',
      },
    });
    mockedCreateAdminUser.mockResolvedValue({
      success: true,
      data: {
        id: 3,
        username: 'charlie',
        display_name: 'Charlie',
        role: 'user',
        is_active: true,
        avatar: null,
        created_at: '2024-01-15T00:00:00',
        last_login_at: null,
      },
    });
    mockedUpdateAdminUser.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        username: 'alice',
        display_name: 'Alice Updated',
        role: 'user',
        is_active: true,
        avatar: null,
        created_at: '2024-01-01T00:00:00',
        last_login_at: null,
      },
    });
    mockedDeleteAdminUser.mockResolvedValue({ success: true });
  });

  it('renders user list header after loading', async () => {
    const view = render(React.createElement(UserManagementPage));

    await waitFor(() => {
      expect(mockedGetAdminUsers).toHaveBeenCalled();
    });

    // The page header and table header title should be present
    expect(await view.findByText('用户管理')).toBeTruthy();
    expect(await view.findByText('用户列表')).toBeTruthy();
  });

  it('renders username in the list', async () => {
    const view = render(React.createElement(UserManagementPage));

    await waitFor(() => {
      expect(mockedGetAdminUsers).toHaveBeenCalled();
    });

    expect(await view.findByText('alice')).toBeTruthy();
  });

  it('maps ProTable current/pageSize to service page/page_size', async () => {
    render(React.createElement(UserManagementPage));

    await waitFor(() => {
      expect(mockedGetAdminUsers).toHaveBeenCalled();
    });

    const latestCall = mockedGetAdminUsers.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      page: expect.any(Number),
      page_size: expect.any(Number),
    });
  });

  it('renders role and status columns', async () => {
    const view = render(React.createElement(UserManagementPage));

    await waitFor(() => {
      expect(mockedGetAdminUsers).toHaveBeenCalled();
    });

    // Role and status tags should be visible
    expect(await view.findAllByText('管理员')).toBeTruthy();
    expect(await view.findAllByText('普通用户')).toBeTruthy();
  });

  it('renders 操作 column header', async () => {
    const view = render(React.createElement(UserManagementPage));

    await waitFor(() => {
      expect(mockedGetAdminUsers).toHaveBeenCalled();
    });

    // 操作 column header (findAllByText because 操作 appears in header + row actions)
    const actionHeaders = await view.findAllByText('操作');
    expect(actionHeaders.length).toBeGreaterThan(0);
  });

  it('renders 新增用户 toolbar button', async () => {
    const view = render(React.createElement(UserManagementPage));

    await waitFor(() => {
      expect(mockedGetAdminUsers).toHaveBeenCalled();
    });

    // 新增用户 appears in toolbar
    const newUserButton = view.container.querySelector(
      '.ant-pro-table-list-toolbar button',
    );
    expect(newUserButton?.textContent).toContain('新增用户');
  });
});
