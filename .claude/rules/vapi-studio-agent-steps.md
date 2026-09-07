---
paths:
  - "**/conversation/nodes/**/*.ts"
  - "src/node/**/*.ts"
  - "projects/**/config/flow.yaml"
  - "projects/**/config/poc/*.brain.yml"
---

# Vapi Studio agent-step conventions

## Intention naming

- **Actions**: `is{VerbInPast}…` — e.g. `isCollectedFirstName`, `isAcceptedAppointment`
- **Polarity**: `studio.isPositive`, `studio.isNegative`
- **Multi-choice**: soft affirmatives that do not name an option → `resolveIntention` re-ask which lane; never Brain/unknown

## Brain (stock adapters)

- Live calls MUST be fast: scan abort ≤ 3s; target first speech < 1.5s.
- Cheap model is set in `VapiStudioModule.forRoot({ brain: { model } })`, not `.env`.
- Scan candidates = listen intentions + portal intentions + `studio.isUnknownTransition`.

## TypeScript style (framework + apps)

- **Explicit access modifiers** on every class member: `public`, `protected`, or `private` — no default (implicit public).
- **Typed properties** — declare types on class fields (`public phase: IntentionCascadePhase = …`), not untyped inference.
- Enforced in the framework via `yarn lint` (`@typescript-eslint/explicit-member-accessibility`, `@typescript-eslint/typedef`).

## Lifecycle method order

`before()` → `listen()` → `run()` → `after()` → `catch()`

```ts
export class ExampleStep extends AgentNode<Schema> {
  public async before(ctx): Promise<boolean> { /* … */ }
  public async listen(ctx): Promise<ListenExpectation | null> { /* … */ }
  public async run(ctx): Promise<NodeResult> { /* … */ }
}
```

Full rules: `docs/guides/node-conventions.md` and `docs/best-practices/`.
