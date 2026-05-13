import { ArrowRightOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import React from 'react';
import { ClaudeButton, ClaudeCard } from '@/components/ui';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

interface CtaSectionProps {
  nextActionLabel: string;
  nextActionDescription: string;
  nextActionButtonText: string;
  onAction: () => void;
}

const useStyles = createStyles(({ css }) => ({
  section: css`
    margin-bottom: 26px;
  `,
  card: css`
    padding: 36px 32px;
    text-align: center;
    border-radius: ${claudeRadius.lg}px;
    background: linear-gradient(135deg, ${claudeColors.parchment} 0%, ${claudeColors.ivory} 100%);
  `,
  label: css`
    font-family: ${claudeFonts.heading};
    font-size: 14px;
    font-weight: 600;
    color: ${claudeColors.terracotta};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 8px;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 22px;
    font-weight: 700;
    color: ${claudeColors.nearBlack};
    margin: 0 0 10px;
  `,
  desc: css`
    font-size: 15px;
    color: ${claudeColors.oliveGray};
    max-width: 480px;
    margin: 0 auto 24px;
    line-height: 1.7;
  `,
}));

export function CtaSection({
  nextActionLabel,
  nextActionDescription,
  nextActionButtonText,
  onAction,
}: CtaSectionProps) {
  const { styles } = useStyles();

  return (
    <motion.div
      className={styles.section}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <ClaudeCard elevation="glass" className={styles.card}>
        <p className={styles.label}>{nextActionLabel}</p>
        <h3 className={styles.title}>{nextActionDescription}</h3>
        <ClaudeButton
          variant="terracotta"
          icon={<ArrowRightOutlined />}
          onClick={onAction}
        >
          {nextActionButtonText}
        </ClaudeButton>
      </ClaudeCard>
    </motion.div>
  );
}
