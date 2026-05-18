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

  it('delays navigation until the morph duration completes', () => {
    const navigate = jest.fn();
    const { result } = renderHook(() => useAuthMorphTransition('login'));

    act(() => {
      result.current.startRouteMorph('register', navigate);
    });

    expect(result.current.isMorphing).toBe(true);
    expect(result.current.direction).toBe('to-register');
    expect(navigate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(AUTH_MORPH.durationMs - 1);
    });
    expect(navigate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('does not navigate or morph when target is the current variant', () => {
    const navigate = jest.fn();
    const { result } = renderHook(() => useAuthMorphTransition('login'));

    act(() => {
      result.current.startRouteMorph('login', navigate);
    });

    expect(result.current.isMorphing).toBe(false);
    expect(result.current.direction).toBeUndefined();

    act(() => {
      jest.advanceTimersByTime(AUTH_MORPH.durationMs);
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
