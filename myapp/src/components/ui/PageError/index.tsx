import { Alert, Button } from 'antd';
import React from 'react';

export interface PageErrorProps {
  /** 错误标题 */
  message?: string;
  /** 详细错误描述 */
  description?: string;
  /** 重试回调 */
  onRetry?: () => void;
  className?: string;
}

export const PageError: React.FC<PageErrorProps> = ({
  message = '加载失败',
  description,
  onRetry,
  className,
}) => {
  return (
    <div className={className} style={{ padding: '24px 0' }}>
      <Alert
        type="error"
        message={message}
        description={description}
        showIcon
        action={
          onRetry ? (
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          ) : undefined
        }
      />
    </div>
  );
};
