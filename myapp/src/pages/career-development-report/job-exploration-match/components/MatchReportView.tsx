import { Radar } from '@ant-design/charts';
import { StarFilled, StarOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import React, { useMemo } from 'react';
import MatchEvidenceSection from './MatchEvidenceSection';

const GROUP_ORDER = [
  { key: 'professional-and-threshold', label: '专业与门槛' },
  { key: 'collaboration-and-adaptation', label: '协作与适应' },
  { key: 'growth-and-professionalism', label: '成长与职业素养' },
] as const;

const DIMENSION_TO_GROUP_KEY: Record<string, string> = {
  professional_skills: 'professional-and-threshold',
  professional_background: 'professional-and-threshold',
  education_requirement: 'professional-and-threshold',
  teamwork: 'collaboration-and-adaptation',
  stress_adaptability: 'collaboration-and-adaptation',
  communication: 'collaboration-and-adaptation',
  work_experience: 'growth-and-professionalism',
  documentation_awareness: 'growth-and-professionalism',
  responsibility: 'growth-and-professionalism',
  learning_ability: 'growth-and-professionalism',
  problem_solving: 'growth-and-professionalism',
  other_special: 'growth-and-professionalism',
};

const STATUS_COLOR_MAP: Record<string, string> = {
  高契合: 'success',
  基础契合: 'processing',
  待补强: 'warning',
  明显差距: 'error',
};

const normalizeComparableValue = (value: string) => value.toLowerCase().replace(/\s+/g, '').trim();

const hasKeywordOverlap = (left: string, right: string) => {
  const normalizedLeft = normalizeComparableValue(left);
  const normalizedRight = normalizeComparableValue(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
};

const formatPercent = (value?: number) => `${Math.round(value || 0)}%`;

type Props = {
  report?: API.CareerDevelopmentMatchReport;
  emptyText?: string;
  favorite?: API.CareerDevelopmentFavoritePayload;
  favoriteSubmitting?: boolean;
  favoriteSourceKind?: 'recommendation' | 'custom';
  onToggleFavorite?: (
    report: API.CareerDevelopmentMatchReport,
    favorite?: API.CareerDevelopmentFavoritePayload,
  ) => void;
  onOpenCompanyDetail: (params: {
    jobTitle: string;
    industry: string;
    companyName: string;
  }) => void;
};

const renderMetricTile = (label: string, value: string, tone?: 'danger') => (
  <div
    style={{
      padding: 12,
      borderRadius: 14,
      border: tone === 'danger' ? '1px solid #fff1f0' : '1px solid #f0f0f0',
      background: tone === 'danger' ? '#fff7f6' : '#fff',
    }}
  >
    <Typography.Text type="secondary">{label}</Typography.Text>
    <div>
      <Typography.Text strong type={tone === 'danger' ? 'danger' : undefined}>
        {value}
      </Typography.Text>
    </div>
  </div>
);

const MatchReportView: React.FC<Props> = ({
  report,
  emptyText,
  favorite,
  favoriteSubmitting,
  favoriteSourceKind,
  onToggleFavorite,
  onOpenCompanyDetail,
}) => {
  const comparisonByKey = useMemo(
    () =>
      Object.fromEntries(
        (report?.comparison_dimensions || []).map((item) => [item.key, item] as const),
      ),
    [report?.comparison_dimensions],
  );

  const radarData = useMemo(
    () =>
      (report?.chart_series || []).flatMap((item) => [
        {
          dimension: item.title,
          category: '目标要求',
          value: item.market_importance,
        },
        {
          dimension: item.title,
          category: '当前契合度',
          value: item.user_readiness,
        },
      ]),
    [report?.chart_series],
  );

  const groupedDimensions = useMemo(() => {
    const advices = report?.action_advices || [];
    return GROUP_ORDER.map((group) => ({
      ...group,
      rows: (report?.group_summaries.find((item) => item.group_key === group.key)?.dimension_keys || [])
        .map((key) => comparisonByKey[key])
        .filter(Boolean),
      advices: advices
        .filter((item) => DIMENSION_TO_GROUP_KEY[item.key] === group.key)
        .sort((left, right) => right.gap - left.gap),
      summary: report?.group_summaries.find((item) => item.group_key === group.key),
    }));
  }, [comparisonByKey, report?.action_advices, report?.group_summaries]);

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

  if (!report) {
    return <Empty description={emptyText || '当前暂无可展示的匹配报告'} />;
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Card style={{ borderRadius: 20 }} styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
                {report.target_title}
              </Typography.Title>
              <Space wrap>
                <Tag color="blue">{report.canonical_job_title}</Tag>
                {report.industry ? <Tag color="cyan">{report.industry}</Tag> : null}
                {report.representative_job_title ? <Tag>{report.representative_job_title}</Tag> : null}
              </Space>
            </div>
            {onToggleFavorite ? (
              <Button
                icon={favorite ? <StarFilled /> : <StarOutlined />}
                loading={favoriteSubmitting}
                type={favorite ? 'primary' : 'default'}
                onClick={() => onToggleFavorite(report, favorite)}
              >
                {favorite ? '取消收藏' : favoriteSourceKind === 'custom' ? '收藏行业报告' : '收藏'}
              </Button>
            ) : null}
          </div>

          {report.narrative?.overall_review ? (
            <Alert showIcon type="info" message="匹配结论" description={report.narrative.overall_review} />
          ) : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card variant="borderless" style={{ background: '#fafafa' }}>
                <Statistic title="总体契合度" value={report.overall_match} suffix="%" />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card variant="borderless" style={{ background: '#fafafa' }}>
                <Statistic title="高契合维度" value={report.strength_dimension_count} suffix="项" />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card variant="borderless" style={{ background: '#fafafa' }}>
                <Statistic title="优先补强维度" value={report.priority_gap_dimension_count} suffix="项" />
              </Card>
            </Col>
          </Row>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={13}>
          <Card title="目标要求 vs 当前契合度" style={{ borderRadius: 20, height: '100%' }}>
            {radarData.length ? <Radar {...(radarConfig as any)} /> : <Empty description="当前暂无雷达图数据" />}
          </Card>
        </Col>
        <Col xs={24} xl={11}>
          <Card title="三大维摘要" style={{ borderRadius: 20, height: '100%' }} styles={{ body: { padding: 20 } }}>
            <Collapse
              items={groupedDimensions.map((group) => ({
                key: group.key,
                label: (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Space wrap>
                      <Typography.Text strong>{group.label}</Typography.Text>
                      <Tag color={STATUS_COLOR_MAP[group.summary?.status_label || ''] || 'default'}>
                        {group.summary?.status_label || '待评估'}
                      </Tag>
                    </Space>
                    <Typography.Text>{formatPercent(group.summary?.match_score)}</Typography.Text>
                  </div>
                ),
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        background: '#fafafa',
                        border: '1px solid #f0f0f0',
                      }}
                    >
                      <Progress percent={Math.round(group.summary?.match_score || 0)} showInfo={false} />
                      <Typography.Text type="secondary">
                        目标要求 {formatPercent(group.summary?.target_requirement)} · 当前契合{' '}
                        {formatPercent(group.summary?.match_score)} · 仍差 {formatPercent(group.summary?.gap)}
                      </Typography.Text>
                      {group.advices[0] ? (
                        <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
                          当前这组最需要先补的是“{group.advices[0].title}”，先把缺失证据与关键词补齐，提升会更直接。
                        </Typography.Paragraph>
                      ) : null}
                    </div>
                    {group.advices.length ? (
                      group.advices.map((advice) => {
                        const dimension = comparisonByKey[advice.key];
                        const missingKeywords = dimension?.missing_market_keywords || [];
                        const matchedKeywords = dimension?.matched_market_keywords || [];
                        const existingEvidence =
                          matchedKeywords.length > 0
                            ? matchedKeywords
                            : (dimension?.user_values || []).filter((value) =>
                                (dimension?.market_keywords || []).some((keyword) =>
                                  hasKeywordOverlap(value, keyword),
                                ),
                              );
                        const suggestedActions = advice.next_actions.slice(0, 3);
                        const expressionKeywords = Array.from(
                          new Set([
                            ...(advice.recommended_keywords || []),
                            ...(advice.example_phrases || []),
                          ]),
                        );

                        return (
                          <div
                            key={advice.key}
                            data-testid={`diagnostic-card-${advice.key}`}
                            style={{
                              padding: 16,
                              borderRadius: 16,
                              border: '1px solid #f0f0f0',
                              background: '#fafafa',
                            }}
                          >
                            <Space wrap style={{ marginBottom: 12 }}>
                              <Typography.Text strong>{advice.title}</Typography.Text>
                              <Tag color={STATUS_COLOR_MAP[advice.status_label] || 'default'}>
                                {advice.status_label}
                              </Tag>
                              <Tag color="error">差距 {formatPercent(advice.gap)}</Tag>
                            </Space>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                gap: 10,
                                marginBottom: 14,
                              }}
                            >
                              {renderMetricTile('目标要求', formatPercent(dimension?.market_target))}
                              {renderMetricTile('当前契合', formatPercent(dimension?.user_readiness))}
                              {renderMetricTile('还差多少', formatPercent(advice.gap), 'danger')}
                            </div>

                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                              <div>
                                <Typography.Text strong>你现在缺什么</Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                  {missingKeywords.length ? (
                                    <Space wrap>
                                      {missingKeywords.map((item) => (
                                        <Tag color="error" key={`${advice.key}-missing-${item}`}>
                                          {item}
                                        </Tag>
                                      ))}
                                    </Space>
                                  ) : (
                                    <Typography.Text type="secondary">
                                      {advice.current_issue || '当前缺口还没有被提炼成明确关键词。'}
                                    </Typography.Text>
                                  )}
                                </div>
                              </div>

                              <div>
                                <Typography.Text strong>你已经有什么</Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                  {existingEvidence.length ? (
                                    <Space wrap>
                                      {existingEvidence.map((item) => (
                                        <Tag color="success" key={`${advice.key}-evidence-${item}`}>
                                          {item}
                                        </Tag>
                                      ))}
                                    </Space>
                                  ) : (
                                    <Typography.Text type="secondary">当前还没有足够明确的对位证据。</Typography.Text>
                                  )}
                                </div>
                              </div>

                              <div>
                                <Typography.Text strong>优先补什么</Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                  {suggestedActions.length ? (
                                    <Space direction="vertical" size={4}>
                                      {suggestedActions.map((item) => (
                                        <Typography.Text key={item}>{item}</Typography.Text>
                                      ))}
                                    </Space>
                                  ) : (
                                    <Typography.Text type="secondary">当前没有额外动作建议。</Typography.Text>
                                  )}
                                </div>
                              </div>

                              <div>
                                <Typography.Text strong>可直接补进表达里</Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                  {expressionKeywords.length ? (
                                    <Space wrap>
                                      {expressionKeywords.map((item) => (
                                        <Tag color="gold" key={`${advice.key}-expression-${item}`}>
                                          {item}
                                        </Tag>
                                      ))}
                                    </Space>
                                  ) : (
                                    <Typography.Text type="secondary">先补动作和结果，再回写成岗位表达。</Typography.Text>
                                  )}
                                </div>
                              </div>
                            </Space>
                          </div>
                        );
                      })
                    ) : (
                      <Empty description="当前该维度组暂无优先补强建议" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </Space>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Card title="三大维摘要详细对比" style={{ borderRadius: 20 }} styles={{ body: { padding: 20 } }}>
        <Collapse
          items={groupedDimensions.map((group) => ({
            key: group.key,
            label: (
              <Space wrap>
                <Typography.Text strong>{group.label}</Typography.Text>
                <Tag>{group.rows.length} 项小维度</Tag>
              </Space>
            ),
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {group.rows.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: '#fafafa',
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginBottom: 8,
                      }}
                    >
                      <Space wrap>
                        <Typography.Text strong>{item.title}</Typography.Text>
                        <Tag color={STATUS_COLOR_MAP[item.status_label] || 'default'}>
                          {item.status_label}
                        </Tag>
                      </Space>
                      <Space wrap>
                        <Typography.Text>契合度 {formatPercent(item.user_readiness)}</Typography.Text>
                        <Typography.Text type={item.gap > 0 ? 'danger' : 'secondary'}>
                          差距 {formatPercent(item.gap)}
                        </Typography.Text>
                      </Space>
                    </div>
                    <Progress percent={Math.round(item.user_readiness)} showInfo={false} />
                    <div style={{ marginTop: 10 }}>
                      <Typography.Text strong>你的画像</Typography.Text>
                      <div style={{ marginTop: 6 }}>
                        <Space wrap>
                          {item.user_values.length ? (
                            item.user_values.map((value) => {
                              const overlapped = item.market_keywords.some((keyword) =>
                                hasKeywordOverlap(value, keyword),
                              );
                              return (
                                <Tag
                                  color={overlapped ? 'green' : undefined}
                                  data-overlap={overlapped ? 'true' : 'false'}
                                  key={`${item.key}-source-${value}`}
                                >
                                  {value}
                                </Tag>
                              );
                            })
                          ) : (
                            <Typography.Text type="secondary">暂无明确信息</Typography.Text>
                          )}
                        </Space>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Typography.Text strong>目标画像</Typography.Text>
                      <div style={{ marginTop: 6 }}>
                        <Space wrap>
                          {item.market_keywords.length ? (
                            item.market_keywords.map((value) => {
                              const overlapped = item.user_values.some((userValue) =>
                                hasKeywordOverlap(userValue, value),
                              );
                              return (
                                <Tag
                                  color={overlapped ? 'green' : 'blue'}
                                  data-overlap={overlapped ? 'true' : 'false'}
                                  key={`${item.key}-target-${value}`}
                                >
                                  {value}
                                </Tag>
                              );
                            })
                          ) : (
                            <Typography.Text type="secondary">当前目标未强调该维度</Typography.Text>
                          )}
                        </Space>
                      </div>
                    </div>
                  </div>
                ))}
              </Space>
            ),
          }))}
        />
      </Card>

      <MatchEvidenceSection report={report} onOpenCompanyDetail={onOpenCompanyDetail} />
    </Space>
  );
};

export default MatchReportView;
