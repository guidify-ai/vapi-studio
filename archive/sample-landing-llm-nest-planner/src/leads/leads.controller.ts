import { Body, Controller, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('api/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  async create(
    @Body()
    body: {
      sessionId?: string;
      name?: string;
      email?: string;
      company?: string;
      notes?: string;
      designDraft?: Record<string, unknown> | null;
      messages?: Array<{ role: string; content: string }>;
    },
  ) {
    const sessionId = String(body.sessionId || '').trim();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    if (!sessionId || !name || !email) {
      return { ok: false, error: 'sessionId, name, and email are required' };
    }
    const result = await this.leads.submitQuote({
      sessionId,
      name,
      email,
      company: body.company,
      notes: body.notes,
      designDraft: (body.designDraft || null) as any,
      messages: Array.isArray(body.messages)
        ? body.messages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m.content || ''),
          }))
        : undefined,
    });
    return {
      ok: true,
      id: result.id,
      message:
        'Thanks — Guidify is the only official team for Vapi Studio. We will follow up with a quote shortly.',
    };
  }
}
