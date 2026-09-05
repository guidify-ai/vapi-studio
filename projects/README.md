# Projects

```text
vapi-studio/
├── src/                       ← framework
└── projects/
    ├── sample-landing-llm/    ← TRACKED Vapi Studio sample (:9998)
    ├── roofr-poc/             ← gitignored PoC (:9999) — same Studio pattern
    └── vapi-studio-landing/   ← gitignored marketing (:4173) → sample /studio
```

| App | Role | Port | Git |
| --- | --- | --- | --- |
| **`sample-landing-llm`** | Vapi Studio **Planner LLM** sample (LP designs the agent) | **9998** | **tracked** |
| **`roofr-poc`** | Private PoC | **9999** | gitignored |
| **`vapi-studio-landing`** | Marketing site | **4173** | gitignored |

`sample-landing-llm` and `roofr-poc` are the **same kind of app**: `VapiStudioModule`, `flow.yaml`, `/analytics`, `/flow`, `/studio`, Vapi ingress.

Landing is **not** the sample — it only hosts the marketing UI and calls the sample’s `/studio` API.

```bash
cd projects/sample-landing-llm && docker compose up -d --build
# http://127.0.0.1:9998/analytics
# http://127.0.0.1:9998/flow
```

`projects/` is gitignored except `README.md`, `.gitignore`, and **`sample-landing-llm/`**.
