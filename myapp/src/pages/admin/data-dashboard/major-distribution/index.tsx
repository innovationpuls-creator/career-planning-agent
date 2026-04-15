import { Column, Pie } from '@ant-design/charts';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Col, Empty, Result, Row, Space, Statistic } from 'antd';
import React, { useEffect, useState } from 'react';
import { getMajorDistribution } from '@/services/ant-design-pro/api';

const MajorDistributionPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<API.MajorDistributionResponse | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await getMajorDistribution();
        if (response.success) {
          setData(response as API.MajorDistributionResponse);
          return;
        }
        setError('未获取到统计数据');
      } catch (requestError: unknown) {
        setError(
          (requestError as any)?.response?.data?.detail ||
            (requestError as any)?.message ||
            '获取统计数据失败',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const hasData = Boolean(
    data &&
      (data.total_users > 0 ||
        data.major_distribution.length > 0 ||
        data.education_distribution.length > 0 ||
        data.school_distribution.length > 0),
  );

  if (error) {
    return (
      <PageContainer title="就读专业分布">
        <Result status="error" title="数据加载失败" subTitle={error} />
      </PageContainer>
    );
  }

  const schoolData =
    data?.school_distribution.map((item) => ({
      school: item.school,
      count: item.count,
    })) || [];

  const majorPieConfig = {
    data: data?.major_distribution || [],
    angleField: 'count',
    colorField: 'major',
    radius: 0.82,
    label: {
      text: 'count',
      style: { fontWeight: 'bold' },
    },
    legend: { position: 'right' as const },
  };

  const educationPieConfig = {
    data: data?.education_distribution || [],
    angleField: 'count',
    colorField: 'level',
    radius: 0.82,
    label: {
      text: 'count',
      style: { fontWeight: 'bold' },
    },
    legend: { position: 'right' as const },
  };

  return (
    <PageContainer
      loading={loading}
      header={{
        title: '就读专业分布',
        subTitle: '查看学生资料完善情况，以及专业、学历和学校分布概览。',
      }}
    >
      {!hasData ? (
        <Empty description="暂无统计数据" />
      ) : (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="总用户数" value={data?.total_users ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="已完善画像数" value={data?.profiles_completed ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="画像完善率"
                  value={((data?.completion_rate ?? 0) * 100).toFixed(1)}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="专业分布">
                <Pie {...majorPieConfig} height={320} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="学历层次分布">
                <Pie {...educationPieConfig} height={320} />
              </Card>
            </Col>
          </Row>

          <Card title="学校分布 TOP 20">
            {schoolData.length > 0 ? (
              <Column
                data={schoolData}
                xField="school"
                yField="count"
                label={{ position: 'top' as const }}
                height={320}
                color="#1677ff"
              />
            ) : (
              <Empty description="暂无学校分布数据" />
            )}
          </Card>
        </Space>
      )}
    </PageContainer>
  );
};

export default MajorDistributionPage;
