import { AUTH_MORPH } from './constants';
import type { AuthExperienceVariant, AuthMorphDirection } from './types';

export const authMorphTransition = {
  duration: AUTH_MORPH.durationMs / 1000,
  ease: AUTH_MORPH.easing,
} as const;

export const authContentTransition = {
  duration: 0.28,
  ease: AUTH_MORPH.easing,
} as const;

export const authMorphVariants = {
  login: {
    width: 400,
    scale: 1,
  },
  register: {
    width: 520,
    scale: 1,
  },
} as const;

export function getMorphDirection(
  target: AuthExperienceVariant,
): AuthMorphDirection {
  return target === 'login' ? 'to-login' : 'to-register';
}
