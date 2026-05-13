export const fadeInUp = {
  initial: { y: 8, opacity: 0 },
  animate: { y: 0, opacity: 1 },
};

export const fadeInLeft = {
  initial: { x: -12, opacity: 0 },
  animate: { x: 0, opacity: 1 },
};

export const fadeInRight = {
  initial: { x: 16, opacity: 0 },
  animate: { x: 0, opacity: 1 },
};

export const slideDown = {
  initial: { y: -24, opacity: 0 },
  animate: { y: 0, opacity: 1 },
};

export const scaleIn = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
};

export const shakeKeyframes = {
  x: [0, -4, 4, -4, 4, 0],
};

export const TRANSITION = {
  fast: { duration: 0.15, ease: 'easeOut' },
  normal: { duration: 0.3, ease: 'easeOut' },
} as const;
