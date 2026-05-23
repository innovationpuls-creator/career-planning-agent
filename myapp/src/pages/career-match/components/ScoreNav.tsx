import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeAlpha } from '@/styles/claude-tokens';

interface ScoreNavProps {
  recommendations: API.CareerDevelopmentMatchReport[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}

const useStyles = createStyles(({ css }) => ({
  nav: css`
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
    @media (max-width: 800px) {
      flex-direction: row;
      flex-wrap: wrap;
    }
  `,
  badge: css`
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "STSongti SC", "SimSun", "Songti SC", "Noto Serif SC", Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s ease;
    border: 1px solid transparent;
  `,
  badgeActive: css`
    background: ${claudeColors.terracotta};
    color: #fff;
    box-shadow: 0 4px 14px rgba(201, 100, 66, 0.3);
  `,
  badgeInactive: css`
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-color: rgba(255, 255, 255, 0.5);
    color: ${claudeColors.oliveGray};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    &:hover {
      border-color: ${claudeAlpha(claudeColors.terracotta, 0.18)};
      color: ${claudeColors.terracotta};
      box-shadow: 0 2px 12px rgba(201, 100, 66, 0.08);
    }
  `,
  more: css`
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: ${claudeColors.stoneGray};
  `,
}));

export function ScoreNav({ recommendations, activeId, onSelect }: ScoreNavProps) {
  const { styles, cx } = useStyles();
  const visible = recommendations.slice(0, 5);
  const remaining = Math.max(0, recommendations.length - 5);

  return (
    <div className={styles.nav} data-testid="score-nav">
      {visible.map((r) => {
        const isActive =
          r.report_id === (activeId || recommendations[0]?.report_id);
        return (
          <div
            key={r.report_id}
            className={cx(
              styles.badge,
              isActive ? styles.badgeActive : styles.badgeInactive,
            )}
            onClick={() => onSelect(r.report_id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(r.report_id);
            }}
          >
            {Math.round(r.overall_match)}
          </div>
        );
      })}
      {remaining > 0 && <div className={styles.more}>+{remaining}</div>}
    </div>
  );
}
