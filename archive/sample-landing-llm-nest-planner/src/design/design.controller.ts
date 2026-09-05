import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { DesignService } from './design.service';
import { ChatMessage, DesignDraftPublic } from '../leads/leads.service';
import { clientIpFromRequest } from '../client-ip';
import { randomUUID } from 'crypto';

@Controller('api/design')
export class DesignController {
  constructor(private readonly design: DesignService) {}

  /** Obligatory contact form — no LLM. */
  @Post('intake')
  async intake(
    @Req() req: Request,
    @Body()
    body: {
      sessionId?: string;
      companyName?: string;
      contactEmail?: string;
      contactName?: string;
    },
  ) {
    const sessionId = String(body.sessionId || '').trim() || randomUUID();
    try {
      const result = await this.design.intake({
        sessionId,
        clientIp: clientIpFromRequest(req),
        companyName: String(body.companyName || ''),
        contactEmail: String(body.contactEmail || ''),
        contactName: String(body.contactName || ''),
      });
      return {
        ok: true,
        sessionId,
        assistantMessage: result.assistantMessage,
        draft: result.draft,
        messages: result.messages,
        completed: Boolean(result.completed),
        completedReason: result.completedReason || null,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Invalid contact form';
      throw new HttpException(
        { ok: false, error: message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('turn')
  async turn(
    @Req() req: Request,
    @Body()
    body: {
      sessionId?: string;
      messages?: ChatMessage[];
      message?: string;
      draft?: DesignDraftPublic | null;
    },
  ) {
    const sessionId = String(body.sessionId || '').trim() || randomUUID();
    const result = await this.design.turn({
      sessionId,
      clientIp: clientIpFromRequest(req),
      messages: Array.isArray(body.messages) ? body.messages : [],
      userMessage: body.message,
      clientDraft: body.draft || null,
    });
    return {
      ok: true,
      sessionId,
      assistantMessage: result.assistantMessage,
      draft: result.draft,
      messages: result.messages,
      completed: Boolean(result.completed),
      completedReason: result.completedReason || null,
    };
  }

  /** Close a conversation: left_site | idle_timeout | guest_exit | transfer_human */
  @Post('complete')
  async complete(
    @Body()
    body: {
      sessionId?: string;
      reason?: string;
    },
  ) {
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
      throw new HttpException(
        { ok: false, error: 'sessionId required' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const raw = String(body.reason || '').trim();
    const reason =
      raw === 'left_site' ||
      raw === 'idle_timeout' ||
      raw === 'guest_exit' ||
      raw === 'transfer_human'
        ? raw
        : 'left_site';
    const result = await this.design.complete({ sessionId, reason });
    return result;
  }
}
