import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { ClaudeButton } from './index';

describe('ClaudeButton', () => {
  it('renders children text', () => {
    render(<ClaudeButton>Click me</ClaudeButton>);
    expect(screen.getByRole('button').textContent).toBe('Click me');
  });

  it('defaults to warm-sand variant', () => {
    render(<ClaudeButton>Test</ClaudeButton>);
    expect(screen.getByRole('button').getAttribute('data-variant')).toBe(
      'warm-sand',
    );
  });

  it('applies terracotta variant when specified', () => {
    render(<ClaudeButton variant="terracotta">Test</ClaudeButton>);
    expect(screen.getByRole('button').getAttribute('data-variant')).toBe(
      'terracotta',
    );
  });

  it('applies dark-charcoal variant when specified', () => {
    render(<ClaudeButton variant="dark-charcoal">Test</ClaudeButton>);
    expect(screen.getByRole('button').getAttribute('data-variant')).toBe(
      'dark-charcoal',
    );
  });

  it('applies ghost variant when specified', () => {
    render(<ClaudeButton variant="ghost">Test</ClaudeButton>);
    expect(screen.getByRole('button').getAttribute('data-variant')).toBe(
      'ghost',
    );
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<ClaudeButton onClick={handleClick}>Click</ClaudeButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<ClaudeButton disabled>Disabled</ClaudeButton>);
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });

  it('applies custom className', () => {
    render(<ClaudeButton className="custom-class">Test</ClaudeButton>);
    expect(screen.getByRole('button').className).toContain('custom-class');
  });

  it('renders as a button element', () => {
    render(<ClaudeButton>Test</ClaudeButton>);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });
});
