import { Card, Col, Row, Spin, Table } from 'antd';
import { Radar, Column } from '@ant-design/charts';
import React, { useEffect, useState } from 'react';
import { getCompetencyAnalysis } from '@/services/ant-design-pro/api';

const DIMENSION_LABELS: Record<string, string> = {
  professional_skills: '专业技能',
  professional_background: '专业背景',
  education_requirement: '学历要求',
  teamwork: '团队协作',
  stress_adaptability: '压力适应',
  communication: '沟通表达',
  work_experience: '工作经验',
  documentation_awareness: '文档意识',
  responsibility: '责任意识',
  learning_ability: '学习能力',
  problem_solving: '问题解决',
  other_special: '其他特长',
};

const CompetencyAnalysisPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<API.CompetencyAnalysisResponse | null>(null);

  useEffect(() => {
    getCompetencyAnalysis()
      .then((res) => {
        if (res.success) {
          setData(res as API.CompetencyAnalysisResponse);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Radar chart data
  const radarData = data
    ? Object.entries(data.average_scores).map(([key, value]) => ({
        name: DIMENSION_LABELS[key] || key,
        value,
      }))
    : [];

  const radarConfig = {
    data: radarData,
    xField: 'name',
    yField: 'value',
    meta: { name: { alias: '维度' }, value: { alias: '平均得分' } },
    area: { style: { fillOpacity: 0.3 } },
    scale: { y: { domainMin: 0, domainMax: 1 } },
    theme: { color10: '#5B8FF9' },
  };

  // Distribution stacked column data
  const distData =
    data?.score_distribution.map((d) => ({
      dimension: DIMENSION_LABELS[d.dimension] || d.dimension,
      高分段: d.high,
      中分段: d.medium,
      低分段: d.low,
    })) || [];

  const columnConfig = {
    data: distData,
    xField: 'dimension',
    yField: '高分段',
    stack: true,
    theme: { color10: ['#52c41a', '#faad14', '#ff4d4f'] },
    label: { position: 'top' as const },
    height: 280,
  };

  const topStudentColumns = [
    { title: '排名', dataIndex: 'rank', width: 60, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: '用户', dataIndex: 'display_name', ellipsis: true },
    {
      title: '综合评分',
      dataIndex: 'overall_score',
      render: (v: number) => (v * 100).toFixed(0) + '分',
    },
  ];

  const topStudentData =
    data?.top_students.map((s) => ({ ...s, key: s.user_id })) || [];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <h2 style={{ marginBottom: 16 }}>能力评估分析</h2>
        </Col>

        {/* 数字卡片 */}
        <Col xs={24} sm={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#999', marginBottom: 8 }}>已完成评估人数</div>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff' }}>
                {data?.total_assessments ?? 0}
              </div>
            </div>
          </Card>
        </Col>

        {/* 雷达图 */}
        <Col xs={24} md={14}>
          <Card title="12维度能力雷达图">
            {data && radarData.length > 0 && <Radar {...radarConfig} height={320} />}
          </Card>
        </Col>

        {/* TOP10 表格 */}
        <Col xs={24} md={10}>
          <Card title="TOP10 学生能力排名">
            <Table
              columns={topStudentColumns}
              dataSource={topStudentData}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 维度分布柱状图 */}
        <Col span={24}>
          <Card title="各维度得分分布（高/中/低分段人数）">
            {data && <Column {...columnConfig} seriesField="type" />}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default CompetencyAnalysisPage;
