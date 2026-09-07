import dagre from '@dagrejs/dagre';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { FlowDiagramGraph, FlowDiagramNodeData } from './types';

const NODE_W = 240;
const NODE_H = 76;

function styleEdges(raw: FlowDiagramGraph['edges']): Edge[] {
  return raw.map((e) => {
    const stroke =
      (e.style && typeof e.style.stroke === 'string' && e.style.stroke) ||
      '#5c6b7a';
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: e.type || 'smoothstep',
      animated: e.animated,
      reconnectable: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: stroke,
      },
      style: {
        stroke: '#5c6b7a',
        strokeWidth: 1.5,
        ...(e.style || {}),
      },
      labelStyle: { fill: '#8b9aab', fontSize: 12 },
      labelBgStyle: { fill: '#0f1419', fillOpacity: 0.85 },
      labelBgPadding: [5, 3] as [number, number],
    };
  });
}

export function layoutGraph(
  graph: FlowDiagramGraph,
  highlightNodeId: string | null,
  activeModuleId: string | null,
): { nodes: Node<FlowDiagramNodeData>[]; edges: Edge[] } {
  const laneIds = graph.lanes?.length
    ? graph.lanes.map((l) => l.id)
    : [...new Set(graph.nodes.map((n) => n.data.lane || 'main'))];

  const positioned: Node<FlowDiagramNodeData>[] = [];
  let yOffset = 0;

  for (const laneId of laneIds) {
    const laneNodes = graph.nodes.filter(
      (n) => (n.data.lane || 'main') === laneId,
    );
    if (!laneNodes.length) continue;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: 'LR',
      nodesep: NODE_H * 1.5,
      ranksep: NODE_W * 0.85,
    });

    for (const n of laneNodes) {
      g.setNode(n.id, { width: NODE_W, height: NODE_H });
    }
    for (const e of graph.edges) {
      if (
        laneNodes.some((n) => n.id === e.source) &&
        laneNodes.some((n) => n.id === e.target)
      ) {
        g.setEdge(e.source, e.target);
      }
    }
    dagre.layout(g);

    let maxY = 0;
    for (const n of laneNodes) {
      const p = g.node(n.id);
      const x = (p?.x ?? 0) - NODE_W / 2;
      const y = (p?.y ?? 0) - NODE_H / 2 + yOffset;
      maxY = Math.max(maxY, y + NODE_H);
      const isCurrent = Boolean(
        highlightNodeId &&
          (n.id === highlightNodeId || n.data.realNodeId === highlightNodeId),
      );
      const isDim = Boolean(
        activeModuleId &&
          n.data.moduleId &&
          n.data.moduleId !== activeModuleId &&
          n.data.lane !== 'portals' &&
          n.data.lane !== 'conversation',
      );
      positioned.push({
        id: n.id,
        type: 'studio',
        position: { x, y },
        data: { ...n.data, isCurrent, isDim },
      });
    }
    yOffset = maxY + 80;
  }

  return { nodes: positioned, edges: styleEdges(graph.edges) };
}

/** MiniMap / legend colors — match Flow Studio node kinds. */
export function kindColor(kind: string | undefined): string {
  switch (kind) {
    case 'conversation-start':
    case 'start-prep':
      return '#14b8a6';
    case 'assistant-start':
    case 'greeting':
    case 'start':
      return '#2d6a4f';
    case 'assistant-end':
    case 'portal-exit':
      return '#78716c';
    case 'handoff-exit':
      return '#e9c46a';
    case 'portal':
      return '#7b2d3b';
    case 'portal-start':
      return '#9a3412';
    case 'terminal':
      return '#4a3f6b';
    case 'normal':
    default:
      return '#1d3557';
  }
}
