import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Space, Tag, Typography } from 'antd';
import React from 'react';
import ExportActions from './ExportActions';

const { Text, Title } = Typography;

type ReportHeaderActionsProps = {
  updatedAtText: string;
  completedCount: number;
  totalCount: number;
  dirty?: boolean;
  saving?: boolean;
  regenerating?: boolean;
  onSave: () => void;
  onExport: (format: 'pdf' | 'docx') => void;
  onRegenerate: () => void;
};

const ReportHeaderActions: React.FC<ReportHeaderActionsProps> = ({
  updatedAtText,
  completedCount,
  totalCount,
  dirty,
  saving,
  regenerating,
  onSave,
  onExport,
  onRegenerate,
}) => (
  <div>
    <Space
      align="start"
      style={{ width: '100%', justifyContent: 'space-between' }}
      wrap
    >
      <div>
        <Title
          level={3}
          style={{
            marginBottom: 8,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.04em',
          }}
        >
          个人职业成长报告
        </Title>
        <Space wrap size={8}>
          <Text type="secondary">最近更新时间：{updatedAtText}</Text>
          <Text type="secondary">
            已完成模块：{completedCount}/{totalCount}
          </Text>
          {dirty ? <Tag color="warning">有未保存修改</Tag> : null}
        </Space>
      </div>
      <Space wrap>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={onSave}
          loading={saving}
        >
          保存
        </Button>
        <ExportActions onExport={onExport} />
        <Button
          icon={<ReloadOutlined />}
          onClick={onRegenerate}
          loading={regenerating}
        >
          重新生成初稿
        </Button>
      </Space>
    </Space>
  </div>
);

export default ReportHeaderActions;
