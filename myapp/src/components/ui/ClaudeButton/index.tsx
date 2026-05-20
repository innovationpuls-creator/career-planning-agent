import type { ButtonProps } from 'antd';
import { Button } from 'antd';
import { createStyles, keyframes } from 'antd-style';
import * as React from 'react';
import {
  claudeAlpha,
  claudeColors,
  claudeRadius,
  claudeShadows,
} from '@/styles/claude-tokens';

export type ClaudeButtonVariant =
  | 'warm-sand'
  | 'terracotta'
  | 'dark-charcoal'
  | 'ghost'
  | 'white-surface'
  | 'dark-primary';

export interface ClaudeButtonProps
  extends Omit<ButtonProps, 'type' | 'variant'> {
  variant?: ClaudeButtonVariant;
}

const glowSpin = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
`;

const useStyles = createStyles(({ css }) => ({
  base: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    /* Antd overrides */
    &.ant-btn {
      box-shadow: none;
    }

    &:active {
      transform: scale(0.98);
      box-shadow: ${claudeShadows.inset} !important;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none !important;
    }
  `,
  content: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: inherit;
  `,
  warmSand: css`
    background: ${claudeColors.warmSand};
    color: ${claudeColors.nearBlack};
    border-radius: ${claudeRadius.md}px;
    padding: 0 12px 0 8px;
    height: 36px;

    &:hover {
      background: ${claudeColors.borderWarm};
      box-shadow: ${claudeShadows.ring};
    }
  `,
  terracotta: css`
    position: relative;
    overflow: hidden;
    background: ${claudeColors.terracotta};
    color: ${claudeColors.ivory} !important;
    border-radius: ${claudeRadius.lg}px;
    padding: 8px 16px;
    height: auto;

    &.ant-btn,
    &.ant-btn:hover,
    &.ant-btn:focus-visible {
      background: ${claudeColors.terracotta} !important;
      border-color: transparent !important;
      color: ${claudeColors.ivory} !important;
    }

    /* Glow border — spinning conic-gradient ring */
    &.ant-btn::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 200%;
      height: 200%;
      transform: translate(-50%, -50%);
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        ${claudeAlpha(claudeColors.primaryHover, 0)} 40deg,
        ${claudeAlpha(claudeColors.primaryHover, 0.5)} 70deg,
        ${claudeAlpha(claudeColors.terracotta, 0.3)} 110deg,
        transparent 140deg,
        ${claudeAlpha(claudeColors.primaryHover, 0.25)} 200deg,
        transparent 240deg,
        ${claudeAlpha(claudeColors.primaryHover, 0.4)} 290deg,
        ${claudeAlpha(claudeColors.terracotta, 0.2)} 330deg,
        transparent 360deg
      );
      opacity: 0;
      transition: opacity 0.35s ease;
      animation: ${glowSpin} 4s linear infinite;
      z-index: 0;
    }

    /* Inner mask — covers center, exposes only the 2px edge ring */
    &.ant-btn::after {
      content: '';
      position: absolute;
      inset: 2px;
      border-radius: 10px;
      background: ${claudeColors.terracotta};
      z-index: 1;
      transition: background 0.2s ease;
    }

    /* Lift content above the masking ::after */
    &.ant-btn > span {
      position: relative;
      z-index: 2;
    }

    &:hover {
      &.ant-btn::before {
        opacity: 1;
      }
      &.ant-btn::after {
        background: ${claudeColors.primaryHover};
      }
    }

    &:active {
      &.ant-btn::after {
        box-shadow: ${claudeShadows.inset};
      }
    }

    &:disabled {
      &.ant-btn::before {
        animation-play-state: paused;
      }
      &.ant-btn::after {
        background: ${claudeColors.terracotta};
      }
    }
  `,
  darkCharcoal: css`
    background: ${claudeColors.darkSurface};
    color: ${claudeColors.ivory};
    border-radius: ${claudeRadius.md}px;
    padding: 0 12px 0 8px;
    height: 36px;

    &:hover {
      box-shadow: 0px 0px 0px 1px ${claudeColors.ringWarm};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${claudeColors.oliveGray};
    border-radius: ${claudeRadius.md}px;
    padding: 4px 12px;

    &:hover {
      background: ${claudeColors.primaryBg};
      color: ${claudeColors.terracotta};
    }
  `,
  whiteSurface: css`
    background: #ffffff;
    color: ${claudeColors.nearBlack};
    border-radius: ${claudeRadius.lg}px;
    padding: 8px 16px 8px 12px;
    height: auto;

    &:hover {
      background: ${claudeColors.warmSand};
      box-shadow: ${claudeShadows.ring};
    }
  `,
  darkPrimary: css`
    background: ${claudeColors.nearBlack};
    color: ${claudeColors.warmSilver};
    border-radius: ${claudeRadius.lg}px;
    padding: 9.6px 16.8px;
    height: auto;
    border: 1px solid ${claudeColors.darkSurface};

    &:hover {
      box-shadow: 0px 0px 0px 1px ${claudeColors.ringWarm};
    }
  `,
}));

export function ClaudeButton({
  variant = 'warm-sand',
  className,
  children,
  ...rest
}: ClaudeButtonProps) {
  const { styles, cx } = useStyles();

  const variantMap: Record<ClaudeButtonVariant, string> = {
    'warm-sand': styles.warmSand,
    terracotta: styles.terracotta,
    'dark-charcoal': styles.darkCharcoal,
    ghost: styles.ghost,
    'white-surface': styles.whiteSurface,
    'dark-primary': styles.darkPrimary,
  };

  return (
    <Button
      data-variant={variant}
      className={cx(styles.base, variantMap[variant], className)}
      {...rest}
    >
      <span className={styles.content}>{children}</span>
    </Button>
  );
}
