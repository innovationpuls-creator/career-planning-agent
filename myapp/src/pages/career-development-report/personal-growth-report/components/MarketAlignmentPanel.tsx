import { Empty, List, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type MarketAlignmentPanelProps = {
  targetDiagnosis?: Record<string, any> | null;
  gapDiagnosis?: Record<string, any> | null;
};

const recommendationLabels: Record<string, string> = {
  keep: '继续',
  adjust: '微调',
  change_direction: '换向',
};

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    min-width: 0;
    padding: ${token.padding}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  title: css`
    margin: 0 0 ${token.marginSM}px;
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    font-weight: 600;
  `,
  summary: css`
    margin: 0 0 ${token.marginSM}px;
    color: ${token.colorTextSecondary};
    line-height: ${token.lineHeight};
  `,
  sectionLabel: css`
    margin: ${token.margin}px 0 ${token.marginXS}px;
    color: ${token.colorText};
    font-weight: 600;
  `,
}));

const MarketAlignmentPanel: React.FC<MarketAlignmentPanelProps> = ({
  targetDiagnosis,
  gapDiagnosis,
}) => {
  const { styles } = useStyles();
  const dimensions = Array.isArray(gapDiagnosis?.priority_dimensions)
    ? gapDiagnosis.priority_dimensions
    : [];
  const recommendation = String(targetDiagnosis?.recommendation || 'keep');

  return (
    <section className={styles.panel} data-testid="market-alignment-panel">
      <h2 className={styles.title}>市场对齐</h2>
      {targetDiagnosis ? (
        <>
          <Tag>{recommendationLabels[recommendation] || recommendation}</Tag>
          <p className={styles.summary}>{String(targetDiagnosis.summary || '')}</p>
        </>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无目标诊断" />
      )}
      {gapDiagnosis?.summary ? (
        <>
          <div className={styles.sectionLabel}>差距诊断</div>
          <p className={styles.summary}>{String(gapDiagnosis.summary)}</p>
        </>
      ) : null}
      {dimensions.length ? (
        <List
          size="small"
          dataSource={dimensions}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={String(item.label || item.key || '维度')}
                description={String(item.priority || item.summary || '')}
              />
            </List.Item>
          )}
        />
      ) : null}
    </section>
  );
};

export default MarketAlignmentPanel;
