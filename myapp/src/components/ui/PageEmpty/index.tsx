import { Empty, Space, Typography } from 'antd';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';
import React from 'react';

export interface PageEmptyProps {
  /** 主标题 */
  title?: string;
  /** 描述文字，告诉用户接下来做什么 */
  description?: string;
  /** 操作按钮 */
  action?: ReactNode;
  className?: string;
}

const useStyles = createStyles(({ token }) => ({
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
  },
  title: {
    margin: '12px 0 4px !important',
    fontSize: 16,
    fontWeight: 500,
    color: token.colorText,
  },
  description: {
    margin: '0 0 16px !important',
    fontSize: 12,
    color: token.colorTextTertiary,
    textAlign: 'center' as const,
    maxWidth: 280,
    lineHeight: 1.5,
  },
}));

export const PageEmpty: React.FC<PageEmptyProps> = ({
  title = '暂无数据',
  description,
  action,
  className,
}) => {
  const { styles } = useStyles();

  return (
    <div className={className}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space
            direction="vertical"
            size={4}
            align="center"
            className={styles.wrap}
          >
            <Typography.Text className={styles.title}>{title}</Typography.Text>
            {description && (
              <Typography.Text className={styles.description}>
                {description}
              </Typography.Text>
            )}
            {action}
          </Space>
        }
      />
    </div>
  );
};
