import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { PipelineSteps } from './PipelineSteps';

const MOCK_STEPS: API.HomeV2ProgressStep[] = [
  {
    key: 'profile',
    label: '完善资料',
    status: 'done',
    description: '已完善',
    href: '/',
  },
  {
    key: 'analysis',
    label: '简历解析',
    status: 'current',
    description: '完成 12 维能力画像。',
    href: '/student-competency-profile',
  },
  {
    key: 'favorite',
    label: '职业匹配',
    status: 'todo',
    description: '待开始',
    href: '/student-competency-profile',
  },
  {
    key: 'learning_path',
    label: '蜗牛学习路径',
    status: 'todo',
    description: '待开始',
    href: '/snail-learning-path',
  },
  {
    key: 'growth_report',
    label: '成长报告',
    status: 'todo',
    description: '待开始',
    href: '/personal-growth-report',
  },
];

describe('PipelineSteps', () => {
  const defaultProps = {
    steps: MOCK_STEPS,
    completedCount: 1,
    nextActionLabel: '去解析简历',
    onStepClick: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onStepClick.mockReset();
  });

  it('renders all 5 step labels', () => {
    render(<PipelineSteps {...defaultProps} />);
    expect(screen.getByText('完善资料')).toBeTruthy();
    expect(screen.getByText('简历解析')).toBeTruthy();
    expect(screen.getByText('职业匹配')).toBeTruthy();
    expect(screen.getByText('蜗牛学习路径')).toBeTruthy();
    expect(screen.getByText('成长报告')).toBeTruthy();
  });

  it('renders completed count in header', () => {
    render(<PipelineSteps {...defaultProps} />);
    expect(screen.getByText(/已完成 1\/5 步/)).toBeTruthy();
  });

  it('shows "已完成" for done steps', () => {
    render(<PipelineSteps {...defaultProps} />);
    expect(screen.getByText('已完成')).toBeTruthy();
  });

  it('shows action button for current step', () => {
    render(<PipelineSteps {...defaultProps} />);
    expect(screen.getByRole('button', { name: /去解析简历/ })).toBeTruthy();
  });

  it('shows "待开始" for todo steps', () => {
    render(<PipelineSteps {...defaultProps} />);
    expect(screen.getAllByText('待开始').length).toBeGreaterThanOrEqual(3);
  });

  it('calls onStepClick when current step button clicked', () => {
    render(<PipelineSteps {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /去解析简历/ }));
    expect(defaultProps.onStepClick).toHaveBeenCalledWith(
      '/student-competency-profile',
    );
  });

  it('renders section heading', () => {
    render(<PipelineSteps {...defaultProps} />);
    expect(screen.getByText('职业规划进度')).toBeTruthy();
  });
});
