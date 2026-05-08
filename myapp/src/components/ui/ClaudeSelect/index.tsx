import type { SelectProps } from 'antd';
import { Select } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeColors, claudeRadius } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  select: css`
    .ant-select-selector {
      border-radius: ${claudeRadius.lg}px !important;
      border-color: ${claudeColors.borderCream} !important;
      background: ${claudeColors.ivory} !important;
    }

    &.ant-select-focused .ant-select-selector {
      border-color: ${claudeColors.terracotta} !important;
      box-shadow: 0 0 0 2px rgba(201, 100, 66, 0.15) !important;
    }
  `,
}));

export interface ClaudeSelectProps extends SelectProps {
  className?: string;
}

export function ClaudeSelect({ className, style, ...rest }: ClaudeSelectProps) {
  const { styles, cx } = useStyles();
  return (
    <div data-testid="claude-select" className={className} style={style}>
      <Select className={styles.select} {...rest} />
    </div>
  );
}
