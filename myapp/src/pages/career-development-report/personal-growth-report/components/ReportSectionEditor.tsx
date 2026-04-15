import { Button, Input, Space, Tag } from 'antd';
import React from 'react';

const { TextArea } = Input;

type ReportSectionEditorProps = {
  dirty?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  children?: React.ReactNode;
};

const ReportSectionEditor: React.FC<ReportSectionEditorProps> = ({
  dirty,
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
  children,
}) => (
  <Space direction="vertical" size={16} style={{ width: '100%' }}>
    {children || (
      <TextArea
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        autoSize={{ minRows: 5, maxRows: 12 }}
        placeholder={placeholder}
      />
    )}
    <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
      <Space>{dirty ? <Tag color="warning">未保存修改</Tag> : null}</Space>
      <Space>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={onSave}>
          保存
        </Button>
      </Space>
    </Space>
  </Space>
);

export default ReportSectionEditor;
