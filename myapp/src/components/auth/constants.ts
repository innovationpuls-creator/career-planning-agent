import { claudeAlpha, claudeColors } from '@/styles/claude-tokens';

export const AUTH_LAYOUT = {
  desktopLeftPercent: 55,
  desktopRightPercent: 45,
  mobileBreakpoint: 920,
} as const;

export const AUTH_RADIUS = {
  shell: 18,
  glassCard: 32,
  control: 14,
  terminal: 12,
} as const;

export const AUTH_CONSOLE = {
  intervalMs: 2200,
  initialRows: 5,
  maxRows: 8,
  visibleFreshRows: 4,
  fadeOutMs: 500,
} as const;

export const AUTH_MORPH = {
  durationMs: 500,
  easing: [0.55, 0, 0.45, 1] as [number, number, number, number],
  settleDurationMs: 180,
} as const;

export const AUTH_ART_COPY = {
  login: {
    tag: '「 归 序 」',
    title: '将旷野，收敛为轨道。',
    subtitle: '认知推演与未来重塑  |  大学生职业规划智能体',
  },
  register: {
    tag: '「 构 筑 」',
    title: '予 灵 魂，\n以 算 法 的 脉 络 。',
    subtitle: '从 模 糊 的 志 向 ， 提 炼 精 确 的 座 标 。',
  },
} as const;

export const AUTH_SURFACE_COLORS = {
  terminal: claudeColors.nearBlack,
  terminalSoft: claudeColors.darkSurface,
  terminalGrid: claudeAlpha(claudeColors.ivory, 0.07),
  terminalArt: claudeAlpha(claudeColors.ivory, 0.85),
  terminalSubtitle: claudeAlpha(claudeColors.warmSilver, 0.7),
  consoleText: claudeAlpha(claudeColors.ivory, 0.36),
  consoleHotText: claudeAlpha(claudeColors.ivory, 0.62),
  consoleSuccess: claudeColors.success,
  paperWhite: claudeColors.ivory,
  warmPaper: claudeColors.parchment,
  terracotta: claudeColors.terracotta,
  warmGold: claudeAlpha(claudeColors.warning, 0.28),
  subtleGreen: claudeAlpha(claudeColors.success, 0.18),
  glassFill: claudeAlpha(claudeColors.ivory, 0.42),
  glassBorder: claudeAlpha(claudeColors.ivory, 0.72),
  glassHighlight: claudeAlpha(claudeColors.ivory, 0.9),
  spotlightCore: claudeAlpha(claudeColors.ivory, 0.58),
  spotlightSoft: claudeAlpha(claudeColors.ivory, 0.22),
  clear: claudeAlpha(claudeColors.ivory, 0),
  macClose: '#ff5f56',
  macMinimize: '#ffbd2e',
  macMaximize: '#27c93f',
} as const;
