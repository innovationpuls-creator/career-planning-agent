import { FilePdfOutlined, FileWordOutlined } from '@ant-design/icons';
import { Button, message } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { useState } from 'react';
import { exportPersonalGrowthReport } from '@/services/ant-design-pro/api';
import { claudeColors, claudeShadows } from '@/styles/claude-tokens';

type ExportPanelProps = {
  favoriteId?: number;
  disabled?: boolean;
  onError?: (message?: string) => void;
};

const getRequestErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

const downloadBlob = (blob: Blob, filename?: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'personal-growth-report';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const useStyles = createStyles(({ css, token }) => ({
  actions: css`
    display: flex;
    align-items: center;
    gap: ${token.marginXS}px;
    flex-wrap: wrap;
  `,
  wordButton: css`
    background: ${claudeColors.warmSand} !important;
    border-color: ${claudeColors.ringWarm} !important;
    color: ${claudeColors.charcoalWarm} !important;
    box-shadow: ${claudeShadows.ring};

    &:hover {
      background: ${token.colorFillSecondary} !important;
      border-color: ${token.colorBorder} !important;
      color: ${token.colorText} !important;
    }
  `,
  pdfButton: css`
    background: ${token.colorPrimary} !important;
    border-color: ${token.colorPrimary} !important;
    color: ${token.colorBgContainer} !important;

    &:hover {
      background: ${token.colorPrimaryHover} !important;
      border-color: ${token.colorPrimaryHover} !important;
      color: ${token.colorBgContainer} !important;
    }
  `,
}));

const ExportPanel: React.FC<ExportPanelProps> = ({
  favoriteId,
  disabled = false,
  onError,
}) => {
  const { styles } = useStyles();
  const [exportingFormat, setExportingFormat] = useState<'docx' | 'pdf'>();

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!favoriteId) return;
    setExportingFormat(format);
    onError?.(undefined);
    try {
      const result = await exportPersonalGrowthReport(favoriteId, {
        format,
        force_with_issues: false,
      });
      downloadBlob(result.blob, result.filename);
      message.success(format === 'docx' ? '已导出 Word。' : '已导出 PDF。');
    } catch (error: any) {
      onError?.(getRequestErrorMessage(error, '导出失败。'));
    } finally {
      setExportingFormat(undefined);
    }
  };

  return (
    <div className={styles.actions} data-testid="export-panel">
      <Button
        className={styles.wordButton}
        icon={<FileWordOutlined />}
        disabled={disabled || !favoriteId}
        loading={exportingFormat === 'docx'}
        onClick={() => void handleExport('docx')}
      >
        导出 Word
      </Button>
      <Button
        className={styles.pdfButton}
        icon={<FilePdfOutlined />}
        disabled={disabled || !favoriteId}
        loading={exportingFormat === 'pdf'}
        onClick={() => void handleExport('pdf')}
      >
        导出 PDF
      </Button>
    </div>
  );
};

export default ExportPanel;
