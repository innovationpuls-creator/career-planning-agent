import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { Button, Result, Spin } from 'antd';
import React from 'react';
import { AvatarDropdown, AvatarName, SelectLang } from '@/components';
import { currentUser as queryCurrentUser } from '@/services/ant-design-pro/api';
import { serializeRequestParams } from '@/utils/requestParams';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';
import '@ant-design/v5-patch-for-react-19';

const isDev = process.env.NODE_ENV === 'development';
const loginPath = '/user/login';
const userDefaultPath = '/home-v2';
const publicPaths = [loginPath, '/user/register', '/user/register-result'];

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

  return {
    actionsRender: () => [<SelectLang key="SelectLang" />],
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: <AvatarName />,
      render: (_, avatarChildren) => {
        return <AvatarDropdown>{avatarChildren}</AvatarDropdown>;
      },
    },
    waterMarkProps: shouldShowWatermark
      ? {
          content: initialState?.currentUser?.name,
        }
      : undefined,
    footerRender: false,
    onPageChange: () => {
      if (!initialState?.currentUser && !publicPaths.includes(location.pathname)) {
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
                isLoggedIn ? (isAdmin ? '/admin/job-postings' : userDefaultPath) : loginPath,
              )
            }
          >
            {isLoggedIn ? (isAdmin ? '前往管理端' : '返回简历解析') : '前往登录'}
          </Button>
        }
      />
    ),
    bgLayoutImgList: shouldShowWatermark
      ? undefined
      : [
          {
            src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/D2LWSqNny4sAAAAAAAAAAAAAFl94AQBr',
            left: 85,
            bottom: 100,
            height: '303px',
          },
          {
            src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/C2TWRpJpiC0AAAAAAAAAAAAAFl94AQBr',
            bottom: -68,
            right: -45,
            height: '303px',
          },
          {
            src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/F6vSTbj8KpYAAAAAAAAAAAAAFl94AQBr',
            bottom: 0,
            left: 0,
            width: '331px',
          },
        ],
    links: [],
    menuHeaderRender: undefined,
    childrenRender: (children) => {
      if (initialState?.loading) {
        return <Spin fullscreen tip="正在加载页面..." />;
      }
      return (
        <>
          {children}
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
        </>
      );
    },
    menu: {
      defaultOpenAll: false,
    },
    ...initialState?.settings,
  };
};

export const request: RequestConfig = {
  ...errorConfig,
  paramsSerializer: serializeRequestParams,
};
