import { DownOutlined, ExportOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Dropdown } from 'antd';
import React from 'react';

type ExportActionsProps = {
  onExport: (format: 'pdf' | 'docx') => void;
};

const ExportActions: React.FC<ExportActionsProps> = ({ onExport }) => {
  const items: MenuProps['items'] = [
    { key: 'pdf', label: '导出 PDF' },
    { key: 'docx', label: '导出 Word' },
  ];

  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => onExport(key as 'pdf' | 'docx'),
      }}
      trigger={['click']}
    >
      <Button icon={<ExportOutlined />}>
        导出
        <DownOutlined />
      </Button>
    </Dropdown>
  );
};

export default ExportActions;
