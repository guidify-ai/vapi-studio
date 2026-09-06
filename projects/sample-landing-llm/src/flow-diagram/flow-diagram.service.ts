import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { FlowLoader, type FlowDefinition } from '@guidify-ai/vapi-studio';

export interface FlowDiagramEdgeDef {
  from: string;
  to: string;
  label: string;
}

/** React Flow / @xyflow graph — workflow = Squad, one lane per assistant. */
export interface FlowDiagramGraph {
  flowId: string;
  /** Workflow entry module id. */
  start: string;
  entryModuleId: string;
  library: '@xyflow/react';
  workflowId: string;
  assistants: Array<{
    moduleId: string;
    assistantName: string;
    description?: string;
    handoffTo: string[];
  }>;
  /** Layout lanes: one left→right row per assistant (+ portals below). */
  lanes: Array<{ id: string; label: string; moduleId?: string }>;
  nodes: Array<{
    id: string;
    type?: string;
    data: {
      label: string;
      className: string;
      intentions: string;
      kind: string;
      lane: string;
      moduleId?: string;
      assistantName?: string;
      /** Real module flow node id (un-namespaced). */
      realNodeId?: string;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: string;
    animated?: boolean;
    style?: Record<string, unknown>;
    lane?: string;
  }>;
}

interface EdgesFile {
  hide?: string[];
  edges?: FlowDiagramEdgeDef[];
}

interface RawWorkflowFile {
  workflow: { id: string; entryModule: string };
  modules: Record<
    string,
    {
      assistantName: string;
      kind?: string;
      flowFile?: string;
      entryNode?: string;
      handoffTo?: string[];
      description?: string;
    }
  >;
}

const isSynthetic = (id: string) =>
  id.includes('::__') || id.startsWith('__');

const SHARED_SKIP = new Set(['continue', 'goodbye']);

@Injectable()
export class FlowDiagramService {
  configDir(explicit?: string): string {
    return explicit ?? process.env.CONFIG_DIR ?? join(process.cwd(), 'config');
  }

  buildGraph(configDir?: string): FlowDiagramGraph {
    const dir = this.configDir(configDir);
    const wfPath = join(dir, 'workflow.yaml');
    let rawWf: RawWorkflowFile | null = null;
    try {
      rawWf = parseYaml(readFileSync(wfPath, 'utf8')) as RawWorkflowFile;
    } catch {
      rawWf = null;
    }

    if (!rawWf?.workflow?.id || !rawWf.modules) {
      return this.buildLegacySingleFlowGraph(dir);
    }

    return this.buildWorkflowAssistantsGraph(dir, rawWf);
  }

