import type { ProLayoutProps } from '@ant-design/pro-components';

/** 设计 token — 完整定义，支撑全局样式系统 */
const designToken = {
  // === 主色 ===
  colorPrimary: '#1655CC',
  colorPrimaryHover: '#2966D4',
  colorPrimaryActive: '#0F4299',
  colorPrimaryBg: '#EEF3FB',
  colorPrimaryBgHover: '#E0E9F6',

  // === 功能色 ===
  colorSuccess: '#1F8E3D',
  colorSuccessBg: '#EDF7F0',
  colorSuccessBorder: '#A3D4AE',

  colorWarning: '#B07800',
  colorWarningBg: '#FDF6E3',
  colorWarningBorder: '#F0C850',

  colorError: '#C53B37',
  colorErrorBg: '#FDF0EF',
  colorErrorBorder: '#F0A8A5',

  colorInfo: '#1655CC',
  colorInfoBg: '#EEF3FB',
  colorInfoBorder: '#BDD0F0',

  // === 中性色 ===
  colorText: '#1C1C1E',
  colorTextSecondary: '#5C5C5E',
  colorTextTertiary: '#98989D',
  colorTextQuaternary: '#C5C5C8',

  colorBorder: '#E3E3E5',
  colorBorderSecondary: '#EDEDEF',
  colorBgBase: '#FFFFFF',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFFFFF',
  colorBgLayout: '#F5F6F8',
  colorBgSpotlight: '#FAFAFA',

  // === 字号层级 ===
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeLG: 16,
  fontSizeXL: 18,
  fontSizeHeading1: 22,
  fontSizeHeading2: 18,
  fontSizeHeading3: 16,
  fontSizeHeading4: 14,
  fontSizeHeading5: 12,

  // === 字重 ===
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,

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

  // === 圆角 ===
  borderRadius: 6,
  borderRadiusSM: 4,
  borderRadiusLG: 8,
  borderRadiusXS: 2,
  borderRadiusOuter: 4,

  // === 阴影 ===
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  boxShadowSecondary: '0 1px 2px rgba(0, 0, 0, 0.06)',

  // === Auth 页专属渐变 ===
  authLeftGradient:
    'linear-gradient(160deg, #0F2060 0%, #1A3A8F 50%, #0F4299 100%)',

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
  // Selected / active
  menuItemSelectedColor: '#1655CC',
  menuItemSelectedBg: '#EEF3FB',
  // Hover
  menuItemHoverColor: '#1C1C1E',
  menuItemHoverBg: '#FAFAFA',
  // General
  menuItemColor: '#5C5C5E',
  menuBg: '#FFFFFF',
  menuSubMenuItemBg: '#FFFFFF',
  menuDarkItemSelectedColor: '#FFFFFF',
  menuDarkItemSelectedBg: '#1655CC',
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
  colorPrimary: '#1655CC',
  layout: 'top',
  contentWidth: 'Fluid',
  fixedHeader: true,
  fixSiderbar: true,
  splitMenus: false,
  colorWeak: false,
  title: '大学生职业规划智能体',
  pwa: true,
  logo: 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg',
  iconfontUrl: '',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  token: designToken as any,
};

export default settings;
