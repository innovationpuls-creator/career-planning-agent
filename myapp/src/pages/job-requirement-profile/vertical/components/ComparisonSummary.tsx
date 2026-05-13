import { ApartmentOutlined, BarChartOutlined, RadarChartOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import { ClaudeStatCard } from '@/components/ui';
import { claudeColors } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,
}));

const getMaxGapDimension = (
  tiers?: API.VerticalTierDimensionComparison[],
) => {
  const coverageMap = new Map<string, { title: string; values: number[] }>();

  tiers?.forEach((tier) => {
    tier.industries.forEach((industry) => {
      industry.dimensions.forEach((dimension) => {
        const item = coverageMap.get(dimension.key) || {
          title: dimension.title,
          values: [],
        };
        item.values.push(dimension.coverage_ratio);
        coverageMap.set(dimension.key, item);
      });
    });
  });

  return [...coverageMap.values()]
    .map((item) => ({
      title: item.title,
      gap: Math.max(...item.values) - Math.min(...item.values),
    }))
    .sort((left, right) => right.gap - left.gap)[0]?.title;
};

export const ComparisonSummary: React.FC<{
  data?: API.VerticalJobProfilePayload;
}> = ({ data }) => {
  const { styles } = useStyles();
  const coveredDimensions = useMemo(() => {
    const keys = new Set<string>();
    data?.dimension_comparison?.forEach((tier) => {
      tier.industries.forEach((industry) => {
        industry.dimensions.forEach((dimension) => {
          if (dimension.non_default_count > 0) keys.add(dimension.key);
        });
      });
    });
    return keys.size;
  }, [data]);
  const maxGapDimension = useMemo(
    () => getMaxGapDimension(data?.dimension_comparison),
    [data],
  );

  return (
    <div className={styles.grid} data-testid="comparison-summary">
      <ClaudeStatCard
        icon={<ApartmentOutlined />}
        iconColor={claudeColors.terracotta}
        title="对比行业数"
        value={data?.meta.total_industries || 0}
        unit="个"
        variant="glass"
      />
      <ClaudeStatCard
        icon={<RadarChartOutlined />}
        iconColor={claudeColors.success}
        title="维度覆盖数"
        value={coveredDimensions}
        unit="/ 12"
        variant="glass"
      />
      <ClaudeStatCard
        icon={<BarChartOutlined />}
        iconColor={claudeColors.warning}
        title="最大差异维度"
        value={maxGapDimension || '—'}
        variant="glass"
      />
    </div>
  );
};
