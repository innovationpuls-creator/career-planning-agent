import { Skeleton } from 'antd';
import React from 'react';

export interface SkeletonCardProps {
  /** 段落行数 */
  rows?: number;
  /** 是否显示头像 */
  avatar?: boolean;
  /** 是否显示操作按钮区域 */
  hasAction?: boolean;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  rows = 3,
  avatar = false,
  className,
}) => {
  return (
    <div className={className}>
      <Skeleton active avatar={avatar} paragraph={{ rows }} />
    </div>
  );
};
