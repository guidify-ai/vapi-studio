#!/usr/bin/env node
/**
 * Interactive: yarn new-project
 * Creates projects/<slug>/ with a stable config/project.identity.json
 * (UUID generated once here — never at app runtime).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS = path.join(ROOT, 'projects');

const SLUG_RE = /^[a-z][a-z0-9-]{1,62}$/;

function ask(rl, question, defaultValue) {
  const tip = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${tip}: `, (answer) => {
      const v = String(answer ?? '').trim();
      resolve(v || defaultValue || '');
    });
  });
}

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function write(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function copyEnsureDocker(destDir) {
  const src = path.join(PROJECTS, 'roofr-poc', 'scripts', 'ensure-docker.sh');
  const dest = path.join(destDir, 'scripts', 'ensure-docker.sh');
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o755);
  } else {
    write(
      dest,
      `#!/usr/bin/env bash\nset -euo pipefail\ndocker info >/dev/null 2>&1 || { echo "Docker required" >&2; exit 1; }\n`,
    );
    fs.chmodSync(dest, 0o755);
  }
}

function renderFiles({ slug, name, uuid }) {
  const dir = path.join(PROJECTS, slug);
  if (fs.existsSync(dir)) {
    throw new Error(`projects/${slug} already exists`);
  }

  write(
    path.join(dir, 'config', 'project.identity.json'),
    `${JSON.stringify({ id: uuid, slug, name }, null, 2)}\n`,
  );

  write(
    path.join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name: slug,
        version: '0.1.0',
        private: true,
        description: `${name} — Vapi Studio app`,
        license: 'UNLICENSED',
        scripts: {
          build: 'tsc -p tsconfig.json',
          start: 'bash scripts/start.sh',
          stop: 'docker compose down',
          clean: 'rm -rf dist',
        },
        dependencies: {
          '@guidify-ai/vapi-studio': 'file:../..',
          '@nestjs/common': '^11.0.12',
          '@nestjs/core': '^11.0.12',
          '@nestjs/platform-express': '^11.0.12',
          '@nestjs/typeorm': '^11.0.0',
          pg: '^8.14.1',
          'reflect-metadata': '^0.2.2',
          rxjs: '^7.8.2',
          typeorm: '^0.3.21',
          yaml: '^2.7.0',
        },
        devDependencies: {
          '@types/express': '^5.0.1',
          '@types/node': '^22.13.10',
          typescript: '^5.8.2',
        },
      },
      null,
      2,
    )}\n`,
  );

  write(
    path.join(dir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'CommonJS',
          lib: ['ES2022'],
          outDir: 'dist',
          rootDir: 'src',
          strict: true,
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          skipLibCheck: true,
          moduleResolution: 'node',
          forceConsistentCasingInFileNames: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2,
    )}\n`,
  );

  write(
    path.join(dir, '.gitignore'),
    `node_modules/\ndist/\n.env\nlogs/\n`,
  );

  write(
    path.join(dir, '.env.example'),
    `PORT=9999
DATABASE_URL=postgres://studio:studio@127.0.0.1:15432/studio
PUBLIC_BASE_URL=https://YOUR_NGROK_SUBDOMAIN.ngrok-free.app
# Mirrored from config/project.identity.json by yarn start (file is source of truth).
PROJECT_UUID=${uuid}
OPENAI_API_KEY=
LOG_DIR=logs
LOG_DAYS=14
`,
  );

  write(
    path.join(dir, 'README.md'),
    `# ${name}

Northern stars only — conversation design, not flow dumps.

| | |
| --- | --- |
| **Slug** | \`${slug}\` |
| **Ingress UUID** | \`${uuid}\` (from \`config/project.identity.json\` — do not rotate) |
| **Vapi webhook** | \`{PUBLIC_BASE_URL}/${uuid}/vapi/webhook\` |
| **Custom LLM** | \`{PUBLIC_BASE_URL}/${uuid}/vapi/chat/completions\` |

\`\`\`bash
yarn install
yarn start   # seeds project UUID into Postgres; prints Vapi URLs
\`\`\`

See [Creating an app](../../docs/building-apps/creating-an-app.md) and [best practices](../../docs/best-practices/).
`,
  );

  write(
    path.join(dir, 'config', 'flow.yaml'),
    `version: 1
flow:
  id: ${slug}
  start: greet
nodes:
  greet:
    class: GreetNode
    intentions:
      - studio.isPositive
      - studio.isGoodbye
  goodbye:
    class: GoodbyeNode
    portal: true
    priority: 100
    intentions:
      - studio.isGoodbye
`,
  );

  write(
    path.join(dir, 'src', 'main.ts'),
    `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  const port = Number(process.env.PORT ?? 9999);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log('${slug} listening on ' + port);
}

bootstrap();
`,
  );

  write(
    path.join(dir, 'src', 'health', 'health.controller.ts'),
    `import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}
`,
  );

  write(
    path.join(dir, 'src', 'project', 'project.config.ts'),
    `import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ProjectIdentity {
  id: string;
  slug: string;
  name: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cached: ProjectIdentity | null = null;

/** Canonical identity from config/project.identity.json — never generate at runtime. */
export function loadProjectIdentity(configDir?: string): ProjectIdentity {
  if (cached) return cached;
  const dir = configDir ?? process.env.CONFIG_DIR ?? join(process.cwd(), 'config');
  const path = join(dir, 'project.identity.json');
  if (!existsSync(path)) {
    throw new Error('Missing ' + path + ' — run yarn new-project or restore the identity file.');
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<ProjectIdentity>;
  const id = String(raw.id ?? '').trim().toLowerCase();
  const slug = String(raw.slug ?? '').trim();
  const name = String(raw.name ?? '').trim();
  if (!UUID_RE.test(id)) throw new Error('project.identity.json id must be a UUID');
  if (!slug || !name) throw new Error('project.identity.json needs slug and name');
  cached = { id, slug, name };
  return cached;
}

export function resolveProjectUuid(): string {
  return loadProjectIdentity().id;
}

export function projectVapiBasePath(projectUuid = resolveProjectUuid()): string {
  return '/' + projectUuid + '/vapi';
}

export function projectWebhookUrl(publicBaseUrl: string, projectUuid = resolveProjectUuid()): string {
  return publicBaseUrl.replace(/\\/$/, '') + projectVapiBasePath(projectUuid) + '/webhook';
}

export function projectChatCompletionsUrl(
  publicBaseUrl: string,
  projectUuid = resolveProjectUuid(),
  moduleId?: string | null,
): string {
  const root = publicBaseUrl.replace(/\\/$/, '') + projectVapiBasePath(projectUuid);
  if (moduleId?.trim()) return root + '/' + moduleId.trim() + '/chat/completions';
  return root + '/chat/completions';
}
`,
  );

  write(
    path.join(dir, 'src', 'project', 'project-seed.service.ts'),
    `import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProjectRepository } from '@guidify-ai/vapi-studio';
