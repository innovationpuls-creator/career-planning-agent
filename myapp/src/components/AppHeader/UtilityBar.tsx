import { DownOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { SelectLang as UmiSelectLang, useModel } from '@umijs/max';
import { Spin } from 'antd';
import React from 'react';
import { AvatarDropdown } from '@/components/RightContent';
import styles from './index.module.less';

const UtilityBar: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const { currentUser } = initialState || {};

  if (!initialState || !currentUser?.name) {
    return (
      <div className={styles.utilityBar}>
        <Spin size="small" />
      </div>
    );
  }

  return (
    <div className={styles.utilityBar}>
      <div className={styles.utilityButton}>
        <UmiSelectLang style={{ fontSize: 14, color: 'inherit' }} />
      </div>

      <button type="button" className={styles.utilityButton}>
        <SettingOutlined />
      </button>

      <div className={styles.utilityDivider} />

      {/* Reuses AvatarDropdown: handles logout via outLogin/clearAccessToken internally */}
      <AvatarDropdown>
        <div className={styles.userEntry}>
          <div className={styles.avatar}>
            <UserOutlined style={{ fontSize: 14 }} />
          </div>
          <span className={styles.userName}>{currentUser.name}</span>
          <DownOutlined className={styles.dropdownArrow} />
        </div>
      </AvatarDropdown>
    </div>
  );
};

export default UtilityBar;
