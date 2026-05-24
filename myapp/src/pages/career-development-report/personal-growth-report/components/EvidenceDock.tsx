import { CheckOutlined, MinusOutlined } from '@ant-design/icons';
import { Empty, List, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type EvidenceDockProps = {
  sources: API.GrowthWorkbenchEvidenceSource[];
};

const statusLabels: Record<API.GrowthWorkbenchEvidenceSource['status'], string> =
  {
    available: '可用',
    partial: '部分',
    missing: '缺失',
  };

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    min-width: 0;
    padding: ${token.padding}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  title: css`
    margin: 0 0 ${token.marginSM}px;
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    font-weight: 600;
  `,
}));

const EvidenceDock: React.FC<EvidenceDockProps> = ({ sources }) => {
  const { styles } = useStyles();

  return (
    <section className={styles.panel} data-testid="evidence-dock">
      <h2 className={styles.title}>证据</h2>
      {sources.length ? (
        <List
          size="small"
          dataSource={sources}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta title={item.label} description={item.summary} />
              <Tag
                icon={
                  item.status === 'available' ? <CheckOutlined /> : <MinusOutlined />
                }
              >
                {statusLabels[item.status]}
              </Tag>
            </List.Item>
          )}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无证据" />
      )}
    </section>
  );
};

export default EvidenceDock;
