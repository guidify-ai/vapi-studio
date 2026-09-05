import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProjectRepository } from '@guidify-ai/vapi-studio';
import { loadProjectIdentity } from './project.config';

/**
 * Ensures `projects` row matches config/project.identity.json on every boot.
 * yarn start → Docker app start → this upsert (create or exist).
 */
@Injectable()
export class ProjectSeedService implements OnModuleInit {
  private readonly logger = new Logger(ProjectSeedService.name);

  constructor(private readonly projects: ProjectRepository) {}

  async onModuleInit(): Promise<void> {
    const identity = loadProjectIdentity();
    const row = await this.projects.upsert({
      id: identity.id,
      slug: identity.slug,
      name: identity.name,
    });
    this.logger.log(
      `Project seeded id=${row.id} slug=${row.slug} (Vapi paths: /${row.id}/vapi/...)`,
    );
  }
}
