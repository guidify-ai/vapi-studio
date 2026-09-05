import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  FormsService,
  renderFormGoneHtml,
  renderFormHtml,
  renderFormThanksHtml,
  type FormValues,
} from '@guidify-ai/vapi-studio';
import { FORM_TEMPLATES } from './form-catalog';
import { renderFormInboxHtml } from './form-inbox.html';
import { FormResumeService } from './form-resume.service';

/**
 * First-party HTML forms — JSON field specs → HTML; submit → FormsService → Node.
 *
 * GET  /forms/inbox              operator list of exposed / unsubmitted forms
 * GET  /forms/live               alias → inbox
 * GET  /forms/pending            JSON list of open exposes
 * GET  /forms/pending-latest     newest open expose (JSON)
 * GET  /forms/templates/:formId  template JSON
 * GET  /forms/:exposeId          fillable HTML
 * POST /forms/:exposeId          submit → bot resumes (same as caller)
 */
@Controller('forms')
export class HtmlFormController {
  constructor(
    private readonly forms: FormsService,
    private readonly resume: FormResumeService,
  ) {}

  @Get('inbox')
  @Header('Content-Type', 'text/html; charset=utf-8')
  inbox(@Res() res: Response): void {
    res.status(200).send(renderFormInboxHtml());
  }

  /** Kept for bookmarks — same UI as inbox. */
  @Get('live')
  @Header('Content-Type', 'text/html; charset=utf-8')
  live(@Res() res: Response): void {
    res.status(200).send(renderFormInboxHtml());
  }

  @Get('pending')
  pending() {
    const items = this.forms.listPending().map((handle) => {
      const tpl = FORM_TEMPLATES[handle.formId];
      return {
        exposeId: handle.exposeId,
        formId: handle.formId,
        title: tpl?.title ?? `Form ${handle.formId}`,
        conversationId: handle.conversationId,
        createdAt: handle.createdAt,
        branch: handle.branch ?? null,
        deliveryBranch: handle.deliveryBranch ?? null,
        fieldNames: handle.fields.map((f) => f.name),
        path: `/forms/${handle.exposeId}`,
        localUrl: this.localFormUrl(handle.exposeId),
      };
    });
    return { items, count: items.length };
  }

  @Get('pending-latest')
  pendingLatest() {
    const handle = this.forms.getLatestPending();
    if (!handle) return { exposeId: null };
    const tpl = FORM_TEMPLATES[handle.formId];
    return {
      exposeId: handle.exposeId,
      formId: handle.formId,
      title: tpl?.title ?? `Form ${handle.formId}`,
      conversationId: handle.conversationId,
      createdAt: handle.createdAt,
      branch: handle.branch ?? null,
      deliveryBranch: handle.deliveryBranch ?? null,
      path: `/forms/${handle.exposeId}`,
      localUrl: this.localFormUrl(handle.exposeId),
    };
  }

  @Get('templates/:formId')
  template(@Param('formId') formIdRaw: string) {
    const formId = Number(formIdRaw);
    const tpl = FORM_TEMPLATES[formId];
    if (!tpl) throw new NotFoundException(`Unknown formId ${formIdRaw}`);
    return { formId, title: tpl.title, fields: tpl.fields };
  }

  @Get(':exposeId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getForm(@Param('exposeId') exposeId: string, @Res() res: Response): void {
    const handle = this.forms.getByExposeId(exposeId);
    if (!handle) {
      res.status(404).send(renderFormGoneHtml());
      return;
    }
    const tpl = FORM_TEMPLATES[handle.formId];
    res.status(200).send(
      renderFormHtml(handle, {
        title: tpl?.title ?? 'Your details',
        action: `/forms/${handle.exposeId}`,
        subtitle:
          'Fill this out and submit — the bot on the call will receive it and continue.',
      }),
    );
  }

  @Post(':exposeId')
  @HttpCode(200)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async postForm(
    @Param('exposeId') exposeId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const handle = this.forms.getByExposeId(exposeId);
    if (!handle) {
      res.status(404).send(renderFormGoneHtml());
      return;
    }

    const values = this.coerceValues(body, req);
    try {
      const submitted = this.forms.submit(exposeId, values);
      if (!submitted) {
        res.status(404).send(renderFormGoneHtml());
        return;
      }
      // Non-blocking open() path: finish Custom LLM already closed — resume via
      // Vapi controlUrl say (or next still-there claims values).
      void this.resume.afterSubmit(handle.conversationId).catch(() => undefined);
      res.status(200).send(
        renderFormThanksHtml({
          title: 'Submitted',
          body: 'Treated as caller submit — the bot should continue on the line.',
          backHref: '/forms/inbox',
          backLabel: 'Back to pending forms',
        }),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not submit the form.';
      res.status(400).send(
        renderFormHtml(handle, {
          title: FORM_TEMPLATES[handle.formId]?.title ?? 'Your details',
          action: `/forms/${handle.exposeId}`,
          error: message,
        }),
      );
    }
  }

  private localFormUrl(exposeId: string): string {
    const port = process.env.PORT ?? '9999';
    return `http://localhost:${port}/forms/${exposeId}`;
  }

  private coerceValues(
    body: Record<string, unknown>,
    req: Request,
  ): FormValues {
    const src =
      body && typeof body === 'object' && Object.keys(body).length
        ? body
        : ((req.body as Record<string, unknown>) ?? {});
    const out: FormValues = {};
    for (const [key, raw] of Object.entries(src)) {
      if (typeof raw === 'string') out[key] = raw;
      else if (raw != null) out[key] = String(raw);
    }
    return out;
  }
}
