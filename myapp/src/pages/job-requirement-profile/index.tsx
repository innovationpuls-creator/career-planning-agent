import {
  ApartmentOutlined,
  InfoCircleOutlined,
  NodeIndexOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Graph } from '@antv/g6';
import { Alert, Card, Collapse, Col, Empty, Row, Space, Spin, Statistic, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getJobRequirementProfileGraph } from '@/services/ant-design-pro/api';

type GraphNode = API.JobRequirementGraphNode;
type GraphEdge = API.JobRequirementGraphEdge;
type GraphNodeType = GraphNode['type'];
type LabelPlacement = 'top' | 'bottom' | 'left' | 'right';

type GraphLayoutNode = {
  id: string;
  data: GraphNode & {
    emphasis: boolean;
    labelPlacement: LabelPlacement;
    labelOffset: number;
    labelMaxWidth: number;
  };
  style: {
    x: number;
    y: number;
  };
};

type GraphData = {
  nodes: GraphLayoutNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data: GraphEdge & {
      active: boolean;
    };
  }>;
};

type GraphRenderDatum = {
  data?: Record<string, unknown>;
};

const getRenderNodeData = (datum: GraphRenderDatum) => datum.data as GraphLayoutNode['data'];

const GROUP_ANGLES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];

const ICON_TEXT_MAP: Record<string, string> = {
  profile: 'P',
  apartment: 'G',
  'fund-projection-screen': 'S',
  book: 'B',
  read: 'E',
  schedule: 'W',
  team: 'T',
  thunderbolt: 'A',
  message: 'C',
  'file-text': 'D',
  'safety-certificate': 'R',
  solution: 'L',
};

const TYPE_COLORS: Record<GraphNodeType, { fill: string; stroke: string; label: string }> = {
  ProfileRoot: {
    fill: '#e6f4ff',
    stroke: '#1677ff',
    label: '#0f2f57',
  },
  DimensionGroup: {
    fill: '#f0f7ff',
    stroke: '#69b1ff',
    label: '#12314d',
  },
  Dimension: {
    fill: '#ffffff',
    stroke: '#b7d7ff',
    label: '#244a72',
  },
};

