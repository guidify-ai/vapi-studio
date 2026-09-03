import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity';

@Injectable()
export class ProjectRepository {
  public constructor(
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
  ) {}

  public findById(id: string): Promise<ProjectEntity | null> {
    return this.projects.findOne({ where: { id } });
  }

  public findBySlug(slug: string): Promise<ProjectEntity | null> {
    return this.projects.findOne({ where: { slug } });
  }

  /**
   * Idempotent seed for local/dev — always the same UUID so Vapi URLs stay stable.
   */
  public async upsert(input: {
    id: string;
    slug: string;
    name: string;
  }): Promise<ProjectEntity> {
    const existing = await this.findById(input.id);
    if (existing) {
      let dirty = false;
      if (existing.slug !== input.slug) {
        existing.slug = input.slug;
        dirty = true;
      }
      if (existing.name !== input.name) {
        existing.name = input.name;
        dirty = true;
      }
      if (dirty) {
        return this.projects.save(existing);
      }
      return existing;
    }
    const bySlug = await this.findBySlug(input.slug);
    if (bySlug && bySlug.id !== input.id) {
      throw new Error(
        `Project slug "${input.slug}" already registered as ${bySlug.id}; cannot upsert ${input.id}`,
      );
    }
    const row = this.projects.create({
      id: input.id,
      slug: input.slug,
      name: input.name,
    });
    return this.projects.save(row);
  }
}
