import { SearchOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeButton, ClaudeCard, ClaudeSelect } from '@/components/ui';
import { claudeColors } from '@/styles/claude-tokens';
import type { ComparisonQuery } from '../hooks/useComparisonData';

const useStyles = createStyles(({ css }) => ({
  card: css`
  `,
  grid: css`
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(260px, 1.5fr) auto;
    gap: 16px;
    align-items: end;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,
  field: css`
    display: grid;
    gap: 8px;
  `,
  label: css`
    color: ${claudeColors.nearBlack};
    font-weight: 600;
  `,
  select: css`
    width: 100%;
  `,
  button: css`
    height: 40px;
    min-width: 120px;
  `,
}));

export interface FilterBarProps {
  query: ComparisonQuery;
  jobTitles: API.JobTitleOption[];
  industries: API.IndustryOption[];
  loading: boolean;
  industryLoading: boolean;
  onJobTitleChange: (jobTitle?: string) => void;
  onIndustriesChange: (industries: string[]) => void;
  onSearch: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  query,
  jobTitles,
  industries,
  loading,
  industryLoading,
  onJobTitleChange,
  onIndustriesChange,
  onSearch,
}) => {
  const { styles } = useStyles();

  return (
    <ClaudeCard elevation="glass" className={styles.card}>
      <div className={styles.grid}>
        <div className={styles.field}>
          <span className={styles.label}>岗位名称</span>
          <ClaudeSelect
            id="job_title"
            className={styles.select}
            placeholder="请选择岗位名称"
            options={jobTitles}
            value={query.jobTitle}
            showSearch
            optionFilterProp="label"
            onChange={(value) => onJobTitleChange(value as string | undefined)}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>行业</span>
          <ClaudeSelect
            id="industry"
            className={styles.select}
            mode="multiple"
            placeholder="请选择行业"
            options={industries}
            value={query.industries}
            loading={industryLoading}
            disabled={!query.jobTitle}
            maxTagCount="responsive"
            optionFilterProp="label"
            onChange={(value) => onIndustriesChange(value as string[])}
          />
        </div>

        <ClaudeButton
          variant="terracotta"
          loading={loading}
          disabled={!query.jobTitle}
          className={styles.button}
          icon={<SearchOutlined />}
          onClick={onSearch}
        >
          查询
        </ClaudeButton>
      </div>
    </ClaudeCard>
  );
};