const DEFAULT_DIMENSION_COUNT = 12;
const useStyles = createStyles(({ css, token }) => ({
  pageContainer: css`
    :global(.ant-pro-page-container-children-container) {
      padding-inline: 24px;
      padding-block: 24px;

      @media (max-width: 768px) {
        padding-inline: 16px;
        padding-block: 16px;
      }
    }
  `,
  shell: css`
    min-height: calc(100vh - 160px);
  `,
  sectionCard: css`
    border-radius: ${token.borderRadiusLG}px;

    :global(.ant-card-body) {
      padding: 24px;
    }
  `,
  sectionHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  sectionTitle: css`
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: ${token.colorTextHeading};
    letter-spacing: -0.3px;
  `,
  sectionText: css`
    max-width: 780px;
    margin: 0;
    color: rgba(18, 49, 77, 0.66);
    line-height: 1.8;
  `,
  toolBar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 18px;
  `,
  graphStage: css`
    width: 100%;
    min-height: 720px;
    border-radius: 12px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    overflow: hidden;
  `,
  loadingWrap: css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 720px;
  `,
  infoPanel: css`
    height: 100%;
    border-radius: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    transition: all 0.2s ease;

    :global(.ant-card-body) {
      padding: 20px 22px;
    }

    :hover {
      border-color: ${token.colorPrimary};
      box-shadow: 0 4px 16px rgba(22, 119, 255, 0.1);
    }
  `,
  infoPanelContent: css`
    animation: fadeIn 0.2s ease;

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  panelTitle: css`
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
    color: ${token.colorTextHeading};
  `,
  panelText: css`
    margin: 0 0 16px;
    color: ${token.colorTextSecondary};
    line-height: 1.8;
  `,
  panelSection: css`
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
  panelLabel: css`
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
    color: ${token.colorTextHeading};
    font-weight: 600;
  `,
  helperText: css`
    margin: 0 0 12px;
    color: ${token.colorTextTertiary};
    font-size: 13px;
    line-height: 1.7;
  `,
  statGrid: css`
    margin-top: 8px;
  `,
  statHint: css`
    margin-top: 8px;
    color: ${token.colorTextTertiary};
    font-size: 12px;
    line-height: 1.7;
  `,
  statValue: css`
    transition: all 0.2s ease;

    :hover {
      transform: scale(1.04);
      color: ${token.colorPrimary};
    }
  `,
  keywordTag: css`
    transition: all 0.2s ease;
    animation: tagEnter 0.2s ease;

    @keyframes tagEnter {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
  guideCollapse: css`
    margin-top: 20px;
    border-radius: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    overflow: hidden;

    :global(.ant-collapse-header) {
      align-items: center !important;
      padding: 14px 20px !important;
      background: ${token.colorFillQuaternary};
      font-weight: 600;
    }

    :global(.ant-collapse-content-box) {
      padding: 16px 20px !important;
    }
  `,
  guideItem: css`
    padding: 12px 0;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  `,
  guideItemTitle: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-weight: 600;
    color: ${token.colorTextHeading};
  `,
  guideItemBadge: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: ${token.colorPrimary};
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  `,
  guideItemText: css`
    margin: 0;
    color: ${token.colorTextSecondary};
    line-height: 1.7;
    font-size: 13px;
  `,
}));

const getRelatedIds = (nodeId: string, edges: GraphEdge[]) => {
  const relatedIds = new Set<string>([nodeId]);
  edges.forEach((edge) => {
    if (edge.source === nodeId) relatedIds.add(edge.target);
    if (edge.target === nodeId) relatedIds.add(edge.source);
  });
  return relatedIds;
};

const getOutwardLabelPlacement = (x: number, y: number, centerX: number, centerY: number): LabelPlacement => {
  const dx = x - centerX;
  const dy = y - centerY;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
};

const buildGraphLayout = (
  payload: API.JobRequirementGraphPayload,
  width: number,
  height: number,
  activeNodeId?: string,
): GraphData => {
  const centerX = width / 2;
  const centerY = height * 0.54;
  const root = payload.nodes.find((node) => node.type === 'ProfileRoot');
  const groups = payload.nodes.filter((node) => node.type === 'DimensionGroup');
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));
  const dimensionBuckets = new Map<string, GraphNode[]>();
  const highlightedIds = activeNodeId ? getRelatedIds(activeNodeId, payload.edges) : new Set<string>();
  const activeEdgeIds = new Set<string>();

  for (const edge of payload.edges.filter((item) => item.type === 'HAS_DIMENSION')) {
    const list = dimensionBuckets.get(edge.source) || [];
    const targetNode = payload.nodes.find((node) => node.id === edge.target);
    if (targetNode) {
      list.push(targetNode);
      dimensionBuckets.set(edge.source, list);
    }
  }

  if (activeNodeId) {
    payload.edges.forEach((edge) => {
      if (highlightedIds.has(edge.source) && highlightedIds.has(edge.target)) {
        activeEdgeIds.add(`${edge.source}-${edge.target}`);
      }
    });
  }

  const buildNodeData = (
    node: GraphNode,
    x: number,
    y: number,
    fallbackPlacement: LabelPlacement,
    labelOffset: number,
    labelMaxWidth: number,
  ) => ({
    ...node,
    emphasis: node.id === activeNodeId,
    labelPlacement: node.type === 'Dimension' ? getOutwardLabelPlacement(x, y, centerX, centerY) : fallbackPlacement,
    labelOffset,
    labelMaxWidth,
  });

  const nodes: GraphLayoutNode[] = [];
  const edges: GraphData['edges'] = payload.edges.map((edge) => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    data: {
      ...edge,
      active: !activeNodeId || activeEdgeIds.has(`${edge.source}-${edge.target}`),
    },
  }));

  if (root) {
    nodes.push({
      id: root.id,
      data: buildNodeData(root, centerX, centerY, 'bottom', 18, 164),
      style: { x: centerX, y: centerY },
    });
  }

  groups.forEach((group, index) => {
    const angle = GROUP_ANGLES[index] ?? GROUP_ANGLES.at(-1) ?? 0;
    const radius = Math.min(width, height) * 0.24;
    const groupX = centerX + Math.cos(angle) * radius;
    const groupY = centerY + Math.sin(angle) * radius;

    nodes.push({
      id: group.id,
      data: buildNodeData(group, groupX, groupY, 'bottom', 14, 156),
      style: { x: groupX, y: groupY },
    });

    const dimensions = dimensionBuckets.get(group.id) || [];
    const spread = dimensions.length > 1 ? (2 * Math.PI) / 3 : 0;
    const startAngle = angle - spread / 2;

    dimensions.forEach((dimension, itemIndex) => {
      const childAngle =
        dimensions.length > 1 ? startAngle + (spread / (dimensions.length - 1)) * itemIndex : angle;
      const childRadius = Math.min(width, height) * 0.4;
      const offsetX = centerX + Math.cos(childAngle) * childRadius;
      const offsetY = centerY + Math.sin(childAngle) * childRadius;

      nodes.push({
        id: dimension.id,
        data: buildNodeData(dimension, offsetX, offsetY, 'bottom', 12, 120),
        style: { x: offsetX, y: offsetY },
      });
    });
  });

  nodes.sort((a, b) => {
    const rank = { ProfileRoot: 0, DimensionGroup: 1, Dimension: 2 } as const;
    const rankDiff = rank[a.data.type] - rank[b.data.type];
    if (rankDiff !== 0) return rankDiff;
    if (a.data.type === 'DimensionGroup') return (groupOrder.get(a.id) || 0) - (groupOrder.get(b.id) || 0);
    return a.data.title.localeCompare(b.data.title);
  });

  return { nodes, edges };
};

const JobRequirementProfilePage: React.FC = () => {
  const { styles } = useStyles();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [graphPayload, setGraphPayload] = useState<API.JobRequirementGraphPayload>();
  const [activeNodeId, setActiveNodeId] = useState<string>();

  const activeNode = useMemo(
    () => graphPayload?.nodes.find((node) => node.id === activeNodeId),
    [activeNodeId, graphPayload],
  );

  const dimensionNodes = useMemo(
    () => graphPayload?.nodes.filter((node) => node.type === 'Dimension') || [],
    [graphPayload],
  );

  const dimensionCount = dimensionNodes.length || DEFAULT_DIMENSION_COUNT;

  const focusNode = (nodeId: string) => {
    setActiveNodeId(nodeId);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(undefined);

    void getJobRequirementProfileGraph()
      .then((response) => {
        if (!mounted) return;
        setGraphPayload(response.data);
        const rootNode = response.data.nodes.find((node) => node.type === 'ProfileRoot');
        setActiveNodeId(rootNode?.id || response.data.nodes[0]?.id);
      })
      .catch(() => {
        if (!mounted) return;
        setError('岗位要求画像图谱暂时无法加载，请确认 Neo4j 服务与后端接口已经启动。');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || loading || error || !graphPayload) return undefined;

    const container = containerRef.current;
    const width = container.clientWidth || 1180;
    const height = 720;
    const nextData = buildGraphLayout(graphPayload, width, height, activeNodeId);

    if (graphRef.current) {
      graphRef.current.setData(nextData);
      void graphRef.current.draw();
      return undefined;
    }

    container.innerHTML = '';
    const graph = new Graph({
      container,
      width,
      height,
      autoFit: 'view',
      data: nextData,
      animation: false,
      behaviors: [{ type: 'hover-activate', degree: 0, state: 'active', animation: false }],
      node: {
        type: 'circle',
        style: {
          size: (datum: GraphRenderDatum) => {
            const nodeData = getRenderNodeData(datum);
            const baseSize =
              nodeData.type === 'ProfileRoot' ? 124 : nodeData.type === 'DimensionGroup' ? 84 : 56;
            return nodeData.emphasis ? baseSize + 8 : baseSize;
          },
          fill: (datum: GraphRenderDatum) => TYPE_COLORS[getRenderNodeData(datum).type].fill,
          stroke: (datum: GraphRenderDatum) => TYPE_COLORS[getRenderNodeData(datum).type].stroke,
          lineWidth: (datum: GraphRenderDatum) => {
            const nodeData = getRenderNodeData(datum);
            if (nodeData.emphasis) return 5;
            if (nodeData.type === 'ProfileRoot') return 4;
            if (nodeData.type === 'DimensionGroup') return 3;
            return 2;
          },
          shadowColor: 'rgba(22, 119, 255, 0.18)',
          shadowBlur: (datum: GraphRenderDatum) => {
            const nodeData = getRenderNodeData(datum);
            if (nodeData.emphasis) return 26;
            if (nodeData.type === 'ProfileRoot') return 18;
            if (nodeData.type === 'DimensionGroup') return 12;
            return 6;
          },
          iconText: (datum: GraphRenderDatum) => ICON_TEXT_MAP[getRenderNodeData(datum).icon] || 'N',
          iconFontSize: (datum: GraphRenderDatum) => {
            const nodeData = getRenderNodeData(datum);
            if (nodeData.type === 'ProfileRoot') return 30;
            if (nodeData.type === 'DimensionGroup') return 18;
            return 15;
          },
          labelText: (datum: GraphRenderDatum) => getRenderNodeData(datum).title,
          labelPlacement: (datum: GraphRenderDatum) => getRenderNodeData(datum).labelPlacement,
          labelMaxWidth: (datum: GraphRenderDatum) => getRenderNodeData(datum).labelMaxWidth,
          labelWordWrap: true,
          labelWordWrapWidth: (datum: GraphRenderDatum) => getRenderNodeData(datum).labelMaxWidth,
          labelOffsetX: (datum: GraphRenderDatum) =>
            getRenderNodeData(datum).labelPlacement === 'left'
              ? -getRenderNodeData(datum).labelOffset
              : getRenderNodeData(datum).labelPlacement === 'right'
                ? getRenderNodeData(datum).labelOffset
                : 0,
          labelOffsetY: (datum: GraphRenderDatum) =>
            getRenderNodeData(datum).labelPlacement === 'top'
              ? -getRenderNodeData(datum).labelOffset
              : getRenderNodeData(datum).labelPlacement === 'bottom'
                ? getRenderNodeData(datum).labelOffset
                : 0,
          labelBackground: true,
          labelBackgroundFill: 'rgba(255,255,255,0.95)',
          labelBackgroundRadius: 8,
          labelPadding: [6, 10],
          labelFill: (datum: GraphRenderDatum) => TYPE_COLORS[getRenderNodeData(datum).type].label,
          labelFontSize: (datum: GraphRenderDatum) => {
            const nodeData = getRenderNodeData(datum);
            if (nodeData.type === 'ProfileRoot') return 20;
            if (nodeData.type === 'DimensionGroup') return 16;
            return 14;
          },
          labelFontWeight: (datum: GraphRenderDatum) =>
            getRenderNodeData(datum).type === 'Dimension' ? 600 : 700,
          labelTextAlign: (datum: any) => {
            if (datum.data.labelPlacement === 'left') return 'right';
            if (datum.data.labelPlacement === 'right') return 'left';
            return 'center';
          },
        },
        state: {
          active: {
            halo: true,
            haloLineWidth: 14,
            haloStroke: '#69b1ff',
            haloStrokeOpacity: 0.24,
            shadowBlur: 22,
            shadowColor: 'rgba(22, 119, 255, 0.24)',
            lineWidth: 4,
          },
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: (datum: any) => (datum.data.active ? '#69b1ff' : '#d6e4ff'),
          lineWidth: (datum: any) => (datum.data.active ? 2.6 : 1.3),
          strokeOpacity: (datum: any) => (datum.data.active ? 0.95 : 0.72),
          endArrow: true,
          endArrowFill: (datum: any) => (datum.data.active ? '#69b1ff' : '#d6e4ff'),
        },
      },
    });

    graph.on('node:click', (event: any) => {
      const eventNodeId = event?.target?.id as string | undefined;
      if (eventNodeId) focusNode(eventNodeId);
    });

    void graph.render();
    graphRef.current = graph;

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [activeNodeId, error, graphPayload, loading]);

  return (
    <PageContainer className={styles.pageContainer} title={false} breadcrumbRender={false}>
      <div className={styles.shell}>
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <Typography.Title level={2} className={styles.sectionTitle}>
                岗位要求图谱总览
              </Typography.Title>
            </div>
            <Space wrap size={[8, 8]}>
              <Tag icon={<NodeIndexOutlined />} color="blue">
                {graphPayload?.nodes.length || 0} 个节点
              </Tag>
              <Tag icon={<ApartmentOutlined />} color="cyan">
                {graphPayload?.edges.length || 0} 条关系
              </Tag>
              <Tag icon={<RadarChartOutlined />} color="processing">
                图谱视图
              </Tag>
            </Space>
          </div>

          {loading ? (
            <div className={styles.graphStage}>
              <div className={styles.loadingWrap}>
                <Spin size="large" />
              </div>
            </div>
          ) : error ? (
            <Alert type="error" showIcon message="岗位要求画像图谱加载失败" description={error} />
          ) : graphPayload ? (
            <>
              <Row gutter={[20, 20]}>
                <Col xs={24} xl={16}>
                  <div ref={containerRef} className={styles.graphStage} />
                </Col>
                <Col xs={24} xl={8}>
                  <Card className={styles.infoPanel}>
                    <div className={styles.infoPanelContent}>
                      <Typography.Title level={3} className={styles.panelTitle}>
                        {activeNode?.title || '岗位要求画像'}
                      </Typography.Title>
                      <Typography.Paragraph className={styles.panelText}>
                        {activeNode?.description || '请选择图谱中的节点以查看详情。'}
                      </Typography.Paragraph>

                      <div className={styles.panelSection}>
                        <Typography.Text className={styles.panelLabel}>
                          <InfoCircleOutlined />
                          招聘关键词
                        </Typography.Text>
                        <Typography.Paragraph className={styles.helperText}>
                          以下关键词来自公司招聘信息原文的聚合提取，用来概括这个节点在真实招聘描述里最常被强调的能力或要求。
                        </Typography.Paragraph>
                        <Space wrap size={[8, 8]}>
                          {(activeNode?.keywords?.length ? activeNode.keywords : ['暂无明确招聘关键词']).map((item) => (
                            <Tag key={item} className={styles.keywordTag} color={item === '暂无明确招聘关键词' ? 'default' : 'blue'}>
                              {item}
                            </Tag>
                          ))}
                        </Space>
                      </div>

                      <div className={styles.panelSection}>
                        <Typography.Text className={styles.panelLabel}>
                          <InfoCircleOutlined />
                          聚合统计
                        </Typography.Text>
                        <Typography.Paragraph className={styles.helperText}>
                          覆盖岗位数表示这个节点在多少条岗位招聘信息中被提及；明确要求数表示去掉默认占位或未写明情况后，明确写出该要求的岗位数量。
                        </Typography.Paragraph>
                        <Row gutter={[12, 12]} className={styles.statGrid}>
                          <Col span={12}>
                            <Statistic
                              title="覆盖岗位数"
                              value={activeNode?.profile_count || 0}
                              valueStyle={{ fontSize: 22 }}
                              className={styles.statValue}
                            />
                            <div className={styles.statHint}>有提到该节点的岗位招聘信息总数。</div>
                          </Col>
                          <Col span={12}>
                            <Statistic
                              title="明确要求数"
                              value={activeNode?.non_default_count || 0}
                              valueStyle={{ fontSize: 22 }}
                              className={styles.statValue}
                            />
                            <div className={styles.statHint}>明确写出该能力或门槛要求的岗位数。</div>
                          </Col>
                        </Row>
                      </div>

                      <div className={styles.panelSection}>
                        <Typography.Text className={styles.panelLabel}>
                          <InfoCircleOutlined />
                          覆盖度
                        </Typography.Text>
                        <Typography.Paragraph className={styles.helperText}>
                          覆盖度表示在全部已聚合岗位中，有多大比例明确提到了当前节点，数值越高，说明它越像一个普遍要求。
                        </Typography.Paragraph>
                        <Statistic
                          title="覆盖度"
                          value={((activeNode?.coverage_ratio || 0) * 100).toFixed(1)}
                          suffix="%"
                          valueStyle={{ fontSize: 24 }}
                          className={styles.statValue}
                        />
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Collapse
                ghost
                className={styles.guideCollapse}
                items={[{
                  key: 'guide',
                  label: (
                    <Space>
                      <InfoCircleOutlined />
                      <span>图谱阅读指南</span>
                    </Space>
                  ),
                  children: (
                    <div>
                      <div className={styles.guideItem}>
                        <div className={styles.guideItemTitle}>
                          <span className={styles.guideItemBadge}>1</span>
                          中心节点：岗位要求画像
                        </div>
                        <p className={styles.guideItemText}>
                          从中心节点出发，理解当前岗位市场最常见的能力结构。点击节点可查看详情。
                        </p>
                      </div>
                      <div className={styles.guideItem}>
                        <div className={styles.guideItemTitle}>
                          <span className={styles.guideItemBadge}>2</span>
                          能力分组：三大维度视角
                        </div>
                        <p className={styles.guideItemText}>
                          将岗位要求分为"专业与门槛""协作与适应""成长与职业素养"三个观察视角。
                        </p>
                      </div>
                      <div className={styles.guideItem}>
                        <div className={styles.guideItemTitle}>
                          <span className={styles.guideItemBadge}>3</span>
                          具体维度：{dimensionCount} 个能力点
                        </div>
                        <p className={styles.guideItemText}>
                          点击具体维度后，可查看招聘关键词、覆盖度和岗位关注点摘要。
                        </p>
                      </div>
                    </div>
                  ),
                }]}
              />
            </>
          ) : (
            <Empty description="暂无岗位要求画像图谱数据" />
          )}
        </Card>
      </div>
    </PageContainer>
  );
};

export default JobRequirementProfilePage;
