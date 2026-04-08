import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import Welcome from './Welcome';

const mockedPush = jest.fn();
let mockedAccess = 'user';

jest.mock('@umijs/max', () => ({
  history: {
    push: (...args: any[]) => mockedPush(...args),
  },
  useModel: () => ({
    initialState: {
      currentUser: {
        access: mockedAccess,
      },
    },
  }),
}));

describe('Welcome', () => {
  beforeEach(() => {
    mockedPush.mockReset();
    mockedAccess = 'user';
  });

  it('should render the three core navigation cards', () => {
    render(React.createElement(Welcome));

    expect(
      screen.getByText('从清晰入口开始，逐步完成职业规划分析'),
    ).toBeTruthy();
    expect(screen.getByText('构建就业岗位要求画像')).toBeTruthy();
    expect(screen.getByText('构建学生就业能力画像')).toBeTruthy();
    expect(screen.getByText('构建学生职业生涯发展报告')).toBeTruthy();
  });

  it('should navigate to the selected feature page', () => {
    render(React.createElement(Welcome));

    const actionButtons = screen.getAllByText('进入功能');
    expect(actionButtons.length).toBeGreaterThan(0);
    fireEvent.click(actionButtons[0]);

    expect(mockedPush).toHaveBeenCalledWith('/job-requirement-profile/overview');
  });

  it('should hide student features for admin users', () => {
    mockedAccess = 'admin';

    render(React.createElement(Welcome));

    expect(screen.getByText('当前角色没有学生端模块权限')).toBeTruthy();
    expect(screen.queryByText('构建就业岗位要求画像')).toBeNull();
  });
});
