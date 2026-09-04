# Environment variables

Variables the **framework** reads at runtime. Application-specific vars (database URL, `PUBLIC_BASE_URL`, `PROJECT_UUID`, feature flags) belong in **your app** — document them in your app's `.env.example`.

App identity: **`config/project.identity.json`** (`id` / `slug` / `name`). `PROJECT_UUID` in `.env` is a mirror for operators/compose. App boot upserts the identity into the `projects` table. Never regenerate `id` at runtime.

**Brain model and confidence** are set in `VapiStudioModule.forRoot({ brain })` — not env.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | ChatGPT Brain adapter |
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
| `TWILIO_SMS_DRY_RUN` | on | Prepare mode — persist `OUTBOUND_NOTIFICATION` dry-run; no Twilio API |
| `VAPI_END_CALL_TOOL_NAME` | `end_call_tool` | End-call tool name |
| `VAPI_TRANSFER_CALL_TOOL_NAME` | `transferCall` | Transfer tool name |
| `VAPI_HANDOFF_TOOL_NAME` | `handoff` | Squad handoff tool |
| `VAPI_TRANSFER_DESTINATION` | — | E.164 transfer target |
| `VAPI_DASHBOARD_CALL_URL` | `https://dashboard.vapi.ai/call/{callId}` | Debug UI link to Vapi call (`{callId}` = `provider_call_id`) |
| `CONFIG_DIR` | app `config/` | Flow + `workflow.yaml` root |

## Related

- [Runtime API](./runtime-api.md)
- [Security](./security.md)
