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
    padding: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
  `,
  header: css`
    margin-bottom: 6px;
  `,
  title: css`
    margin: 0;
    font-size: 15px;
  `,
  primaryUploadCard: css`
    margin-bottom: 10px;
    border-radius: 12px;
    overflow: hidden;

    :global(.ant-upload) {
      padding: 14px 12px !important;
      background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%);
    }

    :global(.ant-upload-drag-icon) {
      margin-bottom: 8px;
    }
  `,
  compactUpload: css`
    margin-top: 8px;
  `,
  textarea: css`
    border-radius: 10px;
    resize: none;

    :global(textarea) {
      min-height: 38px !important;
      padding-block: 8px;
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
    margin-top: 10px;
    flex-wrap: wrap;
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  `,
  uploadButton: css`
    border-radius: 10px;
  `,
  primaryButton: css`
    min-width: 120px;
    border-radius: 10px;
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
              color={upload.status === 'error' ? 'error' : 'processing'}
              closable={!compact}
              onClose={(event) => {
                event.preventDefault();
                onRemoveUpload(upload.id);
              }}
              style={{ marginInlineEnd: 0 }}
            >
              {upload.kind === 'image' ? '图片' : '文件'} | {upload.name}
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
