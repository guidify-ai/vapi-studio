import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  private configDir(): string {
    return process.env.CONFIG_DIR ?? join(process.cwd(), 'config');
  }

  private sendHtml(res: Response, fileName: string): void {
    const path = join(this.configDir(), fileName);
    try {
      res.type('text/html; charset=utf-8').send(readFileSync(path, 'utf8'));
    } catch {
      throw new NotFoundException(`Missing ${fileName}`);
    }
  }

  /** JSON list for the debug UI. */
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

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  listPage(@Res() res: Response): void {
    this.sendHtml(res, 'conversations-list.html');
  }

  @Get(':id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  showPage(@Res() res: Response): void {
    this.sendHtml(res, 'conversation-show.html');
  }
}
