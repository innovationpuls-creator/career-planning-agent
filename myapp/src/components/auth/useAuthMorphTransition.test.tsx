import { act, renderHook } from '@testing-library/react';
import { AUTH_MORPH } from './constants';
import { useAuthMorphTransition } from './useAuthMorphTransition';

describe('useAuthMorphTransition', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns false and does not change isMorphing when target equals current variant', () => {
    const { result } = renderHook(() => useAuthMorphTransition('login'));

    let started: boolean = false;
    act(() => {
      started = result.current.startMorph('login');
    });

    expect(started).toBe(false);
    expect(result.current.isMorphing).toBe(false);
    expect(result.current.direction).toBeUndefined();
  });

  it('starts morph state immediately and clears after duration', () => {
    const { result } = renderHook(() => useAuthMorphTransition('login'));

    let started: boolean = false;
    act(() => {
      started = result.current.startMorph('register');
    });

    expect(started).toBe(true);
    expect(result.current.isMorphing).toBe(true);
    expect(result.current.direction).toBe('to-register');
    expect(result.current.targetVariant).toBe('register');

    act(() => {
      jest.advanceTimersByTime(AUTH_MORPH.durationMs - 1);
    });
    expect(result.current.isMorphing).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isMorphing).toBe(false);
    expect(result.current.direction).toBeUndefined();
    expect(result.current.targetVariant).toBeUndefined();
  });

  it('returns false when a morph is already in progress (sync lock via morphingRef)', () => {
    const { result } = renderHook(() => useAuthMorphTransition('login'));

    act(() => {
      result.current.startMorph('register');
    });

    let secondStarted: boolean = false;
    act(() => {
      secondStarted = result.current.startMorph('register');
    });

    expect(secondStarted).toBe(false);
    expect(result.current.isMorphing).toBe(true);
  });
});
