import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ProjectIdentity {
  /** Public ingress UUID — path segment in /{id}/vapi/... Never regenerate. */
  id: string;
  slug: string;
  name: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cached: ProjectIdentity | null = null;

/**
 * Canonical project identity — `config/project.identity.json`.
 * Written once by `yarn new-project` (or checked in). Not generated at runtime.
 */
export function loadProjectIdentity(configDir?: string): ProjectIdentity {
  if (cached) return cached;
  const dir = configDir ?? process.env.CONFIG_DIR ?? join(process.cwd(), 'config');
  const path = join(dir, 'project.identity.json');
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path}. Create it with yarn new-project (repo root) or copy project.identity.json — do not invent a UUID at runtime.`,
    );
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<ProjectIdentity>;
  const id = String(raw.id ?? '').trim().toLowerCase();
  const slug = String(raw.slug ?? '').trim();
  const name = String(raw.name ?? '').trim();
  if (!UUID_RE.test(id)) {
    throw new Error(`project.identity.json id must be a UUID (got "${raw.id ?? ''}")`);
  }
  if (!slug) {
    throw new Error('project.identity.json slug is required');
  }
  if (!name) {
    throw new Error('project.identity.json name is required');
  }
  cached = { id, slug, name };
  return cached;
}

/** @deprecated prefer loadProjectIdentity().id */
export function resolveProjectUuid(): string {
  return loadProjectIdentity().id;
}

export function projectVapiBasePath(projectUuid = resolveProjectUuid()): string {
  return `/${projectUuid}/vapi`;
}

export function projectWebhookUrl(
  publicBaseUrl: string,
  projectUuid = resolveProjectUuid(),
): string {
  const base = publicBaseUrl.replace(/\/$/, '');
  return `${base}${projectVapiBasePath(projectUuid)}/webhook`;
}

export function projectChatCompletionsUrl(
  publicBaseUrl: string,
  projectUuid = resolveProjectUuid(),
  moduleId?: string | null,
): string {
  const base = publicBaseUrl.replace(/\/$/, '');
  const root = projectVapiBasePath(projectUuid);
  if (moduleId?.trim()) {
    return `${base}${root}/${moduleId.trim()}/chat/completions`;
  }
  return `${base}${root}/chat/completions`;
}
