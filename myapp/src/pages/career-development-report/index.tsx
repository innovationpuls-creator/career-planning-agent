import { PageContainer } from '@ant-design/pro-components';
import { Card, Space, Tag, Typography } from 'antd';
import React from 'react';

const CareerDevelopmentReportPage: React.FC = () => {
  return (
    <PageContainer
      title="构建学生职业生涯发展报告"
      content="沉淀阶段性分析结果与建议，帮助学生持续理解当前状态和下一步发展方向。"
    >
      <Card>
        <Space direction="vertical" size="middle">
          <Tag color="purple">功能入口已创建</Tag>
          <Typography.Paragraph>
            当前页面已经具备独立路由入口，后续可以继续扩展报告摘要、阶段评估、建议行动与导出能力等内容。
          </Typography.Paragraph>
        </Space>
      </Card>
    </PageContainer>
  );
};

export default CareerDevelopmentReportPage;
