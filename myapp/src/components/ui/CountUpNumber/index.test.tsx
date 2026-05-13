import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { CountUpNumber } from './index';

describe('CountUpNumber', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    rafId = 0;
    jest.useFakeTimers();
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        const id = ++rafId;
        rafCallbacks.set(id, cb);
        // Schedule callback to fire on next timer tick
        setTimeout(() => cb(performance.now() + 2000), 0);
        return id;
      });
    jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id: number) => {
        rafCallbacks.delete(id);
      });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the target number', () => {
    render(<CountUpNumber target={42} />);
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders prefix when provided', () => {
    render(<CountUpNumber target={100} prefix="$" />);
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByText('$')).toBeTruthy();
  });

  it('renders suffix when provided', () => {
    render(<CountUpNumber target={75} suffix="%" />);
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByText('%')).toBeTruthy();
  });

  it('renders zero target', () => {
    render(<CountUpNumber target={0} />);
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders large numbers with comma formatting', () => {
    render(<CountUpNumber target={10000} />);
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByText('10,000')).toBeTruthy();
  });

  it('applies custom className', () => {
    render(<CountUpNumber target={50} className="count-custom" />);
    expect(screen.getByTestId('count-up-number').className).toContain(
      'count-custom',
    );
  });
});
