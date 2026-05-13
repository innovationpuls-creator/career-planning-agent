import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { ProgressRing } from './index';

describe('ProgressRing', () => {
  it('renders SVG element', () => {
    render(<ProgressRing percent={75} />);
    expect(screen.getByTestId('progress-ring').tagName).toBe('svg');
  });

  it('renders with default size', () => {
    render(<ProgressRing percent={50} />);
    const svg = screen.getByTestId('progress-ring');
    expect(svg.getAttribute('width')).toBe('120');
  });

  it('renders with custom size', () => {
    render(<ProgressRing percent={50} size={80} />);
    const svg = screen.getByTestId('progress-ring');
    expect(svg.getAttribute('width')).toBe('80');
  });

  it('clamps percent to 0-100 range', () => {
    render(<ProgressRing percent={150} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('clamps negative percent to 0', () => {
    render(<ProgressRing percent={-10} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('displays the percent value as text', () => {
    render(<ProgressRing percent={75} />);
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('renders circles for track and progress', () => {
    const { container } = render(<ProgressRing percent={50} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });
});
