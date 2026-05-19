import { useCallback, useEffect, useRef, useState } from 'react';
import { getMorphDirection } from './authMotion';
import { AUTH_MORPH } from './constants';
import type { AuthExperienceVariant, AuthMorphDirection } from './types';

export interface UseAuthMorphTransitionResult {
  isMorphing: boolean;
  direction?: AuthMorphDirection;
  targetVariant?: AuthExperienceVariant;
  startMorph: (target: AuthExperienceVariant) => boolean;
}

export function useAuthMorphTransition(
  current: AuthExperienceVariant,
): UseAuthMorphTransitionResult {
  const [isMorphing, setIsMorphing] = useState(false);
  const [direction, setDirection] = useState<AuthMorphDirection>();
  const [targetVariant, setTargetVariant] = useState<AuthExperienceVariant>();
  const timerRef = useRef<number | undefined>(undefined);
  const morphingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const startMorph = useCallback(
    (target: AuthExperienceVariant): boolean => {
      if (target === current || morphingRef.current) return false;
      morphingRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);

      setIsMorphing(true);
      setDirection(getMorphDirection(target));
      setTargetVariant(target);
      timerRef.current = window.setTimeout(() => {
        setIsMorphing(false);
        setDirection(undefined);
        setTargetVariant(undefined);
        morphingRef.current = false;
      }, AUTH_MORPH.durationMs);
      return true;
    },
    [current],
  );

  return {
    isMorphing,
    direction,
    targetVariant,
    startMorph,
  };
}
