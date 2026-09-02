# Node conventions

Human-readable summary of `.cursor/rules/vapi-studio-agent-steps.mdc`. Agents should follow the rule file in the repo.

## Intention naming

- **Actions:** `is{VerbPast}…` — `isCollectedFirstName`, `isConfirmedAddressMatch`
- **Polarity:** `studio.isPositive`, `studio.isNegative`
- **Framework standard:** `studio.isGoodbye`, `studio.isStillThere`, …

## Node method order

Declare in source in **runtime call order**:

1. `before()` — CAN gate
2. `listen()` — register extract / intentions (before speech completes)
3. `run()`
4. `after()`
5. `catch()` — only when overridden

## Brain (live ChatGPT path)

- No Custom LLM listen-hold before scan
- Scan abort ≤ 3s
- Target first speech < 1.5s after request
- Model in `VapiStudioModule.forRoot({ brain })` or `brain.config.ts` — not `.env`
- `interruptible: false` — queue overlapping POSTs until 3s silence, then one scan
- End of call: `BRAIN_COST_SUMMARY` when usage tracked

## Listed choices

After numbered options, always the same closing question pattern via `listedChoiceQuestion` / `listedChoiceListen` — pick N or neither.

## Integrations

```typescript
await ctx.integrations.request({
  name: 'my-api',
  url: 'https://…',
  body: { … },
  secretEnvKey: 'MY_HMAC_SECRET',  // env KEY name, not the secret value
});
```

JWT HS256 in `x-signature`. Events: `INTEGRATION_REQUEST`, `INTEGRATION_RESPONSE`, `INTEGRATION_ERROR`.

## Shit in, shit out

Do not add Node logic for Vapi stale Custom LLM repeats or “caller repeating previous field.” Unknown / re-ask is enough.

## Related

- [Standard intentions](../reference/standard-intentions.md)
- [Nodes and listens (doctrine)](../best-practices/nodes-and-listens.md)
- [Agents](./agents.md)
