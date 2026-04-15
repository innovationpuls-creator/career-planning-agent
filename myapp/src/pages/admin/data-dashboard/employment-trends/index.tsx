import { Column, Pie } from '@ant-design/charts';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Col, Empty, Result, Row, Space, Statistic } from 'antd';
import React, { useEffect, useState } from 'react';
import { getEmploymentTrends } from '@/services/ant-design-pro/api';

const EmploymentTrendsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<API.EmploymentTrendsResponse | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await getEmploymentTrends();
        if (response.success) {
          setData(response as API.EmploymentTrendsResponse);
          return;
        }
        setError('未获取到就业趋势数据');
      } catch (requestError: unknown) {
        setError(
          (requestError as any)?.response?.data?.detail ||
            (requestError as any)?.message ||
            '获取就业趋势数据失败',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  if (error) {
    return (
      <PageContainer title="就业趋势洞察">
        <Result status="error" title="数据加载失败" subTitle={error} />
      </PageContainer>
    );
  }

  const industryData =
    data?.industry_distribution.map((item) => ({
      industry: item.industry,
      count: item.count,
    })) || [];

  const jobTitleData =
    data?.job_title_distribution.map((item) => ({
      job_title: item.job_title,
      count: item.count,
    })) || [];

  const salaryData = data
    ? [
        { range: '15k 以下', count: data.salary_distribution.below_15k },
        { range: '15k - 25k', count: data.salary_distribution.from_15k_to_25k },
        { range: '25k - 35k', count: data.salary_distribution.from_25k_to_35k },
        { range: '35k 以上', count: data.salary_distribution.above_35k },
      ]
    : [];

  const salaryCoverage = salaryData.reduce((sum, item) => sum + item.count, 0);

  const hasData = Boolean(
    data &&
      (data.total_jobs > 0 ||
        data.total_companies > 0 ||
        industryData.length > 0 ||
        jobTitleData.length > 0 ||
        salaryCoverage > 0),
  );

  return (
    <PageContainer
      loading={loading}
      header={{
        title: '就业趋势洞察',
        subTitle: '查看岗位总量、公司数量、行业分布和薪资区间分布。',
      }}
    >
      {!hasData ? (
        <Empty description="暂无就业趋势数据" />
      ) : (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="总岗位数" value={data?.total_jobs ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="公司总数" value={data?.total_companies ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="有薪资标注岗位数" value={salaryCoverage} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="行业岗位分布">
                {industryData.length > 0 ? (
                  <Column
                    data={industryData}
                    xField="industry"
                    yField="count"
                    label={{ position: 'top' as const }}
                    height={320}
                    color="#1677ff"
                  />
                ) : (
                  <Empty description="暂无行业分布数据" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="热门岗位 TOP 20">
                {jobTitleData.length > 0 ? (
                  <Column
                    data={jobTitleData}
                    xField="job_title"
                    yField="count"
                    label={{ position: 'top' as const }}
                    height={320}
                    color="#52c41a"
                  />
                ) : (
                  <Empty description="暂无岗位分布数据" />
                )}
              </Card>
            </Col>
          </Row>

          <Card title="薪资区间分布">
            {salaryCoverage > 0 ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Pie
                    data={salaryData}
                    angleField="count"
                    colorField="range"
                    radius={0.78}
                    label={{ text: 'range', style: { fontWeight: 'bold' } }}
                    legend={{ position: 'right' as const }}
                    color={['#ff7875', '#ffbb96', '#ffd666', '#95de64']}
                    height={300}
                  />
                </Col>
                <Col xs={24} lg={12}>
                  <Column
                    data={salaryData}
                    xField="range"
                    yField="count"
                    label={{ position: 'top' as const }}
                    height={300}
                    color="#1677ff"
                  />
                </Col>
              </Row>
            ) : (
              <Empty description="暂无薪资分布数据" />
            )}
          </Card>
        </Space>
      )}
    </PageContainer>
  );
};

export default EmploymentTrendsPage;
