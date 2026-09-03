# Vapi Studio best practices

Opinionated guides for **deterministic voice agents** on `@guidify-ai/vapi-studio` (**Vapi Studio**). These are **framework-owned** — every app that installs the package should treat them as the default conversation-design doctrine unless a project README explicitly overrides a rule.

## For CLI / coding agents

1. Read this index, then open the guide that matches the change.
2. Prefer these rules over improvising prompt/node structure.
3. When a project README’s northern stars conflict, the **project** wins for product goals; these guides win for **how** to structure turns, nodes, and extracts.

| Guide | Use when |
| --- | --- |
| [Conversation design](./conversation-design.md) | Writing or changing what the bot says / asks |
| [Nodes and listens](./nodes-and-listens.md) | Adding Nodes, `listen()`, extract, `continueTo` |
| [Identity and PII](./identity-and-pii.md) | Names, phones, email, forms, consent |
| [Brain and prompt injection](./brain-and-prompt-injection.md) | Untrusted caller speech, Brain allowlists, no spoken jailbreaks |
| [Debugging and observability](./debugging-and-observability.md) | Call forensics — logs/events must explain any turn |
| [Documentation layers](./documentation-layers.md) | Updating READMEs / agent refs |

## Canonical paths

After install, from an app root:

```text
node_modules/@guidify-ai/vapi-studio/docs/best-practices/
node_modules/@guidify-ai/vapi-studio/agent/AGENTS.md
```

In the **vapi-studio** repository:

```text
docs/best-practices/     ← these guides
docs/README.md           ← doc site index
agent/AGENTS.md
README.md                ← handbook (runtime contracts)
```
