export declare class ProviderIngressEntity {
    id: string;
    /** Owning project (ingress UUID); null for legacy/unscoped writes. */
    projectId: string | null;
    channel: string;
    /** webhook | custom-llm */
    kind: string;
    providerCallId: string | null;
    messageType: string | null;
    method: string;
    path: string;
    headers: Record<string, unknown>;
    body: Record<string, unknown>;
    responseStatus: number | null;
    responseBody: Record<string, unknown> | null;
    createdAt: Date;
}
//# sourceMappingURL=provider-ingress.entity.d.ts.map