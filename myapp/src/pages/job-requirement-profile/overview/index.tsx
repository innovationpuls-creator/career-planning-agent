import { PageContainer } from '@ant-design/pro-components';
import { Alert, Empty, Space, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeCard } from '@/components/ui';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';
import { GraphCanvas } from './components/GraphCanvas';
import { GraphGuide } from './components/GraphGuide';
import { GraphLegend } from './components/GraphLegend';
import { NodeDetailPanel } from './components/NodeDetailPanel';
import { useGraphData } from './hooks/useGraphData';

const useStyles = createStyles(({ css }) => ({
  pageContainer: css`
    :global(.ant-pro-page-container-children-container) {
      padding-inline: 0;
      padding-block: 0;
    }
  `,
  shell: css`
    min-height: calc(100vh - 112px);
    padding: 24px;
    background: ${claudeColors.parchment};
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-end;
    margin-bottom: 18px;

    @media (max-width: 768px) {
      display: grid;
    }
  `,
  title: css`
    margin: 0;
    font-family: ${claudeFonts.heading};
    color: ${claudeColors.nearBlack};
  `,
  subtitle: css`
    margin: 8px 0 0;
    color: ${claudeColors.oliveGray};
    line-height: 1.7;
  `,
  statLine: css`
    display: flex;
    gap: 8px;
    color: ${claudeColors.stoneGray};
    font-size: 13px;
  `,
  graphWrap: css`
    position: relative;
    min-height: 720px;
  `,
  footer: css`
    display: grid;
    gap: 14px;
    margin-top: 16px;
  `,
}));

const JobRequirementOverviewPage: React.FC = () => {
  const { styles } = useStyles();
  const { graphData, loading, error, payload, selectedNode, selectNode } =
    useGraphData();
  const dimensionCount =
    payload?.nodes.filter((node) => node.type === 'Dimension').length || 12;

  return (
    <PageContainer
      className={styles.pageContainer}
      title={false}
      breadcrumbRender={false}
    >
      <main className={styles.shell}>
        <div className={styles.header}>
          <div>
            <Typography.Title level={2} className={styles.title}>
              岗位能力图谱
            </Typography.Title>
            <p className={styles.subtitle}>
              从岗位画像总览进入三层能力结构，点击节点聚焦相关路径并查看右侧证据。
            </p>
          </div>
          <Space direction="vertical" size={6}>
            <div className={styles.statLine}>
              <span>{payload?.nodes.length || 0} 个节点</span>
              <span>{payload?.edges.length || 0} 条关系</span>
            </div>
            <GraphLegend />
          </Space>
        </div>

        {error ? (
          <Alert
            type="error"
            showIcon
            message="岗位要求画像图谱加载失败"
            description={error}
          />
        ) : graphData || loading ? (
          <ClaudeCard elevation="flat">
            <div className={styles.graphWrap}>
              <GraphCanvas
                graphData={graphData}
                loading={loading}
                onSelectNode={selectNode}
              />
              {!loading ? <NodeDetailPanel node={selectedNode} /> : null}
            </div>
          </ClaudeCard>
        ) : (
          <Empty description="暂无岗位要求画像图谱数据" />
        )}

        <div className={styles.footer}>
          <GraphGuide dimensionCount={dimensionCount} />
        </div>
      </main>
    </PageContainer>
  );
};

export default JobRequirementOverviewPage;
