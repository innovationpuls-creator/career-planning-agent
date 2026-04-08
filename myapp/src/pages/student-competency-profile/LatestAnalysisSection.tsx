import { Radar } from '@ant-design/charts';
import { Alert, Card, Col, Empty, Progress, Row, Space, Statistic, Tag, Typography } from 'antd';
import React, { useMemo } from 'react';

const { Title, Text } = Typography;

type Props = {
  analysis?: API.StudentCompetencyLatestAnalysisPayload;
  loading?: boolean;
};

const STATUS_COLOR_MAP: Record<string, string> = {
  明显缺失: 'error',
  信息偏弱: 'warning',
  基础覆盖: 'processing',
  较强匹配: 'success',
};

const GAP_PROGRESS_COLOR_MAP: Record<string, string> = {
  明显缺失: '#ff4d4f',
  信息偏弱: '#faad14',
  基础覆盖: '#1677ff',
  较强匹配: '#52c41a',
};

const LatestAnalysisSection: React.FC<Props> = ({ analysis, loading = false }) => {
  const itemsByKey = useMemo(
    () =>
      Object.fromEntries(
        (analysis?.comparison_dimensions || []).map((item) => [item.key, item] as const),
      ),
    [analysis?.comparison_dimensions],
  );

  const radarData = useMemo(
    () =>
      (analysis?.chart_series || []).flatMap((item) => [
        {
          dimension: item.title,
          category: '市场重要度',
          value: item.market_importance,
        },
        {
          dimension: item.title,
          category: '用户准备度',
          value: item.user_readiness,
        },
      ]),
    [analysis?.chart_series],
  );

  const radarConfig = useMemo(
    () => ({
      data: radarData,
      xField: 'dimension',
      yField: 'value',
      colorField: 'category',
      scale: { y: { domain: [0, 100] } },
      area: {
        style: {
          fillOpacity: 0.12,
        },
      },
      point: {
        size: 2,
      },
      axis: {
        y: {
          labelFormatter: (value: string) => `${value}%`,
        },
      },
      legend: {
        position: 'bottom',
      },
    }),
    [radarData],
  );

  return (
    <Card
      title="岗位对标分析"
      loading={loading}
      style={{ borderRadius: 18 }}
      styles={{ body: { padding: 20 } }}
    >
      {!analysis ? (
        <Empty description="正在加载最近一次岗位对标分析" />
      ) : !analysis.available ? (
        analysis.workspace_conversation_id || analysis.profile ? (
          <Alert
            type="warning"
            showIcon
            message="岗位对标分析暂不可用"
            description={analysis.message || '暂无可展示的岗位对标结果。'}
          />
        ) : (
          <Empty
            description={
              <Space direction="vertical" size={6}>
                <Text strong>暂无最新画像分析</Text>
                <Text type="secondary">
                  先生成或保存一份结构化 12 维学生画像，再查看岗位对标评分。
                </Text>
              </Space>
            }
          />
        )
      ) : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              综合评分
            </Title>
            <Text type="secondary">
              {analysis.narrative?.overall_review ||
                analysis.message ||
                '基于最近一次结构化画像与岗位总览基准生成。'}
            </Text>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card variant="borderless" style={{ background: '#fafafa' }}>
                <Statistic title="完整度" value={analysis.score?.completeness || 0} suffix="分" />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card variant="borderless" style={{ background: '#fafafa' }}>
                <Statistic title="竞争力" value={analysis.score?.competitiveness || 0} suffix="分" />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card variant="borderless" style={{ background: '#fafafa' }}>
                <Statistic title="综合评分" value={analysis.score?.overall || 0} suffix="分" />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card title="市场重要度 vs 用户准备度" style={{ height: '100%' }}>
                {radarData.length ? <Radar {...(radarConfig as any)} /> : <Empty description="暂无雷达图数据" />}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="维度缺口" style={{ height: '100%' }}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {(analysis.comparison_dimensions || []).slice(0, 6).map((item) => (
                    <div key={item.key}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginBottom: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Text strong>{item.title}</Text>
                        <Space size={8} wrap>
                          <Tag color={STATUS_COLOR_MAP[item.status_label] || 'default'}>
                            {item.status_label}
                          </Tag>
                          <Text type={item.gap > 0 ? 'danger' : 'secondary'}>
                            gap {item.gap > 0 ? item.gap : 0}
                          </Text>
                        </Space>
                      </div>
                      <Progress
                        percent={Math.max(0, Math.min(100, Math.round(item.user_readiness)))}
                        showInfo={false}
                        strokeColor={GAP_PROGRESS_COLOR_MAP[item.status_label] || '#1677ff'}
                      />
                      <Text type="secondary" style={{ display: 'block' }}>
                        用户画像：{item.user_values.length ? item.user_values.join('、') : '暂无明确信息'}
                      </Text>
                      {item.missing_market_keywords.length ? (
                        <Text type="secondary" style={{ display: 'block' }}>
                          待补高频词：{item.missing_market_keywords.slice(0, 3).join('、')}
                        </Text>
                      ) : null}
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Card title="优势维度" style={{ height: '100%' }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {(analysis.strength_dimensions || []).length ? (
                    analysis.strength_dimensions.map((key) => {
                      const item = itemsByKey[key];
                      if (!item) return null;
                      return (
                        <div key={key}>
                          <Space size={8} wrap>
                            <Text strong>{item.title}</Text>
                            <Tag color={STATUS_COLOR_MAP[item.status_label] || 'success'}>
                              {item.status_label}
                            </Tag>
                          </Space>
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {item.user_values.map((value) => (
                              <Tag
                                key={`${key}-${value}`}
                                style={{ marginInlineEnd: 0, whiteSpace: 'normal', height: 'auto' }}
                              >
                                {value}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Text type="secondary">暂无明显优势维度。</Text>
                  )}
                </Space>
              </Card>
            </Col>
            <Col xs={24} lg={16}>
              <Card title="优先补强行动卡片" style={{ height: '100%' }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {(analysis.action_advices || []).length ? (
                    analysis.action_advices.map((advice) => (
                      <div
                        key={advice.key}
                        style={{
                          border: '1px solid #f0f0f0',
                          borderRadius: 12,
                          padding: 14,
                          background: '#fafafa',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            flexWrap: 'wrap',
                            marginBottom: 10,
                          }}
                        >
                          <Space size={8} wrap>
                            <Text strong>{advice.title}</Text>
                            <Tag color={STATUS_COLOR_MAP[advice.status_label] || 'default'}>
                              {advice.status_label}
                            </Tag>
                          </Space>
                          <Text type="danger">gap {advice.gap}</Text>
                        </div>

                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <div>
                            <Text strong>为什么重要</Text>
                            <div>
                              <Text type="secondary">{advice.why_it_matters}</Text>
                            </div>
                          </div>

                          <div>
                            <Text strong>当前问题</Text>
                            <div>
                              <Text type="secondary">{advice.current_issue}</Text>
                            </div>
                          </div>

                          <div>
                            <Text strong>优先补什么</Text>
                            <div style={{ marginTop: 6 }}>
                              <Space direction="vertical" size={4}>
                                {advice.next_actions.map((item) => (
                                  <Text key={item}>{item}</Text>
                                ))}
                              </Space>
                            </div>
                          </div>

                          <div>
                            <Text strong>可直接补的表达</Text>
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {advice.example_phrases.map((item) => (
                                <Tag
                                  key={item}
                                  color="processing"
                                  style={{ marginInlineEnd: 0, whiteSpace: 'normal', height: 'auto' }}
                                >
                                  {item}
                                </Tag>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Text strong>建议从这些素材里提取</Text>
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {advice.evidence_sources.map((item) => (
                                <Tag key={item} style={{ marginInlineEnd: 0 }}>
                                  {item}
                                </Tag>
                              ))}
                            </div>
                          </div>

                          {advice.recommended_keywords.length ? (
                            <div>
                              <Text strong>优先对齐的高频词</Text>
                              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {advice.recommended_keywords.map((item) => (
                                  <Tag key={item} color="gold" style={{ marginInlineEnd: 0 }}>
                                    {item}
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </Space>
                      </div>
                    ))
                  ) : (
                    <Text type="secondary">暂无需要优先补强的维度。</Text>
                  )}
                </Space>
              </Card>
            </Col>
          </Row>

          {analysis.narrative ? (
            <Card title="评分说明">
              <Space direction="vertical" size={10}>
                <Text>{analysis.narrative.completeness_explanation}</Text>
                <Text>{analysis.narrative.competitiveness_explanation}</Text>
                {analysis.narrative.strength_highlights.map((item) => (
                  <Text key={item}>{item}</Text>
                ))}
                {analysis.narrative.priority_gap_highlights.map((item) => (
                  <Text key={item}>{item}</Text>
                ))}
              </Space>
            </Card>
          ) : null}
        </Space>
      )}
    </Card>
  );
};

export default LatestAnalysisSection;
