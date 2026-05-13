import { render, screen } from '@testing-library/react';
import React from 'react';
import { HeroSection } from './HeroSection';

describe('HeroSection', () => {
  const defaultProps = {
    targetJob: '前端开发',
    stage: '初级阶段',
    matchPercent: 86,
    completionPercent: 60,
    nextActionLabel: '完成简历解析',
    nextActionDescription: '用最新简历生成 12 维能力画像。',
    onAction: jest.fn(),
    hasTarget: true,
  };

  beforeEach(() => {
    defaultProps.onAction.mockReset();
  });

  it('renders target job title as heading', () => {
    render(<HeroSection {...defaultProps} />);
    expect(screen.getByRole('heading', { name: '前端开发' })).toBeTruthy();
  });

  it('renders stage badge', () => {
    render(<HeroSection {...defaultProps} />);
    expect(screen.getByText('初级阶段')).toBeTruthy();
  });

  it('renders match percentage', () => {
    render(<HeroSection {...defaultProps} />);
    expect(screen.getByText('86')).toBeTruthy();
  });

  it('renders progress ring with correct percent', () => {
    render(<HeroSection {...defaultProps} />);
    expect(screen.getByText(/60/)).toBeTruthy();
  });

  it('renders "目标岗位" label', () => {
    render(<HeroSection {...defaultProps} />);
    expect(screen.getByText('目标岗位')).toBeTruthy();
  });

  it('renders nextActionDescription', () => {
    render(<HeroSection {...defaultProps} />);
    expect(screen.getByText(/用最新简历生成 12 维能力画像/)).toBeTruthy();
  });

  it('renders "完善资料" when no target', () => {
    render(
      <HeroSection
        {...defaultProps}
        hasTarget={false}
        targetJob="设置目标岗位"
      />,
    );
    expect(screen.getByRole('heading', { name: '设置目标岗位' })).toBeTruthy();
    expect(screen.getByText(/先设置目标岗位/)).toBeTruthy();
  });

  it('calls onAction when CTA button clicked', () => {
    render(<HeroSection {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /完成简历解析|去完成/ });
    btn.click();
    expect(defaultProps.onAction).toHaveBeenCalledTimes(1);
  });
});
