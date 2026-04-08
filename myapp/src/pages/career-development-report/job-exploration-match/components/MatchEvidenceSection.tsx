import { EyeOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Space, Tag, Typography } from 'antd';
import React from 'react';

type Props = {
  report: API.CareerDevelopmentMatchReport;
  onOpenCompanyDetail: (params: {
    jobTitle: string;
    industry: string;
    companyName: string;
  }) => void;
};

const MatchEvidenceSection: React.FC<Props> = ({ report, onOpenCompanyDetail }) => {
  return (
    <Card title="推荐岗位信息" styles={{ body: { padding: 20 } }} style={{ borderRadius: 20 }}>
      {report.evidence_cards.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 16,
          }}
        >
          {report.evidence_cards.map((item) => (
            <Card
              key={item.profile_id}
              size="small"
              style={{
                borderRadius: 18,
                borderColor: '#d6e4ff',
                background: '#f8fbff',
              }}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Typography.Text strong>{item.career_title}</Typography.Text>
                  <Tag color="processing">匹配度 {item.match_score}%</Tag>
                </Space>
                <Space wrap>
                  <Tag color="blue">{item.industry}</Tag>
                  <Tag>{item.job_title}</Tag>
                  <Tag>{item.company_name}</Tag>
                </Space>
                <Typography.Text type="secondary">
                  这是与当前目标最契合的具体岗位样本，可直接查看招聘信息和公司信息。
                </Typography.Text>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Typography.Text>
                    专业与门槛覆盖维数：{item.professional_threshold_dimension_count}
                  </Typography.Text>
                  <Typography.Text>
                    专业与门槛关键词数：{item.professional_threshold_keyword_count}
                  </Typography.Text>
                </Space>
                <Space wrap>
                  {item.group_similarities.map((group) => (
                    <Tag key={`${item.profile_id}-${group.group_key}`} color="cyan">
                      {group.label} {(group.similarity_score * 100).toFixed(1)}%
                    </Tag>
                  ))}
                </Space>
                <Button
                  icon={<EyeOutlined />}
                  onClick={() =>
                    onOpenCompanyDetail({
                      jobTitle: item.job_title,
                      industry: item.industry,
                      companyName: item.company_name,
                    })
                  }
                >
                  查看招聘与公司详情
                </Button>
              </Space>
            </Card>
          ))}
        </div>
      ) : (
        <Empty description="当前报告暂无可展示的推荐岗位信息" />
      )}
    </Card>
  );
};

export default MatchEvidenceSection;
