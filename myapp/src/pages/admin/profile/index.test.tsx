import { render, waitFor } from '@testing-library/react';
import React from 'react';
import AdminProfilePage from './index';

const mockedGetAdminProfile = jest.fn();
const mockedUpdateAdminProfile = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getAdminProfile: (...args: any[]) => mockedGetAdminProfile(...args),
  updateAdminProfile: (...args: any[]) => mockedUpdateAdminProfile(...args),
}));

jest.mock('@umijs/max', () => ({
  useModel: () => ({
    setInitialState: jest.fn(),
  }),
}));

describe('AdminProfilePage', () => {
  beforeEach(() => {
    mockedGetAdminProfile.mockReset();
    mockedUpdateAdminProfile.mockReset();

    mockedGetAdminProfile.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        username: 'admin',
        display_name: 'Admin User',
        role: 'admin',
        is_active: true,
        avatar: null,
        created_at: '2024-01-01T00:00:00',
        last_login_at: '2024-01-10T00:00:00',
      },
    });
    mockedUpdateAdminProfile.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        username: 'admin',
        display_name: 'Admin User',
        role: 'admin',
        is_active: true,
        avatar: 'https://example.com/avatar.png',
        created_at: '2024-01-01T00:00:00',
        last_login_at: '2024-01-10T00:00:00',
      },
    });
  });

  it('loads profile on mount and fills the form', async () => {
    const view = render(React.createElement(AdminProfilePage));

    await waitFor(() => {
      expect(mockedGetAdminProfile).toHaveBeenCalled();
    });

    expect(await view.findByText('个人信息')).toBeTruthy();
    expect(await view.findByText('基础资料')).toBeTruthy();
    expect(await view.findByText('修改密码')).toBeTruthy();
  });

  it('displays username and role as readonly fields', async () => {
    const view = render(React.createElement(AdminProfilePage));

    await waitFor(() => {
      expect(mockedGetAdminProfile).toHaveBeenCalled();
    });

    // Username and role should be present as disabled inputs
    const disabledInputs = view.container.querySelectorAll('input[disabled]');
    expect(disabledInputs.length).toBeGreaterThan(0);
  });

  it('renders display_name field for editing', async () => {
    const view = render(React.createElement(AdminProfilePage));

    await waitFor(() => {
      expect(mockedGetAdminProfile).toHaveBeenCalled();
    });

    // 昵称 label should be visible
    expect(view.container.textContent).toContain('昵称');
  });

  it('renders avatar URL field', async () => {
    const view = render(React.createElement(AdminProfilePage));

    await waitFor(() => {
      expect(mockedGetAdminProfile).toHaveBeenCalled();
    });

    // 头像 URL label should be visible
    expect(view.container.textContent).toContain('头像 URL');
  });

  it('renders password change form', async () => {
    const view = render(React.createElement(AdminProfilePage));

    await waitFor(() => {
      expect(mockedGetAdminProfile).toHaveBeenCalled();
    });

    // Password form card
    expect(await view.findByText('修改密码')).toBeTruthy();
    expect(view.container.textContent).toContain('新密码');
    expect(view.container.textContent).toContain('确认新密码');
  });

  it('renders 保存资料 button in profile form', async () => {
    const view = render(React.createElement(AdminProfilePage));

    await waitFor(() => {
      expect(mockedGetAdminProfile).toHaveBeenCalled();
    });

    expect(await view.findByText('保存资料')).toBeTruthy();
  });

  it('renders 更新密码 button in password form', async () => {
    const view = render(React.createElement(AdminProfilePage));

    await waitFor(() => {
      expect(mockedGetAdminProfile).toHaveBeenCalled();
    });

    expect(await view.findByText('更新密码')).toBeTruthy();
  });
});
