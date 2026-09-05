"use strict";
/**
 * Durable analytics tags — milestones for operator dashboards.
 *
 * Persist via `EventService.persistAnalyticsTag` (type `ANALYTICS_TAG`).
 *
 * **Funnels:** apps define an `AnalyticsFunnelDefinition[]` catalog in code.
 * Charts score conversations that match each step’s `tags` / `eventTypes`.
 * Stamps are just `tag` ids — catalog membership, not per-event `funnels[]`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANALYTICS_TAG_EVENT = void 0;
exports.normalizeAnalyticsFunnels = normalizeAnalyticsFunnels;
exports.ANALYTICS_TAG_EVENT = 'ANALYTICS_TAG';
/**
 * Normalize funnel ids: trim, drop empties; undefined if none.
 * @deprecated Kept for reading legacy ANALYTICS_TAG rows that stored funnels[].
 */
function normalizeAnalyticsFunnels(funnels) {
    if (!funnels?.length)
        return undefined;
    const clean = [
        ...new Set(funnels.map((f) => String(f ?? '').trim()).filter((f) => f.length > 0)),
    ];
    return clean.length ? clean : undefined;
}
//# sourceMappingURL=analytics-tags.js.map