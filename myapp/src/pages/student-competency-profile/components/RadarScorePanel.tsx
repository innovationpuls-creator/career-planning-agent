import { Radar } from '@ant-design/charts';
import { Empty, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';
import { PROFILE_FIELDS } from '../shared';

const { Text } = Typography;

interface RadarScorePanelProps {
  scores: API.StudentCompetencyChartSeriesItem[];
  onDimensionClick?: (key: string) => void;
}

const DIMENSION_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  PROFILE_FIELDS.map(([key, title]) => [
    key,
    title.length > 5 ? title.slice(0, 5) : title,
  ]),
);

const useStyles = createStyles(({ css }) => ({
  panel: css`
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)};
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.4)};
    border-radius: ${claudeRadius.md}px;
    padding: 24px;
    min-height: 340px;
  `,
  header: css`
    margin-bottom: 16px;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin: 0;
  `,
  chartWrap: css`
    width: 100%;
    max-width: 100%;
    height: 320px;
    position: relative;
  `,
  emptyWrap: css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 280px;
  `,
  scoreGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid ${claudeColors.borderCream};
  `,
  scoreItem: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: ${claudeAlpha('#ffffff', 0.4)};
    border-radius: ${claudeRadius.md}px;
    transition: background 0.2s ease;
    &:hover {
      background: ${claudeColors.borderCream};
    }
  `,
  scoreItemHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  scoreLabel: css`
    font-size: 13px;
    font-weight: 500;
    color: ${claudeColors.nearBlack};
  `,
  scoreValue: css`
    font-family: ${claudeFonts.heading};
    font-size: 14px;
    font-weight: 700;
  `,
  scoreBar: css`
    height: 4px;
    border-radius: 2px;
    background: ${claudeColors.borderCream};
    overflow: hidden;
  `,
  scoreBarFill: css`
    height: 100%;
    border-radius: 2px;
    transition: width 0.6s ease;
  `,
  legend: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
    justify-content: center;
    min-width: 0;
  `,
  legendItem: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  legendDot: css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${claudeColors.terracotta};
    border: 1.5px solid ${claudeColors.terracotta};
  `,
}));

export function RadarScorePanel({
  scores,
  onDimensionClick,
}: RadarScorePanelProps) {
  const { styles } = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 320 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const update = () => {
      const w = Math.max(Math.floor(el.clientWidth), 0);
      const h = Math.max(Math.floor(el.clientHeight), 320);
      setChartSize((cur) =>
        cur.width === w && cur.height === h ? cur : { width: w, height: h },
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(
    () =>
      scores.flatMap((item) => [
        {
          dimension: DIMENSION_SHORT_LABELS[item.key] || item.title,
          key: item.key,
          value: item.market_importance,
          category: '市场重要度',
        },
        {
          dimension: DIMENSION_SHORT_LABELS[item.key] || item.title,
          key: item.key,
          value: item.user_readiness,
          category: '个人准备度',
        },
      ]),
    [scores],
  );

  const handleChartClick = useCallback(
    (evt: { data?: { datum?: { key?: string } } }) => {
      const key = evt?.data?.datum?.key;
      if (key && onDimensionClick) onDimensionClick(key);
    },
    [onDimensionClick],
  );

  const config = useMemo(
    () => ({
      data: chartData,
      xField: 'dimension',
      yField: 'value',
      colorField: 'category',
      scale: { y: { domain: [0, 100] } },
      style: {
        lineWidth: 2,
      },
      area: {
        style: {
          fillOpacity: 0.2,
        },
      },
      point: { size: 3 },
      axis: {
        x: {
          labelFontSize: 11,
          labelSpacing: 6,
          labelFill: claudeColors.oliveGray,
        },
        y: {
          labelFontSize: 11,
          labelFill: claudeColors.oliveGray,
          labelFormatter: (v: number) => `${v}%`,
        },
      },
      legend: false,
      padding: [16, 16, 24, 16],
      interaction: {
        elementHighlight: true,
      },
    }),
    [chartData],
  );

  if (!scores.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyWrap}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无维度数据"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel} data-testid="radar-score-panel">
      <div className={styles.header}>
        <Text className={styles.title}>能力雷达图</Text>
      </div>
      <div className={styles.chartWrap} ref={containerRef}>
        {chartSize.width > 0 ? (
          <Radar
            key={`${chartSize.width}-${chartSize.height}-${chartData.length}`}
            {...config}
            autoFit={false}
            width={chartSize.width}
            height={chartSize.height}
            onEvent={(_chart: any, event: any) => {
              if (event.type === 'element:click') {
                const key = event.data?.data?.key;
                if (key) {
                  handleChartClick({ data: { datum: { key } } });
                }
              }
            }}
          />
        ) : null}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} />
          市场重要度
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{
              background: 'transparent',
              borderColor: claudeColors.oliveGray,
            }}
          />
          个人准备度
        </span>
      </div>
      <div className={styles.scoreGrid}>
        {scores.map((item) => {
          const value = Math.round(item.user_readiness);
          const barColor =
            value >= 70
              ? claudeColors.success
              : value >= 40
                ? claudeColors.terracotta
                : claudeColors.error;
          return (
            <div
              key={item.key}
              className={styles.scoreItem}
              onClick={() => onDimensionClick?.(item.key)}
            >
              <div className={styles.scoreItemHeader}>
                <span className={styles.scoreLabel}>{item.title}</span>
                <span className={styles.scoreValue} style={{ color: barColor }}>
                  {value}
                </span>
              </div>
              <div className={styles.scoreBar}>
                <div
                  className={styles.scoreBarFill}
                  style={{ width: `${value}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
