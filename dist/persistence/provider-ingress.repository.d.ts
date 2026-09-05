import { Repository } from 'typeorm';
import { ProviderIngressEntity } from './provider-ingress.entity';
export declare class ProviderIngressRepository {
    private readonly rows;
    constructor(rows: Repository<ProviderIngressEntity>);
    record(input: {
        projectId?: string | null;
        channel?: string;
        kind: string;
        providerCallId?: string | null;
        messageType?: string | null;
        method?: string;
        path: string;
        headers?: Record<string, unknown>;
        body?: Record<string, unknown>;
        responseStatus?: number | null;
        responseBody?: Record<string, unknown> | null;
    }): Promise<ProviderIngressEntity>;
    setResponse(id: string, responseStatus: number, responseBody?: Record<string, unknown> | null): Promise<void>;
}
//# sourceMappingURL=provider-ingress.repository.d.ts.map