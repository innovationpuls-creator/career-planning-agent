import { act, renderHook } from '@testing-library/react';
import { AUTH_CONSOLE, LOGIN_TOOL_LOG_ITEMS } from './';
import type { AuthToolLogLine } from './types';
import { useAuthToolLog } from './useAuthToolLog';

describe('useAuthToolLog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('starts with seeded coach tool rows', () => {
    const { result } = renderHook(() => useAuthToolLog(LOGIN_TOOL_LOG_ITEMS));

    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current[0].toolName).toBe(LOGIN_TOOL_LOG_ITEMS[0].toolName);
    expect(result.current[0].displayName).toBe(
      LOGIN_TOOL_LOG_ITEMS[0].displayName,
    );
  });

  it('appends a mixed coach tool row every 2200ms', () => {
    const { result } = renderHook(() => useAuthToolLog(LOGIN_TOOL_LOG_ITEMS));
    const initialCount = result.current.length;

    act(() => {
      jest.advanceTimersByTime(AUTH_CONSOLE.intervalMs - 1);
    });
    expect(result.current).toHaveLength(initialCount);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    const latestLine = result.current[result.current.length - 1];
    expect(result.current).toHaveLength(initialCount + 1);
    expect(latestLine.toolName).toBeTruthy();
    expect(latestLine.displayName).toBeTruthy();
    expect(latestLine.agent).toBeTruthy();
  });

  it('marks older rows stale and removes them after fade when max visible rows is exceeded', () => {
    const { result } = renderHook(() => useAuthToolLog(LOGIN_TOOL_LOG_ITEMS));

    act(() => {
      jest.advanceTimersByTime(AUTH_CONSOLE.intervalMs * 10);
    });

    const staleLine = result.current.find(
      (line: AuthToolLogLine) => line.stale,
    );
    expect(staleLine).toBeTruthy();
    expect(result.current.length).toBeLessThanOrEqual(AUTH_CONSOLE.maxRows);

    act(() => {
      jest.advanceTimersByTime(AUTH_CONSOLE.fadeOutMs);
    });

    if (staleLine) {
      expect(
        result.current.some(
          (line: AuthToolLogLine) => line.id === staleLine.id,
        ),
      ).toBe(false);
    }
  });
});
