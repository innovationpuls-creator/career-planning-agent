import { render, screen } from '@testing-library/react';
import React from 'react';
import AppHeader from './index';

jest.mock('@umijs/max', () => ({
  history: { push: jest.fn(), replace: jest.fn() },
  useLocation: () => ({ pathname: '/home-v2' }),
  useModel: () => ({
    initialState: { currentUser: { name: '测试用户' } },
    setInitialState: jest.fn(),
  }),
  SelectLang: () =>
    require('react').createElement('div', { 'data-testid': 'select-lang' }),
}));

jest.mock('@/services/ant-design-pro/api', () => ({
  outLogin: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/utils/authToken', () => ({
  clearAccessToken: jest.fn(),
}));

const mockMenuData = [
  { name: '职业规划', path: '/home-v2' },
  { name: '简历解构', path: '/student-competency-profile' },
];

describe('AppHeader', () => {
  it('renders all three zones', () => {
    render(React.createElement(AppHeader, { menuData: mockMenuData }));

    // Brand zone
    expect(screen.getByText('大学生职业规划智能体')).toBeTruthy();
    expect(screen.getByText('AI赋能职业成长每一步')).toBeTruthy();

    // Nav zone
    expect(screen.getByText('职业规划')).toBeTruthy();
    expect(screen.getByText('简历解构')).toBeTruthy();

    // Utility zone
    expect(screen.getByText('测试用户')).toBeTruthy();
    expect(screen.getByTestId('select-lang')).toBeTruthy();
  });

  it('renders a header element', () => {
    const { container } = render(
      React.createElement(AppHeader, { menuData: mockMenuData }),
    );
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
  });
});
