import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Input, Space, Tag, Typography, Upload } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import type { UploadProps } from 'antd';
import { buildUploadButtonProps } from '../shared';
import type { WorkspaceUpload, WorkspaceViewState } from '../shared';

const { Dragger } = Upload;
const { TextArea } = Input;

const useStyles = createStyles(({ css, token }) => ({
  composer: css`
    padding: 18px 18px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
    box-shadow: 0 6px 18px rgba(15, 35, 70, 0.035);
  `,
  header: css`
    margin-bottom: 14px;
  `,
  title: css`
    margin: 0;
    color: ${token.colorText};
    font-size: 17px !important;
    font-weight: 600 !important;
  `,
  primaryUploadCard: css`
    margin-bottom: 12px;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s ease;
    cursor: pointer;

    :global(.ant-upload) {
      padding: 18px 12px !important;
      background: linear-gradient(180deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 100%);
      transition: background 0.2s ease;
    }

    :global(.ant-upload-drag-icon) {
      margin-bottom: 8px;
      transition: transform 0.2s ease;
    }

    :hover {
      border-color: ${token.colorPrimary};
      box-shadow: 0 8px 18px rgba(22, 85, 204, 0.11);
    }

    :hover :global(.ant-upload-drag-icon) {
      transform: scale(1.1);
    }

    :hover :global(.ant-upload) {
      background: linear-gradient(180deg, ${token.colorPrimaryBgHover} 0%, ${token.colorPrimaryBg} 100%);
    }
  `,
  compactUpload: css`
    margin-top: 12px;
  `,
  textarea: css`
    border-radius: 8px;
    resize: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    :global(textarea) {
      min-height: 38px !important;
      padding: 8px 12px;
      color: ${token.colorText};
    }

    :global(.ant-input:focus),
    :global(.ant-input-focused) {
      border-color: ${token.colorPrimary};
      box-shadow: 0 0 0 2px rgba(22, 85, 204, 0.1);
    }

    :hover:not(:global(.ant-input-disabled)) {
      border-color: ${token.colorPrimary};
    }
  `,
  uploadList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  `,
  footer: css`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
    flex-wrap: wrap;
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  `,
  uploadButton: css`
    height: 38px;
    border-radius: 8px;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(15, 35, 70, 0.08);
      border-color: ${token.colorPrimary};
      color: ${token.colorPrimary};
    }

    :active {
      transform: translateY(0);
    }
  `,
  primaryButton: css`
    min-width: 128px;
    height: 38px;
    border-radius: 8px;
    font-weight: 500;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(22, 85, 204, 0.18);
    }

    :active {
      transform: translateY(0);
      box-shadow: none;
    }
  `,
  helperText: css`
    font-size: 12px;
  `,
}));

type Props = {
  viewState: WorkspaceViewState;
  expanded?: boolean;
  value: string;
  uploads: WorkspaceUpload[];
  error?: string;
  disabled: boolean;
  submitDisabledReason?: string;
  canSubmit: boolean;
  submitLabel: string;
  fileUploadEnabled: boolean;
  onValueChange: (value: string) => void;
  onRemoveUpload: (uploadId: string) => void;
  onSubmit: () => void;
  onBeforeUpload: NonNullable<UploadProps['beforeUpload']>;
};

const ResumeComposer: React.FC<Props> = ({
  viewState,
  expanded = true,
  value,
  uploads,
  error,
  disabled,
  submitDisabledReason,
  canSubmit,
  submitLabel,
  fileUploadEnabled,
  onValueChange,
  onRemoveUpload,
  onSubmit,
  onBeforeUpload,
}) => {
  const { styles } = useStyles();
  const uploadProps = buildUploadButtonProps(onBeforeUpload, disabled || !fileUploadEnabled);
  const isEmptyState = viewState === 'empty';
  const compact = !expanded;
  const getUploadColor = (status: WorkspaceUpload['status']) => {
    if (status === 'error') return 'error';
    if (status === 'submitted') return 'success';
    return 'processing';
  };

  return (
    <div className={styles.composer}>
      <div className={styles.header}>
        <Typography.Title level={5} className={styles.title}>
          补充描述
        </Typography.Title>
      </div>

      {isEmptyState && !compact ? (
        <Dragger className={styles.primaryUploadCard} {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <Typography.Title level={4} style={{ marginBottom: 4 }}>
            上传简历开始解析
          </Typography.Title>
          <Typography.Text type="secondary">也可补充项目经历或技能描述</Typography.Text>
        </Dragger>
      ) : null}

      <TextArea
        className={styles.textarea}
        placeholder="补充项目或技能"
        autoSize={{ minRows: compact ? 1 : 2, maxRows: compact ? 2 : 2 }}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
      />

      {uploads.length ? (
        <div className={styles.uploadList}>
          {(compact ? uploads.slice(0, 1) : uploads).map((upload) => (
            <Tag
              key={upload.id}
              color={getUploadColor(upload.status)}
              closable={!compact}
              onClose={(event) => {
                event.preventDefault();
                onRemoveUpload(upload.id);
              }}
              style={{ marginInlineEnd: 0 }}
            >
              {upload.kind === 'image' ? '图片' : '文件'} | {upload.name}
              {!compact && upload.status === 'submitted' ? ' | 已上传' : ''}
              {!compact && upload.error ? ` | ${upload.error}` : ''}
            </Tag>
          ))}
        </div>
      ) : null}

      {!isEmptyState ? (
        <div className={styles.compactUpload}>
          <Upload {...uploadProps}>
            <Button className={styles.uploadButton} icon={<UploadOutlined />} disabled={disabled || !fileUploadEnabled}>
              {compact ? '继续上传' : '上传文件'}
            </Button>
          </Upload>
        </div>
      ) : null}

      <div className={styles.footer}>
        <Space direction="vertical" size={2}>
          {error ? (
            <Typography.Text type="danger" className={styles.helperText}>
              {error}
            </Typography.Text>
          ) : null}
          {!canSubmit && submitDisabledReason ? (
            <Typography.Text type="secondary" className={styles.helperText}>
              {submitDisabledReason}
            </Typography.Text>
          ) : null}
        </Space>

        <div className={styles.actions}>
          <Button
            type="primary"
            className={styles.primaryButton}
            loading={disabled && canSubmit}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResumeComposer;
