import { CheckOutlined, FileDoneOutlined } from '@ant-design/icons';
import { Button, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type ReportArtifactPanelProps = {
  versions: API.GrowthReportVersionPayload[];
  existingWorkspace?: API.PersonalGrowthReportPayload | null;
  children: React.ReactNode;
  onAccept: (artifactId: string) => void;
};

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    min-width: 0;
    display: grid;
    gap: ${token.margin}px;
  `,
  bar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.margin}px;
    flex-wrap: wrap;
    padding: ${token.padding}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  title: css`
    color: ${token.colorText};
    font-weight: 600;
  `,
}));

const ReportArtifactPanel: React.FC<ReportArtifactPanelProps> = ({
  versions,
  existingWorkspace,
  children,
  onAccept,
}) => {
  const { styles } = useStyles();
  const latest = versions[0];
  const hasWorkspace = Boolean(existingWorkspace?.workspace_id);

  return (
    <section className={styles.panel} data-testid="report-artifact-panel">
      <div className={styles.bar}>
        <Space wrap>
          <FileDoneOutlined />
          <span className={styles.title}>成长报告</span>
          {latest ? <Tag>{latest.accepted ? '已接受' : '新版本'}</Tag> : null}
          {!latest && hasWorkspace ? <Tag>当前版本</Tag> : null}
        </Space>
        {latest && !latest.accepted ? (
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            autoInsertSpace={false}
            onClick={() => onAccept(latest.id)}
          >
            接受
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
};

export default ReportArtifactPanel;
