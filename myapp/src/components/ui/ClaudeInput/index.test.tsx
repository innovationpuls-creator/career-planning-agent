import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { ClaudeInput, ClaudePassword, ClaudeTextArea } from './index';

describe('ClaudeInput', () => {
  it('renders input element', () => {
    render(<ClaudeInput placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('forwards className prop', () => {
    render(<ClaudeInput className="my-input" />);
    expect(screen.getByRole('textbox').className).toContain('my-input');
  });

  it('handles value changes', () => {
    const handleChange = jest.fn();
    render(<ClaudeInput onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'hello' },
    });
    expect(handleChange).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<ClaudeInput disabled />);
    expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(true);
  });
});

describe('ClaudeTextArea', () => {
  it('renders textarea element', () => {
    render(<ClaudeTextArea placeholder="Enter description" />);
    expect(screen.getByPlaceholderText('Enter description')).toBeTruthy();
  });
});

describe('ClaudePassword', () => {
  it('renders password input', () => {
    render(<ClaudePassword placeholder="Enter password" />);
    expect(screen.getByPlaceholderText('Enter password')).toBeTruthy();
  });
});
