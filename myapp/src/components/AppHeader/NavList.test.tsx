import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import NavList from './NavList';

const mockedHistoryPush = jest.fn();

jest.mock('@umijs/max', () => ({
  history: {
    push: (...args: unknown[]) => mockedHistoryPush(...args),
  },
  useLocation: () => ({ pathname: '/home-v2' }),
}));

const mockMenuData = [
  { name: '职业规划', path: '/home-v2' },
  { name: '简历解构', path: '/student-competency-profile' },
  { name: '蜗牛学习路径', path: '/snail-learning-path' },
];

const mockAdminMenuData = [
  {
    name: 'admin',
    path: '/admin',
    children: [
      { path: '/admin', redirect: '/admin/job-postings' },
      { name: 'profile', path: '/admin/profile', hideInMenu: true },
      { name: 'user-management', path: '/admin/user-management' },
      { name: 'job-postings', path: '/admin/job-postings' },
      {
        name: 'job-requirement-comparisons',
        path: '/admin/job-requirement-comparisons',
      },
      { path: '/admin/upload-data', redirect: '/admin/job-postings' },
      { name: 'major-distribution', path: '/admin/major-distribution' },
      { name: 'competency-analysis', path: '/admin/competency-analysis' },
      { name: 'employment-trends', path: '/admin/employment-trends' },
    ],
  },
];

describe('NavList', () => {
  beforeEach(() => {
    mockedHistoryPush.mockReset();
  });

  it('renders all visible menu items', () => {
    render(React.createElement(NavList, { menuData: mockMenuData }));
    expect(screen.getByText('职业规划')).toBeTruthy();
    expect(screen.getByText('简历解构')).toBeTruthy();
    expect(screen.getByText('蜗牛学习路径')).toBeTruthy();
  });

  it('filters out items without name or path', () => {
    const data = [
      ...mockMenuData,
      { name: undefined, path: '/hidden' },
      { name: 'NoPath', path: undefined },
    ];
    render(React.createElement(NavList, { menuData: data }));
    expect(screen.queryByText('NoPath')).toBeNull();
  });

  it('filters out items with hideInMenu', () => {
    const data = [
      ...mockMenuData,
      { name: 'Hidden', path: '/hidden', hideInMenu: true },
    ];
    render(React.createElement(NavList, { menuData: data }));
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('flattens admin child routes into header tabs', () => {
    render(React.createElement(NavList, { menuData: mockAdminMenuData }));

    expect(screen.getByText('个人信息')).toBeTruthy();
    expect(screen.getByText('用户管理')).toBeTruthy();
    expect(screen.getByText('岗位知识库')).toBeTruthy();
    expect(screen.getByText('岗位要求对比')).toBeTruthy();
    expect(screen.getByText('就读专业分布')).toBeTruthy();
    expect(screen.getByText('能力评估分析')).toBeTruthy();
    expect(screen.getByText('就业趋势洞察')).toBeTruthy();
    expect(screen.queryByText('admin')).toBeNull();
  });

  it('marks the matching item as active', () => {
    render(React.createElement(NavList, { menuData: mockMenuData }));
    const activeBtn = screen.getByText('职业规划').closest('button');
    expect(activeBtn?.className).toContain('navItemActive');
  });

  it('does not mark non-matching items as active', () => {
    render(React.createElement(NavList, { menuData: mockMenuData }));
    const inactiveBtn = screen.getByText('简历解构').closest('button');
    expect(inactiveBtn?.className).not.toContain('navItemActive');
  });

  it('navigates on click', () => {
    render(React.createElement(NavList, { menuData: mockMenuData }));
    fireEvent.click(screen.getByText('简历解构'));
    expect(mockedHistoryPush).toHaveBeenCalledWith(
      '/student-competency-profile',
    );
  });
});
