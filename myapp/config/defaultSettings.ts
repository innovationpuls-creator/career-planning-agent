import type { ProLayoutProps } from '@ant-design/pro-components';

const settings: ProLayoutProps & {
  pwa?: boolean;
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: '#1890ff',
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
  token: {},
};

export default settings;
