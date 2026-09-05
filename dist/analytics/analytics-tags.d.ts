/**
 * Durable analytics tags — milestones for operator dashboards.
 *
 * Persist via `EventService.persistAnalyticsTag` (type `ANALYTICS_TAG`).
 *
 * **Funnels:** apps define an `AnalyticsFunnelDefinition[]` catalog in code.
 * Charts score conversations that match each step’s `tags` / `eventTypes`.
 * Stamps are just `tag` ids — catalog membership, not per-event `funnels[]`.
 */
export declare const ANALYTICS_TAG_EVENT = "ANALYTICS_TAG";
export interface AnalyticsTagPayload {
    /** Stable milestone id (snake_case). */
    tag: string;
    /**
     * @deprecated Optional legacy field. Funnel charts use the code catalog;
     * prefer omitting. Still normalized/stored when present for old rows.
     */
    funnels?: string[];
    /** Human label for dashboards (optional; catalogs may override). */
    label?: string;
    [key: string]: unknown;
}
export interface AnalyticsFunnelStep {
    /** Step id — usually matches the analytics tag. */
    id: string;
    label: string;
    /**
     * Conversation counts if it has any of these event types
     * (e.g. FORM_SENDOUT) — works on historical data without tags.
     */
    eventTypes?: string[];
    /**
     * Conversation counts if it has ANALYTICS_TAG with payload.tag in this list
     * (OR semantics, combined with eventTypes).
     */
    tags?: string[];
    /**
     * Conversation must have ALL of these ANALYTICS_TAG values (AND).
     * When set, `tags` / `eventTypes` are ignored for this step.
     */
    requireAllTags?: string[];
    /**
     * Conversation must have NONE of these ANALYTICS_TAG values.
     * Applied with `requireAllTags` (outcome / exclusive-path steps).
     */
    excludeTags?: string[];
}
export interface AnalyticsFunnelDefinition {
    /** Stable funnel id (catalog only). */
    id: string;
    label: string;
    description?: string;
    steps: AnalyticsFunnelStep[];
}
/**
 * Normalize funnel ids: trim, drop empties; undefined if none.
 * @deprecated Kept for reading legacy ANALYTICS_TAG rows that stored funnels[].
 */
export declare function normalizeAnalyticsFunnels(funnels: string[] | undefined | null): string[] | undefined;
//# sourceMappingURL=analytics-tags.d.ts.map