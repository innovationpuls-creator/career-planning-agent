import { Badge, Card, List, Progress, Tag } from 'antd';
import React from 'react';
import type { PersonalGrowthSection, PersonalGrowthSectionKey } from '../personalGrowthReportUtils';

type ReportSidebarNavProps = {
  sections: PersonalGrowthSection[];
  activeSectionKey: PersonalGrowthSectionKey;
  onSelect: (key: PersonalGrowthSectionKey) => void;
};

const ReportSidebarNav: React.FC<ReportSidebarNavProps> = ({
  sections,
  activeSectionKey,
  onSelect,
}) => {
  const completedCount = sections.filter((section) => section.completed).length;
  const percent = Math.round((completedCount / Math.max(sections.length, 1)) * 100);

  return (
    <Card title="目录" size="small">
      <Progress percent={percent} size="small" showInfo={false} style={{ marginBottom: 12 }} />
      <List
        dataSource={sections}
        renderItem={(section, index) => (
          <List.Item
            onClick={() => onSelect(section.key)}
            style={{
              cursor: 'pointer',
              paddingInline: 8,
              borderRadius: 8,
              background: activeSectionKey === section.key ? '#f0f5ff' : undefined,
            }}
          >
            <List.Item.Meta
              avatar={
                <Badge status={section.completed ? 'success' : 'default'} text={`${index + 1}`} />
              }
              title={section.title}
              description={
                <Tag color={section.completed ? 'success' : 'default'}>
                  {section.completed ? '已完成' : '待补充'}
                </Tag>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

export default ReportSidebarNav;
