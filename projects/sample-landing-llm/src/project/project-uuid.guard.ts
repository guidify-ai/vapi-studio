import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProjectRepository } from '@guidify-ai/vapi-studio';

export const PROJECT_ID_REQUEST_KEY = 'projectId';

@Injectable()
export class ProjectUuidGuard implements CanActivate {
  constructor(private readonly projects: ProjectRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const projectUuid = String(req.params?.projectUuid ?? '').trim().toLowerCase();
    if (!projectUuid) {
      throw new NotFoundException('project not found');
    }
    const row = await this.projects.findById(projectUuid);
    if (!row) {
      throw new NotFoundException('project not found');
    }
    (req as Request & { [PROJECT_ID_REQUEST_KEY]: string })[
      PROJECT_ID_REQUEST_KEY
    ] = row.id;
    return true;
  }
}

export function projectIdFromRequest(req: Request): string {
  const id = (req as Request & { [PROJECT_ID_REQUEST_KEY]?: string })[
    PROJECT_ID_REQUEST_KEY
  ];
  if (!id) {
    throw new NotFoundException('project not found');
  }
  return id;
}
