import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';
import React from 'react';

export interface StatCardProps {
  /** 图标节点 */
  icon: ReactNode;
  /** 图标颜色，对应功能色 */
  iconColor?: string;
  /** 标题文字 */
  title: string;
  /** 数值（大字） */
  value: string | number;
  /** 单位 */
  unit?: string;
  /** 描述文字 */
  description?: string;
  /** 增长方向：positive=正向(绿箭头)，negative=负向(红箭头) */
  trend?: 'positive' | 'negative' | 'neutral';
  /** 增长值，如 "+12%" */
  trendValue?: string;
  /** 卡片 className */
  className?: string;
}

const useStyles = createStyles(({ token }) => ({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 20,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
    minWidth: 0,
    transition: `border-color ${token.motionDurationFast} ${token.motionEaseInOut}`,
    cursor: 'default',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 400,
    color: token.colorTextSecondary,
    lineHeight: 1.5,
    margin: 0,
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: 600,
    color: token.colorText,
    lineHeight: 1.2,
  },
  unit: {
    fontSize: 14,
    fontWeight: 400,
    color: token.colorTextSecondary,
    lineHeight: 1.5,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    fontWeight: 400,
    color: token.colorTextTertiary,
    lineHeight: 1.5,
    margin: 0,
  },
  trend: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    fontSize: 12,
    fontWeight: 500,
    margin: 0,
  },
  trendPositive: { color: token.colorSuccess },
  trendNegative: { color: token.colorError },
  trendNeutral: { color: token.colorTextTertiary },
}));

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconColor,
  title,
  value,
  unit,
  description,
  trend,
  trendValue,
  className,
}) => {
  const { styles, cx } = useStyles();

  const trendClass =
    trend === 'positive'
      ? styles.trendPositive
      : trend === 'negative'
        ? styles.trendNegative
        : styles.trendNeutral;

  return (
    <div className={cx(styles.card, className)}>
      <div className={styles.header}>
        {icon && (
          <span className={styles.iconWrap} style={{ color: iconColor }}>
            {icon}
          </span>
        )}
        <p className={styles.title}>{title}</p>
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {(description || (trend && trendValue)) && (
        <div className={styles.footer}>
          {description && <p className={styles.description}>{description}</p>}
          {trend && trendValue && (
            <span className={cx(styles.trend, trendClass)}>
              {trend === 'positive' && <ArrowUpOutlined />}
              {trend === 'negative' && <ArrowDownOutlined />}
              {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