import { loadProjectIdentity } from './project.config';

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
      'Project seeded id=' + row.id + ' slug=' + row.slug + ' (Vapi: /' + row.id + '/vapi/...)',
    );
  }
}
`,
  );

  write(
    path.join(dir, 'src', 'project', 'project-uuid.guard.ts'),
    `import {
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
    if (!projectUuid) throw new NotFoundException('project not found');
    const row = await this.projects.findById(projectUuid);
    if (!row) throw new NotFoundException('project not found');
    (req as Request & { [PROJECT_ID_REQUEST_KEY]: string })[PROJECT_ID_REQUEST_KEY] = row.id;
    return true;
  }
}

export function projectIdFromRequest(req: Request): string {
  const id = (req as Request & { [PROJECT_ID_REQUEST_KEY]?: string })[PROJECT_ID_REQUEST_KEY];
  if (!id) throw new NotFoundException('project not found');
  return id;
}
`,
  );

  write(
    path.join(dir, 'src', 'conversation', 'entry.ts'),
    `import { Injectable } from '@nestjs/common';
import {
  ConversationEntryPoint,
  type ConversationBootstrapContext,
} from '@guidify-ai/vapi-studio';

export type AppVars = {
  callerId?: string;
  callerChannel?: string;
};

@Injectable()
export class AppConversationEntry implements ConversationEntryPoint<AppVars> {
  async createVariables(_ctx: ConversationBootstrapContext): Promise<AppVars> {
    return {};
  }
}
`,
  );

  write(
    path.join(dir, 'src', 'conversation', 'nodes', 'greet.node.ts'),
    `import { Injectable } from '@nestjs/common';
