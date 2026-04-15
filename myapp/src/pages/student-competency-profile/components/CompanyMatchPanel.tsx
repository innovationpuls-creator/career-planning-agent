import { BankOutlined, LoadingOutlined, ReadOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Drawer, Empty, Space, Spin, Tag, Typography, message } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import { getJobRequirementComparison } from '@/services/ant-design-pro/api';

const { Paragraph, Text, Title } = Typography;

const DIMENSION_LABELS: Array<{
  key: keyof API.JobRequirementComparisonDetailItem;
  label: string;
}> = [
  { key: 'professional_skills', label: '专业技能 / 技术栈' },
  { key: 'professional_background', label: '专业背景' },
  { key: 'education_requirement', label: '学历要求' },
  { key: 'teamwork', label: '团队协作能力' },
  { key: 'stress_adaptability', label: '抗压 / 适应能力' },
  { key: 'communication', label: '沟通表达能力' },
  { key: 'work_experience', label: '工作经验' },
  { key: 'documentation_awareness', label: '文档规范意识' },
  { key: 'responsibility', label: '责任心 / 工作态度' },
  { key: 'learning_ability', label: '学习能力' },
  { key: 'problem_solving', label: '分析解决问题能力' },
  { key: 'other_special', label: '其他 / 特殊要求' },
];

const DEFAULT_VALUE = '无明确要求';

const useStyles = createStyles(({ css, token }) => ({
  list: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 1280px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  card: css`
    height: 100%;

    :global(.ant-card-body) {
      display: grid;
      gap: 12px;
    }
  `,
  summary: css`
    display: grid;
    gap: 8px;
  `,
  metaRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  detailSection: css`
    display: grid;
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
  `,
  tagList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  drawerBody: css`
    display: grid;
    gap: 16px;
  `,
  detailParagraph: css`
    margin-bottom: 0;
    white-space: pre-wrap;
  `,
}));

type Props = {
  items: API.CareerDevelopmentMatchEvidenceCard[];
};

const CompanyMatchPanel: React.FC<Props> = ({ items }) => {
  const { styles } = useStyles();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<API.JobRequirementComparisonDetailItem>();

  const openDetail = async (profileId: number) => {
    setDrawerOpen(true);
    setLoading(true);
    try {
      const response = await getJobRequirementComparison(profileId, { skipErrorHandler: true });
      setDetail(response.data);
    } catch (error: any) {
      message.error(error?.message || '加载公司详情失败');
      setDetail(undefined);
    } finally {
      setLoading(false);
    }
  };

  const renderDimensionValues = (values?: string[]) => {
    if (!values?.length || (values.length === 1 && values[0] === DEFAULT_VALUE)) {
      return <Text type="secondary">{DEFAULT_VALUE}</Text>;
    }

    return (
      <div className={styles.tagList}>
        {values.map((item) => (
          <Tag color="blue" key={item}>
            {item}
          </Tag>
        ))}
      </div>
    );
  };

  if (!items.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前暂无匹配职位" />;
  }

  return (
    <>
      <div className={styles.list}>
        {items.map((item) => (
          <Card
            key={item.profile_id}
            className={styles.card}
            title={
              <Space size={8}>
                <BankOutlined />
                <span>{item.job_title}</span>
              </Space>
            }
            extra={<Tag color="gold">{Math.round(item.match_score)}%</Tag>}
          >
            <div className={styles.summary}>
              <div className={styles.metaRow}>
                <Tag color="blue">{item.industry}</Tag>
                <Tag color="green">{item.company_name}</Tag>
              </div>
              <Text type="secondary">标准职业：{item.career_title}</Text>
              <Text type="secondary">
                画像基础维度：{item.professional_threshold_dimension_count} 项
              </Text>
              <Text type="secondary">
                关键词命中：{item.professional_threshold_keyword_count} 个
              </Text>
            </div>
            <Button type="link" icon={<ReadOutlined />} style={{ paddingInline: 0 }} onClick={() => void openDetail(item.profile_id)}>
              查看具体信息
            </Button>
          </Card>
        ))}
      </div>

      <Drawer
        title="匹配职位详情"
        width={960}
        open={drawerOpen}
        destroyOnClose
        onClose={() => {
          setDrawerOpen(false);
          setDetail(undefined);
        }}
      >
        {loading ? (
          <Spin indicator={<LoadingOutlined spin />} />
        ) : detail ? (
          <div className={styles.drawerBody}>
            <Card>
              <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small">
                <Descriptions.Item label="公司">{detail.company_name}</Descriptions.Item>
                <Descriptions.Item label="行业">{detail.industry}</Descriptions.Item>
                <Descriptions.Item label="职位">{detail.job_title}</Descriptions.Item>
                <Descriptions.Item label="原文条数">{detail.job_detail_count}</Descriptions.Item>
              </Descriptions>
            </Card>

            <section className={styles.detailSection}>
              <Title level={5} style={{ margin: 0 }}>
                合并后的岗位原文
              </Title>
              <Paragraph className={styles.detailParagraph}>
                {detail.merged_job_detail || '暂无原文'}
              </Paragraph>
            </section>

            <section className={styles.detailSection}>
              <Title level={5} style={{ margin: 0 }}>
                12 维提取结果
              </Title>
              {DIMENSION_LABELS.map((dimension) => (
                <div key={dimension.key}>
                  <Text strong>{dimension.label}</Text>
                  <div style={{ marginTop: 8 }}>
                    {renderDimensionValues(detail[dimension.key] as string[])}
                  </div>
                </div>
              ))}
            </section>
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无详情数据" />
        )}
      </Drawer>
    </>
  );
};

export default CompanyMatchPanel;
