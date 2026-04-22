import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { Button, Result, Spin } from 'antd';
import React from 'react';
import { AvatarDropdown, AvatarName } from '@/components';
import defaultSettings from '../../config/defaultSettings';

const isDev = process.env.NODE_ENV === 'development';
const loginPath = '/user/login';
const userDefaultPath = '/home-v2';
const publicPaths = [loginPath, '/user/register', '/user/register-result'];

export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const { location } = history;
  const isLoggedIn = !!initialState?.currentUser;
  const isAdmin = initialState?.currentUser?.access === 'admin';

  return {
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg',
    title: '大学生职业规划智能体',
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: <AvatarName />,
      render: (_, avatarChildren) => {
        return <AvatarDropdown menu>{avatarChildren}</AvatarDropdown>;
      },
    },
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
    links: [],
    menuHeaderRender: undefined,
    bgLayoutImgList: [],
    childrenRender: (children) => {
      if (initialState?.loading) {
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
            }}
          >
            <Spin size="large" tip="正在加载页面..." />
          </div>
        );
      }
      return (
        <>
          {children}
          {isDev && (
            <SettingDrawer
              disableUrlParams
              enableDarkTheme
              settings={initialState?.settings}
              onSettingChange={(settings: Partial<LayoutSettings>) => {
                setInitialState((pre) => ({
                  ...pre,
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
