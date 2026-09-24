# Example applications

Examples are **NestJS projects under `projects/`** that implement **`@guidify-ai/vapi-studio`**.

| Example | Role | Port | Git |
| --- | --- | --- | --- |
| **`sample-landing-llm`** | **Tracked** Studio **Planner LLM** sample — LP designs the customer agent | **9998** | tracked |

Private experimental apps under `projects/` stay gitignored.
Compose stubs stay in git; promoted `docker-compose.yaml` does not.

The tracked sample exposes the operator **React SPA**: `/flow`, `/conversations`, plus JSON `/studio/conversations/*` and `/{PROJECT_UUID}/vapi/...`.

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:../.."
  }
}
```
