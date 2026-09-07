import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { STUDIO_UI_ROOT } from './studio-ui.tokens';

type HtmlResponse = {
  type: (contentType: string) => HtmlResponse;
  send: (body: string) => void;
};

/** Shared helper — serve SPA index.html from the Vite build. */
export function sendStudioIndex(root: string, res: HtmlResponse): void {
  const index = join(root, 'index.html');
  if (!existsSync(index)) {
    throw new NotFoundException('Studio UI index.html missing');
  }
  res.type('text/html; charset=utf-8').send(readFileSync(index, 'utf8'));
}

/**
 * Serves the React SPA shell for top-level operator routes.
 * Conversation detail (`/conversations/:id`) is served by the app’s
 * ConversationsController so `/conversations/api` is never stolen.
 */
@Controller()
export class StudioSpaController {
  constructor(@Inject(STUDIO_UI_ROOT) private readonly root: string) {}

  @Get(['flow', 'conversations', 'analytics'])
  @Header('Cache-Control', 'no-cache')
  spa(@Res() res: HtmlResponse): void {
    sendStudioIndex(this.root, res);
  }
}
