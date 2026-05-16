import { keyframes } from 'antd-style';
import { motionTokens } from '@/styles/motion';

// ── Spring configs ─────────────────────────────────────────────

export const springGentle = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 24,
  mass: 0.8,
};

export const springSnappy = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
  mass: 1,
};

// ── Transition presets aligned with global tokens ──────────────

export const TRANSITION = {
  fast: { duration: motionTokens.duration.fast, ease: motionTokens.easing.enter },
  normal: { duration: motionTokens.duration.normal, ease: motionTokens.easing.enter },
  slow: { duration: motionTokens.duration.slow, ease: motionTokens.easing.enter },
} as const;

// ── Enter variants ─────────────────────────────────────────────

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

export const expandIn = {
  initial: { scaleY: 0.95, opacity: 0 },
  animate: { scaleY: 1, opacity: 1 },
  exit: { scaleY: 0.95, opacity: 0 },
};

// ── Interactive variants ───────────────────────────────────────

export const hoverLift = {
  y: -2,
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  transition: springGentle,
};

export const tapScale = {
  scale: 0.97,
  transition: springSnappy,
};

// ── Shake ──────────────────────────────────────────────────────

export const shakeKeyframes = {
  x: [0, -4, 4, -4, 4, 0],
};

// ── Orb float animations (CSS @keyframes) ──────────────────────

export const orbFloat1 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); border-radius: 48% 52% 58% 42%; }
  33% { transform: translate(20px, -30px) scale(1.05); border-radius: 55% 45% 40% 60%; }
  66% { transform: translate(-15px, 20px) scale(0.97); border-radius: 42% 58% 50% 50%; }
`;

export const orbFloat2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); border-radius: 52% 48% 44% 56%; }
  33% { transform: translate(-18px, 25px) scale(1.04); border-radius: 40% 60% 55% 45%; }
  66% { transform: translate(14px, -22px) scale(0.96); border-radius: 50% 50% 48% 52%; }
`;
