# Environment variables

Variables the **framework** reads at runtime. Application-specific vars (database URL, `PUBLIC_BASE_URL`, Vapi outbound ids) belong in **your app** — start from the package [`.env.example`](../../.env.example) (presets for Brain providers, Twilio, Vapi tools, optional event broker).

App identity: **`config/project.identity.json`** (`slug` / `name`). App boot upserts a local `projects` row for DB FKs. Vapi ingress is host-scoped (`/vapi/...`) — each fork has its own `PUBLIC_BASE_URL` / port.

**Brain adapter class** is selected in `VapiStudioModule.forRoot({ brainAdapter })` (or your app’s `brain.config.ts`). Secrets stay in env:

| Provider | Adapter | Env |
| --- | --- | --- |
| ChatGPT | `ChatGptBrainAdapter` | `OPENAI_API_KEY` |
| Claude | `ClaudeBrainAdapter` | `ANTHROPIC_API_KEY` |
| Gemini | `GeminiBrainAdapter` | `GOOGLE_API_KEY` (alias `GEMINI_API_KEY`) |
| Grok | `GrokBrainAdapter` | `XAI_API_KEY` |
| Mock | `MockBrainAdapter` / `Mock*BrainAdapter` | none |

**Brain model and confidence** are set in `VapiStudioModule.forRoot({ brain })` — not env.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | ChatGPT Brain adapter |
| `ANTHROPIC_API_KEY` | — | Claude Brain adapter |
| `GOOGLE_API_KEY` | — | Gemini Brain adapter (alias: `GEMINI_API_KEY`) |
| `XAI_API_KEY` | — | Grok Brain adapter |
| `STUDIO_CONSOLE_DEBUG` | on | Pretty console forensics |
| `STUDIO_CONSOLE_DEBUG_ALL` | off | Verbose console |
| `STUDIO_FILE_LOG` | on | Daily log files |
| `LOG_DIR` | `logs` | Log directory (your app chooses path) |
| `LOG_DAYS` | `14` | Retention |
| `STUDIO_FORM_ACK_MS` | `15000` | Form deliver ACK window |
| `TWILIO_ACCOUNT_SID` | — | Twilio SMS form dispose (with `TwilioSmsFormDisposeAdapter`) |
| `TWILIO_AUTH_TOKEN` | — | Twilio auth token |
| `TWILIO_FROM_NUMBER` | — | E.164 from-number (or use messaging service sid) |
| `TWILIO_MESSAGING_SERVICE_SID` | — | Alternative to `TWILIO_FROM_NUMBER` |
| `TWILIO_SMS_DRY_RUN` | on | Prepare mode — emit `OUTBOUND_NOTIFICATION` dry-run; no Twilio API |
| `PUBLIC_BASE_URL` | — | App HTTPS origin; Twilio SMS dispose uses `{PUBLIC_BASE_URL}/forms/{exposeId}` when `disposeContext.formUrl` is omitted |
| `VAPI_END_CALL_TOOL_NAME` | `end_call_tool` | End-call tool name (snake_case in `.env.example`) |
| `VAPI_TRANSFER_CALL_TOOL_NAME` | `transfer_call` | Transfer tool name (`.env.example`; live apps may still use Vapi’s `transferCall`) |
| `VAPI_HANDOFF_TOOL_NAME` | `handoff` | Squad handoff tool |
| `VAPI_TRANSFER_DESTINATION` | — | E.164 transfer target |
| `VAPI_DASHBOARD_CALL_URL` | `https://dashboard.vapi.ai/call/{callId}` | Debug UI link to Vapi call (`{callId}` = `provider_call_id`) |
| `CONFIG_DIR` | app `config/` | Flow + `workflow.yaml` root |

Nest / TypeORM / RxJS peers (and optional Twilio) are **exact versions** on the
package — see `package.json` / [CONTRIBUTING.md](../../CONTRIBUTING.md). Do not
float them with `^` in apps that consume Studio.

### App-owned (documented in `.env.example`, not read by the framework core)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | App Postgres |
| `PUBLIC_BASE_URL` / `PORT` | Public host + listen port (ngrok) |
| `PROJECT_NAME` / `PROJECT_SLUG` | Human identity → `project.identity.json` |
| `VAPI_API_KEY` / `VAPI_PHONE_NUMBER_ID` / `POC_ASSISTANT_ID` | Outbound dial / telephony — **required** empty slots in app `.env.example` (client must have Vapi access; **Vapi is paid**) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | **Twilio only for now**; same account that owns the Vapi-imported FROM number. Trust Hub must allow +1; keep ~$30 balance (auto-recharge near $10 recommended). Other carriers later. |
| `STUDIO_EVENTS_REDIS_URL` / `STUDIO_EVENTS_REDIS_STREAM` | Optional event broker for `onStudioEvent` fan-out |
| `EVENT_STORE_DATABASE_URL` | Optional durable store for your event consumer |

Event export / remote sinks are application-owned — not framework wiring.
See [Extending events](../guides/extending-events.md) · [Events & logging](./events-and-logging.md).

- [Runtime API](./runtime-api.md)
- [Security](./security.md)
