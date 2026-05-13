import { render, screen } from '@testing-library/react';
import React from 'react';
import { QuickStats } from './QuickStats';

describe('QuickStats', () => {
  const defaultProps = {
    progress: 60,
    salary: '8K-15K',
    matchedJobs: 12,
  };

  it('renders progress percent', () => {
    render(<QuickStats {...defaultProps} />);
    expect(screen.getByText(/规划进度/)).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
  });

  it('renders salary reference', () => {
    render(<QuickStats {...defaultProps} />);
    expect(screen.getByText(/薪资参考/)).toBeTruthy();
    expect(screen.getByText(/8K-15K/)).toBeTruthy();
  });

  it('renders matched jobs count', () => {
    render(<QuickStats {...defaultProps} />);
    expect(screen.getByText(/已匹配岗位/)).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('renders percent suffix', () => {
    render(<QuickStats {...defaultProps} />);
    expect(screen.getByText('%')).toBeTruthy();
  });
});
