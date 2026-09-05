/** Framework-standard intention ids (use in flow.yaml and portal nodes). */
export declare const STANDARD_INTENTIONS: {
    readonly isGoodbye: "studio.isGoodbye";
    readonly isTransferToHuman: "studio.isTransferToHuman";
    readonly isPause: "studio.isPause";
    /** Caller is angry / mad — handle as a standalone portal, not normal flow. */
    readonly isMad: "studio.isMad";
    /**
     * No candidate intention cleared the confidence threshold.
     * Standalone portal — ask to clarify / recover.
     */
    readonly isUnknownTransition: "studio.isUnknownTransition";
    /** Affirmative answer (yes / correct / sure / okay). */
    readonly isPositive: "studio.isPositive";
    /** Negative answer (no / incorrect / decline). */
    readonly isNegative: "studio.isNegative";
    /**
     * Caller went silent — Vapi idle hook / Studio timer injects this portal.
     * Ask “still there?” twice, then endCall.
     */
    readonly isStillThere: "studio.isStillThere";
    /** Synthetic: channel delivered tool results for the pending toolCall. */
    readonly isToolResult: "studio.isToolResult";
};
export type StandardIntention = (typeof STANDARD_INTENTIONS)[keyof typeof STANDARD_INTENTIONS];
//# sourceMappingURL=standard-intentions.d.ts.map