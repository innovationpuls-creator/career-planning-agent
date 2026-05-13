import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { ClaudeStatCard } from './index';

describe('ClaudeStatCard', () => {
  const defaultProps = {
    icon: <span data-testid="icon">📊</span>,
    title: 'Total Users',
    value: '1,234',
  };

  it('renders title and value', () => {
    render(<ClaudeStatCard {...defaultProps} />);
    expect(screen.getByText('Total Users')).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy();
  });

  it('renders icon', () => {
    render(<ClaudeStatCard {...defaultProps} />);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('renders unit when provided', () => {
    render(<ClaudeStatCard {...defaultProps} unit="%" />);
    expect(screen.getByText('%')).toBeTruthy();
  });

  it('renders positive trend', () => {
    render(
      <ClaudeStatCard {...defaultProps} trend="positive" trendValue="+12%" />,
    );
    expect(screen.getByText('+12%')).toBeTruthy();
  });

  it('renders negative trend', () => {
    render(
      <ClaudeStatCard {...defaultProps} trend="negative" trendValue="-5%" />,
    );
    expect(screen.getByText('-5%')).toBeTruthy();
  });

  it('forwards className prop', () => {
    render(<ClaudeStatCard {...defaultProps} className="stat-custom" />);
    expect(screen.getByTestId('claude-stat-card').className).toContain(
      'stat-custom',
    );
  });

  it('renders description when provided', () => {
    render(<ClaudeStatCard {...defaultProps} description="vs last month" />);
    expect(screen.getByText('vs last month')).toBeTruthy();
  });
});
