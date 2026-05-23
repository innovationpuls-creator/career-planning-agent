import { ClockCircleOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors } from '@/styles/claude-tokens';

interface DataSourceFooterProps {
  dimensionCount: number;
  updatedAt: string | undefined;
}

const useStyles = createStyles(({ css }) => ({
  footer: css`
    text-align: center;
    padding: 8px 0 0;
    font-size: 11px;
    color: ${claudeColors.stoneGray};
  `,
}));

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function DataSourceFooter({
  dimensionCount,
  updatedAt,
}: DataSourceFooterProps) {
  const { styles } = useStyles();
  return (
    <div className={styles.footer} data-testid="datasource-footer">
      <ClockCircleOutlined style={{ marginRight: 4 }} />
      数据来源：{dimensionCount} 维度分析
      {updatedAt ? ` · 更新于 ${formatDate(updatedAt)}` : ''}
    </div>
  );
}
