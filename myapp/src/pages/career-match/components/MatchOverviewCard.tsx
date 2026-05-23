import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeButton } from '@/components/ui';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';

interface MatchOverviewCardProps {
  report: API.CareerDevelopmentMatchReport;
  isFavorited: boolean;
  favoriteSubmitting: boolean;
  onToggleFavorite: () => void;
  onGeneratePlan: () => void;
}

const useStyles = createStyles(({ css }) => ({
  card: css`
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 16px;
    padding: 24px 28px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(255,255,255,0.5);
    display: flex;
    align-items: center;
    gap: 24px;
    @media (max-width: 800px) {
      flex-direction: column;
      text-align: center;
    }
  `,
  ringWrap: css`flex-shrink: 0; position: relative; width: 88px; height: 88px;`,
  ringSvg: css`transform: rotate(-90deg);`,
  ringValue: css`
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  `,
  ringNum: css`
    font-family: ${claudeFonts.heading}; font-size: 26px; font-weight: 600;
    color: ${claudeColors.terracotta}; line-height: 1;
  `,
  ringUnit: css`font-size: 11px; color: ${claudeColors.stoneGray}; margin-top: 1px;`,
  info: css`flex: 1; min-width: 0;`,
  job: css`
    font-family: ${claudeFonts.heading}; font-size: 20px; font-weight: 600;
    color: ${claudeColors.nearBlack}; margin-bottom: 4px;
  `,
  meta: css`
    font-size: 13px; color: ${claudeColors.oliveGray};
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  `,
  metaDot: css`
    width: 5px; height: 5px; border-radius: 50%;
    background: ${claudeColors.terracotta}; opacity: 0.5; display: inline-block;
  `,
  actions: css`display: flex; gap: 8px; flex-shrink: 0;`,
}));

export function MatchOverviewCard({
  report, isFavorited, favoriteSubmitting, onToggleFavorite, onGeneratePlan,
}: MatchOverviewCardProps) {
  const { styles } = useStyles();
  const percent = Math.round(report.overall_match);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (circumference * percent) / 100;

  return (
    <div className={styles.card} data-testid="match-overview-card">
      <div className={styles.ringWrap}>
        <svg className={styles.ringSvg} width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="38" fill="none" stroke="#f0eee6" strokeWidth="8" />
          <circle cx="44" cy="44" r="38" fill="none" stroke={claudeColors.terracotta}
            strokeWidth="8" strokeDasharray={circumference}
            strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className={styles.ringValue}>
          <span className={styles.ringNum}>{percent}</span>
          <span className={styles.ringUnit}>%</span>
        </div>
      </div>
      <div className={styles.info}>
        <div className={styles.job}>{report.canonical_job_title}</div>
        <div className={styles.meta}>
          {report.industry && (
            <span><span className={styles.metaDot}></span> {report.industry}</span>
          )}
          <span>基于 {report.comparison_dimensions?.length || 12} 维度分析</span>
        </div>
      </div>
      <div className={styles.actions}>
        <ClaudeButton
          variant={isFavorited ? 'terracotta' : 'ghost'}
          icon={isFavorited ? <StarFilled /> : <StarOutlined />}
          loading={favoriteSubmitting}
          onClick={onToggleFavorite}
        >
          {isFavorited ? '已收藏' : '收藏'}
        </ClaudeButton>
        <Tooltip title={!isFavorited ? '请先收藏该职业推荐' : undefined}>
          <ClaudeButton
            variant="terracotta"
            disabled={!isFavorited}
            onClick={onGeneratePlan}
          >
            生成学习计划
          </ClaudeButton>
        </Tooltip>
      </div>
    </div>
  );
}