import { AgentNode, type NodeContext, type NodeResult } from '@guidify-ai/vapi-studio';
import type { AppVars } from '../entry';

@Injectable()
export class GreetNode extends AgentNode<AppVars> {
  async run(ctx: NodeContext<AppVars>): Promise<NodeResult> {
    return ctx.output.sayAndListen('Hello — how can I help you today?', {
      intentions: ['studio.isPositive', 'studio.isGoodbye'],
    });
  }
}
`,
  );

  write(
    path.join(dir, 'src', 'conversation', 'nodes', 'goodbye.node.ts'),
    `import { Injectable } from '@nestjs/common';
import { AgentNode, type NodeContext, type NodeResult } from '@guidify-ai/vapi-studio';
import type { AppVars } from '../entry';

@Injectable()
export class GoodbyeNode extends AgentNode<AppVars> {
  async run(ctx: NodeContext<AppVars>): Promise<NodeResult> {
    return ctx.output.sayAndEnd('Thanks for calling. Goodbye.');
  }
}
`,
  );

  write(
    path.join(dir, 'src', 'vapi', 'vapi.controller.ts'),
    `import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  ConversationBootstrapService,
  EventService,
  ProviderIngressRepository,
  extractVapiCallId,
  extractVapiCallerNumber,
} from '@guidify-ai/vapi-studio';
import {
  ProjectUuidGuard,
  projectIdFromRequest,
} from '../project/project-uuid.guard';
import { projectVapiBasePath, loadProjectIdentity } from '../project/project.config';

/**
 * Minimal Vapi ingress. Extend with Custom LLM SSE from creating-an-app / example apps.
 */
@Controller(':projectUuid/vapi')
@UseGuards(ProjectUuidGuard)
export class VapiController {
  constructor(
    private readonly bootstrap: ConversationBootstrapService,
    private readonly events: EventService,
    private readonly ingress: ProviderIngressRepository,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const projectId = projectIdFromRequest(req);
    const message = (body.message ?? body) as Record<string, unknown>;
    const call = message.call as { id?: string } | undefined;
    const callId = call?.id ?? extractVapiCallId(body);
    const path = projectVapiBasePath(projectId) + '/webhook';
    await this.ingress.record({
      projectId,
      kind: 'webhook',
      path,
      providerCallId: callId ?? null,
      messageType: String(message.type ?? 'unknown'),
      body,
    });
    if (callId && String(message.type ?? '') === 'assistant-request') {
      await this.bootstrap.bootstrap({
        projectId,
        providerCallId: callId,
        brainProfileId: process.env.POC_BRAIN_PROFILE || 'default',
        metadata: {
          messageType: message.type,
          projectId,
          callerPhoneNumber: extractVapiCallerNumber(body),
        },
      });
      const identity = loadProjectIdentity();
      this.events.log('info', 'ASSISTANT_REQUEST', {
        projectId,
        providerCallId: callId,
        slug: identity.slug,
      });
    }
    if (callId && String(message.status ?? '') === 'ended') {
      await this.bootstrap.finalizeEnded(callId);
    }
    return { ok: true };
  }

