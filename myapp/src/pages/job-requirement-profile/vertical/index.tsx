import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Col, Row, Select, Space, Spin, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import VerticalTierComparison from '@/components/VerticalTierComparison';
import {
  getIndustryOptionsByJobTitle,
  getJobTitleOptions,
  getVerticalJobProfile,
} from '@/services/ant-design-pro/api';

const useStyles = createStyles(({ css, token }) => ({
  pageContainer: css`
    :global(.ant-pro-page-container-children-container) {
      padding-inline: 0;
      padding-block: 0;
    }
  `,
  shell: css`
    min-height: calc(100vh - 112px);
    padding: 24px;
    background: linear-gradient(160deg, ${token.colorBgLayout} 0%, ${token.colorBgContainer} 100%);
  `,
  header: css`
    margin-bottom: 20px;
  `,
  filterCard: css`
    margin-bottom: 20px;
    border-radius: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);

    :global(.ant-card-head) {
      border-bottom-color: ${token.colorBorderSecondary};
    }
  `,
  resultCard: css`
    border-radius: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);

    :global(.ant-card-head) {
      border-bottom-color: ${token.colorBorderSecondary};
    }
  `,
  loading: css`
    display: flex;
    justify-content: center;
    padding: 48px 0;
  `,
  industrySelect: css`
    width: 100%;

    :global(.ant-select-selection-overflow-item) {
      max-width: 100%;
    }

    :global(.ant-select-selection-item) {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
}));

const VerticalJobProfilePage: React.FC = () => {
  const { styles } = useStyles();
  const [jobTitleOptions, setJobTitleOptions] = useState<API.JobTitleOption[]>([]);
  const [industryOptions, setIndustryOptions] = useState<API.IndustryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [industryLoading, setIndustryLoading] = useState(false);
  const [result, setResult] = useState<API.VerticalJobProfilePayload>();
  const [jobTitle, setJobTitle] = useState<string>();
  const [industries, setIndustries] = useState<string[]>([]);

  useEffect(() => {
    void getJobTitleOptions({ skipErrorHandler: true }).then((response) => {
      setJobTitleOptions(response.data || []);
    });
  }, []);

  const handleJobTitleChange = async (value?: string) => {
    setJobTitle(value);
    setIndustries([]);
    setIndustryOptions([]);
    if (!value) {
      return;
    }
    setIndustryLoading(true);
    try {
      const response = await getIndustryOptionsByJobTitle(value);
      setIndustryOptions(response.data || []);
    } finally {
      setIndustryLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!jobTitle) {
      return;
    }
    setLoading(true);
    try {
      const response = await getVerticalJobProfile({
        job_title: jobTitle,
        industry: industries,
      });
      setResult(response.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className={styles.pageContainer} title={false} breadcrumbRender={false}>
      <div className={styles.shell}>
        <div className={styles.header}>
          <Typography.Title level={2} style={{ marginBottom: 0 }}>
            垂直岗位图谱
          </Typography.Title>
        </div>
        <Card title="筛选条件" className={styles.filterCard}>
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} md={10}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text>岗位名称</Typography.Text>
                <Select
                  id="job_title"
                  placeholder="请选择岗位名称"
                  options={jobTitleOptions}
                  value={jobTitle}
                  onChange={(value) => void handleJobTitleChange(value)}
                />
              </Space>
            </Col>
            <Col xs={24} md={10}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text>行业</Typography.Text>
                <Select
                  id="industry"
                  mode="multiple"
                  placeholder="请选择行业"
                  options={industryOptions}
                  value={industries}
                  loading={industryLoading}
                  onChange={(value) => setIndustries(value)}
                  className={styles.industrySelect}
                />
              </Space>
            </Col>
            <Col xs={24} md={4}>
              <Button type="primary" loading={loading} onClick={() => void handleSearch()} block>
                查询
              </Button>
            </Col>
          </Row>
        </Card>
        <Card title={result?.job_title || '阶段路径'} className={styles.resultCard}>
          {loading ? (
            <div className={styles.loading}>
              <Spin />
            </div>
          ) : (
            <VerticalTierComparison comparison={result?.tiered_comparison} mode="detailed" />
          )}
        </Card>
      </div>
    </PageContainer>
  );
};

export default VerticalJobProfilePage;
