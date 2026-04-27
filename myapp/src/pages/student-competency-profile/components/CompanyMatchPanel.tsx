import {
  AimOutlined,
  BankOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LoadingOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  message,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import { getJobRequirementComparison } from '@/services/ant-design-pro/api';
import { extractRequestError } from '../shared';

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
    gap: 14px;

    @media (max-width: 1280px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  card: css`
    height: 100%;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(15, 35, 70, 0.035);
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

    :hover {
      transform: translateY(-2px);
      border-color: ${token.colorPrimaryBorder};
      box-shadow: 0 12px 24px rgba(22, 85, 204, 0.08);
    }

    :global(.ant-card-body) {
      display: grid;
      gap: 14px;
      padding: 18px 20px;
    }
  `,
  cardHead: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    min-width: 0;
  `,
  titleGroup: css`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
  `,
  jobIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 20px;
  `,
  jobTitle: css`
    margin: 0 !important;
    color: ${token.colorText};
    font-size: 16px !important;
    font-weight: 600 !important;
    line-height: 1.4 !important;
    font-family: var(--font-heading);
    letter-spacing: 0.04em;
  `,
  careerText: css`
    display: block;
    margin-top: 4px;
    color: ${token.colorTextSecondary};
    font-size: 13px;
  `,
  scoreBadge: css`
    flex: 0 0 auto;
    margin-inline-end: 0 !important;
    padding: 3px 10px;
    border-color: ${token.colorWarningBorder};
    border-radius: 6px;
    background: ${token.colorWarningBg};
    color: ${token.colorWarning};
    font-weight: 600;
  `,
  summary: css`
    display: grid;
    gap: 12px;
  `,
  metaRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  metaTag: css`
    margin-inline-end: 0 !important;
    border-radius: 6px;
  `,
  metricGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  `,
  metricItem: css`
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 10px;
    background: ${token.colorFillQuaternary};
  `,
  metricLabel: css`
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  metricValue: css`
    color: ${token.colorText};
    font-weight: 600;
  `,
  viewButton: css`
    justify-self: flex-start;
    height: 34px;
    padding-inline: 0;
    color: ${token.colorPrimary};
    font-weight: 500;
  `,
  drawerOverview: css`
    display: grid;
    gap: 14px;
    padding: 18px 20px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: linear-gradient(180deg, ${token.colorBgContainer} 0%, ${token.colorPrimaryBg} 190%);
  `,
  detailSection: css`
    display: grid;
    gap: 14px;
    padding: 18px 20px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
  `,
  detailSectionTitle: css`
    margin: 0 !important;
    color: ${token.colorText};
    font-size: 16px !important;
    font-weight: 600 !important;
    font-family: var(--font-heading);
    letter-spacing: 0.04em;
  `,
  dimensionGrid: css`
    display: grid;
    gap: 12px;
  `,
  dimensionRow: css`
    display: grid;
    grid-template-columns: minmax(150px, 0.32fr) minmax(0, 1fr);
    gap: 14px;
    align-items: flex-start;
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  tagList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  valueTag: css`
    margin-inline-end: 0 !important;
    max-width: 100%;
    height: auto;
    padding: 3px 12px;
    border-color: ${token.colorSuccessBorder};
    border-radius: 6px;
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    white-space: normal;
    line-height: 20px;
  `,
  emptyValue: css`
    width: fit-content;
    padding: 4px 10px;
    border-radius: 6px;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextTertiary};
    font-size: 13px;
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
  const [detail, setDetail] =
    useState<API.JobRequirementComparisonDetailItem>();

  const openDetail = async (profileId: number) => {
    setDrawerOpen(true);
    setLoading(true);
    try {
      const response = await getJobRequirementComparison(profileId, {
        skipErrorHandler: true,
      });
      setDetail(response.data);
    } catch (error: unknown) {
      const detail = extractRequestError(error);
      message.error(detail === '请求失败' ? '加载公司详情失败' : detail);
      setDetail(undefined);
    } finally {
      setLoading(false);
    }
  };

  const renderDimensionValues = (values?: string[]) => {
    if (
      !values?.length ||
      (values.length === 1 && values[0] === DEFAULT_VALUE)
    ) {
      return <Text className={styles.emptyValue}>{DEFAULT_VALUE}</Text>;
    }

    return (
      <div className={styles.tagList}>
        {values.map((item) => (
          <Tag className={styles.valueTag} key={item}>
            {item}
          </Tag>
        ))}
      </div>
    );
  };

  if (!items.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="当前暂无匹配职位"
      />
    );
  }

  return (
    <>
      <div className={styles.list}>
        {items.map((item) => (
          <Card key={item.profile_id} className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.titleGroup}>
                <span className={styles.jobIcon}>
                  <BankOutlined />
                </span>
                <div>
                  <Title level={5} className={styles.jobTitle}>
                    {item.job_title}
                  </Title>
                  <Text className={styles.careerText}>
                    标准职业：{item.career_title}
                  </Text>
                </div>
              </div>
              <Tag className={styles.scoreBadge}>
                {Math.round(item.match_score)}%
              </Tag>
            </div>

            <div className={styles.summary}>
              <div className={styles.metaRow}>
                <Tag color="processing" className={styles.metaTag}>
                  {item.industry}
                </Tag>
                <Tag color="success" className={styles.metaTag}>
                  {item.company_name}
                </Tag>
              </div>
              <div className={styles.metricGrid}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>画像基础维度</span>
                  <span className={styles.metricValue}>
                    {item.professional_threshold_dimension_count} 项
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>关键词命中</span>
                  <span className={styles.metricValue}>
                    {item.professional_threshold_keyword_count} 个
                  </span>
                </div>
              </div>
            </div>
            <Button
              type="link"
              icon={<ReadOutlined />}
              className={styles.viewButton}
              onClick={() => void openDetail(item.profile_id)}
            >
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
            <section className={styles.drawerOverview}>
              <Title level={5} className={styles.detailSectionTitle}>
                岗位概览
              </Title>
              <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small">
                <Descriptions.Item
                  label={
                    <>
                      <BankOutlined /> 公司
                    </>
                  }
                >
                  {detail.company_name}
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <>
                      <AimOutlined /> 行业
                    </>
                  }
                >
                  {detail.industry}
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <>
                      <FileTextOutlined /> 职位
                    </>
                  }
                >
                  {detail.job_title}
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <>
                      <DatabaseOutlined /> 原文条数
                    </>
                  }
                >
                  {detail.job_detail_count}
                </Descriptions.Item>
              </Descriptions>
            </section>

            <section className={styles.detailSection}>
              <Title level={5} className={styles.detailSectionTitle}>
                合并后的岗位原文
              </Title>
              <Paragraph className={styles.detailParagraph}>
                {detail.merged_job_detail || '暂无原文'}
              </Paragraph>
            </section>

            <section className={styles.detailSection}>
              <Title level={5} className={styles.detailSectionTitle}>
                12 维提取结果
              </Title>
              <div className={styles.dimensionGrid}>
                {DIMENSION_LABELS.map((dimension) => (
                  <div key={dimension.key} className={styles.dimensionRow}>
                    <Text strong>{dimension.label}</Text>
                    {renderDimensionValues(detail[dimension.key] as string[])}
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无详情数据"
          />
        )}
      </Drawer>
    </>
  );
};

export default CompanyMatchPanel;
