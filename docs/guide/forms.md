# Forms

Structured collection outside the voice channel — SMS links, Studio modals, first-party HTML.

## API surface (`ctx.forms`)

| Method | Use when |
| --- | --- |
| `expose(spec)` | **Blocking** — holds the channel turn until submit (Flow Studio modal) |
| `open(spec)` | **Non-blocking** — deliver + speak, finish SSE turn, wait for submit later (live Vapi) |
| `resend()` | Caller did not receive SMS/link — re-run dispose on same `exposeId` |
| `claimSubmitted()` | Take values after `open()` submit |
| `hasPending()` | Open expose awaiting submit (ghosting must no-op) |
| `hasUnclaimedSubmit()` | Submitted but not yet claimed |

## Dispose adapter

Apps provide `FormDisposeAdapter`:

```typescript
@Injectable()
export class LinkFormDisposeAdapter implements FormDisposeAdapter {
  readonly id = 'studio-first-party-html';
  readonly branch = 'html_link';  // delivery lane for forensics

  async dispose(payload: FormDisposePayload): Promise<void> {
    // Publish URL, send SMS, open Studio modal…
    forms.ack(payload.exposeId);
  }
}
```

`disposeContext` on expose is opaque app data (e.g. `contactPhone`, `channel`) stored for `resend()`.

### Twilio SMS (prepared)

Framework ships `TwilioSmsFormDisposeAdapter` (`branch: sms`). Wire it when you want SMS link delivery:

```ts
VapiStudioModule.forRoot({
  formDisposeAdapter: TwilioSmsFormDisposeAdapter,
  // …
})
```

Reserved env (default **dry-run on** — no live Twilio calls until you opt in):

| Variable | Purpose |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Account SID |
| `TWILIO_AUTH_TOKEN` | Auth token |
| `TWILIO_FROM_NUMBER` | E.164 from-number **or** |
| `TWILIO_MESSAGING_SERVICE_SID` | Messaging Service SID |
| `TWILIO_SMS_DRY_RUN` | Default `1` — still emits durable `OUTBOUND_NOTIFICATION` (`status: dry_run`) and ACKs without API. Set `0` for live send (requires peer package `twilio`) |

Each send (dry-run or live) goes through `EventService.persist` → listeners → Postgres `conversation_events` as `OUTBOUND_NOTIFICATION`. Failures emit `OUTBOUND_NOTIFICATION_ERROR`.

`disposeContext` for this driver:

```ts
disposeContext: {
  contactPhone: '5550100999', // or E.164 / `to` / `phone`
  formUrl: `${process.env.PUBLIC_BASE_URL}/forms/${exposeId}`,
  // body?: 'optional custom SMS text'
}
```

## Events

| Event | When |
| --- | --- |
| `FORM_SENDOUT` | Early — branch + delivery lane before ACK |
| `FORM_EXPOSE` / `FORM_DELIVERED` | Adapter delivered |
| `FORM_RESEND` / `FORM_RESENT` | Caller never got link |
| `FORM_SUBMITTED` | Values received |
| `FORM_DELIVER_TIMEOUT` / `FORM_FILLOUT_TIMEOUT` | Timeouts |

## HTML helpers

- `renderFormHtml(handle)` — JSON fields → fillable page
- `renderFormThanksHtml()` / `renderFormGoneHtml()`

Apps own HTTP routes (`GET/POST /forms/:exposeId`). Document routes in the application repository.

## Timeouts

- **ACK** — `STUDIO_FORM_ACK_MS` (default 15s) after dispose
- **Fillout** — `filloutTimeoutMs` on expose spec (open path timer)

## Doctrine

- Form fail → **one CTA**: voice fallback
- “Didn’t get text” → resend + “did you get it this time?” — not stacked with fill prompts

Full rules: [Identity and PII](../best-practices/identity-and-pii.md)

## Related

- [Handbook](./handbook.md) — full forms section in package README
- [Identity and PII](../best-practices/identity-and-pii.md)
