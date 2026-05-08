import type { ProLayoutProps } from '@ant-design/pro-components';
import React from 'react';
import BrandArea from './BrandArea';
import styles from './index.module.less';
import NavList from './NavList';
import UtilityBar from './UtilityBar';

const AppHeader: React.FC<ProLayoutProps> = (props) => {
  const { menuData = [] } = props;

  return (
    <header className={styles.appHeader}>
      <BrandArea />
      <NavList menuData={menuData} />
      <UtilityBar />
    </header>
  );
};

export default AppHeader;
