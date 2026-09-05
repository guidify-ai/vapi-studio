import { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity';
export declare class ProjectRepository {
    private readonly projects;
    constructor(projects: Repository<ProjectEntity>);
    findById(id: string): Promise<ProjectEntity | null>;
    findBySlug(slug: string): Promise<ProjectEntity | null>;
    /**
     * Idempotent seed for local/dev — always the same UUID so Vapi URLs stay stable.
     */
    upsert(input: {
        id: string;
        slug: string;
        name: string;
    }): Promise<ProjectEntity>;
}
//# sourceMappingURL=project.repository.d.ts.map