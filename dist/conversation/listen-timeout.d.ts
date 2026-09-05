/**
 * How long the channel waits after a user pause before closing a listen.
 *
 * Vapi's default `onPunctuationSeconds` is 0.1 — a transcribed "K." ends the
 * turn before "as soon as possible" lands. Vapi Studio's default is long enough to
 * catch trailing speech; Nodes override via `listenTimeoutSeconds`.
 */
/** Default listen window in seconds (Node class + channel hold). */
export declare const DEFAULT_LISTEN_TIMEOUT_SECONDS = 2.5;
/** Shortest listen window (Vapi waitSeconds floor is 0.4). */
export declare const MIN_LISTEN_TIMEOUT_SECONDS = 0.4;
/** Longest listen window — long dictation (address) needs room after pauses. */
export declare const MAX_LISTEN_TIMEOUT_SECONDS = 12;
export declare function clampListenTimeoutSeconds(value: number): number;
/**
 * Resolve listen timeout: sayAndListen → listen() → Node class → default.
 */
export declare function resolveListenTimeoutSeconds(input: {
    fromSayAndListen?: number;
    fromListen?: number;
    fromNode?: number;
}): number;
export declare function listenTimeoutSecondsToMs(timeoutSeconds: number | undefined): number;
/** Vapi `startSpeakingPlan` fragment for a listen timeout (seconds). */
export interface VapiStartSpeakingPlanFromListenTimeout {
    customEndpointingRules: Array<{
        type: 'assistant';
        regex: string;
        timeoutSeconds: number;
    }>;
    transcriptionEndpointingPlan: {
        onPunctuationSeconds: number;
        onNoPunctuationSeconds: number;
        onNumberSeconds: number;
    };
}
/**
 * Map a listen timeout onto Vapi endpointing so punctuation like "K." does
 * not close the user turn at the 0.1s default.
 */
export declare function listenTimeoutToVapiStartSpeakingPlan(timeoutSeconds?: number): VapiStartSpeakingPlanFromListenTimeout;
//# sourceMappingURL=listen-timeout.d.ts.map