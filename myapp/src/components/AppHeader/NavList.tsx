import { MenuUnfoldOutlined } from '@ant-design/icons';
import type { MenuDataItem } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Drawer } from 'antd';
import React, { useEffect, useState } from 'react';
import styles from './index.module.less';

const MOBILE_BREAKPOINT = 768;

interface NavListProps {
  menuData: MenuDataItem[];
}

type HeaderMenuItem = MenuDataItem & {
  children?: MenuDataItem[];
  routes?: MenuDataItem[];
};

const ADMIN_NAV_PATHS = [
  '/admin/profile',
  '/admin/user-management',
  '/admin/job-postings',
  '/admin/job-requirement-comparisons',
  '/admin/major-distribution',
  '/admin/competency-analysis',
  '/admin/employment-trends',
];

const ADMIN_NAV_LABELS: Record<string, string> = {
  '/admin/profile': '个人信息',
  '/admin/user-management': '用户管理',
  '/admin/job-postings': '岗位知识库',
  '/admin/job-requirement-comparisons': '岗位要求对比',
  '/admin/major-distribution': '就读专业分布',
  '/admin/competency-analysis': '能力评估分析',
  '/admin/employment-trends': '就业趋势洞察',
};

const getChildMenuItems = (item: HeaderMenuItem) =>
  item.children ?? item.routes ?? [];

const getVisibleHeaderItems = (menuData: MenuDataItem[]) =>
  menuData.flatMap((item) => {
    const menuItem = item as HeaderMenuItem;

    if (menuItem.path === '/admin') {
      const adminItemsByPath = new Map(
        getChildMenuItems(menuItem)
          .filter((child) => child.name && child.path)
          .map((child) => [child.path, child]),
      );

      return ADMIN_NAV_PATHS.map((path) => adminItemsByPath.get(path)).filter(
        (child): child is MenuDataItem => Boolean(child),
      );
    }

    if (!item.name || !item.path || item.hideInMenu) return [];
    return [item];
  });

const getItemLabel = (item: MenuDataItem) =>
  item.path ? (ADMIN_NAV_LABELS[item.path] ?? item.name) : item.name;

const NavList: React.FC<NavListProps> = ({ menuData }) => {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

  const visibleItems = getVisibleHeaderItems(menuData);

  // "/" requires exact match; sub-routes match path or any descendant
  const isActive = (itemPath: string) => {
    if (!itemPath) return false;
    if (itemPath === '/') return pathname === '/';
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  };

  const handleClick = (path: string) => {
    history.push(path);
    setMobileOpen(false);
  };

  const navContent = (
    <>
      {visibleItems.map((item) => {
        const itemPath = item.path;
        if (!itemPath) return null;

        const active = isActive(itemPath);
        const label = getItemLabel(item);
        return (
          <button
            key={itemPath}
            type="button"
            className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
            onClick={() => handleClick(itemPath)}
          >
            {item.icon}
            <span>{label}</span>
          </button>
        );
      })}
    </>
  );

  // Mobile: hamburger + drawer
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          className={styles.hamburger}
          onClick={() => setMobileOpen(true)}
          aria-label="打开菜单"
        >
          <MenuUnfoldOutlined />
        </button>
        <Drawer
          title={<span className={styles.drawerTitle}>导航菜单</span>}
          placement="top"
          onClose={() => setMobileOpen(false)}
          open={mobileOpen}
          height="auto"
          styles={{ body: { padding: '8px 0' } }}
        >
          <nav className={styles.mobileNavList}>
            {visibleItems.map((item) => {
              const itemPath = item.path;
              if (!itemPath) return null;

              const active = isActive(itemPath);
              const label = getItemLabel(item);
              return (
                <button
                  key={itemPath}
                  type="button"
                  className={`${styles.mobileNavItem} ${active ? styles.mobileNavItemActive : ''}`}
                  onClick={() => handleClick(itemPath)}
                >
                  {item.icon}
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </Drawer>
      </>
    );
  }

  return <nav className={styles.navList}>{navContent}</nav>;
};

export default NavList;
