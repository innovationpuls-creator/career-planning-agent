import { Spin } from 'antd';
import React from 'react';

export interface PageLoadingProps {
  tip?: string;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  tip = '正在加载...',
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <Spin size="large" tip={tip} />
    </div>
  );
};
