import { EditOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Tag, Typography } from 'antd';
import React from 'react';

type ReportSectionCardProps = {
  title: string;
  completed: boolean;
  editing: boolean;
  onEdit: () => void;
  children: React.ReactNode;
  content?: string;
  extraTags?: React.ReactNode;
};

const ReportSectionCard: React.FC<ReportSectionCardProps> = ({
  title,
  completed,
  editing,
  onEdit,
  children,
  content,
  extraTags,
}) => (
  <Card
    title={title}
    extra={
      editing ? (
        extraTags
      ) : (
        <Button type="link" icon={<EditOutlined />} onClick={onEdit}>
          编辑
        </Button>
      )
    }
  >
    {!editing && !content ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" />
    ) : (
      <>
        {!editing ? (
          <div style={{ marginBottom: 12 }}>
            <Tag color={completed ? 'success' : 'default'}>
              {completed ? '已完成' : '待补充'}
            </Tag>
          </div>
        ) : null}
        {typeof children === 'string' ? (
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
            {children}
          </Typography.Paragraph>
        ) : (
          children
        )}
      </>
    )}
  </Card>
);

export default ReportSectionCard;
