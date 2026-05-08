import type { InputProps } from 'antd';
import { Input } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeColors, claudeRadius } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  input: css`
    border-radius: ${claudeRadius.lg}px;
    padding: 8px 12px;
    border: 1px solid ${claudeColors.borderCream};
    background: ${claudeColors.ivory};
    transition: border-color 0.2s, box-shadow 0.2s;

    &:focus,
    &:focus-within {
      border-color: ${claudeColors.terracotta};
      box-shadow: 0 0 0 2px rgba(201, 100, 66, 0.15);
    }

    &::placeholder {
      color: ${claudeColors.stoneGray};
    }
  `,
}));

export interface ClaudeInputProps extends Omit<InputProps, 'variant'> {
  className?: string;
}

export function ClaudeInput({ className, ...rest }: ClaudeInputProps) {
  const { styles, cx } = useStyles();
  return <Input className={cx(styles.input, className)} {...rest} />;
}

export type ClaudeTextAreaProps = React.ComponentPropsWithoutRef<
  typeof Input.TextArea
> & {
  className?: string;
};

export function ClaudeTextArea({ className, ...rest }: ClaudeTextAreaProps) {
  const { styles, cx } = useStyles();
  return <Input.TextArea className={cx(styles.input, className)} {...rest} />;
}

export type ClaudePasswordProps = React.ComponentPropsWithoutRef<
  typeof Input.Password
> & {
  className?: string;
};

export function ClaudePassword({ className, ...rest }: ClaudePasswordProps) {
  const { styles, cx } = useStyles();
  return <Input.Password className={cx(styles.input, className)} {...rest} />;
}
