import type { ListenExpectation, SayAndListenOptions } from '../conversation/listen-expectation';
import type { IntentionCandidate } from '../conversation/types';
import type { NodeResult } from '../output/conversation-output';
export type RouteRejectReason = 'before_false' | 'missing' | 'still_there_requires_force';
export interface RouteRejectRow {
    nodeId: string;
    class: string;
    intention: string;
    reason: RouteRejectReason;
    confidence?: number;
    priority?: number;
}
export interface RouteWinnerRow {
    nodeId: string;
    class: string;
    intention: string;
    confidence: number;
    priority: number;
    portal: boolean;
}
export declare function truncateForLog(text: string | undefined, max?: number): string | undefined;
export declare function listenForensics(listen: ListenExpectation | SayAndListenOptions | null | undefined): Record<string, unknown> | null;
export declare function walkForensics(ranked: IntentionCandidate[]): Array<{
    name: string;
    confidence: number;
    priority: number;
    listenBoost?: number;
    reason?: string;
}>;
export declare function nodeResultForensics(result: NodeResult): Record<string, unknown>;
export declare function actionForensics(actions: Array<{
    kind: string;
    text?: string;
    continueToNodeId?: string;
    handoffReason?: string;
    handoffTo?: string;
}>): Array<Record<string, unknown>>;
//# sourceMappingURL=route-forensics.d.ts.map