import { Card, Empty, Input, Space, Typography } from 'antd';
import React from 'react';
import type { PhasePlanContent } from '../personalGrowthReportUtils';
import ReportSectionEditor from './ReportSectionEditor';

const { Text } = Typography;
const { TextArea } = Input;

type PhasePlanSectionProps = {
  editing: boolean;
  value: PhasePlanContent;
  dirty?: boolean;
  onChange: (next: PhasePlanContent) => void;
  onSave: () => void;
  onCancel: () => void;
};

const buildUpdater =
  (
    key: keyof PhasePlanContent,
    value: PhasePlanContent,
    onChange: (next: PhasePlanContent) => void,
  ) =>
  (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...value, [key]: event.target.value });
  };

const PhasePlanSection: React.FC<PhasePlanSectionProps> = ({
  editing,
  value,
  dirty,
  onChange,
  onSave,
  onCancel,
}) => {
  if (editing) {
    return (
      <ReportSectionEditor dirty={dirty} onSave={onSave} onCancel={onCancel}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Text strong>短期</Text>
            <TextArea
              value={value.shortTerm}
              onChange={buildUpdater('shortTerm', value, onChange)}
              autoSize={{ minRows: 4, maxRows: 8 }}
              placeholder="补充短期阶段目标、重点动作和阶段成果。"
            />
          </div>
          <div>
            <Text strong>中期</Text>
            <TextArea
              value={value.midTerm}
              onChange={buildUpdater('midTerm', value, onChange)}
              autoSize={{ minRows: 4, maxRows: 8 }}
              placeholder="补充中期阶段目标、重点动作和阶段成果。"
            />
          </div>
          <div>
            <Text strong>长期</Text>
            <TextArea
              value={value.longTerm}
              onChange={buildUpdater('longTerm', value, onChange)}
              autoSize={{ minRows: 4, maxRows: 8 }}
              placeholder="补充长期阶段目标、重点动作和阶段成果。"
            />
          </div>
        </Space>
      </ReportSectionEditor>
    );
  }

  const blocks: Array<{ title: string; value: string }> = [
    { title: '短期', value: value.shortTerm },
    { title: '中期', value: value.midTerm },
    { title: '长期', value: value.longTerm },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {blocks.map((block) => (
        <Card key={block.title} size="small" title={block.title}>
          {block.value ? (
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {block.value}
            </Typography.Paragraph>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" />
          )}
        </Card>
      ))}
    </Space>
  );
};

export default PhasePlanSection;
