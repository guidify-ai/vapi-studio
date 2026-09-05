import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { StudioSessionService } from './studio-session.service';
import { readWebCallerIdFromRequest } from '../caller/caller-identity';
import { STUDIO_PRESETS_CATALOG, type StudioCallPresets } from './studio-presets';

@Controller('studio')
export class StudioController {
  constructor(private readonly sessions: StudioSessionService) {}

  /** Preset catalog for the Studio toggles panel. */
  @Get('presets')
  presets() {
    return STUDIO_PRESETS_CATALOG;
  }

  /** Call button — opening entry phrase only (no user text). */
  @Post('conversations/call')
  call(
    @Req() req: Request,
    @Headers('cookie') cookie: string | undefined,
    @Body()
    body: {
      callerId?: string;
      afterHours?: boolean;
      abOverrides?: StudioCallPresets['abOverrides'];
      featureFlagOverrides?: StudioCallPresets['featureFlagOverrides'];
      contactName?: string;
      contactEmail?: string;
      guestCompanyName?: string;
      companyName?: string;
    },
  ) {
    return this.sessions.startCall(this.webCallerId(req, cookie, body?.callerId), {
      afterHours: body?.afterHours === true,
      abOverrides: body?.abOverrides,
      featureFlagOverrides: body?.featureFlagOverrides,
      contactName: body?.contactName,
      contactEmail: body?.contactEmail,
      guestCompanyName: body?.guestCompanyName || body?.companyName,
    });
  }

  /** First message starts a new text conversation (opening + user turn). */
  @Post('conversations')
  start(
    @Req() req: Request,
    @Headers('cookie') cookie: string | undefined,
    @Body() body: { text?: string; callerId?: string },
  ) {
    return this.sessions.startWithMessage(
      String(body?.text ?? ''),
      this.webCallerId(req, cookie, body?.callerId),
    );
  }

  @Post('conversations/:id/turns')
  turn(@Param('id') id: string, @Body() body: { text?: string }) {
    return this.sessions.sendTurn(id, String(body?.text ?? ''));
  }

  @Post('conversations/:id/idle')
  idle(@Param('id') id: string) {
    return this.sessions.idleStillThere(id);
  }

  @Post('conversations/:id/end')
  end(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.sessions.end(id, String(body?.reason ?? 'customer_ended'));
  }

  @Get('conversations/:id')
  state(@Param('id') id: string) {
    return this.sessions.getState(id);
  }

  @Get('conversations/:id/forms/pending')
  pendingForm(@Param('id') id: string) {
    return this.sessions.getPendingForm(id);
  }

  @Post('conversations/:id/forms/:exposeId/ack')
  ackForm(
    @Param('id') id: string,
    @Param('exposeId') exposeId: string,
  ) {
    return this.sessions.ackForm(id, exposeId);
  }

  /** Submit fillout — runs IdentityCollect resume and returns assistant lines for Studio chat. */
  @Post('conversations/:id/forms/:exposeId/submit')
  submitForm(
    @Param('id') id: string,
    @Param('exposeId') exposeId: string,
    @Body() body: { values?: Record<string, string> },
  ) {
    return this.sessions.submitForm(id, exposeId, body?.values ?? {});
  }

  private webCallerId(
    req: Request,
    cookieHeader: string | undefined,
    bodyCallerId?: string,
  ): string {
    const fromReq =
      typeof req.headers.cookie === 'string' ? req.headers.cookie : cookieHeader;
    return (
      readWebCallerIdFromRequest(fromReq, bodyCallerId) ?? randomUUID()
    );
  }
}
