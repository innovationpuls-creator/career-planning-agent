import { render, screen } from '@testing-library/react';
import { StatusBar } from '../components/StatusBar';

describe('StatusBar', () => {
  test('renders status text', () => {
    render(<StatusBar text="generating response" />);
    expect(screen.getByText('generating response')).toBeTruthy();
  });

  test('shows time when provided', () => {
    render(<StatusBar text="generating response" time="12s" />);
    expect(screen.getByText('12s')).toBeTruthy();
  });

  test('shows running dot by default', () => {
    const { container } = render(<StatusBar text="generating response" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toBeTruthy();
  });

  test('shows done dot when status is done', () => {
    const { container } = render(<StatusBar text="generating response" status="done" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toBeTruthy();
  });

  test('hides dot when status is none', () => {
    const { container } = render(<StatusBar text="generating response" status="none" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toBeNull();
  });
});