  /**
   * One horizontal (L→R) lane per workflow module (Vapi Squad member).
   * Each lane has __start → nodes → __end; handoffTo draws cross-lane edges.
   * Flow Studio stacks lanes vertically and draws portals on a row below.
   */
  private buildWorkflowAssistantsGraph(
    dir: string,
    rawWf: RawWorkflowFile,
  ): FlowDiagramGraph {
    const edgesFile = this.loadEdges(join(dir, 'workflow-diagram.edges.yaml'));
    const hide = new Set(edgesFile.hide ?? []);
    const moduleIds = Object.keys(rawWf.modules);

    const assistants = moduleIds.map((moduleId) => {
      const m = rawWf.modules[moduleId];
      return {
        moduleId,
        assistantName: m.assistantName,
        description: m.description,
        handoffTo: m.handoffTo ?? [],
      };
    });

    const lanes: FlowDiagramGraph['lanes'] = [
      { id: 'conversation', label: 'Conversation' },
      ...assistants.map((a) => ({
        id: `assistant:${a.moduleId}`,
        label: a.assistantName,
        moduleId: a.moduleId,
      })),
      { id: 'portals', label: 'Shared portals' },
    ];

    const nodes: FlowDiagramGraph['nodes'] = [];
    const edges: FlowDiagramGraph['edges'] = [];
    let edgeIndex = 0;

    const pushNode = (node: FlowDiagramGraph['nodes'][number]) => {
      nodes.push(node);
    };
    const pushEdge = (
      source: string,
      target: string,
      label: string,
      lane: string,
      style?: Record<string, unknown>,
    ) => {
      edges.push({
        id: `e${edgeIndex++}`,
        source,
        target,
        label,
        type: 'smoothstep',
        lane,
        ...(style ? { style, animated: true } : {}),
      });
    };

    const ns = (moduleId: string, nodeId: string) => `${moduleId}::${nodeId}`;
    const entryModuleId = rawWf.workflow.entryModule;
    const conversationStartId = '__conversation_start';

    // Dedicated pre-call entry — Studio centers here until Call starts.
    pushNode({
      id: conversationStartId,
      type: 'studio',
      data: {
        label: 'Conversation start',
        className: 'Call',
        intentions: 'studio Call · entry phrase',
        kind: 'conversation-start',
        lane: 'conversation',
        realNodeId: conversationStartId,
      },
    });

    for (const moduleId of moduleIds) {
      const mod = rawWf.modules[moduleId];
      if (!mod.flowFile) continue;
      const flow = this.loadFlowDefinition(join(dir, mod.flowFile));
      const lane = `assistant:${moduleId}`;
      const startId = ns(moduleId, '__start');
      const endId = ns(moduleId, '__end');
      const handoffs = mod.handoffTo ?? [];
      const endLabel =
        handoffs.length > 0
          ? `exit · handoff → ${handoffs.join(', ')}`
          : 'exit · endCall';

      pushNode({
        id: startId,
        type: 'studio',
        data: {
          label: `${mod.assistantName}`,
          className: 'assistant start',
          intentions: 'module entry',
          kind: 'assistant-start',
          lane,
          moduleId,
          assistantName: mod.assistantName,
        },
      });

      for (const node of Object.values(flow.nodes)) {
        if (hide.has(node.id)) continue;
        if (SHARED_SKIP.has(node.id)) continue;
        if (node.portal) {
          continue;
        }

        const isFlowStart = node.id === flow.start;
        const isHandoffExit =
          /Done$/i.test(node.class) ||
          node.id.endsWith('Done') ||
          node.id === 'appointmentDone' ||
          node.id === 'instantDone';
        const kind =
          node.terminal || node.id === 'farewell'
            ? 'terminal'
            : isHandoffExit
              ? 'handoff-exit'
              : isFlowStart
                ? 'start'
                : 'normal';

        pushNode({
          id: ns(moduleId, node.id),
          type: 'studio',
          data: {
            label: node.id,
            className: node.class,
            intentions: node.intentions.join(', '),
            kind,
            lane,
            moduleId,
            assistantName: mod.assistantName,
            realNodeId: node.id,
          },
        });
      }

      pushNode({
        id: endId,
        type: 'studio',
        data: {
          label: endLabel,
          className: handoffs.length ? 'handoff' : 'endCall',
          intentions: handoffs.length ? 'output.handoff' : 'output.endCall',
          kind: 'assistant-end',
          lane,
          moduleId,
          assistantName: mod.assistantName,
        },
      });
    }

    if (moduleIds.length > 0) {
      const entryFlow = this.loadFlowDefinition(
        join(dir, rawWf.modules[moduleIds[0]].flowFile!),
      );
      this.appendPortalLane(entryFlow, hide, nodes, edges, () => `e${edgeIndex++}`);
    }

    // Intra-assistant edges from workflow-diagram.edges.yaml
    for (const edge of edgesFile.edges ?? []) {
      if (hide.has(edge.from) || hide.has(edge.to)) continue;
      if (!nodes.some((n) => n.id === edge.from)) continue;
      if (!nodes.some((n) => n.id === edge.to)) continue;
      const fromMod = edge.from.split('::')[0];
      const lane = `assistant:${fromMod}`;
      pushEdge(edge.from, edge.to, edge.label, lane);
    }

    // Cross-assistant handoff edges (workflow policy)
    for (const a of assistants) {
      const fromEnd = ns(a.moduleId, '__end');
      for (const toId of a.handoffTo) {
        const toStart = ns(toId, '__start');
        if (!nodes.some((n) => n.id === fromEnd)) continue;
        if (!nodes.some((n) => n.id === toStart)) continue;
        edges.push({
          id: `e${edgeIndex++}`,
          source: fromEnd,
          target: toStart,
          label: `handoff → ${toId}`,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: '#e9c46a',
            strokeDasharray: '8 4',
            strokeWidth: 2,
          },
        });
      }
    }

    // Call → entry assistant (visual only; Studio Call starts the Conversation)
    const entryStartId = ns(entryModuleId, '__start');
    if (nodes.some((n) => n.id === entryStartId)) {
      edges.push({
        id: `e${edgeIndex++}`,
        source: conversationStartId,
        target: entryStartId,
        label: 'Call',
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#2dd4bf',
          strokeWidth: 2.5,
        },
      });
    }

