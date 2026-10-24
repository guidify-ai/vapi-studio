# Vapi account, plans & phones

Live voice requires a [Vapi](https://vapi.ai) organization and `VAPI_API_KEY`.
Studio does not bill you for Vapi — you pay Vapi (and any LLM / carrier you use)
directly. Plan and phone SKUs change; confirm on [vapi.ai/pricing](https://vapi.ai/pricing)
and the Vapi dashboard.

## Plans

| Path | When | Notes |
| --- | --- | --- |
| **Core** (recommended for a first real project) | Builders & early teams shipping a bot people will call | About **$29/mo** success package (confirm on pricing page): **10** concurrent calls, **5** included Vapi phone numbers, 30-day raw retention, ZDR, email support (2 business day SLA) |
| **No success package / free start** | Slow early phase, demos, learning the stack | Usage-based hosting + limited free credits; typically **4** concurrent calls and **1** included Vapi number — easy to outgrow under even light traffic |
| **Pro / Premier** | Scale, SLAs, more orgs / concurrency | See Vapi pricing |

**Guidance:** prefer **Core** for the first customer-facing project so concurrency and included numbers are not the bottleneck on day one. Starting on the free / usage-only tier is fine if you expect a quiet phase — you can **upgrade later** without changing Studio.

Per-minute model / voice / transport costs are separate from the success package.

## Phones

| Path | When | Why |
| --- | --- | --- |
| **Vapi-managed numbers** (recommended for starters / simple projects) | First bot, demos, early teams | One `VAPI_API_KEY` to buy/attach numbers in the dashboard — **no Twilio account, no Trust Hub, no separate carrier verification** for voice |
| **Twilio-imported (BYOK)** | Larger / production projects that need their own carrier, compliance, or SMS scale | Twilio is **paid** and typically needs **verification** (Trust Hub / geo). Use when you outgrow Vapi-included numbers or need Twilio-native SMS ops |

Studio only needs `VAPI_PHONE_NUMBER_ID` (plus assistant + API key). It does not care whether the number was purchased in Vapi or imported from Twilio.

**SMS HTML forms** in this stack still use the optional Twilio dispose adapter for **live** send (`TWILIO_*`, `TWILIO_SMS_DRY_RUN=0`). Starters can keep dry-run SMS while voice runs on a Vapi phone.

## What Studio needs from Vapi

1. Create / select an **assistant** → `POC_ASSISTANT_ID`  
2. Attach a **phone number** → `VAPI_PHONE_NUMBER_ID`  
   - Starter path: **Vapi phone** from the dashboard (included on Core / free allotment)  
   - Scale path: import a **Twilio** number into Vapi when you need BYOK  
3. Put the org **API key** in `.env` → `VAPI_API_KEY`  
4. Point webhook + Custom LLM at your app URLs (see [Quick start](./quick-start.md))

Next: [Quick start](./quick-start.md) · [Creating an app](../building-apps/creating-an-app.md)
