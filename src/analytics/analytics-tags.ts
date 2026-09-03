/**
 * Durable analytics tags — conversation funnel steps for operator dashboards.
 *
 * Persist via `EventService.persistAnalyticsTag` (type `ANALYTICS_TAG`,
 * payload.tag). Funnel catalogs may also bind to other event types so
 * historical forensics count without re-tagging.
 */
export const ANALYTICS_TAG_EVENT = 'ANALYTICS_TAG';

export interface AnalyticsTagPayload {
  /** Stable funnel/tag id (snake_case). */
  tag: string;
  /** Optional funnel id when a tag belongs to multiple funnels. */
  funnel?: string;
  /** Human label for dashboards (optional; catalogs may override). */
  label?: string;
  [key: string]: unknown;
}

export interface AnalyticsFunnelStep {
  /** Step id — usually matches tag or a catalog key. */
  id: string;
  label: string;
  /**
   * Conversation counts if it has any of these event types
   * (e.g. FORM_SENDOUT) — works on historical data.
   */
  eventTypes?: string[];
  /**
   * Conversation counts if it has ANALYTICS_TAG with payload.tag in this list.
   */
  tags?: string[];
}

export interface AnalyticsFunnelDefinition {
  id: string;
  label: string;
  description?: string;
  steps: AnalyticsFunnelStep[];
}
