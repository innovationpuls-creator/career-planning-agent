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
  | 'ghost';

export interface ClaudeButtonProps
  extends Omit<ButtonProps, 'type' | 'variant'> {
  variant?: ClaudeButtonVariant;
}

const useStyles = createStyles(({ css }) => ({
  base: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    border-radius: ${claudeRadius.lg}px;

    &:hover {
      box-shadow: ${claudeShadows.ring};
    }

    &:active {
      transform: scale(0.98);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  `,
  asymmetric: css`
    padding: 8px 12px;
  `,
  warmSand: css`
    background: ${claudeColors.warmSand};
    color: ${claudeColors.nearBlack};

    &:hover {
      background: ${claudeColors.borderWarm};
    }
  `,
  terracotta: css`
    background: ${claudeColors.terracotta};
    color: #fff;

    &:hover {
      background: ${claudeColors.primaryHover};
    }
  `,
  darkCharcoal: css`
    background: ${claudeColors.charcoalWarm};
    color: #fff;

    &:hover {
      background: ${claudeColors.darkSurface};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${claudeColors.oliveGray};

    &:hover {
      background: ${claudeColors.primaryBg};
      color: ${claudeColors.terracotta};
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

  const variantClass =
    variant === 'terracotta'
      ? styles.terracotta
      : variant === 'dark-charcoal'
        ? styles.darkCharcoal
        : variant === 'ghost'
          ? styles.ghost
          : styles.warmSand;

  return (
    <Button
      data-variant={variant}
      className={cx(styles.base, styles.asymmetric, variantClass, className)}
      {...rest}
    >
      {children}
    </Button>
  );
}
