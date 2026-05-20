import type { UploadProps } from 'antd';
import { Upload } from 'antd';
import { createStyles } from 'antd-style';
import React, { useCallback, useState } from 'react';
import { ClaudeTag } from '@/components/ui';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
  claudeShadows,
} from '@/styles/claude-tokens';
import { ACCEPTED_EXTENSIONS } from '../shared';

interface ResumeUploadZoneProps {
  onUpload: (file: File) => boolean | undefined;
  disabled?: boolean;
  acceptedTypes?: string[];
}

const useStyles = createStyles(({ css }) => ({
  dropZone: css`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 280px;
    padding: 48px 32px;
    border: 2px dashed rgba(0, 0, 0, 0.15);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      border-color: ${claudeColors.terracotta};
      background: rgba(217, 93, 57, 0.04);
      transform: scale(1.02);
    }

    &:hover .upload-icon {
      color: ${claudeColors.terracotta};
    }

    :global(.ant-upload-drag) {
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
    }

    :global(.ant-upload) {
      width: 100%;
    }
  `,
  dropZoneDragging: css`
    background: rgba(217, 93, 57, 0.08);
    border-color: ${claudeColors.terracotta};
    box-shadow: 0 0 0 3px rgba(217, 93, 57, 0.1), ${claudeShadows.whisper};
  `,
  icon: css`
    color: ${claudeColors.warmSilver};
    transition: color 0.3s;
  `,
  title: css`
    font-size: 24px;
    font-weight: 500;
    color: ${claudeColors.nearBlack};
    margin: 0;
    margin-bottom: 12px;
  `,
  subtitle: css`
    font-size: 14px;
    color: ${claudeColors.warmSilver};
    margin: 0;
  `,
  tagRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    max-width: 400px;
  `,
}));

const FILE_TYPE_LABELS = ['PDF', 'DOC', 'DOCX', 'TXT', 'JPG', 'PNG'];

export function ResumeUploadZone({
  onUpload,
  disabled,
  acceptedTypes,
}: ResumeUploadZoneProps) {
  const { styles, cx } = useStyles();
  const [isDragging, setIsDragging] = useState(false);

  const accept = (acceptedTypes || ACCEPTED_EXTENSIONS).join(',');

  const handleBeforeUpload = useCallback(
    (file: File) => {
      setIsDragging(false);
      return onUpload(file);
    },
    [onUpload],
  );

  return (
    <div
      className={cx(styles.dropZone, isDragging && styles.dropZoneDragging)}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
    >
      <Upload.Dragger
        accept={accept}
        showUploadList={false}
        beforeUpload={handleBeforeUpload as UploadProps['beforeUpload']}
        disabled={disabled}
        multiple
      >
        <div className={`${styles.icon} upload-icon`}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
        </div>
        <p className={styles.title}>拖放简历文件到此处</p>
        <p className={styles.subtitle}>或点击选择文件上传，支持多种格式</p>
        <div className={styles.tagRow}>
          {FILE_TYPE_LABELS.map((label) => (
            <ClaudeTag key={label}>{label}</ClaudeTag>
          ))}
        </div>
      </Upload.Dragger>
    </div>
  );
}
