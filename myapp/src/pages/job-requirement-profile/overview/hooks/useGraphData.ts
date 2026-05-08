import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJobRequirementProfileGraph } from '@/services/ant-design-pro/api';

type NodeDepth = 0 | 1 | 2;
type LabelPlacement = 'top' | 'bottom' | 'left' | 'right';

export type GraphCanvasNode = {
  id: string;
  data: API.JobRequirementGraphNode & {
    depth: NodeDepth;
    selected: boolean;
    related: boolean;
    dimmed: boolean;
    labelPlacement: LabelPlacement;
    labelOffset: number;
    labelMaxWidth: number;
  };
  style: {
    x: number;
    y: number;
  };
};

export type GraphCanvasEdge = {
  id: string;
  source: string;
  target: string;
  data: API.JobRequirementGraphEdge & {
    active: boolean;
  };
};

export type GraphCanvasData = {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
};

const GROUP_ANGLES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];

const getRelatedIds = (nodeId: string, edges: API.JobRequirementGraphEdge[]) => {
  const ids = new Set<string>([nodeId]);
  let changed = true;

  while (changed) {
    changed = false;
    edges.forEach((edge) => {
      if (ids.has(edge.source) && !ids.has(edge.target)) {
        ids.add(edge.target);
        changed = true;
      }
      if (ids.has(edge.target) && !ids.has(edge.source)) {
        ids.add(edge.source);
        changed = true;
      }
    });
  }

  return ids;
};

const getLabelPlacement = (
  x: number,
  y: number,
  centerX: number,
  centerY: number,
): LabelPlacement => {
  const dx = x - centerX;
  const dy = y - centerY;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
};

export const buildGraphData = (
  payload: API.JobRequirementGraphPayload,
  selectedNodeId?: string,
  width = 1180,
  height = 720,
): GraphCanvasData => {
  const centerX = width / 2;
  const centerY = height * 0.52;
  const selectedRelatedIds = selectedNodeId
    ? getRelatedIds(selectedNodeId, payload.edges)
    : new Set<string>();
  const root = payload.nodes.find((node) => node.type === 'ProfileRoot');
  const groups = payload.nodes.filter((node) => node.type === 'DimensionGroup');
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));
  const dimensionBuckets = new Map<string, API.JobRequirementGraphNode[]>();

  payload.edges
    .filter((edge) => edge.type === 'HAS_DIMENSION')
    .forEach((edge) => {
      const dimension = payload.nodes.find((node) => node.id === edge.target);
      if (!dimension) return;
      const bucket = dimensionBuckets.get(edge.source) || [];
      bucket.push(dimension);
      dimensionBuckets.set(edge.source, bucket);
    });

  const buildNode = (
    node: API.JobRequirementGraphNode,
    x: number,
    y: number,
    depth: NodeDepth,
  ): GraphCanvasNode => {
    const related = !selectedNodeId || selectedRelatedIds.has(node.id);
    return {
      id: node.id,
      data: {
        ...node,
        depth,
        selected: node.id === selectedNodeId,
        related,
        dimmed: Boolean(selectedNodeId && !related),
        labelPlacement:
          depth === 2 ? getLabelPlacement(x, y, centerX, centerY) : 'bottom',
        labelOffset: depth === 0 ? 18 : depth === 1 ? 14 : 12,
        labelMaxWidth: depth === 0 ? 164 : depth === 1 ? 152 : 124,
      },
      style: { x, y },
    };
  };

  const nodes: GraphCanvasNode[] = [];
  if (root) nodes.push(buildNode(root, centerX, centerY, 0));

  groups.forEach((group, index) => {
    const angle = GROUP_ANGLES[index] ?? GROUP_ANGLES[0];
    const groupRadius = Math.min(width, height) * 0.24;
    const groupX = centerX + Math.cos(angle) * groupRadius;
    const groupY = centerY + Math.sin(angle) * groupRadius;
    nodes.push(buildNode(group, groupX, groupY, 1));

    const dimensions = dimensionBuckets.get(group.id) || [];
    const spread = dimensions.length > 1 ? (2 * Math.PI) / 3 : 0;
    const startAngle = angle - spread / 2;

    dimensions.forEach((dimension, dimensionIndex) => {
      const childAngle =
        dimensions.length > 1
          ? startAngle + (spread / (dimensions.length - 1)) * dimensionIndex
          : angle;
      const childRadius = Math.min(width, height) * 0.4;
      nodes.push(
        buildNode(
          dimension,
          centerX + Math.cos(childAngle) * childRadius,
          centerY + Math.sin(childAngle) * childRadius,
          2,
        ),
      );
    });
  });

  nodes.sort((left, right) => {
    const depthDiff = left.data.depth - right.data.depth;
    if (depthDiff !== 0) return depthDiff;
    if (left.data.depth === 1) {
      return (groupOrder.get(left.id) || 0) - (groupOrder.get(right.id) || 0);
    }
    return left.data.title.localeCompare(right.data.title);
  });

  return {
    nodes,
    edges: payload.edges.map((edge) => {
      const active =
        !selectedNodeId ||
        (selectedRelatedIds.has(edge.source) && selectedRelatedIds.has(edge.target));
      return {
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        data: { ...edge, active },
      };
    }),
  };
};

export const useGraphData = () => {
  const [payload, setPayload] = useState<API.JobRequirementGraphPayload>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(undefined);

    void getJobRequirementProfileGraph({ skipErrorHandler: true })
      .then((response) => {
        if (!mounted) return;
        setPayload(response.data);
        const root =
          response.data.nodes.find((node) => node.type === 'ProfileRoot') ||
          response.data.nodes[0];
        setSelectedNodeId(root?.id);
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

  const selectedNode = useMemo(
    () => payload?.nodes.find((node) => node.id === selectedNodeId),
    [payload, selectedNodeId],
  );

  const graphData = useMemo(
    () => (payload ? buildGraphData(payload, selectedNodeId) : undefined),
    [payload, selectedNodeId],
  );

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  return {
    graphData,
    loading,
    error,
    payload,
    selectedNode,
    selectNode,
  };
};
