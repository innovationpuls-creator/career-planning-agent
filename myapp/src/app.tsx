import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { Button, ConfigProvider, Result, Spin } from 'antd';
import React from 'react';
import AppHeader from '@/components/AppHeader';
import AuroraBackground from '@/components/AuroraBackground';
import AuroraLoader from '@/components/AuroraLoader';
import { PageRouteTransition } from '@/components/ui';
import { currentUser as queryCurrentUser } from '@/services/ant-design-pro/api';
import { serializeRequestParams } from '@/utils/requestParams';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
} from './styles/claude-tokens';
import '@ant-design/v5-patch-for-react-19';

const isDev = process.env.NODE_ENV === 'development';
const loginPath = '/user/login';
const userDefaultPath = '/home-v2';
const publicPaths = [loginPath, '/user/register', '/user/register-result'];

function wrapLayoutFalseRoutes(routes: any[] = []) {
  routes.forEach((route) => {
    if (route.layout === false && route.element) {
      const element = route.element;
      route.element = <PageRouteTransition>{element}</PageRouteTransition>;
    }
    wrapLayoutFalseRoutes(route.children ?? route.routes);
  });
}

export function patchClientRoutes({ routes }: { routes: any[] }) {
  wrapLayoutFalseRoutes(routes);
}

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: API.CurrentUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.CurrentUser | undefined>;
}> {
  const fetchUserInfo = async () => {
    try {
      const msg = await queryCurrentUser({
        skipErrorHandler: true,
      });
      return msg.data;
    } catch (_error) {
      if (!publicPaths.includes(history.location.pathname)) {
        history.push(loginPath);
      }
    }
    return undefined;
  };

  const { location } = history;
  if (!publicPaths.includes(location.pathname)) {
    const currentUser = await fetchUserInfo();
    return {
      fetchUserInfo,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }

  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const { location } = history;
  const shouldShowWatermark = location.pathname.startsWith('/admin');
  const isLoggedIn = !!initialState?.currentUser;
  const isAdmin = initialState?.currentUser?.access === 'admin';
  const isAdminRoute = location.pathname.startsWith('/admin');

  return {
    ...initialState?.settings,
    headerRender: (props) => <AppHeader {...props} />,
    pageHeaderRender: false,
    fixSiderbar: !isAdminRoute,
    siderMenuType: isAdminRoute ? 'group' : 'sub',
    waterMarkProps: shouldShowWatermark
      ? {
          content: initialState?.currentUser?.name,
        }
      : undefined,
    footerRender: false,
    onPageChange: () => {
      if (
        !initialState?.currentUser &&
        !publicPaths.includes(location.pathname)
      ) {
        history.replace(loginPath);
      }
    },
    unAccessible: (
      <Result
        status="403"
        title={isLoggedIn ? '当前角色无权访问' : '需要先登录'}
        subTitle={
          isLoggedIn
            ? '当前页面仅对对应角色开放，请返回你有权限访问的模块。'
            : '当前页面需要登录后访问，系统会自动跳转，你也可以手动前往登录页。'
        }
        extra={
          <Button
            type="primary"
            onClick={() =>
              history.replace(
                isLoggedIn
                  ? isAdmin
                    ? '/admin/job-postings'
                    : userDefaultPath
                  : loginPath,
              )
            }
          >
            {isLoggedIn
              ? isAdmin
                ? '前往管理端'
                : '返回简历解析'
              : '前往登录'}
          </Button>
        }
      />
    ),
    bgLayoutImgList: [],
    links: [],
    childrenRender: (children) => {
      if (initialState?.loading) {
        return <Spin fullscreen tip="正在加载页面..." />;
      }
      return (
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: claudeColors.terracotta,
              colorPrimaryHover: claudeColors.primaryHover,
              colorPrimaryActive: claudeColors.primaryActive,
              colorPrimaryBg: claudeColors.primaryBg,
              colorText: claudeColors.nearBlack,
              colorTextSecondary: claudeColors.oliveGray,
              colorTextTertiary: claudeColors.stoneGray,
              colorBorder: claudeColors.borderCream,
              colorBgLayout: claudeColors.parchment,
              colorBgContainer: claudeColors.ivory,
              colorSuccess: claudeColors.success,
              colorError: claudeColors.error,
              borderRadius: claudeRadius.md,
              fontFamily: claudeFonts.body,
            },
          }}
        >
          <AuroraBackground />
          <AuroraLoader />
          <PageRouteTransition>{children}</PageRouteTransition>
          {isDev && (
            <SettingDrawer
              disableUrlParams
              enableDarkTheme
              settings={initialState?.settings}
              onSettingChange={(settings) => {
                setInitialState((preInitialState) => ({
                  ...preInitialState,
                  settings,
                }));
              }}
            />
          )}
        </ConfigProvider>
      );
    },
    menu: {
      defaultOpenAll: false,
    },
  };
};

export const request: RequestConfig = {
  ...errorConfig,
  paramsSerializer: serializeRequestParams,
};
