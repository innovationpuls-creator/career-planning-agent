import type { ButtonProps } from 'antd';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import {
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
    background: ${claudeColors.terracotta};
    color: #fff;
    border-radius: ${claudeRadius.lg}px;
    padding: 8px 16px;
    height: auto;

    &:hover {
      background: ${claudeColors.primaryHover};
      box-shadow: 0px 0px 0px 1px ${claudeColors.terracotta};
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
    'terracotta': styles.terracotta,
    'dark-charcoal': styles.darkCharcoal,
    'ghost': styles.ghost,
    'white-surface': styles.whiteSurface,
    'dark-primary': styles.darkPrimary,
  };

  return (
    <Button
      data-variant={variant}
      className={cx(styles.base, variantMap[variant], className)}
      {...rest}
    >
      {children}
    </Button>
  );
}
