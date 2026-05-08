import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeColors, claudeRadius } from '@/styles/claude-tokens';

export interface ClaudeTagProps {
  closable?: boolean;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

const useStyles = createStyles(({ css }) => ({
  tag: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: ${claudeRadius.xxl}px;
    background: ${claudeColors.primaryBg};
    color: ${claudeColors.terracotta};
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    white-space: nowrap;
  `,
  closeBtn: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    color: ${claudeColors.terracotta};
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    border-radius: 50%;
    transition: background 0.15s;

    &:hover {
      background: rgba(201, 100, 66, 0.15);
    }
  `,
}));

export function ClaudeTag({
  closable,
  onClose,
  className,
  children,
}: ClaudeTagProps) {
  const { styles, cx } = useStyles();

  return (
    <span data-testid="claude-tag" className={cx(styles.tag, className)}>
      {children}
      {closable && (
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Remove tag"
          type="button"
        >
          ×
        </button>
      )}
    </span>
  );
}
