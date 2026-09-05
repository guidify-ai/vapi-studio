import { type ConditionContext, type FlowConditionTransition } from './condition';
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
    flow: {
        id: string;
        start: string;
    };
    nodes: Record<string, {
        class: string;
        intentions?: string[];
        portal?: boolean;
        priority?: number;
        terminal?: boolean;
    }>;
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
export declare const CONDITION_GOTO_PREFIX = "studio.goto.";
export declare function conditionGotoIntention(nodeId: string): string;
export declare function parseConditionGotoNodeId(intention: string): string | null;
export declare class FlowLoader {
    private flow;
    loadFromFile(path: string): FlowDefinition;
    loadFromObject(raw: RawFlowFile): FlowDefinition;
    getFlow(): FlowDefinition;
    nodesForIntention(intention: string): FlowNodeDefinition[];
    /** All intention names declared on portal nodes. */
    portalIntentionNames(): string[];
    /** All intention names on non-portal nodes. */
    normalIntentionNames(): string[];
    /**
     * Condition transitions whose `when` is true for this runtime snapshot.
     * Skips when current node is already `to`, or `from` does not include current.
     */
    matchingConditionTransitions(input: {
        currentNodeId: string | null | undefined;
        memory: Record<string, unknown>;
        variables: Record<string, unknown>;
    }, opts?: {
        force?: boolean;
    }): CompiledConditionTransition[];
}
//# sourceMappingURL=flow-loader.d.ts.map