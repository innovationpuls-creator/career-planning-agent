import { Column, Radar } from '@ant-design/charts';
import { PageContainer } from '@ant-design/pro-components';
import type { ColumnsType } from 'antd/es/table';
import { Card, Col, Empty, Result, Row, Space, Statistic, Table } from 'antd';
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

type TopStudentTableItem = API.TopStudentItem & { key: number };

const CompetencyAnalysisPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<API.CompetencyAnalysisResponse | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await getCompetencyAnalysis();
        if (response.success) {
          setData(response as API.CompetencyAnalysisResponse);
          return;
        }
        setError('未获取到能力评估数据');
      } catch (requestError: unknown) {
        setError(
          (requestError as any)?.response?.data?.detail ||
            (requestError as any)?.message ||
            '获取能力评估数据失败',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  if (error) {
    return (
      <PageContainer title="能力评估分析">
        <Result status="error" title="数据加载失败" subTitle={error} />
      </PageContainer>
    );
  }

  const radarData =
    data
      ? Object.entries(data.average_scores).map(([key, value]) => ({
          dimension: DIMENSION_LABELS[key] || key,
          value,
        }))
      : [];

  const scoreDistributionData =
    data?.score_distribution.flatMap((item) => [
      {
        dimension: DIMENSION_LABELS[item.dimension] || item.dimension,
        level: '高分段',
        count: item.high,
      },
      {
        dimension: DIMENSION_LABELS[item.dimension] || item.dimension,
        level: '中分段',
        count: item.medium,
      },
      {
        dimension: DIMENSION_LABELS[item.dimension] || item.dimension,
        level: '低分段',
        count: item.low,
      },
    ]) || [];

  const topStudentData: TopStudentTableItem[] =
    data?.top_students.map((item) => ({ ...item, key: item.user_id })) || [];

  const topStudentColumns: ColumnsType<TopStudentTableItem> = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 72,
      render: (_value, _record, index) => index + 1,
    },
    {
      title: '用户',
      dataIndex: 'display_name',
      ellipsis: true,
    },
    {
      title: '综合评分',
      dataIndex: 'overall_score',
      render: (value: number) => `${Math.round(value * 100)} 分`,
    },
  ];

  const hasData = Boolean(
    data &&
      (data.total_assessments > 0 ||
        radarData.length > 0 ||
        scoreDistributionData.length > 0 ||
        topStudentData.length > 0),
  );

  return (
    <PageContainer
      loading={loading}
      header={{
        title: '能力评估分析',
        subTitle: '汇总 12 维能力平均分、分段分布和学生排行。',
      }}
    >
      {!hasData ? (
        <Empty description="暂无能力评估数据" />
      ) : (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="已完成评估人数" value={data?.total_assessments ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="覆盖维度数" value={radarData.length} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="排行榜展示人数" value={topStudentData.length} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card title="12 维能力雷达图">
                {radarData.length > 0 ? (
                  <Radar
                    data={radarData}
                    xField="dimension"
                    yField="value"
                    meta={{
                      dimension: { alias: '维度' },
                      value: { alias: '平均得分' },
                    }}
                    area={{ style: { fillOpacity: 0.25 } }}
                    scale={{ y: { domainMin: 0, domainMax: 1 } }}
                    height={320}
                  />
                ) : (
                  <Empty description="暂无雷达图数据" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="TOP 10 学生能力排名">
                <Table
                  columns={topStudentColumns}
                  dataSource={topStudentData}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '暂无排行数据' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="各维度得分分布">
            {scoreDistributionData.length > 0 ? (
              <Column
                data={scoreDistributionData}
                xField="dimension"
                yField="count"
                seriesField="level"
                isStack
                label={{ position: 'middle' as const }}
                legend={{ position: 'top' as const }}
                color={['#52c41a', '#faad14', '#ff4d4f']}
                height={320}
              />
            ) : (
              <Empty description="暂无分段分布数据" />
            )}
          </Card>
        </Space>
      )}
    </PageContainer>
  );
};

export default CompetencyAnalysisPage;
