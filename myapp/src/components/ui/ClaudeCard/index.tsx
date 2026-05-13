import { createStyles } from 'antd-style';
import * as React from 'react';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
  claudeShadows,
  claudeAlpha,
} from '@/styles/claude-tokens';

export type ClaudeCardElevation = 'flat' | 'elevated' | 'ring' | 'glass';

export interface ClaudeCardProps {
  elevation?: ClaudeCardElevation;
  title?: string;
  className?: string;
  children: React.ReactNode;
}

const useStyles = createStyles(({ css }) => ({
  card: css`
    background: ${claudeColors.ivory};
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.md}px;
    padding: 32px;
    min-width: 0;
  `,
  flat: css`
    box-shadow: ${claudeShadows.flat};
  `,
  elevated: css`
    box-shadow: ${claudeShadows.whisper};
  `,
  ring: css`
    box-shadow: ${claudeShadows.ring};
  `,
  glass: css`
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)};
    box-shadow: 
      0 8px 32px 0 rgba(0, 0, 0, 0.08),
      inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.4)};
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 500;
    color: ${claudeColors.nearBlack};
    margin: 0 0 12px 0;
    line-height: 1.4;
  `,
}));

export function ClaudeCard({
  elevation = 'flat',
  title,
  className,
  children,
}: ClaudeCardProps) {
  const { styles, cx } = useStyles();

  const elevationClass =
    elevation === 'elevated'
      ? styles.elevated
      : elevation === 'ring'
        ? styles.ring
        : elevation === 'glass'
          ? styles.glass
          : styles.flat;

  return (
    <div
      data-testid="claude-card"
      data-elevation={elevation}
      className={cx(styles.card, elevationClass, className)}
    >
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </div>
  );
}