  @Post('chat/completions')
  chatCompletions() {
    return {
      error:
        'Wire Custom LLM SSE (Supervisor + VapiSseCompiler). See docs/building-apps/creating-an-app.md',
    };
  }
}
`,
  );

  write(
    path.join(dir, 'src', 'app.module.ts'),
    `import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import {
  ConversationEntity,
  ConversationEventEntity,
  FlowLoader,
  MockBrainAdapter,
  ProjectEntity,
  ProviderIngressEntity,
  VapiStudioModule,
} from '@guidify-ai/vapi-studio';
import { HealthController } from './health/health.controller';
import { ProjectSeedService } from './project/project-seed.service';
import { ProjectUuidGuard } from './project/project-uuid.guard';
import { VapiController } from './vapi/vapi.controller';
import { AppConversationEntry } from './conversation/entry';
import { GreetNode } from './conversation/nodes/greet.node';
import { GoodbyeNode } from './conversation/nodes/goodbye.node';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://studio:studio@postgres:5432/studio',
      entities: [
        ConversationEntity,
        ConversationEventEntity,
        ProviderIngressEntity,
        ProjectEntity,
      ],
      synchronize: true,
    }),
    VapiStudioModule.forRoot({
      entryPoint: AppConversationEntry,
      brainAdapter: MockBrainAdapter,
      nodes: [
        { className: 'GreetNode', useClass: GreetNode },
        { className: 'GoodbyeNode', useClass: GoodbyeNode },
      ],
    }),
  ],
  controllers: [HealthController, VapiController],
  providers: [ProjectSeedService, ProjectUuidGuard],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly flowLoader: FlowLoader) {}

  async onModuleInit(): Promise<void> {
    const configDir = process.env.CONFIG_DIR ?? join(process.cwd(), 'config');
    this.flowLoader.loadFromFile(join(configDir, 'flow.yaml'));
    this.logger.log('Loaded config/flow.yaml');
  }
}
`,
  );

  write(
    path.join(dir, 'Dockerfile'),
    `# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS build

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

WORKDIR /workspace/guidify-ai/packages/vapi-studio
COPY --from=vapi-studio package.json tsconfig.json ./
COPY --from=vapi-studio src ./src
COPY --from=vapi-studio test ./test
COPY --from=vapi-studio scripts ./scripts
COPY --from=vapi-studio docs ./docs
COPY --from=vapi-studio agent ./agent
RUN yarn install && yarn build
RUN mkdir -p /pkg/vapi-studio && cp package.json /pkg/vapi-studio/ && cp -R dist /pkg/vapi-studio/dist && cp -R test /pkg/vapi-studio/test && cp -R scripts /pkg/vapi-studio/scripts && cp -R docs /pkg/vapi-studio/docs && cp -R agent /pkg/vapi-studio/agent
RUN rm -rf node_modules

WORKDIR /workspace/guidify-ai/projects/${slug}
COPY package.json tsconfig.json ./
COPY src ./src
COPY config ./config
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.dependencies['@guidify-ai/vapi-studio']='file:/pkg/vapi-studio'; fs.writeFileSync('package.json', JSON.stringify(p,null,2));" \\
  && yarn install && yarn build

