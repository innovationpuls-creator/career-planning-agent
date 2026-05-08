import React from 'react';
import styles from './index.module.less';

const LOGO_URL = '/images/logo/brand-logo.png';

const BrandArea: React.FC = () => {
  return (
    <div className={styles.brand}>
      <img src={LOGO_URL} alt="Career Planning" className={styles.logo} />
      <div className={styles.brandText}>
        <span className={styles.brandTitle}>大学生职业规划智能体</span>
        <span className={styles.brandSubtitle}>AI赋能职业成长每一步</span>
      </div>
    </div>
  );
};

export default BrandArea;
