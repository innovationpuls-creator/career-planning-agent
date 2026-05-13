import { Progress, Tag } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import React from 'react';
import { claudeColors } from '@/styles/claude-tokens';
import type { PendingUpload } from '../types';

interface PendingUploadsProps {
  uploads: PendingUpload[];
  onRemove: (fileId: string) => void;
}

export function PendingUploads({
  uploads,
  onRemove,
}: PendingUploadsProps) {
  if (uploads.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        padding: '4px 12px',
      }}
    >
      {uploads.map((upload) => (
        <Tag
          key={upload.fileId}
          closable={upload.uploadState === 'ready' || upload.uploadState === 'error'}
          onClose={
            upload.uploadState === 'ready' || upload.uploadState === 'error'
              ? () => onRemove(upload.fileId)
              : undefined
          }
          closeIcon={<CloseOutlined />}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {upload.uploadState === 'uploading' ? (
            <Progress
              type="circle"
              percent={upload.progress}
              size={14}
              strokeWidth={10}
              showInfo={false}
            />
          ) : upload.uploadState === 'error' ? (
            <span style={{ color: claudeColors.error }}>⚠</span>
          ) : (
            <span>✓</span>
          )}
          <span style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {upload.name}
          </span>
        </Tag>
      ))}
    </div>
  );
}
