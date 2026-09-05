import type { FormDisposeAdapter, FormDisposePayload } from './form.types';
/**
 * Default dispose — phone / unknown channels cannot show a Studio modal.
 * FormsService treats dispose failure / missing ACK as deliver timeout so
 * Nodes can fall back to voice collection.
 */
export declare class NoopFormDisposeAdapter implements FormDisposeAdapter {
    readonly id: "noop";
    readonly branch: "unavailable";
    dispose(_payload: FormDisposePayload): Promise<void>;
}
//# sourceMappingURL=noop-form-dispose.adapter.d.ts.map