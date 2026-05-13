import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { ClaudeTag } from './index';

describe('ClaudeTag', () => {
  it('renders tag text', () => {
    render(<ClaudeTag>Label</ClaudeTag>);
    expect(screen.getByText('Label')).toBeTruthy();
  });

  it('renders as a span element', () => {
    render(<ClaudeTag>Tag</ClaudeTag>);
    expect(screen.getByTestId('claude-tag').tagName).toBe('SPAN');
  });

  it('applies custom className', () => {
    render(<ClaudeTag className="custom">Tag</ClaudeTag>);
    expect(screen.getByTestId('claude-tag').className).toContain('custom');
  });

  it('shows close button when closable is true', () => {
    render(<ClaudeTag closable>Tag</ClaudeTag>);
    expect(screen.getByText('×')).toBeTruthy();
  });

  it('does not show close button by default', () => {
    render(<ClaudeTag>Tag</ClaudeTag>);
    expect(screen.queryByText('×')).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <ClaudeTag closable onClose={onClose}>
        Tag
      </ClaudeTag>,
    );
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
