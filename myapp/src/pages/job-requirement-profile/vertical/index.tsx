import { PageContainer } from '@ant-design/pro-components';
import { Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';
import { ComparisonSummary } from './components/ComparisonSummary';
import { FilterBar } from './components/FilterBar';
import { TierComparison } from './components/TierComparison';
import { useComparisonData } from './hooks/useComparisonData';

const useStyles = createStyles(({ css }) => ({
  pageContainer: css`
    :global(.ant-pro-page-container-children-container) {
      padding-inline: 0;
      padding-block: 0;
    }
  `,
  shell: css`
    min-height: calc(100vh - 112px);
    padding: 24px;
    background: ${claudeColors.parchment};
  `,
  header: css`
    margin-bottom: 18px;
  `,
  title: css`
    margin: 0;
    font-family: ${claudeFonts.heading};
    color: ${claudeColors.nearBlack};
  `,
  subtitle: css`
    margin: 8px 0 0;
    color: ${claudeColors.oliveGray};
    line-height: 1.7;
  `,
  stack: css`
    display: grid;
    gap: 18px;
  `,
}));

const VerticalJobProfilePage: React.FC = () => {
  const { styles } = useStyles();
  const comparison = useComparisonData();

  return (
    <PageContainer
      className={styles.pageContainer}
      title={false}
      breadcrumbRender={false}
    >
      <main className={styles.shell}>
        <div className={styles.header}>
          <Typography.Title level={2} className={styles.title}>
            同岗行业对比
          </Typography.Title>
          <p className={styles.subtitle}>
            选择岗位和行业，查看初级、中级、高级薪资层级下的公司样本与 12 维度覆盖差异。
          </p>
        </div>

        <div className={styles.stack}>
          <FilterBar
            query={comparison.query}
            jobTitles={comparison.jobTitles}
            industries={comparison.industries}
            loading={comparison.loading}
            industryLoading={comparison.industryLoading}
            onJobTitleChange={comparison.setJobTitle}
            onIndustriesChange={comparison.setIndustries}
            onSearch={() => void comparison.runQuery()}
          />
          <ComparisonSummary data={comparison.comparisonData} />
          <TierComparison
            data={comparison.comparisonData}
            loading={comparison.loading}
          />
        </div>
      </main>
    </PageContainer>
  );
};

export default VerticalJobProfilePage;
