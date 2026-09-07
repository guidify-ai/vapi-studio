import {
  Controller,
  Get,
  Header,
  Inject,
  Optional,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { STUDIO_UI_ROOT, sendStudioIndex } from '@guidify-ai/vapi-studio';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    @Optional() @Inject(STUDIO_UI_ROOT) private readonly studioUiRoot?: string,
  ) {}

  /** JSON list for the Studio SPA. */
  @Get('api')
  listApi(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.conversations.list({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /** JSON detail — chat history, memory snapshot, events. */
  @Get('api/:id')
  showApi(@Param('id') id: string) {
    return this.conversations.getDetail(id);
  }

  /** SPA shell for conversation detail (React Router). */
  @Get(':id')
  @Header('Cache-Control', 'no-cache')
  showPage(@Res() res: Response): void {
    if (!this.studioUiRoot) {
      res.status(503).type('text/plain').send('Studio UI not mounted');
      return;
    }
    sendStudioIndex(this.studioUiRoot, res);
  }
}
