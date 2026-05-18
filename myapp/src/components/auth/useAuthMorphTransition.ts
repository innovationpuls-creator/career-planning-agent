import { useCallback, useEffect, useRef, useState } from 'react';
import { getMorphDirection } from './authMotion';
import { AUTH_MORPH } from './constants';
import type {
  AuthExperienceVariant,
  AuthMorphDirection,
  AuthTabKey,
} from './types';

export interface UseAuthMorphTransitionResult {
  isMorphing: boolean;
  direction?: AuthMorphDirection;
  startRouteMorph: (
    target: AuthExperienceVariant,
    navigate: () => void,
  ) => void;
  handleTabChange: (target: AuthTabKey) => void;
}

export function useAuthMorphTransition(
  current: AuthExperienceVariant,
  navigateTarget?: (target: AuthExperienceVariant) => void,
): UseAuthMorphTransitionResult {
  const [isMorphing, setIsMorphing] = useState(false);
  const [direction, setDirection] = useState<AuthMorphDirection>();
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const startRouteMorph = useCallback(
    (target: AuthExperienceVariant, navigate: () => void) => {
      if (target === current || isMorphing) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);

      setIsMorphing(true);
      setDirection(getMorphDirection(target));
      timerRef.current = window.setTimeout(() => {
        setIsMorphing(false);
        navigate();
      }, AUTH_MORPH.durationMs);
    },
    [current, isMorphing],
  );

  const handleTabChange = useCallback(
    (target: AuthTabKey) => {
      startRouteMorph(target, () => {
        navigateTarget?.(target);
      });
    },
    [navigateTarget, startRouteMorph],
  );

  return { isMorphing, direction, startRouteMorph, handleTabChange };
}
