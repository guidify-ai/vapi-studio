import { readFileSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_INTENTION_PRIORITY } from '../conversation/conversation-history';
import {
  compileCondition,
  type ConditionContext,
  type FlowConditionTransition,
} from './condition';

export interface FlowNodeDefinition {
  id: string;
  class: string;
  intentions: string[];
  portal?: boolean;
  priority?: number;
  terminal?: boolean;
}

export interface CompiledConditionTransition extends FlowConditionTransition {
  /** Compiled `when` predicate (throws at load if `when` is invalid). */
  test: (ctx: ConditionContext) => boolean;
}

export interface FlowDefinition {
  version: number;
  id: string;
  start: string;
  nodes: Record<string, FlowNodeDefinition>;
  /** Declarative memory/variable gates — evaluated before listen/Brain when force. */
  transitions: CompiledConditionTransition[];
}

export interface RawFlowFile {
  version: number;
  flow: { id: string; start: string };
  nodes: Record<
    string,
    {
      class: string;
      intentions?: string[];
      portal?: boolean;
      priority?: number;
      terminal?: boolean;
    }
  >;
  transitions?: Array<{
    id?: string;
    from?: string | string[];
    to: string;
    when: string;
    force?: boolean;
    priority?: number;
    reason?: string;
  }>;
}

/** Synthetic intention → execute a node by id (condition transitions / goto). */
export const CONDITION_GOTO_PREFIX = 'studio.goto.';

export function conditionGotoIntention(nodeId: string): string {
  return `${CONDITION_GOTO_PREFIX}${nodeId}`;
}

export function parseConditionGotoNodeId(intention: string): string | null {
  if (!intention.startsWith(CONDITION_GOTO_PREFIX)) return null;
  const id = intention.slice(CONDITION_GOTO_PREFIX.length);
  return id.length > 0 ? id : null;
}

@Injectable()
export class FlowLoader {
  private flow: FlowDefinition | null = null;

  public loadFromFile(path: string): FlowDefinition {
    const raw = parseYaml(readFileSync(path, 'utf8')) as RawFlowFile;
    return this.loadFromObject(raw);
  }

  public loadFromObject(raw: RawFlowFile): FlowDefinition {
    if (!raw?.flow?.id || !raw?.flow?.start || !raw?.nodes) {
      throw new Error('Invalid flow schema object');
    }
    const nodes: Record<string, FlowNodeDefinition> = {};
    for (const [id, def] of Object.entries(raw.nodes)) {
      nodes[id] = {
        id,
        class: def.class,
        intentions: def.intentions ?? [],
        portal: def.portal,
        priority: def.priority,
        terminal: def.terminal,
      };
    }
    if (!nodes[raw.flow.start]) {
      throw new Error(`Flow start node "${raw.flow.start}" missing`);
    }

    const transitions: CompiledConditionTransition[] = [];
    for (const [index, rawT] of (raw.transitions ?? []).entries()) {
      const id = (rawT.id ?? `transition_${index}`).trim();
      const to = String(rawT.to ?? '').trim();
      if (!to || !nodes[to]) {
        throw new Error(
          `Flow transition "${id}" targets unknown node "${to}"`,
        );
      }
      const when = String(rawT.when ?? '').trim();
      if (!when) {
        throw new Error(`Flow transition "${id}" is missing when`);
      }
      let test: (ctx: ConditionContext) => boolean;
      try {
        test = compileCondition(when);
      } catch (error) {
        throw new Error(
          `Flow transition "${id}" has invalid when "${when}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      const fromList = rawT.from
        ? (Array.isArray(rawT.from) ? rawT.from : [rawT.from]).map((s) =>
            String(s).trim(),
          )
        : undefined;
      if (fromList) {
        for (const fromId of fromList) {
          if (!nodes[fromId]) {
            throw new Error(
              `Flow transition "${id}" from unknown node "${fromId}"`,
            );
          }
        }
      }
      transitions.push({
        id,
        from: fromList,
        to,
        when,
        force: rawT.force === true,
        priority: rawT.priority,
        reason: rawT.reason,
        test,
      });
    }

    this.flow = {
      version: raw.version ?? 1,
      id: raw.flow.id,
      start: raw.flow.start,
      nodes,
      transitions,
    };
    return this.flow;
  }

  public getFlow(): FlowDefinition {
    if (!this.flow) {
      throw new Error('Flow not loaded');
    }
    return this.flow;
  }

  public nodesForIntention(intention: string): FlowNodeDefinition[] {
    const flow = this.getFlow();
    const gotoId = parseConditionGotoNodeId(intention);
    if (gotoId) {
      const node = flow.nodes[gotoId];
      return node ? [node] : [];
    }
    const matches = Object.values(flow.nodes).filter((n) =>
      n.intentions.includes(intention),
    );
    return matches.sort((a, b) => {
      const pa = a.priority ?? DEFAULT_INTENTION_PRIORITY;
      const pb = b.priority ?? DEFAULT_INTENTION_PRIORITY;
      if (pb !== pa) return pb - pa;
      return a.id.localeCompare(b.id);
    });
  }

  /** All intention names declared on portal nodes. */
  public portalIntentionNames(): string[] {
    const flow = this.getFlow();
    const names = new Set<string>();
    for (const node of Object.values(flow.nodes)) {
      if (!node.portal) continue;
      for (const name of node.intentions) {
        names.add(name);
      }
    }
    return [...names];
  }

  /** All intention names on non-portal nodes. */
  public normalIntentionNames(): string[] {
    const flow = this.getFlow();
    const names = new Set<string>();
    for (const node of Object.values(flow.nodes)) {
      if (node.portal) continue;
      for (const name of node.intentions) {
        names.add(name);
      }
    }
    return [...names];
  }

  /**
   * Condition transitions whose `when` is true for this runtime snapshot.
   * Skips when current node is already `to`, or `from` does not include current.
   */
  public matchingConditionTransitions(
    input: {
      currentNodeId: string | null | undefined;
      memory: Record<string, unknown>;
      variables: Record<string, unknown>;
    },
    opts?: { force?: boolean },
  ): CompiledConditionTransition[] {
    const flow = this.getFlow();
    const current = input.currentNodeId ?? null;
    const ctx: ConditionContext = {
      memory: input.memory,
      variables: input.variables,
    };
    const out: CompiledConditionTransition[] = [];
    for (const t of flow.transitions) {
      if (opts?.force === true && t.force !== true) continue;
      if (opts?.force === false && t.force === true) continue;
      if (current === t.to) continue;
      if (t.from && t.from.length > 0) {
        if (!current || !t.from.includes(current)) continue;
      }
      if (!t.test(ctx)) continue;
      out.push(t);
    }
    return out;
  }
}
