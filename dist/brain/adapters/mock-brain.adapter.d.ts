import type { BrainAdapter, BrainScanInput, BrainScanResult } from '../brain.port';
import { type BrainClarifyRequest, type BrainClarifyResult } from '../brain-clarify';
import { type BrainJudgeRequest, type BrainJudgeResult } from '../brain-judge';
/**
 * Deterministic Brain adapter for PoC / tests.
 * No network, no ChatGPT — sequence-driven intentions + listen boosts/hints + mock extract.
 */
export declare class MockBrainAdapter implements BrainAdapter {
    private profiles;
    private activeProfileId;
    loadProfile(profileId: string, path: string): void;
    setSequence(profileId: string, sequence: string[]): void;
    setActiveProfile(profileId: string): void;
    getActiveProfileId(): string;
    scan(input: BrainScanInput): Promise<BrainScanResult>;
    /**
     * Deterministic clarify for tests — fills required string fields from input text.
     * Empty / reserved marker input → studio.clarify.cannotAnswer.
     */
    clarify<TAnswer extends Record<string, unknown> = Record<string, unknown>>(request: BrainClarifyRequest): Promise<BrainClarifyResult<TAnswer>>;
    /**
     * Deterministic judge for tests — no network.
     * Markers in context: `studio.judge.pass` / `studio.judge.fail`.
     * Otherwise: any matching failureCondition → fail; all successConditions
     * present (or none given) → pass.
     */
    judge<TContext = unknown>(request: BrainJudgeRequest<TContext>): Promise<BrainJudgeResult>;
}
/** @deprecated Prefer MockBrainAdapter — kept for existing imports. */
export declare class MockBrainService extends MockBrainAdapter {
}
//# sourceMappingURL=mock-brain.adapter.d.ts.map