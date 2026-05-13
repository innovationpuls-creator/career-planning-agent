import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { ClaudeCard } from './index';

describe('ClaudeCard', () => {
  it('renders children content', () => {
    render(<ClaudeCard>Card content</ClaudeCard>);
    expect(screen.getByText('Card content')).toBeTruthy();
  });

  it('renders title when provided', () => {
    render(<ClaudeCard title="Test Title">Content</ClaudeCard>);
    expect(screen.getByText('Test Title')).toBeTruthy();
  });

  it('defaults to flat elevation', () => {
    render(<ClaudeCard>Content</ClaudeCard>);
    expect(
      screen.getByTestId('claude-card').getAttribute('data-elevation'),
    ).toBe('flat');
  });

  it('applies elevated elevation when specified', () => {
    render(<ClaudeCard elevation="elevated">Content</ClaudeCard>);
    expect(
      screen.getByTestId('claude-card').getAttribute('data-elevation'),
    ).toBe('elevated');
  });

  it('applies ring elevation when specified', () => {
    render(<ClaudeCard elevation="ring">Content</ClaudeCard>);
    expect(
      screen.getByTestId('claude-card').getAttribute('data-elevation'),
    ).toBe('ring');
  });

  it('forwards className prop', () => {
    render(<ClaudeCard className="my-class">Content</ClaudeCard>);
    expect(screen.getByTestId('claude-card').className).toContain('my-class');
  });

  it('renders as a div element', () => {
    render(<ClaudeCard>Content</ClaudeCard>);
    expect(screen.getByTestId('claude-card').tagName).toBe('DIV');
  });
});
