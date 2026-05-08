import { Graph } from '@antv/g6';
import { Spin, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useRef, useState } from 'react';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';
import type { GraphCanvasData, GraphCanvasNode } from '../hooks/useGraphData';

type RenderDatum = {
  data?: any;
};

type HoverState = {
  x: number;
  y: number;
  node: API.JobRequirementGraphNode;
};

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
  pushpin: 'O',
};

const useStyles = createStyles(({ css }) => ({
  shell: css`
    position: relative;
    min-height: 720px;
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.md}px;
    background: ${claudeColors.parchment};
    overflow: hidden;
  `,
  canvas: css`
    min-height: 720px;
  `,
  loading: css`
    min-height: 720px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  tooltip: css`
    position: absolute;
    z-index: 5;
    width: 260px;
    padding: 14px;
    border: 1px solid ${claudeColors.borderCream};
    border-radius: ${claudeRadius.md}px;
    background: ${claudeColors.ivory};
    box-shadow: 0 16px 36px ${claudeAlpha(claudeColors.nearBlack, 0.12)};
    pointer-events: none;
  `,
  tooltipTitle: css`
    margin: 0 0 6px;
    font-family: ${claudeFonts.heading};
    color: ${claudeColors.nearBlack};
  `,
  tooltipText: css`
    margin: 0;
    color: ${claudeColors.oliveGray};
    font-size: 12px;
    line-height: 1.7;
  `,
}));

const getNodeData = (datum: RenderDatum) => datum.data as GraphCanvasNode['data'];

const getNodeFill = (node: GraphCanvasNode['data']) => {
  if (node.depth === 0) return claudeColors.terracotta;
  if (node.depth === 1) return claudeColors.warmSand;
  return claudeColors.ivory;
};

const getNodeStroke = (node: GraphCanvasNode['data']) => {
  if (node.selected) return claudeColors.terracotta;
  if (node.depth === 0) return claudeColors.primaryActive;
  if (node.depth === 1) return claudeColors.ringDeep;
  return claudeColors.borderCream;
};

const getNodeSize = (node: GraphCanvasNode['data']) => {
  const base = node.depth === 0 ? 126 : node.depth === 1 ? 86 : 58;
  return node.selected ? base + 10 : base;
};

export interface GraphCanvasProps {
  graphData?: GraphCanvasData;
  loading?: boolean;
  onSelectNode: (nodeId: string) => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  loading,
  onSelectNode,
}) => {
  const { styles } = useStyles();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const [hovered, setHovered] = useState<HoverState>();

  useEffect(() => {
    if (!containerRef.current || !graphData || loading) return undefined;

    const container = containerRef.current;
    const width = container.clientWidth || 1180;
    const height = 720;
    const data = graphData;

    if (graphRef.current) {
      graphRef.current.setData(data);
      void graphRef.current.draw();
      return undefined;
    }

    container.innerHTML = '';
    const graph = new Graph({
      container,
      width,
      height,
      autoFit: 'view',
      data,
      animation: true,
      behaviors: [
        { type: 'drag-canvas' },
        { type: 'zoom-canvas', sensitivity: 0.35 },
        {
          type: 'hover-activate',
          degree: 0,
          state: 'active',
          animation: false,
        },
      ],
      node: {
        type: 'circle',
        style: {
          size: (datum: RenderDatum) => getNodeSize(getNodeData(datum)),
          fill: (datum: RenderDatum) => getNodeFill(getNodeData(datum)),
          fillOpacity: (datum: RenderDatum) =>
            getNodeData(datum).dimmed ? 0.28 : 1,
          stroke: (datum: RenderDatum) => getNodeStroke(getNodeData(datum)),
          lineWidth: (datum: RenderDatum) =>
            getNodeData(datum).selected ? 5 : getNodeData(datum).depth === 2 ? 2 : 3,
          shadowColor: claudeAlpha(claudeColors.terracotta, 0.22),
          shadowBlur: (datum: RenderDatum) =>
            getNodeData(datum).selected ? 28 : getNodeData(datum).related ? 12 : 0,
          iconText: (datum: RenderDatum) =>
            ICON_TEXT_MAP[getNodeData(datum).icon] || 'N',
          iconFill: (datum: RenderDatum) =>
            getNodeData(datum).depth === 0
              ? claudeColors.ivory
              : claudeColors.nearBlack,
          iconFontSize: (datum: RenderDatum) =>
            getNodeData(datum).depth === 0 ? 30 : getNodeData(datum).depth === 1 ? 18 : 14,
          labelText: (datum: RenderDatum) => getNodeData(datum).title,
          labelPlacement: (datum: RenderDatum) => getNodeData(datum).labelPlacement,
          labelMaxWidth: (datum: RenderDatum) => getNodeData(datum).labelMaxWidth,
          labelWordWrap: true,
          labelWordWrapWidth: (datum: RenderDatum) =>
            getNodeData(datum).labelMaxWidth,
          labelOffsetX: (datum: RenderDatum) => {
            const node = getNodeData(datum);
            if (node.labelPlacement === 'left') return -node.labelOffset;
            if (node.labelPlacement === 'right') return node.labelOffset;
            return 0;
          },
          labelOffsetY: (datum: RenderDatum) => {
            const node = getNodeData(datum);
            if (node.labelPlacement === 'top') return -node.labelOffset;
            if (node.labelPlacement === 'bottom') return node.labelOffset;
            return 0;
          },
          labelBackground: true,
          labelBackgroundFill: claudeAlpha(claudeColors.ivory, 0.94),
          labelBackgroundRadius: claudeRadius.sm,
          labelPadding: [6, 10],
          labelFill: claudeColors.nearBlack,
          labelFontFamily: claudeFonts.body,
          labelFontSize: (datum: RenderDatum) =>
            getNodeData(datum).depth === 0 ? 18 : getNodeData(datum).depth === 1 ? 15 : 13,
          labelFontWeight: 600,
        },
        state: {
          active: {
            halo: true,
            haloLineWidth: 12,
            haloStroke: claudeColors.terracotta,
            haloStrokeOpacity: 0.18,
            shadowBlur: 22,
            shadowColor: claudeAlpha(claudeColors.terracotta, 0.28),
          },
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: (datum: any) =>
            datum.data.active ? claudeColors.terracotta : claudeColors.stoneGray,
          strokeOpacity: (datum: any) => (datum.data.active ? 0.9 : 0.28),
          lineWidth: (datum: any) => (datum.data.active ? 2.4 : 1.2),
          endArrow: true,
          endArrowFill: (datum: any) =>
            datum.data.active ? claudeColors.terracotta : claudeColors.stoneGray,
        },
        state: {
          active: {
            stroke: claudeColors.terracotta,
            lineWidth: 3,
          },
        },
      },
    });

    graph.on('node:click', (event: any) => {
      const nodeId = event?.target?.id as string | undefined;
      if (nodeId) onSelectNode(nodeId);
    });
    graph.on('node:pointerenter', (event: any) => {
      const nodeId = event?.target?.id as string | undefined;
      const node = data.nodes.find((item) => item.id === nodeId)?.data;
      if (!node) return;
      setHovered({
        x: Math.min((event?.canvas?.x || 24) + 18, width - 280),
        y: Math.max((event?.canvas?.y || 24) - 24, 16),
        node,
      });
    });
    graph.on('node:pointerleave', () => setHovered(undefined));

    void graph.render();
    graphRef.current = graph;

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [graphData, loading, onSelectNode]);

  if (loading) {
    return (
      <div className={styles.shell}>
        <div className={styles.loading}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell} data-testid="graph-canvas">
      <div ref={containerRef} className={styles.canvas} />
      {hovered ? (
        <div
          className={styles.tooltip}
          style={{ left: hovered.x, top: hovered.y }}
          role="tooltip"
        >
          <Typography.Title level={5} className={styles.tooltipTitle}>
            {hovered.node.title}
          </Typography.Title>
          <p className={styles.tooltipText}>{hovered.node.description}</p>
        </div>
      ) : null}
    </div>
  );
};