    return {
      flowId: rawWf.workflow.id,
      start: entryModuleId,
      entryModuleId,
      library: '@xyflow/react',
      workflowId: rawWf.workflow.id,
      assistants,
      lanes,
      nodes,
      edges,
    };
  }

  /** Default PoC path — one assistant, one flow.yaml (no Squad). */
  private buildLegacySingleFlowGraph(dir: string): FlowDiagramGraph {
    const flow = this.loadFlowDefinition(join(dir, 'flow.yaml'));
    const edgesFile = this.loadEdges(join(dir, 'flow-diagram.edges.yaml'));
    const hide = new Set(edgesFile.hide ?? []);
    const nodes: FlowDiagramGraph['nodes'] = [];
    const edges: FlowDiagramGraph['edges'] = [];
    let edgeIndex = 0;
    for (const node of Object.values(flow.nodes)) {
      if (hide.has(node.id) || node.portal || SHARED_SKIP.has(node.id)) continue;
      nodes.push({
        id: node.id,
        type: 'studio',
        data: {
          label: node.id,
          className: node.class,
          intentions: node.intentions.join(', '),
          kind: node.id === flow.start ? 'start' : node.terminal ? 'terminal' : 'normal',
          lane: 'main',
          realNodeId: node.id,
        },
      });
    }
    for (const edge of edgesFile.edges ?? []) {
      if (!nodes.some((n) => n.id === edge.from) || !nodes.some((n) => n.id === edge.to)) {
        continue;
      }
      edges.push({
        id: `e${edgeIndex++}`,
        source: edge.from,
        target: edge.to,
        label: edge.label,
        type: 'smoothstep',
        lane: 'main',
      });
    }
    // Declarative condition transitions from flow.yaml (force = animated).
    for (const t of flow.transitions ?? []) {
      const fromIds =
        t.from && t.from.length > 0
          ? t.from
          : Object.values(flow.nodes)
              .filter((n) => n.id !== t.to && !n.portal && !SHARED_SKIP.has(n.id))
              .map((n) => n.id);
      for (const from of fromIds) {
        if (
          !nodes.some((n) => n.id === from) ||
          !nodes.some((n) => n.id === t.to)
        ) {
          continue;
        }
        edges.push({
          id: `e${edgeIndex++}`,
          source: from,
          target: t.to,
          label: t.force
            ? `force:${t.reason ?? t.id}`
            : `when:${t.reason ?? t.id}`,
          type: 'smoothstep',
          animated: Boolean(t.force),
          lane: 'main',
        });
      }
    }
    this.appendLegacyBookends(flow, nodes, edges, () => `e${edgeIndex++}`);
    this.appendPortalLane(flow, hide, nodes, edges, () => `e${edgeIndex++}`);
    return {
      flowId: flow.id,
      start: flow.start,
      entryModuleId: flow.start,
      library: '@xyflow/react',
      workflowId: flow.id,
      assistants: [],
      lanes: [
        { id: 'main', label: 'Main flow' },
        { id: 'portals', label: 'Shared portals' },
      ],
      nodes,
      edges,
    };
  }

  /**
   * Single-flow PoC bookends:
   * Start (inject / near-zero prep) → Greeting (flow.start) → …
   * Studio Call / channel bootstrap is Start — not a separate Conversation-start hop.
   */
  private appendLegacyBookends(
    flow: FlowDefinition,
    nodes: FlowDiagramGraph['nodes'],
    edges: FlowDiagramGraph['edges'],
    nextEdgeId: () => string,
  ): void {
    const startPrepId = '__start';
    const assistantEndId = '__end';

    // Relabel the real flow.start as Greeting (first speak) — id stays for runtime.
    const greeting = nodes.find((n) => n.id === flow.start);
    if (greeting) {
      greeting.data.label = 'Greeting';
      greeting.data.kind = 'greeting';
      greeting.data.intentions = [
        greeting.data.intentions,
        'first speak · flow.start',
      ]
        .filter(Boolean)
        .join(' · ');
    }

    nodes.unshift({
      id: startPrepId,
      type: 'studio',
      data: {
        label: 'Start',
        className: 'start prep',
        intentions:
          'Call / bootstrap · inject metadata (company / email / name / phone) · near-zero prep · ConversationEntry',
        kind: 'start-prep',
        lane: 'main',
        realNodeId: startPrepId,
      },
    });

    nodes.push({
      id: assistantEndId,
      type: 'studio',
      data: {
        label: 'exit · endCall',
        className: 'endCall',
        intentions: 'output.endCall',
        kind: 'assistant-end',
        lane: 'main',
      },
    });

    const has = (id: string) => nodes.some((n) => n.id === id);

    if (has(flow.start)) {
      edges.unshift({
        id: nextEdgeId(),
        source: startPrepId,
        target: flow.start,
        label: 'open',
        type: 'smoothstep',
        animated: true,
        lane: 'main',
        style: {
          stroke: '#2dd4bf',
          strokeWidth: 2.5,
        },
      });
    }

    if (has('farewell')) {
      edges.push({
        id: nextEdgeId(),
        source: 'farewell',
        target: assistantEndId,
        label: 'endCall',
        type: 'smoothstep',
        lane: 'main',
      });
    } else if (has('goodbye')) {
      edges.push({
        id: nextEdgeId(),
        source: 'goodbye',
        target: assistantEndId,
        label: 'endCall',
        type: 'smoothstep',
        lane: 'main',
      });
    }
  }

  /**
   * Global portal nodes (pause, transfer, …) live in a dedicated lane — they are
   * not part of the main happy-path DAG but are reachable from any listen.
   */
  private appendPortalLane(
    flow: FlowDefinition,
    hide: Set<string>,
    nodes: FlowDiagramGraph['nodes'],
    edges: FlowDiagramGraph['edges'],
    nextEdgeId: () => string,
  ): void {
    const portalLane = 'portals';
    for (const node of Object.values(flow.nodes)) {
      if (hide.has(node.id) || !node.portal || SHARED_SKIP.has(node.id)) {
        continue;
      }
      const enterId = `__enter_${node.id}`;
      const exitId = `__exit_${node.id}`;
      const portalId = `portal::${node.id}`;
      if (nodes.some((n) => n.id === portalId)) continue;

      nodes.push(
        {
          id: enterId,
          type: 'studio',
          data: {
            label: 'any listen',
            className: node.intentions[0] ?? node.id,
            intentions: node.intentions.join(', '),
            kind: 'portal-start',
            lane: portalLane,
          },
        },
        {
          id: portalId,
          type: 'studio',
          data: {
            label: node.id,
            className: node.class,
            intentions: node.intentions.join(', '),
            kind: 'portal',
            lane: portalLane,
            realNodeId: node.id,
          },
        },
        {
          id: exitId,
          type: 'studio',
          data: {
            label: 'exit / resume',
            className: '(back to origin)',
            intentions: 'isContinue',
            kind: 'portal-exit',
            lane: portalLane,
          },
        },
      );
      edges.push(
        {
          id: nextEdgeId(),
          source: enterId,
          target: portalId,
          label: node.intentions[0] ?? '',
          type: 'smoothstep',
          lane: portalLane,
          animated: true,
          style: {
            strokeDasharray: '6 4',
            stroke: '#c1121f',
          },
        },
        {
          id: nextEdgeId(),
          source: portalId,
          target: exitId,
          label: 'isContinue',
          type: 'smoothstep',
          lane: portalLane,
        },
      );
    }
  }

  saveEdges(
    edges: Array<{ source: string; target: string; label?: string }>,
  ): { ok: true; count: number } {
    const path = join(this.configDir(), 'workflow-diagram.edges.yaml');
    const current = this.loadEdges(path);
    const next: FlowDiagramEdgeDef[] = edges
      .filter((e) => !isSynthetic(e.source) && !isSynthetic(e.target))
      // Keep handoff cross-lane edges out of the editable file (owned by workflow.yaml).
      .filter((e) => {
        const fromMod = e.source.split('::')[0];
        const toMod = e.target.split('::')[0];
        return fromMod === toMod;
      })
      .map((e) => ({
        from: e.source,
        to: e.target,
        label: e.label?.trim() || '(intention)',
      }));

    const seen = new Set<string>();
    const deduped = next.filter((e) => {
      const key = `${e.from}->${e.to}:${e.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    writeFileSync(
      path,
      stringifyYaml({ hide: current.hide ?? [], edges: deduped }),
      'utf8',
    );
    return { ok: true, count: deduped.length };
  }

  private loadEdges(path: string): EdgesFile {
    try {
      return parseYaml(readFileSync(path, 'utf8')) as EdgesFile;
    } catch {
      return { hide: [], edges: [] };
    }
  }

  private loadFlowDefinition(path: string): FlowDefinition {
    return new FlowLoader().loadFromFile(path);
  }
}