FROM node:24-bookworm-slim AS runtime
WORKDIR /workspace
COPY --from=build /pkg/vapi-studio /workspace/guidify-ai/packages/vapi-studio
COPY --from=build /workspace/guidify-ai/projects/${slug} /workspace/guidify-ai/projects/${slug}
RUN mkdir -p /pkg && ln -sfn /workspace/guidify-ai/packages/vapi-studio /pkg/vapi-studio
ENV NODE_ENV=production
ENV CONFIG_DIR=/workspace/guidify-ai/projects/${slug}/config
ENV PORT=9999
WORKDIR /workspace/guidify-ai/projects/${slug}
RUN mkdir -p logs
EXPOSE 9999
CMD ["node", "dist/main.js"]
`,
  );

  write(
    path.join(dir, 'docker-compose.yml'),
    `services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: studio
      POSTGRES_PASSWORD: studio
      POSTGRES_DB: studio
    ports:
      - "15432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U studio -d studio"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build:
      context: .
      dockerfile: Dockerfile
      additional_contexts:
        vapi-studio: ../..
    ports:
      - "9999:9999"
    env_file:
      - .env
    environment:
      DATABASE_URL: postgres://studio:studio@postgres:5432/studio
      PORT: 9999
      PUBLIC_BASE_URL: \${PUBLIC_BASE_URL:-http://localhost:9999}
      PROJECT_UUID: \${PROJECT_UUID:-${uuid}}
      LOG_DIR: \${LOG_DIR:-/workspace/guidify-ai/projects/${slug}/logs}
      FORCE_COLOR: "1"
      OPENAI_API_KEY: \${OPENAI_API_KEY:-}
      CONFIG_DIR: /workspace/guidify-ai/projects/${slug}/config
    volumes:
      - ./logs:/workspace/guidify-ai/projects/${slug}/logs
      - ./config:/workspace/guidify-ai/projects/${slug}/config
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
`,
  );

  // start.sh — identity-first (same contract as example apps)
  write(
    path.join(dir, 'scripts', 'start.sh'),
    `#!/usr/bin/env bash
# yarn start — Docker + ngrok; seeds project UUID from config/project.identity.json
set -euo pipefail

ROOT="$(CDPATH="" cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="\${PORT:-9999}"
NGROK_API="\${NGROK_API:-http://127.0.0.1:4040}"
IDENTITY_FILE="\${ROOT}/config/project.identity.json"

if [[ ! -f "$IDENTITY_FILE" ]]; then
  echo "Missing \${IDENTITY_FILE}" >&2
  echo "Re-run yarn new-project or restore project.identity.json" >&2
  exit 1
fi

read_identity() {
  python3 -c '
import json, pathlib, sys
d = json.loads(pathlib.Path("config/project.identity.json").read_text())
for key in ("id", "slug", "name"):
    if not str(d.get(key, "")).strip():
        sys.exit(f"project.identity.json missing {key}")
print(str(d["id"]).strip().lower())
print(str(d["slug"]).strip())
print(str(d["name"]).strip())
'
}
IDENTITY_LINES="$(read_identity)"
PROJECT_UUID="$(printf '%s\\n' "$IDENTITY_LINES" | sed -n '1p')"
PROJECT_SLUG="$(printf '%s\\n' "$IDENTITY_LINES" | sed -n '2p')"
PROJECT_NAME="$(printf '%s\\n' "$IDENTITY_LINES" | sed -n '3p')"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is required on PATH for yarn start." >&2
  exit 1
fi

bash "$ROOT/scripts/ensure-docker.sh"

if [[ ! -f .env ]]; then
  echo ">> No .env — copying .env.example"
  cp .env.example .env
fi

PROJECT_UUID="$PROJECT_UUID" python3 -c '
import os
from pathlib import Path
uuid = os.environ["PROJECT_UUID"]
path = Path(".env")
lines = path.read_text().splitlines() if path.exists() else []
out, seen = [], False
for line in lines:
    if line.startswith("PROJECT_UUID="):
        out.append(f"PROJECT_UUID={uuid}"); seen = True
    else:
        out.append(line)
if not seen:
    out.append(f"PROJECT_UUID={uuid}")
path.write_text("\\n".join(out) + "\\n")
'

echo ">> Project \${PROJECT_NAME} (\${PROJECT_SLUG}) id=\${PROJECT_UUID}"
echo ">> App boot upserts this UUID into the projects table (create or exist)"
docker compose up -d --build

echo ">> Waiting for health on http://localhost:\${PORT}/health"
for _ in $(seq 1 90); do
  if curl -sf "http://localhost:\${PORT}/health" >/dev/null; then
    echo ">> App is healthy (project row seeded)"
    break
  fi
  sleep 1
done
curl -sf "http://localhost:\${PORT}/health" >/dev/null || {
  echo "App failed to become healthy" >&2
  docker compose logs app --tail 60 >&2 || true
  exit 1
}

cleanup() {
  if [[ -n "\${NGROK_PID:-}" ]] && kill -0 "$NGROK_PID" 2>/dev/null; then
    kill "$NGROK_PID" 2>/dev/null || true
    wait "$NGROK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo ">> Starting ngrok http \${PORT}"
ngrok http "$PORT" --log=stdout &
NGROK_PID=$!

public_url=""
for _ in $(seq 1 40); do
  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "ngrok exited early" >&2
    exit 1
  fi
  payload="$(curl -sf "\${NGROK_API}/api/tunnels" 2>/dev/null || true)"
  if [[ -n "$payload" ]]; then
    public_url="$(
      printf '%s' "$payload" | python3 -c '
import json, sys
data = json.load(sys.stdin)
https = [t.get("public_url") for t in data.get("tunnels", []) if str(t.get("public_url", "")).startswith("https://")]
print(https[0] if https else "")
'
    )"
    [[ -n "$public_url" ]] && break
  fi
  sleep 0.5
done

upsert_public_base_url() {
  local url="$1"
  PUBLIC_URL="$url" python3 -c '
import os
from pathlib import Path
url = os.environ["PUBLIC_URL"]
path = Path(".env")
lines = path.read_text().splitlines()
found = False
out = []
for line in lines:
    if line.startswith("PUBLIC_BASE_URL="):
        out.append(f"PUBLIC_BASE_URL={url}"); found = True
    else:
        out.append(line)
if not found:
    out.append(f"PUBLIC_BASE_URL={url}")
path.write_text("\\n".join(out) + "\\n")
'
}

echo
if [[ -z "$public_url" ]]; then
  echo ">> Could not read ngrok public URL; set PUBLIC_BASE_URL in .env manually."
  echo "App: http://localhost:\${PORT}"
else
  echo ">> ngrok public URL: \${public_url}"
  upsert_public_base_url "$public_url"
  PUBLIC_BASE_URL="$public_url" docker compose up -d app
  echo
  echo "Project:                \${PROJECT_NAME} (\${PROJECT_SLUG})"
  echo "Project UUID:           \${PROJECT_UUID}"
  echo "Webhook endpoint:       \${public_url}/\${PROJECT_UUID}/vapi/webhook"
  echo "Conversation endpoint:  \${public_url}/\${PROJECT_UUID}/vapi/chat/completions"
  echo
fi

echo ">> ngrok is running (Ctrl+C stops ngrok; Docker stack keeps running — yarn stop)"
wait "$NGROK_PID"
`,
  );
  fs.chmodSync(path.join(dir, 'scripts', 'start.sh'), 0o755);
  copyEnsureDocker(dir);

  return dir;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i === -1) return null;
    return args[i + 1] ?? '';
  };
  const hasYes = args.includes('--yes') || args.includes('-y');

  let name;
  let slug;
  let rl = null;

  if (flag('--name') != null) {
    name = String(flag('--name') || '').trim();
    slug = String(flag('--slug') || slugify(name) || '').trim();
  } else {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    console.log('Vapi Studio — new project under projects/\n');
    name = await ask(rl, 'Project display name', 'My Voice App');
    if (!name) throw new Error('Name is required');
    const defaultSlug = slugify(name) || 'my-voice-app';
    slug = await ask(rl, 'Project slug (folder name)', defaultSlug);
  }

  try {
    if (!name) throw new Error('Name is required (--name or interactive)');
    slug = slugify(slug || name);
    if (!SLUG_RE.test(slug)) {
      throw new Error(
        'Slug must be lowercase letters/digits/hyphens, start with a letter (got "' +
          slug +
          '")',
      );
    }
    if (fs.existsSync(path.join(PROJECTS, slug))) {
      throw new Error('projects/' + slug + ' already exists');
    }

    // Generate UUID once at scaffold time; stored statically in project.identity.json.
    const uuid = crypto.randomUUID();

    console.log('\nWill create:');
    console.log('  path:  projects/' + slug);
    console.log('  name:  ' + name);
    console.log('  slug:  ' + slug);
    console.log('  uuid:  ' + uuid + '  (written to config/project.identity.json)');

    if (!hasYes) {
      if (!rl) {
        rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
      }
      const ok = await ask(rl, 'Proceed? (y/N)', 'y');
      if (!/^y(es)?$/i.test(ok || '')) {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    const dir = renderFiles({ slug, name, uuid });
    console.log('\nCreated ' + dir);
    console.log('\nNext:');
    console.log('  cd projects/' + slug);
    console.log('  yarn install');
    console.log('  yarn start   # upserts UUID into DB; prints Vapi URLs');
    console.log('\nDo not change config/project.identity.json id after wiring Vapi.');
  } finally {
    if (rl) rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
