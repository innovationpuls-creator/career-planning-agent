import { BankOutlined } from '@ant-design/icons';
import { Empty } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeTag, ProgressRing } from '@/components/ui';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

interface CompanyMatchCardsProps {
  cards: API.CareerDevelopmentMatchEvidenceCard[];
}

const useStyles = createStyles(({ css }) => ({
  container: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,
  card: css`
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)};
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.4)};
    border-radius: ${claudeRadius.md}px;
    padding: 18px;
    transition: all 0.2s ease;

    &:hover {
      border-color: ${claudeColors.terracotta};
      box-shadow: 0 4px 12px ${claudeAlpha(claudeColors.terracotta, 0.08)};
      transform: translateY(-2px);
    }
  `,
  cardHeader: css`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  `,
  companyIcon: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${claudeAlpha(claudeColors.terracotta, 0.08)};
    color: ${claudeColors.terracotta};
    font-size: 16px;
    flex-shrink: 0;
  `,
  companyName: css`
    font-family: ${claudeFonts.heading};
    font-size: 15px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    line-height: 1.3;
  `,
  jobTitle: css`
    font-size: 12px;
    color: ${claudeColors.stoneGray};
    margin-top: 2px;
  `,
  scoreRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  `,
  scoreLabel: css`
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  tagRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-width: 0;
  `,
  emptyWrap: css`
    grid-column: 1 / -1;
    padding: 32px 0;
    text-align: center;
  `,
}));

export function CompanyMatchCards({ cards }: CompanyMatchCardsProps) {
  const { styles } = useStyles();

  if (!cards.length) {
    return (
      <div className={styles.emptyWrap}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无匹配公司数据"
        />
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="company-match-cards">
      {cards.map((card) => (
        <div key={card.profile_id} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.companyIcon}>
              <BankOutlined />
            </div>
            <div>
              <div className={styles.companyName}>{card.company_name}</div>
              <div className={styles.jobTitle}>{card.job_title}</div>
            </div>
          </div>

          <div className={styles.scoreRow}>
            <ProgressRing
              percent={Math.round(card.match_score)}
              size={40}
              color={claudeColors.terracotta}
            />
            <div>
              <div className={styles.scoreLabel}>匹配度</div>
            </div>
          </div>

          <div className={styles.tagRow}>
            {card.industry && <ClaudeTag>{card.industry}</ClaudeTag>}
            {card.professional_threshold_dimension_count > 0 && (
              <ClaudeTag>
                {card.professional_threshold_dimension_count} 个核心维度
              </ClaudeTag>
            )}
            {card.group_similarities?.slice(0, 2).map((group) => (
              <ClaudeTag key={group.group_key}>
                {group.label || group.group_key}
              </ClaudeTag>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
