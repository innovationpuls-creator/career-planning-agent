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

  it('renders the three core navigation cards', () => {
    render(React.createElement(Welcome));

    expect(screen.getByText('就业信息知识库')).toBeTruthy();
    expect(screen.getByText('简历解析')).toBeTruthy();
    expect(screen.getByText('构建学生职业生涯发展报告')).toBeTruthy();
  });

  it('navigates to the selected feature page', () => {
    render(React.createElement(Welcome));

    const actionButtons = screen.getAllByText('进入模块');
    expect(actionButtons.length).toBeGreaterThan(0);
    fireEvent.click(actionButtons[1]);

    expect(mockedPush).toHaveBeenCalledWith('/student-competency-profile');
  });

  it('hides student features for admin users', () => {
    mockedAccess = 'admin';

    render(React.createElement(Welcome));

    expect(screen.getByText('当前账号无学生端访问权限')).toBeTruthy();
    expect(screen.queryByText('就业信息知识库')).toBeNull();
  });
});
