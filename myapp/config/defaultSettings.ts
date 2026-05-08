import type { ProLayoutProps } from '@ant-design/pro-components';
import { claudeColors, claudeRadius } from '../src/styles/claude-tokens';

/** 设计 token — Claude warm palette */
const designToken = {
  // === 主色 (Terracotta) ===
  colorPrimary: claudeColors.terracotta,
  colorPrimaryHover: claudeColors.primaryHover,
  colorPrimaryActive: claudeColors.primaryActive,
  colorPrimaryBg: claudeColors.primaryBg,
  colorPrimaryBgHover: '#f3e5db',

  // === 功能色 ===
  colorSuccess: claudeColors.success,
  colorSuccessBg: '#eef5ec',
  colorSuccessBorder: '#b8d4b0',

  colorWarning: claudeColors.warning,
  colorWarningBg: '#FDF6E3',
  colorWarningBorder: '#F0C850',

  colorError: claudeColors.error,
  colorErrorBg: '#faeaea',
  colorErrorBorder: '#d9a0a0',

  colorInfo: claudeColors.terracotta,
  colorInfoBg: claudeColors.primaryBg,
  colorInfoBorder: '#e8c8b8',

  // === 中性色 (Claude warm grays) ===
  colorText: claudeColors.nearBlack,
  colorTextSecondary: claudeColors.oliveGray,
  colorTextTertiary: claudeColors.stoneGray,
  colorTextQuaternary: claudeColors.warmSilver,

  colorBorder: claudeColors.borderCream,
  colorBorderSecondary: claudeColors.parchment,
  colorBgBase: '#FFFFFF',
  colorBgContainer: claudeColors.ivory,
  colorBgElevated: claudeColors.ivory,
  colorBgLayout: claudeColors.parchment,
  colorBgSpotlight: claudeColors.parchment,

  // === 字号层级 ===
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeLG: 16,
  fontSizeXL: 20,
  fontSizeHeading1: 24,
  fontSizeHeading2: 20,
  fontSizeHeading3: 16,
  fontSizeHeading4: 14,
  fontSizeHeading5: 12,

  // === 字重 ===
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,
  fontWeightDisplay: 900,

  // === 字体栈 ===
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, sans-serif',
  fontFamilyCode: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontFamilyHeading:
    '"STSongti SC", "SimSun", "Songti SC", "Noto Serif SC", Georgia, serif',

  // === 行高 ===
  lineHeight: 1.6,
  lineHeightSM: 1.5,
  lineHeightLG: 1.8,

  // === 间距 ===
  padding: 16,
  paddingSM: 12,
  paddingLG: 24,
  paddingXS: 8,
  paddingXXS: 4,

  margin: 16,
  marginSM: 12,
  marginLG: 24,
  marginXS: 8,
  marginXXS: 4,

  // === 圆角 (Claude scale) ===
  borderRadius: claudeRadius.md,
  borderRadiusSM: claudeRadius.sm,
  borderRadiusLG: claudeRadius.lg,
  borderRadiusXS: 2,
  borderRadiusOuter: claudeRadius.sm,

  // === 阴影 (Claude warm shadows) ===
  boxShadow: 'rgba(0, 0, 0, 0.05) 0px 4px 24px',
  boxShadowSecondary: '0 1px 2px rgba(0, 0, 0, 0.06)',

  // === Auth 页专属渐变 (Parchment) ===
  authLeftGradient:
    'linear-gradient(160deg, #f5f4ed 0%, #ece9df 50%, #e8e6dc 100%)',

  // === 控制尺寸 ===
  controlHeight: 36,
  controlHeightSM: 28,
  controlHeightLG: 44,

  // === 菜单（Menu）===
  // Horizontal top nav
  menuHorizontalPadding: 16,
  menuItemPaddingInline: 16,
  menuItemBorderRadius: 0,
  menuIconMarginInline: 8,
  menuIconSize: 14,
  // Selected / active (Terracotta)
  menuItemSelectedColor: claudeColors.terracotta,
  menuItemSelectedBg: claudeColors.primaryBg,
  // Hover
  menuItemHoverColor: claudeColors.nearBlack,
  menuItemHoverBg: claudeColors.parchment,
  // General
  menuItemColor: claudeColors.oliveGray,
  menuBg: claudeColors.ivory,
  menuSubMenuItemBg: claudeColors.ivory,
  menuDarkItemSelectedColor: '#FFFFFF',
  menuDarkItemSelectedBg: claudeColors.terracotta,
  menuDarkItemHoverBg: 'rgba(255,255,255,0.1)',
  // Collapsed sider
  menuCollapsedWidth: 80,
  menuCollapsedIconSize: 16,
};

const settings: ProLayoutProps & {
  pwa?: boolean;
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: claudeColors.terracotta,
  layout: 'top',
  contentWidth: 'Fixed',
  fixedHeader: true,
  fixSiderbar: true,
  splitMenus: false,
  colorWeak: false,
  title: '大学生职业规划智能体',
  pwa: true,
  logo: '/images/logo/brand-logo.png',
  iconfontUrl: '',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  token: designToken as any,
};

export default settings;
