import { InfoCircleOutlined } from '@ant-design/icons';
import { Collapse } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeFonts, claudeRadius } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  guide: css`
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.md}px;
    overflow: hidden;
    background: ${claudeColors.ivory};

    :global(.ant-collapse-header) {
      align-items: center !important;
      padding: 14px 18px !important;
      color: ${claudeColors.nearBlack} !important;
      font-family: ${claudeFonts.heading};
      font-weight: 500;
    }

    :global(.ant-collapse-content) {
      background: ${claudeColors.ivory} !important;
      border-top-color: ${claudeColors.borderCream} !important;
    }

    :global(.ant-collapse-content-box) {
      padding: 16px 18px !important;
    }
  `,
  list: css`
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  `,
  item: css`
    color: ${claudeColors.oliveGray};
    line-height: 1.75;
  `,
  label: css`
    color: ${claudeColors.nearBlack};
    font-weight: 600;
  `,
}));

export const GraphGuide: React.FC<{ dimensionCount: number }> = ({
  dimensionCount,
}) => {
  const { styles } = useStyles();

  return (
    <Collapse
      className={styles.guide}
      ghost
      items={[
        {
          key: 'guide',
          label: (
            <span>
              <InfoCircleOutlined /> 图谱阅读指南
            </span>
          ),
          children: (
            <ul className={styles.list}>
              <li className={styles.item}>
                <span className={styles.label}>中心节点</span>
                ：从岗位要求画像总览出发，查看市场对当前岗位的总体期待。
              </li>
              <li className={styles.item}>
                <span className={styles.label}>维度组</span>
                ：专业与门槛、协作与适应、成长与职业素养组成第二层视角。
              </li>
              <li className={styles.item}>
                <span className={styles.label}>具体维度</span>
                ：第三层包含 {dimensionCount} 个能力点，点击后右侧查看关键词、覆盖度和样本。
              </li>
            </ul>
          ),
        },
      ]}
    />
  );
};
