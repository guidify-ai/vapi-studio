import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Resolve built Studio SPA assets (`dist/studio-ui` from the package root).
 * Nest mount code compiles to `dist/studio-ui-mount/` (separate from Vite assets).
 */
export function resolveStudioUiRoot(): string {
  const candidates = [
    join(__dirname, '..', 'studio-ui'),
    join(process.cwd(), 'node_modules', '@guidify-ai', 'vapi-studio', 'dist', 'studio-ui'),
    join(process.cwd(), '..', '..', 'dist', 'studio-ui'),
    join(process.cwd(), 'dist', 'studio-ui'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) {
      return dir;
    }
  }
  throw new Error(
    'Studio UI assets not found (dist/studio-ui/index.html). ' +
      'Run `yarn build:studio-ui` from the vapi-studio package root.',
  );
}
