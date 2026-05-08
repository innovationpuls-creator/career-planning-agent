import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import * as React from 'react';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

export interface ClaudeStatCardProps {
  icon: React.ReactNode;
  iconColor?: string;
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  trendValue?: string;
  className?: string;
}

const useStyles = createStyles(({ css }) => ({
  card: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 20px;
    background: ${claudeColors.ivory};
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.md}px;
    min-width: 0;
  `,
  header: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  iconWrap: css`
    font-size: 20px;
    display: flex;
    align-items: center;
  `,
  title: css`
    font-size: 14px;
    font-weight: 400;
    color: ${claudeColors.oliveGray};
    line-height: 1.5;
    margin: 0;
  `,
  valueRow: css`
    display: flex;
    align-items: baseline;
    gap: 4px;
  `,
  value: css`
    font-family: ${claudeFonts.heading};
    font-size: 28px;
    font-weight: 500;
    color: ${claudeColors.nearBlack};
    line-height: 1.2;
  `,
  unit: css`
    font-size: 14px;
    font-weight: 400;
    color: ${claudeColors.oliveGray};
    line-height: 1.5;
  `,
  footer: css`
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  `,
  description: css`
    font-size: 12px;
    font-weight: 400;
    color: ${claudeColors.stoneGray};
    line-height: 1.5;
    margin: 0;
  `,
  trend: css`
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: ${claudeRadius.xxl}px;
    background: ${claudeColors.primaryBg};
    margin: 0;
  `,
  trendPositive: css`
    color: ${claudeColors.success};
  `,
  trendNegative: css`
    color: ${claudeColors.error};
  `,
  trendNeutral: css`
    color: ${claudeColors.stoneGray};
  `,
}));

export function ClaudeStatCard({
  icon,
  iconColor,
  title,
  value,
  unit,
  description,
  trend,
  trendValue,
  className,
}: ClaudeStatCardProps) {
  const { styles, cx } = useStyles();

  const trendClass =
    trend === 'positive'
      ? styles.trendPositive
      : trend === 'negative'
        ? styles.trendNegative
        : styles.trendNeutral;

  return (
    <div data-testid="claude-stat-card" className={cx(styles.card, className)}>
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
}
