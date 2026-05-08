import { ArrowRightOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import React from 'react';
import { ClaudeButton, ClaudeTag, ProgressRing } from '@/components/ui';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

interface HeroSectionProps {
  targetJob: string;
  stage: string;
  matchPercent: number;
  completionPercent: number;
  nextActionLabel: string;
  nextActionDescription: string;
  onAction: () => void;
  hasTarget: boolean;
}

const useStyles = createStyles(({ css }) => ({
  shell: css`
    background: linear-gradient(135deg, ${claudeColors.parchment} 0%, ${claudeColors.ivory} 100%);
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.xxl}px;
    padding: 56px 48px;
    margin-bottom: 30px;
    position: relative;
    overflow: hidden;
    min-height: 340px;
    box-shadow: 0 18px 42px rgba(40, 38, 35, 0.06);
  `,
  inner: css`
    display: flex;
    align-items: center;
    gap: 48px;
    position: relative;
    z-index: 1;

    @media (max-width: 900px) {
      flex-direction: column;
      gap: 32px;
    }
  `,
  left: css`
    flex: 1;
    min-width: 0;
  `,
  badgeRow: css`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  `,
  badgeLabel: css`
    font-size: 14px;
    font-weight: 600;
    color: ${claudeColors.oliveGray};
    letter-spacing: 0.03em;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: clamp(36px, 5vw, 48px);
    font-weight: 700;
    color: ${claudeColors.nearBlack};
    line-height: 1.15;
    margin: 0 0 16px;
  `,
  subtitle: css`
    font-size: 15px;
    color: ${claudeColors.oliveGray};
    margin: 0;
    line-height: 1.7;
    max-width: 420px;
  `,
  right: css`
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  `,
  matchValue: css`
    font-family: ${claudeFonts.heading};
    font-size: 72px;
    font-weight: 700;
    color: ${claudeColors.terracotta};
    line-height: 1;
    letter-spacing: -0.03em;
  `,
  matchLabel: css`
    font-size: 14px;
    color: ${claudeColors.stoneGray};
    margin-top: 4px;
  `,
  statsRow: css`
    display: flex;
    align-items: center;
    gap: 24px;
    margin-top: 24px;
    flex-wrap: wrap;
  `,
  statItem: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  statLabel: css`
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  statValue: css`
    font-size: 18px;
    font-weight: 700;
    color: ${claudeColors.nearBlack};
  `,
  hint: css`
    font-size: 14px;
    color: ${claudeColors.stoneGray};
    margin: 8px 0 0;
    line-height: 1.6;
  `,
  ctaRow: css`
    margin-top: 28px;
  `,
}));

export function HeroSection({
  targetJob,
  stage,
  matchPercent,
  completionPercent,
  nextActionLabel,
  nextActionDescription,
  onAction,
  hasTarget,
}: HeroSectionProps) {
  const { styles } = useStyles();

  return (
    <motion.div
      className={styles.shell}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.inner}>
        <div className={styles.left}>
          <div className={styles.badgeRow}>
            <span className={styles.badgeLabel}>目标岗位</span>
            {hasTarget && <ClaudeTag>{stage}</ClaudeTag>}
          </div>

          <h1 className={styles.title}>{targetJob}</h1>

          {!hasTarget ? (
            <p className={styles.subtitle}>
              先设置目标岗位，首页会生成你的职业规划进度。
            </p>
          ) : (
            <p className={styles.subtitle}>
              以目标岗位为中心，串联资料、解析、匹配、学习路径与成长报告。
            </p>
          )}

          <p className={styles.hint}>{nextActionDescription}</p>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>规划进度</span>
              <span className={styles.statValue}>{completionPercent}%</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>下一步</span>
              <span className={styles.statValue}>{nextActionLabel}</span>
            </div>
          </div>

          <div className={styles.ctaRow}>
            <ClaudeButton
              variant="terracotta"
              icon={<ArrowRightOutlined />}
              onClick={onAction}
            >
              {nextActionLabel}
            </ClaudeButton>
          </div>
        </div>

        {hasTarget && (
          <motion.div
            className={styles.right}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className={styles.matchValue}>{matchPercent}</span>
            <ProgressRing percent={matchPercent} size={120} strokeWidth={8} />
            <span className={styles.matchLabel}>匹配度</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
