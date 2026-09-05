/**
 * Durable project identity — public ingress UUID for Vapi URLs
 * (`/{projectUuid}/vapi/...`). Apps seed a stable id for local/dev.
 */
export declare class ProjectEntity {
    /** Public ingress UUID (path segment). */
    id: string;
    slug: string;
    name: string;
    createdAt: Date;
}
//# sourceMappingURL=project.entity.d.ts.map