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
    border: 2px dashed ${claudeColors.terracotta};
    border-radius: ${claudeRadius.xl}px;
    background: ${claudeColors.ivory};
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: ${claudeColors.primaryBg};
      border-color: ${claudeColors.primaryHover};
      box-shadow: ${claudeShadows.whisper};
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
    background: ${claudeColors.primaryBg};
    border-color: ${claudeColors.primaryActive};
    box-shadow: 0 0 0 3px ${claudeColors.primaryBg}, ${claudeShadows.whisper};
  `,
  icon: css`
    font-size: 48px;
    color: ${claudeColors.terracotta};
    opacity: 0.7;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 20px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin: 0;
  `,
  subtitle: css`
    font-size: 14px;
    color: ${claudeColors.stoneGray};
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
        <div className={styles.icon}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
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
