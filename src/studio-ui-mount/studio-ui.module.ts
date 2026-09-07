import { DynamicModule, Module, type INestApplication } from '@nestjs/common';
import { resolveStudioUiRoot } from './resolve-studio-ui-root';
import { StudioSpaController } from './studio-spa.controller';
import { STUDIO_UI_ROOT } from './studio-ui.tokens';

export type StudioUiModuleOptions = {
  /** Override asset root (tests / monorepo path). */
  rootPath?: string;
};

/**
 * Mounts the shared React Studio SPA (routes + layout).
 * Call `mountStudioUiAssets(app)` from `main.ts` so hashed `/assets/*` are served.
 */
@Module({})
export class StudioUiModule {
  static forRoot(options: StudioUiModuleOptions = {}): DynamicModule {
    const rootPath = options.rootPath ?? resolveStudioUiRoot();
    return {
      module: StudioUiModule,
      controllers: [StudioSpaController],
      providers: [{ provide: STUDIO_UI_ROOT, useValue: rootPath }],
      exports: [STUDIO_UI_ROOT],
    };
  }
}

/** Serve Vite build assets (`/assets/*`) from the Studio UI package. */
export function mountStudioUiAssets(app: INestApplication): string {
  const root = resolveStudioUiRoot();
  const nestApp = app as INestApplication & {
    useStaticAssets?: (
      path: string,
      options?: { index?: boolean; fallthrough?: boolean },
    ) => void;
  };
  if (typeof nestApp.useStaticAssets === 'function') {
    nestApp.useStaticAssets(root, { index: false, fallthrough: true });
  } else {
    throw new Error(
      'mountStudioUiAssets requires NestExpressApplication (useStaticAssets).',
    );
  }
  return root;
}
