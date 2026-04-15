import { Card, Col, Row, Spin, Statistic } from 'antd';
import { Pie, Column } from '@ant-design/charts';
import React, { useEffect, useState } from 'react';
import { getMajorDistribution } from '@/services/ant-design-pro/api';

const MajorDistributionPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<API.MajorDistributionResponse | null>(null);

  useEffect(() => {
    getMajorDistribution()
      .then((res) => {
        if (res.success) {
          setData(res as API.MajorDistributionResponse);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const pieConfig = (field: 'major' | 'level') => ({
    data:
      field === 'major'
        ? data?.major_distribution || []
        : data?.education_distribution || [],
    angleField: 'count',
    categoryField: field === 'major' ? 'major' : 'level',
    radius: 0.8,
    label: {
      text: 'count',
      style: { fontWeight: 'bold' },
    },
    legend: { position: 'right' as const },
    color10: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#FF99C3', '#6DC8EC', '#945FB9', '#FF8182', '#FF9F40', '#1E90FF'],
  });

  const schoolData = (data?.school_distribution || []).map((s) => ({
    school: s.school,
    count: s.count,
  }));

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <h2 style={{ marginBottom: 16 }}>就读专业分布</h2>
        </Col>

        {/* 数字卡片 */}
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="总用户数" value={data?.total_users ?? 0} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="已完善画像数" value={data?.profiles_completed ?? 0} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="画像完善率"
              value={((data?.completion_rate ?? 0) * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>

        {/* 专业分布饼图 */}
        <Col xs={24} md={12}>
          <Card title="专业分布">
            {data && <Pie {...pieConfig('major')} height={300} />}
          </Card>
        </Col>

        {/* 学历分布饼图 */}
        <Col xs={24} md={12}>
          <Card title="学历层次分布">
            {data && <Pie {...pieConfig('level')} height={300} />}
          </Card>
        </Col>

        {/* 学校分布柱状图 */}
        <Col span={24}>
          <Card title="学校分布 TOP20">
            {data && <Column data={schoolData} xField="school" yField="count" label={{ position: 'top' as const }} height={300} color="#5B8FF9" />}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default MajorDistributionPage;
