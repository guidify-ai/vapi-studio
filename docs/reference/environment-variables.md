# Environment variables

Variables the **framework** reads at runtime. Application-specific vars (database URL, `PUBLIC_BASE_URL`, feature flags) belong in **your app** — document them in your app's `.env.example`.

**Brain model and confidence** are set in `VapiStudioModule.forRoot({ brain })` — not env.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | ChatGPT Brain adapter |
| `RA9_CONSOLE_DEBUG` | on | Pretty console forensics |
| `RA9_CONSOLE_DEBUG_ALL` | off | Verbose console |
| `RA9_FILE_LOG` | on | Daily log files |
| `LOG_DIR` | `logs` | Log directory (your app chooses path) |
| `LOG_DAYS` | `14` | Retention |
| `RA9_FORM_ACK_MS` | `15000` | Form deliver ACK window |
| `VAPI_END_CALL_TOOL_NAME` | `end_call_tool` | End-call tool name |
| `VAPI_TRANSFER_CALL_TOOL_NAME` | `transferCall` | Transfer tool name |
| `VAPI_HANDOFF_TOOL_NAME` | `handoff` | Squad handoff tool |
| `VAPI_TRANSFER_DESTINATION` | — | E.164 transfer target |
| `CONFIG_DIR` | app `config/` | Flow + `workflow.yaml` root |

## Related

- [Handbook](../guide/handbook.md)
- [Security](./security.md)
