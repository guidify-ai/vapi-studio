import { Injectable, Logger } from '@nestjs/common';
import { PlannerLeadMailService } from '../mail/planner-lead-mail.service';

export type OutboundCallInput = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  /** TCPA / marketing consent — required true. */
  consent: boolean;
  notes?: string;
};

export type OutboundCallResult = {
  ok: boolean;
  dialed: boolean;
  callId?: string;
  error?: string;
  normalizedPhone?: string;
  /** Human-readable caller ID (from VAPI_PHONE_NUMBER_READABLE). */
  fromNumberReadable?: string;
};

/** Display string for the number guests will see on caller ID. */
export function outboundFromNumberReadable(): string | undefined {
  const raw = process.env.VAPI_PHONE_NUMBER_READABLE?.trim();
  return raw || undefined;
}

/** US-friendly E.164 normalize; returns null if unusable. */
export function normalizePhoneE164(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\+[1-9]\d{7,14}$/.test(t.replace(/[\s()-]/g, ''))) {
    return t.replace(/[\s()-]/g, '');
  }
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/**
 * Place a Vapi outbound call that runs the same planner Custom LLM assistant,
 * with LP intake seeded in call metadata for Conversation bootstrap.
 */
@Injectable()
export class OutboundCallService {
  private readonly log = new Logger(OutboundCallService.name);

  constructor(private readonly leadMail: PlannerLeadMailService) {}

  async requestCall(input: OutboundCallInput): Promise<OutboundCallResult> {
    const fromNumberReadable = outboundFromNumberReadable();
    const companyName = input.companyName.trim();
    const contactName = input.contactName.trim();
    const contactEmail = input.contactEmail.trim();
    if (!companyName || !contactName || !contactEmail) {
      return {
        ok: false,
        dialed: false,
        fromNumberReadable,
        error: 'companyName, contactName, and contactEmail are required',
      };
    }
    if (!input.consent) {
      return {
        ok: false,
        dialed: false,
        fromNumberReadable,
        error: 'Consent to receive a call is required',
      };
    }
    const phone = normalizePhoneE164(input.phone);
    if (!phone) {
      return {
        ok: false,
        dialed: false,
        fromNumberReadable,
        error: 'Enter a valid phone number (E.164 or 10-digit US)',
      };
    }

    // Always notify Guidify — even if dial fails / Vapi unset.
    await this.leadMail.notifyOutboundCallRequest({
      companyName,
      contactName,
      contactEmail,
      phone,
      notes: input.notes,
    });

    const apiKey = process.env.VAPI_API_KEY?.trim();
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
    const assistantId =
      process.env.POC_ASSISTANT_ID?.trim() ||
      process.env.VAPI_ASSISTANT_ID?.trim();

    if (!apiKey || !phoneNumberId || !assistantId) {
      this.log.warn(
        'Outbound dial skipped — set VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, and POC_ASSISTANT_ID',
      );
      return {
        ok: true,
        dialed: false,
        normalizedPhone: phone,
        fromNumberReadable,
        error: 'vapi_not_configured',
      };
    }

    const metadata = {
      channel: 'phone',
      outbound: true,
      contactName,
      contactEmail,
      guestCompanyName: companyName,
      companyName,
      consentOutboundCall: true,
    };

    try {
      const res = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assistantId,
          phoneNumberId,
          customer: {
            number: phone,
            name: contactName,
          },
          metadata,
          assistantOverrides: {
            variableValues: {
              contactName,
              contactEmail,
              guestCompanyName: companyName,
              companyName,
            },
            metadata,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        this.log.warn(
          `Vapi outbound failed ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
        );
        return {
          ok: false,
          dialed: false,
          normalizedPhone: phone,
          fromNumberReadable,
          error: body.message || body.error || `Vapi HTTP ${res.status}`,
        };
      }
      this.log.log(`Outbound call placed id=${body.id || '?'} to=${phone}`);
      return {
        ok: true,
        dialed: true,
        callId: body.id,
        normalizedPhone: phone,
        fromNumberReadable,
      };
    } catch (err) {
      this.log.warn(`Vapi outbound error: ${err}`);
      return {
        ok: false,
        dialed: false,
        normalizedPhone: phone,
        fromNumberReadable,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
