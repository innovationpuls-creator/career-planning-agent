/**
 * Claude design system — color palette, shadows, radius, and font stacks.
 * All values originate from the design spec at
 * docs/superpowers/specs/2026-05-01-frontend-redesign-design.md §4.
 */

// ── Color palette ──────────────────────────────────────────────

export const claudeColors = {
  // Surface
  parchment: '#f5f4ed',
  ivory: '#faf9f5',

  // Primary
  terracotta: '#c96442',
  primaryHover: '#d97757',
  primaryActive: '#b05535',
  primaryBg: '#faf0eb',

  // Text
  nearBlack: '#141413',
  oliveGray: '#5e5d59',
  stoneGray: '#87867f',

  // Borders
  borderCream: '#f0eee6',
  borderWarm: '#e8e6dc',
  borderDark: '#30302e',

  // Surfaces
  warmSand: '#e8e6dc',
  charcoalWarm: '#4d4c48',
  darkSurface: '#30302e',
  warmSilver: '#b0aea5',

  // Rings
  ringWarm: '#d1cfc5',
  ringSubtle: '#dedc01', // accent highlight — intentionally vivid per design spec §4.1
  ringDeep: '#c2c0b6',

  // Functional
  success: '#4a7c3f',
  error: '#b53333',
  warning: '#B07800',

  // Functional text (for dark surfaces)
  errorText: '#f5a3a3',
  successText: '#a3d49a',
} as const;

// ── Alpha helper ───────────────────────────────────────────────

export const claudeAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ── Shadow system ──────────────────────────────────────────────

export const claudeShadows = {
  flat: 'none',
  contained: `1px solid ${claudeColors.borderCream}`,
  ring: `0px 0px 0px 1px ${claudeColors.ringWarm}`,
  whisper: 'rgba(0, 0, 0, 0.05) 0px 4px 24px',
  inset: 'inset 0px 0px 0px 1px rgba(0, 0, 0, 0.15)',
} as const;

// ── Radius system ──────────────────────────────────────────────

export const claudeRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 32,
} as const;

// ── Font stacks ────────────────────────────────────────────────

export const claudeFonts = {
  heading:
    '"STSongti SC", "SimSun", "Songti SC", "Noto Serif SC", Georgia, serif',
  body: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, sans-serif',
} as const;

// ── Glass surface presets ─────────────────────────────────────

export const claudeGlass = {
  // Surface fills
  dark: '#141413',
  mid: 'rgba(48, 48, 46, 0.35)',
  light: 'rgba(255, 255, 255, 0.22)',
  ghost: 'rgba(255, 255, 255, 0.12)',
  terracotta: 'rgba(201, 100, 66, 0.10)',
  input: 'rgba(255, 255, 255, 0.20)',
  bubbleAI: 'rgba(250, 249, 245, 0.45)',
  bubbleUser: 'rgba(201, 100, 66, 0.08)',
  skillPanel: 'rgba(250, 249, 245, 0.80)',
  cli: 'rgba(245, 240, 232, 0.55)',
  errorBg: 'rgba(181, 51, 51, 0.15)',
  // Borders
  borderDark: 'rgba(255, 255, 255, 0.18)',
  borderLight: 'rgba(255, 255, 255, 0.45)',
  borderGhost: 'rgba(255, 255, 255, 0.25)',
  borderInput: 'rgba(255, 255, 255, 0.40)',
  borderTerracotta: 'rgba(201, 100, 66, 0.20)',
  borderCLI: 'rgba(200, 185, 160, 0.30)',
  borderError: 'rgba(181, 51, 51, 0.30)',
  // Blur levels
  blurHeavy: 'blur(28px)',
  blurMedium: 'blur(24px)',
  blurLight: 'blur(16px)',
  blurSubtle: 'blur(12px)',
  blurMicro: 'blur(8px)',
  // Saturation boost for light glass
  saturate: 'saturate(140%)',
  // Inner glow
  innerGlow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2)',
  // Button glow
  btnGlow: '0 4px 16px rgba(201, 100, 66, 0.35)',
} as const;

// ── Glass surface helpers ─────────────────────────────────────

export const glassSurface = (
  fill: string,
  blur: string,
  border: string,
  extra?: string,
): string =>
  [
    `background: ${fill}`,
    `backdrop-filter: ${blur}`,
    `-webkit-backdrop-filter: ${blur}`,
    `border: 1px solid ${border}`,
    extra,
  ]
    .filter(Boolean)
    .join(';');

// ── Combined export ────────────────────────────────────────────

export const claudeTokens = {
  colors: claudeColors,
  shadows: claudeShadows,
  radius: claudeRadius,
  fonts: claudeFonts,
  glass: claudeGlass,
} as const;
