import { Card, Empty, List, Steps, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';

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
  low: '你当前处于低级阶段，可优先关注基础能力补齐与岗位入门要求。',
  middle: '你距离高级阶段还差关键项目沉淀、复杂问题分析与测试方案设计。',
  high: '你已处于高级阶段，可继续关注岗位深度拓展与跨团队协作能力。',
};

const useStyles = createStyles(({ css, token }) => ({
  wrap: css`
    display: grid;
    gap: 16px;
  `,
  split: css`
    display: grid;
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
    gap: 16px;

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
  detailCard: css`
    border-radius: ${token.borderRadiusLG}px;
  `,
  listCard: css`
    height: 100%;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
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
    padding: 12px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillAlter};
  `,
  metaLabel: css`
    margin-bottom: 4px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  gapHint: css`
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorInfoBg};
    color: ${token.colorText};
  `,
  detailWrap: css`
    display: grid;
    gap: 16px;
  `,
  panelTitle: css`
    margin: 0 0 16px;
  `,
}));

type StageMode = 'path' | 'detailed';

type VerticalTierComparisonProps = {
  comparison?: API.TieredVerticalComparisonPayload | null;
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
  return `${lower.toLocaleString()}–${upper.toLocaleString()} 元/月`;
};

const getTierSalarySummary = (tier: API.SalaryTierGroup): string => {
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

const getOrderedTiers = (tiers: API.SalaryTierGroup[]) =>
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
  const { styles } = useStyles();
  const tiers = useMemo(() => getOrderedTiers(comparison?.tiers || []), [comparison]);
  const defaultStage = currentStage || 'low';
  const [selectedStage, setSelectedStage] = useState<'low' | 'middle' | 'high'>(defaultStage);

  useEffect(() => {
    setSelectedStage(defaultStage);
  }, [defaultStage]);

  const selectedTier =
    tiers.find((tier) => getStageKeyByLevel(tier.level) === selectedStage) || tiers[0];

  if (!comparison) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const stepItems = tiers.map((tier) => {
    const stageKey = getStageKeyByLevel(tier.level);
    const showCountTag = mode === 'detailed';

    return {
      title: (
        <div className={styles.stepTitle}>
          <div className={styles.stepTitleText}>
            <span>{tier.level}</span>
            {stageKey === selectedStage ? (
              <Tag color={STAGE_ACCENT[stageKey]}>当前阶段</Tag>
            ) : null}
          </div>
          {showCountTag ? <Tag>{tier.items.length}</Tag> : null}
        </div>
      ),
      description: <div className={styles.stepDesc}>薪资参考：{getTierSalarySummary(tier)}</div>,
      status: stageKey === selectedStage ? 'process' : 'wait',
    };
  });

  if (mode === 'path') {
    return (
      <div className={styles.wrap} data-testid="vertical-tier-comparison">
        <Steps
          direction="vertical"
          current={STAGE_ORDER.indexOf(selectedStage)}
          items={stepItems}
        />
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
          <Steps
            direction="vertical"
            current={STAGE_ORDER.indexOf(selectedStage)}
            items={stepItems}
            onChange={(next) => setSelectedStage(STAGE_ORDER[next] || 'low')}
          />
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
                  <Card size="small" className={styles.listCard}>
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
    </div>
  );
};

export default VerticalTierComparison;
export { STAGE_TO_LEVEL, getStageKeyByLevel, getTierSalarySummary, getOrderedTiers };
