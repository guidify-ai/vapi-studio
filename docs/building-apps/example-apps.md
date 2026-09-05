# Example applications

Examples are **NestJS projects under `projects/`** that implement **`@guidify-ai/vapi-studio`**.

| Example | Role | Port | Git |
| --- | --- | --- | --- |
| **`sample-landing-llm`** | **Tracked** Studio **Planner LLM** sample — LP designs the customer agent | **9998** | tracked |
| **`roofr-poc`** | Larger private voice PoC (same Studio surface) | **9999** | gitignored |
| **`vapi-studio-landing`** | Marketing HTML only; talks to sample via `/studio` | **4173** | gitignored |

Both Studio apps expose the same operator surface: `/analytics`, `/flow`, `/studio/conversations/*`, `/{PROJECT_UUID}/vapi/...`.

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:../.."
  }
}
```
