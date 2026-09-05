# Projects

```text
vapi-studio/
├── src/                       ← framework
└── projects/
    ├── sample-landing-llm/    ← TRACKED Vapi Studio sample (:9998)
    └── vapi-studio-landing/   ← gitignored marketing (:4173) → sample /studio
```

| App | Role | Port | Git |
| --- | --- | --- | --- |
| **`sample-landing-llm`** | Vapi Studio **Planner LLM** sample (LP designs the agent) | **9998** | **tracked** |
| **`vapi-studio-landing`** | Marketing site | **4173** | gitignored |

Private / experimental apps under `projects/` stay **gitignored** — never commit them.

`sample-landing-llm` is the reference app shape: `VapiStudioModule`, `flow.yaml`, `/analytics`, `/flow`, `/studio`, Vapi ingress.

Landing is **not** the sample — it only hosts the marketing UI and calls the sample’s `/studio` API.

```bash
cd projects/sample-landing-llm && yarn start
# http://127.0.0.1:9998/analytics
# http://127.0.0.1:9998/flow
```

`projects/` is gitignored except `README.md`, `.gitignore`, and **`sample-landing-llm/`**.
