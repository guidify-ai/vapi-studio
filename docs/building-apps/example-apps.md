# Example applications

Examples are **separate NestJS apps** that depend on **`@guidify-ai/vapi-studio`**.

| Example | Role | Port | Location |
| --- | --- | --- | --- |
| **sample-landing-llm** | Public Planner LLM showcase | **9998** | [guidify-ai/vapi-studio-sample-landing-llm](https://github.com/guidify-ai/vapi-studio-sample-landing-llm) |

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "0.1.0"
  }
}
```

The sample exposes the operator **React SPA**: `/flow`, `/conversations`, plus `/{PROJECT_UUID}/vapi/...`.
