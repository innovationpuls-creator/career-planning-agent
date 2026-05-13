import { ArrowRightOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import React from 'react';
import { ClaudeButton, ClaudeTag, ProgressRing } from '@/components/ui';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
  claudeShadows,
  claudeAlpha,
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
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)};
    border-radius: ${claudeRadius.lg}px;
    padding: 64px 56px;
    position: relative;
    overflow: hidden;
    min-height: 340px;
    box-shadow: 
      0 8px 32px 0 rgba(0, 0, 0, 0.08),
      inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.4)};
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
      padding: 32px 24px;
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
    margin-bottom: 24px;
  `,
  badgeLabel: css`
    font-size: 14px;
    font-weight: 500;
    color: ${claudeColors.oliveGray};
    letter-spacing: 0.03em;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: clamp(36px, 5vw, 48px);
    font-weight: 500;
    color: ${claudeColors.nearBlack};
    line-height: 1.15;
    margin: 0 0 24px;
    letter-spacing: -0.01em;
  `,
  subtitle: css`
    font-family: ${claudeFonts.body};
    font-size: 16px;
    color: ${claudeColors.oliveGray};
    margin: 0;
    line-height: 1.6;
    max-width: 480px;
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
    font-size: 80px;
    font-weight: 500;
    color: ${claudeColors.terracotta};
    line-height: 1;
    letter-spacing: -0.03em;
  `,
  matchLabel: css`
    font-size: 14px;
    color: ${claudeColors.stoneGray};
    margin-top: 4px;
    font-weight: 500;
  `,
  statsRow: css`
    display: flex;
    align-items: center;
    gap: 32px;
    margin-top: 32px;
    flex-wrap: wrap;
  `,
  statItem: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  statLabel: css`
    font-size: 13px;
    color: ${claudeColors.stoneGray};
  `,
  statValue: css`
    font-size: 18px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
  `,
  hint: css`
    font-size: 14px;
    color: ${claudeColors.stoneGray};
    margin: 12px 0 0;
    line-height: 1.6;
  `,
  ctaRow: css`
    margin-top: 32px;
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
