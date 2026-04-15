import { Card, Col, Row, Spin, Statistic } from 'antd';
import { Column, Pie } from '@ant-design/charts';
import React, { useEffect, useState } from 'react';
import { getEmploymentTrends } from '@/services/ant-design-pro/api';

const EmploymentTrendsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<API.EmploymentTrendsResponse | null>(null);

  useEffect(() => {
    getEmploymentTrends()
      .then((res) => {
        if (res.success) {
          setData(res as API.EmploymentTrendsResponse);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const industryData = (data?.industry_distribution || []).map((d) => ({
    industry: d.industry,
    count: d.count,
  }));

  const jobTitleData = (data?.job_title_distribution || []).map((d) => ({
    job_title: d.job_title,
    count: d.count,
  }));

  const salaryData = data
    ? [
        { range: '15k以下', count: data.salary_distribution.below_15k },
        { range: '15k-25k', count: data.salary_distribution.from_15k_to_25k },
        { range: '25k-35k', count: data.salary_distribution.from_25k_to_35k },
        { range: '35k以上', count: data.salary_distribution.above_35k },
      ]
    : [];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <h2 style={{ marginBottom: 16 }}>就业趋势洞察</h2>
        </Col>

        {/* 数字卡片 */}
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="总岗位数" value={data?.total_jobs ?? 0} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="公司总数" value={data?.total_companies ?? 0} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="薪资范围覆盖"
              value={
                (data?.salary_distribution.below_15k ?? 0) +
                (data?.salary_distribution.from_15k_to_25k ?? 0) +
                (data?.salary_distribution.from_25k_to_35k ?? 0) +
                (data?.salary_distribution.above_35k ?? 0)
              }
              suffix="个岗位有薪资"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>

        {/* 行业分布柱状图 */}
        <Col xs={24} md={12}>
          <Card title="行业岗位分布">
            {data && (
              <Column
                data={industryData}
                xField="industry"
                yField="count"
                label={{ position: 'top' as const }}
                height={280}
                color="#5B8FF9"
              />
            )}
          </Card>
        </Col>

        {/* 岗位分布柱状图 */}
        <Col xs={24} md={12}>
          <Card title="热门岗位 TOP20">
            {data && (
              <Column
                data={jobTitleData}
                xField="job_title"
                yField="count"
                label={{ position: 'top' as const }}
                height={280}
                color="#5AD8A6"
              />
            )}
          </Card>
        </Col>

        {/* 薪资分布饼图 */}
        <Col span={24}>
          <Card title="薪资分布">
            {data && salaryData.length > 0 && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Pie
                    data={salaryData}
                    angleField="count"
                    categoryField="range"
                    radius={0.7}
                    label={{ text: 'range', style: { fontWeight: 'bold' } }}
                    legend={{ position: 'right' as const }}
                    color={['#FF8182', '#FF9F40', '#F6BD16', '#52c41a']}
                    height={280}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Column
                    data={salaryData}
                    xField="range"
                    yField="count"
                    label={{ position: 'top' as const }}
                    color="#5B8FF9"
                    height={280}
                  />
                </Col>
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default EmploymentTrendsPage;
