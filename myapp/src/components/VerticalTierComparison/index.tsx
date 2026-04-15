import {
  LoadingOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { Card, Descriptions, Drawer, Empty, List, Space, Spin, Steps, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';
import { getVerticalJobProfileCompanyDetail } from '@/services/ant-design-pro/api';

const STAGE_ORDER = ['low', 'middle', 'high'] as const;

const LEVEL_TO_STAGE: Record<string, (typeof STAGE_ORDER)[number]> = {
  低级: 'low',
  中级: 'middle',
  高级: 'high',
};

const STAGE_TO_LEVEL: Record<(typeof STAGE_ORDER)[number], string> = {
  low: '低级',
  middle: '中级',
  high: '高级',
};

const STAGE_ACCENT: Record<(typeof STAGE_ORDER)[number], string> = {
  low: '#1677ff',
  middle: '#fa8c16',
  high: '#52c41a',
};

const STAGE_GAP_HINT: Record<(typeof STAGE_ORDER)[number], string> = {
  low: '初级阶段，通常对应入门级岗位，侧重基础技能与行业认知。',
  middle: '中级阶段，对应具备一定经验的岗位，强调独立解决问题的能力。',
  high: '高级阶段，对应资深或专家级岗位，注重项目沉淀与团队协作。',
};

const useStyles = createStyles(({ css, token }) => ({
  wrap: css`
    display: grid;
    gap: 20px;
  `,
  split: css`
    display: grid;
    grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
    gap: 20px;

    @media (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  `,
  stepTitle: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  `,
  stepTitleText: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  `,
  stepDesc: css`
    display: grid;
    gap: 4px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  stepCardWrap: css`
    :global(.ant-steps-item-title) {
      padding: 0 !important;
    }

    :global(.ant-steps-item-description) {
      max-width: 100% !important;
    }

    :global(.ant-steps-item-tail)::after {
      background-color: ${token.colorFillSecondary};
    }
  `,
  stepCard: css`
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    cursor: pointer;
    transition: all 0.2s ease;

    :hover {
      border-color: ${token.colorPrimary};
      background: ${token.colorPrimaryBg};
      transform: translateX(2px);
      box-shadow: 0 2px 8px rgba(22, 119, 255, 0.12);
    }

    :active {
      transform: translateX(0);
    }
  `,
  stepCardActive: css`
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid ${token.colorPrimary};
    background: ${token.colorPrimaryBg} !important;
    box-shadow: 0 2px 12px rgba(22, 119, 255, 0.18);
    cursor: default;

    :hover {
      transform: none;
      box-shadow: 0 2px 12px rgba(22, 119, 255, 0.18);
    }
  `,
  detailCard: css`
    border-radius: ${token.borderRadiusLG}px;
  `,
  listCard: css`
    height: 100%;
    border-radius: 12px;
    border: 1px solid ${token.colorBorder};
    background: ${token.colorBgContainer};
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;

    :global(.ant-card-body) {
      padding: 16px;
    }

    :hover {
      transform: translateY(-3px);
      border-color: ${token.colorPrimary};
      box-shadow: 0 6px 20px rgba(22, 119, 255, 0.14);
    }

    :active {
      transform: translateY(0);
      box-shadow: none;
    }
  `,
  listMeta: css`
    display: grid;
    gap: 12px;
  `,
  metaRow: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  metaItem: css`
    padding: 8px 10px;
    border-radius: 8px;
    background: ${token.colorFillAlter};
    transition: background 0.2s ease;

    :hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  metaLabel: css`
    margin-bottom: 4px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  gapHint: css`
    margin-top: 4px;
    padding: 14px 18px;
    border-radius: 12px;
    border-left: 4px solid ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    color: ${token.colorText};
    transition: all 0.2s ease;

    :hover {
      background: ${token.colorFillTertiary};
      box-shadow: 0 2px 8px rgba(22, 119, 255, 0.1);
    }
  `,
  detailWrap: css`
    display: grid;
    gap: 16px;
  `,
  panelTitle: css`
    margin: 0 0 16px;
  `,
  drawerBody: css`
    display: grid;
    gap: 16px;
  `,
  detailSection: css`
    display: grid;
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
  `,
  detailParagraph: css`
    margin-bottom: 0;
    white-space: pre-wrap;
    line-height: 1.8;
    color: ${token.colorText};
  `,
  overviewTag: css`
    margin-bottom: 4px;
  `,
}));

type SalaryTierItem = {
  company_name: string;
  industry: string;
  salary_range?: string;
  salary_sort_label?: string;
  salary_sort_value?: number;
};

type SalaryTierGroup = {
  level: string;
  items: SalaryTierItem[];
};

type TieredVerticalComparisonPayload = {
  job_title: string;
  tiers: SalaryTierGroup[];
};

type StageMode = 'path' | 'detailed';

type VerticalTierComparisonProps = {
  comparison?: TieredVerticalComparisonPayload | null;
  currentStage?: 'low' | 'middle' | 'high' | null;
  mode?: StageMode;
};

const getStageKeyByLevel = (level: string): 'low' | 'middle' | 'high' =>
  LEVEL_TO_STAGE[level] || 'low';

const formatMonthlyRange = (values: number[]) => {
  if (!values.length) {
    return '-';
  }
  const sorted = [...values].sort((left, right) => left - right);
  const lower = Math.round(sorted[0]);
  const upper = Math.round(sorted[sorted.length - 1]);
  return `${lower.toLocaleString()}-${upper.toLocaleString()} 元/月`;
};

const getTierSalarySummary = (tier: SalaryTierGroup): string => {
  const labels = tier.items
    .map((item) => item.salary_sort_label || item.salary_range)
    .filter(Boolean) as string[];

  if (tier.items.length === 1 && labels[0]) {
    return labels[0];
  }

  const values = tier.items
    .map((item) => item.salary_sort_value)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));

  if (values.length) {
    return formatMonthlyRange(values);
  }

  return labels[0] || '-';
};

const getOrderedTiers = (tiers: SalaryTierGroup[]) =>
  [...tiers].sort(
    (left, right) =>
      STAGE_ORDER.indexOf(getStageKeyByLevel(left.level)) -
      STAGE_ORDER.indexOf(getStageKeyByLevel(right.level)),
  );

const VerticalTierComparison: React.FC<VerticalTierComparisonProps> = ({
  comparison,
  currentStage,
  mode = 'detailed',
}) => {
  const { styles, theme: token } = useStyles();
  const tiers = useMemo(() => getOrderedTiers(comparison?.tiers || []), [comparison]);
  const defaultStage = currentStage || 'low';
  const [selectedStage, setSelectedStage] = useState<'low' | 'middle' | 'high'>(defaultStage);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [companyDetail, setCompanyDetail] = useState<API.VerticalJobProfileCompanyDetailPayload>();

  useEffect(() => {
    setSelectedStage(defaultStage);
  }, [defaultStage]);

  const selectedTier =
    tiers.find((tier) => getStageKeyByLevel(tier.level) === selectedStage) || tiers[0];

  const openDetail = async (item: SalaryTierItem) => {
    if (!comparison?.job_title) return;
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const response = await getVerticalJobProfileCompanyDetail(
        { job_title: comparison.job_title, industry: item.industry, company_name: item.company_name },
        { skipErrorHandler: true },
      );
      setCompanyDetail(response.data);
    } catch {
      setCompanyDetail(undefined);
    } finally {
      setDrawerLoading(false);
    }
  };

  if (!comparison) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const stepItems = tiers.map((tier) => {
    const stageKey = getStageKeyByLevel(tier.level);
    const showCountTag = mode === 'detailed';
    const isActive = stageKey === selectedStage;

    return {
      title: (
        <div className={isActive ? styles.stepCardActive : styles.stepCard}>
          <div className={styles.stepTitle}>
            <div className={styles.stepTitleText}>
              <span>{tier.level}</span>
              {isActive ? (
                <Tag color={STAGE_ACCENT[stageKey]}>当前阶段</Tag>
              ) : null}
            </div>
            {showCountTag ? <Tag>{tier.items.length}</Tag> : null}
          </div>
          <div className={styles.stepDesc}>薪资参考：{getTierSalarySummary(tier)}</div>
        </div>
      ),
      status: 'wait',
    };
  });

  if (mode === 'path') {
    return (
      <div className={styles.wrap} data-testid="vertical-tier-comparison">
        <div className={styles.stepCardWrap}>
          <Steps
            direction="vertical"
            current={-1}
            items={stepItems}
          />
        </div>
        <div className={styles.gapHint}>{STAGE_GAP_HINT[selectedStage]}</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-testid="vertical-tier-comparison">
      <div className={styles.split}>
        <div>
          <Typography.Title level={5} className={styles.panelTitle}>
            阶段路径
          </Typography.Title>
          <div className={styles.stepCardWrap}>
            <Steps
              direction="vertical"
              current={-1}
              items={stepItems}
              onChange={(next) => setSelectedStage(STAGE_ORDER[next] || 'low')}
            />
          </div>
        </div>
        <div className={styles.detailWrap}>
          <div className={styles.stepTitle}>
            <Typography.Title level={5} className={styles.panelTitle} style={{ marginBottom: 0 }}>
              {selectedTier?.level || '阶段详情'}
            </Typography.Title>
            {selectedTier ? <Tag color={STAGE_ACCENT[selectedStage]}>{selectedTier.items.length}</Tag> : null}
          </div>
          {selectedTier?.items.length ? (
            <List
              grid={{ gutter: 16, xs: 1, md: 2 }}
              dataSource={selectedTier.items}
              renderItem={(item) => (
                <List.Item>
                  <Card
                    size="small"
                    className={styles.listCard}
                    onClick={() => void openDetail(item)}
                    extra={
                      <ReadOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                    }
                  >
                    <div className={styles.listMeta}>
                      <Typography.Text strong>{item.company_name}</Typography.Text>
                      <div className={styles.metaRow}>
                        <div className={styles.metaItem}>
                          <div className={styles.metaLabel}>行业</div>
                          <Typography.Text>{item.industry}</Typography.Text>
                        </div>
                        <div className={styles.metaItem}>
                          <div className={styles.metaLabel}>薪资参考</div>
                          <Typography.Text>{item.salary_sort_label || item.salary_range || '-'}</Typography.Text>
                        </div>
                      </div>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </div>

      <Drawer
        title={companyDetail ? `${companyDetail.summary.company_name} - ${companyDetail.summary.job_title}` : '公司详情'}
        width={960}
        open={drawerOpen}
        destroyOnClose
        onClose={() => {
          setDrawerOpen(false);
          setCompanyDetail(undefined);
        }}
      >
        {drawerLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spin indicator={<LoadingOutlined spin />} />
          </div>
        ) : companyDetail ? (
          <div className={styles.drawerBody}>
            <Card>
              <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small">
                <Descriptions.Item label="公司">{companyDetail.summary.company_name}</Descriptions.Item>
                <Descriptions.Item label="行业">{companyDetail.summary.industry}</Descriptions.Item>
                <Descriptions.Item label="职位">{companyDetail.summary.job_title}</Descriptions.Item>
                <Descriptions.Item label="招聘帖子数">{companyDetail.summary.posting_count}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="薪资范围">
              <Space wrap size={[8, 8]}>
                {companyDetail.summary.salary_ranges.map((r) => (
                  <Tag key={r} color="blue">{r}</Tag>
                ))}
              </Space>
            </Card>

            <Card title="公司概览">
              <div className={styles.detailSection}>
                <Typography.Text strong>公司规模</Typography.Text>
                <div>
                  {companyDetail.overview.company_sizes.map((s) => (
                    <Tag key={s} className={styles.overviewTag}>{s}</Tag>
                  ))}
                </div>
              </div>
              <div className={styles.detailSection}>
                <Typography.Text strong>公司类型</Typography.Text>
                <div>
                  {companyDetail.overview.company_types.map((t) => (
                    <Tag key={t} className={styles.overviewTag}>{t}</Tag>
                  ))}
                </div>
              </div>
              <div className={styles.detailSection}>
                <Typography.Text strong>工作地址</Typography.Text>
                <div>
                  {companyDetail.overview.addresses.map((a) => (
                    <Tag key={a} className={styles.overviewTag}>{a}</Tag>
                  ))}
                </div>
              </div>
            </Card>

            <section className={styles.detailSection}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                招聘原文摘录
              </Typography.Title>
              {companyDetail.postings.length ? (
                companyDetail.postings.slice(0, 10).map((posting) => (
                  <div key={posting.id} style={{ marginTop: 12 }}>
                    {posting.job_detail ? (
                      <Typography.Paragraph className={styles.detailParagraph}>
                        {posting.job_detail}
                      </Typography.Paragraph>
                    ) : null}
                    {posting.company_detail ? (
                      <Typography.Paragraph type="secondary" style={{ marginTop: 4, fontSize: 12 }}>
                        {posting.company_detail}
                      </Typography.Paragraph>
                    ) : null}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {posting.address && `地址: ${posting.address}`}
                      {posting.address && posting.salary_range && ' | '}
                      {posting.salary_range}
                    </Typography.Text>
                  </div>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无原文数据" />
              )}
            </section>
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无详情数据" />
        )}
      </Drawer>
    </div>
  );
};

export default VerticalTierComparison;
export { STAGE_TO_LEVEL, getStageKeyByLevel, getTierSalarySummary, getOrderedTiers };
