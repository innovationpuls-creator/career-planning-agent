import {
  EditOutlined,
  FileTextOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { Button, Empty, List, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type ResumeArtifactPanelProps = {
  versions: API.GrowthResumeVersionPayload[];
  onAccept: (artifactId: string) => void;
};

const sourceLabels: Record<
  API.GrowthResumeVersionPayload['source_material_status'],
  string
> = {
  available: '材料可用',
  partial: '部分材料',
  missing: '需补充',
};

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    min-width: 0;
    display: grid;
    gap: ${token.margin}px;
    padding: ${token.padding}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  header: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${token.margin}px;
    flex-wrap: wrap;
  `,
  titleWrap: css`
    min-width: 0;
    display: flex;
    align-items: center;
    gap: ${token.marginXS}px;
    flex-wrap: wrap;
  `,
  title: css`
    margin: 0;
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    font-weight: 600;
  `,
  preview: css`
    max-height: 220px;
    overflow: auto;
    padding: ${token.paddingSM}px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorText};
    white-space: pre-wrap;
    line-height: ${token.lineHeight};
  `,
}));

const ResumeArtifactPanel: React.FC<ResumeArtifactPanelProps> = ({
  versions,
  onAccept,
}) => {
  const { styles } = useStyles();
  const latest = versions[0];

  if (!latest) {
    return (
      <section className={styles.panel} data-testid="resume-artifact-panel">
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <FileTextOutlined />
            <h2 className={styles.title}>简历草稿</h2>
            <Tag>待生成</Tag>
          </div>
        </div>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无简历产物" />
      </section>
    );
  }

  return (
    <section className={styles.panel} data-testid="resume-artifact-panel">
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <FileTextOutlined />
          <h2 className={styles.title}>简历草稿</h2>
          <Tag>{sourceLabels[latest.source_material_status]}</Tag>
          {latest.accepted ? <Tag>已接受</Tag> : null}
        </div>
        <Space wrap>
          {!latest.accepted ? (
            <Button
              size="small"
              type="primary"
              autoInsertSpace={false}
              onClick={() => onAccept(latest.id)}
            >
              接受
            </Button>
          ) : null}
          <Button size="small" icon={<EditOutlined />}>
            编辑
          </Button>
          <Button size="small" icon={<MessageOutlined />}>
            问教练
          </Button>
        </Space>
      </div>
      <List
        size="small"
        dataSource={latest.suggestions}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={String(item.title || '')}
              description={String(item.detail || '')}
            />
          </List.Item>
        )}
      />
      <div className={styles.preview}>
        {latest.resume_markdown || '暂无正文'}
      </div>
    </section>
  );
};

export default ResumeArtifactPanel;
