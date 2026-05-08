/**
 * Claude design system motion tokens.
 * Easing: ease-out-expo for enters, mirrored for exits.
 * Durations and stagger values follow a 4-step scale.
 */
export const motionTokens = {
  easing: {
    default: [0.16, 1, 0.3, 1] as [number, number, number, number],
    enter: [0.16, 1, 0.3, 1] as [number, number, number, number],
    exit: [0.7, 0, 0.3, 1] as [number, number, number, number],
  },
  duration: {
    fast: 0.15,
    normal: 0.3,
    slow: 0.6,
    reveal: 0.8,
  },
  stagger: {
    fast: 0.05,
    normal: 0.1,
    slow: 0.2,
  },
} as const;

/**
 * Returns `true` if the user has enabled `prefers-reduced-motion: reduce`.
 * Returns `false` in SSR or when matchMedia is unavailable.
 */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
