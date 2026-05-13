import { Alert, Button } from 'antd';
import React from 'react';

interface SystemMessageProps {
  kind: 'info' | 'error' | 'abort' | 'retry-hint';
  content: string;
  retryable?: boolean;
  onRetry?: () => void;
}

const TYPE_MAP: Record<
  string,
  'info' | 'warning' | 'error' | 'success'
> = {
  info: 'info',
  error: 'error',
  abort: 'warning',
  'retry-hint': 'warning',
};

export function SystemMessage({
  kind,
  content,
  retryable,
  onRetry,
}: SystemMessageProps) {
  return (
    <div style={{ textAlign: 'center', margin: '8px 0' }}>
      <Alert
        message={content}
        type={TYPE_MAP[kind] || 'info'}
        showIcon
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: 12,
          padding: '4px 12px',
        }}
        action={
          retryable && onRetry ? (
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
