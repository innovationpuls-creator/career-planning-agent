import { PageContainer } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import React from 'react';

const Admin: React.FC = () => {
  const intl = useIntl();
  return (
    <PageContainer
      title={intl.formatMessage({
        id: 'menu.admin',
        defaultMessage: '管理后台',
      })}
    >
      {/* Admin sub-pages will be implemented in subsequent rounds */}
    </PageContainer>
  );
};

export default Admin;
