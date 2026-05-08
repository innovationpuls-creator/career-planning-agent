import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeRadius } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  legend: css`
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
    padding: 12px 14px;
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.md}px;
    background: ${claudeColors.ivory};
  `,
  item: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: ${claudeColors.oliveGray};
    font-size: 13px;
  `,
  nodeRoot: css`
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${claudeColors.terracotta};
  `,
  nodeGroup: css`
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${claudeColors.warmSand};
    border: 1px solid ${claudeColors.ringDeep};
  `,
  nodeLeaf: css`
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${claudeColors.ivory};
    border: 1px solid ${claudeColors.borderCream};
  `,
  edge: css`
    width: 32px;
    height: 0;
    border-top: 2px solid ${claudeColors.stoneGray};
  `,
}));

export const GraphLegend: React.FC = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.legend} data-testid="graph-legend">
      <span className={styles.item}>
        <span className={styles.nodeRoot} />
        根节点
      </span>
      <span className={styles.item}>
        <span className={styles.nodeGroup} />
        维度组
      </span>
      <span className={styles.item}>
        <span className={styles.nodeLeaf} />
        12 维度
      </span>
      <span className={styles.item}>
        <span className={styles.edge} />
        关联路径
      </span>
    </div>
  );
};
