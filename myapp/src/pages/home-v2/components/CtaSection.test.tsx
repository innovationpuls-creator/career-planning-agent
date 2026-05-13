import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { CtaSection } from './CtaSection';

describe('CtaSection', () => {
  const defaultProps = {
    nextActionLabel: '完成简历解析',
    nextActionDescription: '用最新简历生成 12 维能力画像，为岗位匹配做准备。',
    nextActionButtonText: '去解析简历',
    onAction: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onAction.mockReset();
  });

  it('renders next action label', () => {
    render(<CtaSection {...defaultProps} />);
    expect(screen.getByText('完成简历解析')).toBeTruthy();
  });

  it('renders next action description', () => {
    render(<CtaSection {...defaultProps} />);
    expect(
      screen.getByRole('heading', { name: /用最新简历生成 12 维能力画像/ }),
    ).toBeTruthy();
  });

  it('renders CTA button with correct text', () => {
    render(<CtaSection {...defaultProps} />);
    expect(screen.getByRole('button', { name: /去解析简历/ })).toBeTruthy();
  });

  it('calls onAction when CTA button clicked', () => {
    render(<CtaSection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /去解析简历/ }));
    expect(defaultProps.onAction).toHaveBeenCalledTimes(1);
  });
});
