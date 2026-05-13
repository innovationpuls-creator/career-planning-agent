import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { ClaudeSelect } from './index';

describe('ClaudeSelect', () => {
  it('renders select element', () => {
    render(
      <ClaudeSelect
        options={[
          { label: 'Option A', value: 'a' },
          { label: 'Option B', value: 'b' },
        ]}
      />,
    );
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('forwards className prop', () => {
    render(<ClaudeSelect className="my-select" />);
    expect(screen.getByTestId('claude-select').className).toContain(
      'my-select',
    );
  });

  it('applies custom style', () => {
    render(<ClaudeSelect style={{ width: 300 }} />);
    expect(screen.getByTestId('claude-select').style.width).toBe('300px');
  });
});
