# Example applications

Examples are **NestJS projects under `projects/`** that implement **`@guidify-ai/vapi-studio`**.

| Example | Role | Port | Git |
| --- | --- | --- | --- |
| **`sample-landing-llm`** | **Tracked** Studio **Planner LLM** sample — LP designs the customer agent | **9998** | tracked |
| **`vapi-studio-landing`** | Marketing HTML only; talks to sample via `/studio` | **4173** | gitignored |

Private experimental apps under `projects/` stay gitignored.

The tracked sample exposes the operator surface: `/analytics`, `/flow`, `/studio/conversations/*`, `/{PROJECT_UUID}/vapi/...`.

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:../.."
  }
}
```
