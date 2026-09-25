# Quick start

Clone the public starter, fill credentials for **your** setup, run it.

## 1. Machine prerequisites

- Node **22+**, Yarn 1.x or npm  
- **Docker** + Compose  
- **[ngrok](https://ngrok.com/download)** (HTTPS tunnel for Vapi)  
- Accounts as needed below  

## 2. Credentials (pick your path)

You cannot place live calls with an empty `.env`. Fill what your mode needs:

| | Always for **live voice** | Optional / mode-dependent |
| --- | --- | --- |
| **[Vapi](https://vapi.ai)** (paid) | `VAPI_API_KEY`, `POC_ASSISTANT_ID`, `VAPI_PHONE_NUMBER_ID` | `VAPI_PHONE_NUMBER` (E.164), tool-name overrides |
| **Phone** | A number **in Vapi** linked to that assistant | **Vapi-managed** number *or* **Twilio-imported** BYOK |
| **Twilio** | — | Required for **live SMS forms** and recommended if the Vapi number is Twilio-imported (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`). Leave `TWILIO_SMS_DRY_RUN=1` until ready. |
| **Brain / LLM** | — | Starter defaults to **MockBrain** (no key). For ChatGPT / Claude / Gemini / Grok set the matching key and switch the adapter in code — see [`.env.example`](../../.env.example) (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`). |

**Minimum to dial:** Vapi key + assistant id + phone number id.  
**Minimum to text HTML forms for real:** Twilio (or keep dry-run).  
**Minimum for local graph / health only:** `PROJECT_NAME` + Docker (mock brain, dry-run SMS).

## 3. Clone and configure

```bash
git clone git@github.com:guidify-ai/vapi-studio-project.git my-bot
cd my-bot
cp .env.example .env
```

Edit `.env`:

1. `PROJECT_NAME=…` (`PROJECT_SLUG` optional)  
2. **Vapi** block — required for `yarn start` claim / configure  
3. **Twilio** — only if you use BYOK voice import and/or live SMS  
4. **Brain key** — only if you leave MockBrain  

```bash
yarn install   # stamps agent rules; writes config/project.identity.json
yarn start     # Docker Postgres + app + ngrok → prints URLs
```

## 4. Wire Vapi

Paste the printed URLs into the assistant (or let `scripts/configure-vapi.sh` PATCH them):

| Setting | URL |
| --- | --- |
| Webhook | `{PUBLIC_BASE_URL}/vapi/webhook` |
| Custom LLM | `{PUBLIC_BASE_URL}/vapi/chat/completions` |

Then extend `src/conversation/` and `config/flow.yaml`. Full walkthrough: [Creating an app](../building-apps/creating-an-app.md).

Framework contributors (library, not a bot): clone [vapi-studio](https://github.com/guidify-ai/vapi-studio), `yarn build`, `yarn test` — [Installation](./installation.md).
