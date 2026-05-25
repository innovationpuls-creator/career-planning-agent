import { CheckOutlined, FileDoneOutlined } from '@ant-design/icons';
import { Button, Empty, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type ReportVersionPanelProps = {
  versions: API.GrowthReportVersionPayload[];
  onAccept: (artifactId: string) => void;
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
    max-height: 240px;
    overflow: auto;
    padding: ${token.paddingSM}px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorText};
    white-space: pre-wrap;
    line-height: ${token.lineHeight};
  `,
}));

const ReportVersionPanel: React.FC<ReportVersionPanelProps> = ({
  versions,
  onAccept,
}) => {
  const { styles } = useStyles();
  const latest = versions[0];

  if (!latest) {
    return (
      <section className={styles.panel} data-testid="report-version-panel">
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <FileDoneOutlined />
            <h2 className={styles.title}>报告改写草稿</h2>
            <Tag>待生成</Tag>
          </div>
        </div>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无报告草稿" />
      </section>
    );
  }

  return (
    <section className={styles.panel} data-testid="report-version-panel">
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <FileDoneOutlined />
          <h2 className={styles.title}>报告改写草稿</h2>
          <Tag>{latest.accepted ? '已接受' : '新版本'}</Tag>
        </div>
        {!latest.accepted ? (
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            autoInsertSpace={false}
            onClick={() => onAccept(latest.id)}
          >
            接受回填
          </Button>
        ) : null}
      </div>
      <Space direction="vertical" size="small">
        <div className={styles.preview}>
          {latest.markdown || '暂无正文'}
        </div>
      </Space>
    </section>
  );
};

export default ReportVersionPanel;
