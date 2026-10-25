# ARD-0002: Vapi-only North Star

- **Status:** Accepted
- **Date:** 2026-10-24
- **Tags:** framework | adapter | docs | governance

## Context

Studio keeps Vapi wire protocols inside adapters (Constitution I), and parts of
the code and docs use neutral words: `channel`, "channel tools", "provider
ingress", "dispose adapter for the active channel". Read together, these suggest
Studio is a channel-agnostic conversation engine where Vapi is one plug-in among
many (Twilio Voice, other voice-AI platforms, web chat, messaging).

That is not the product. Studio was started to build tools **for Vapi**, every
app built on it runs behind a Vapi assistant, and the tool roadmap (Custom
Transcriber, Voice Profiles, Integrations) is Vapi-specific. Without a written
north star, contributors can reasonably propose "make it work without Vapi"
features that the project would never merge.

## Decision

1. **Vapi is the only voice/agent platform.** Studio is a toolkit for building
   on Vapi. Making Vapi optional or swappable is a non-goal.
2. **Adapters are a cleanliness boundary, not a provider seam.** They keep
   Nodes free of Vapi JSON and absorb Vapi API changes. Ports and types are
   shaped by Vapi's model and are not generalized for hypothetical providers.
3. **"Channel" means a surface of a Vapi conversation**, not a platform:
   - the Vapi call itself (`phone` / `web` call),
   - Vapi-advertised tools (`ChannelTool` = a Vapi `model.tools[]` entry),
   - companion surfaces serving that call (SMS form links, Studio form modal),
   - the Studio web harness (local dev on the same Supervisor).
4. The North Star is recorded at the top of the
   [constitution](../../.specify/memory/constitution.md) and is the first gate
   for SpecKit plans and PR review.

## Consequences

- **Positive:** Clear contribution filter; Vapi features (squads, tools,
  transcriber, voice) can be used directly instead of through a lowest-common-
  denominator abstraction; less surface area to maintain.
- **Negative / trade-offs:** Studio cannot be reused for non-Vapi stacks; a Vapi
  pricing or API shift affects every consumer. Accepted — that is the product.
- **Follow-ups:**
  - Prefer "Vapi call" / "Vapi tool" wording in new docs and JSDoc over neutral
    "channel" / "provider" wording.
  - Existing identifiers (`ChannelTool`, `CHANNEL_META`, `provider_ingress.channel`)
    stay as-is; renaming public exports is not worth a breaking change.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Channel-agnostic engine with Vapi as one adapter | Lowest-common-denominator APIs; hides Vapi features; large speculative surface (violates Constitution IV); not the product's purpose |
| Leave the north star implicit (README tagline only) | Already produced "agnostic channel" drift in docs and design discussions |

## References

- Constitution: North Star, Principles I and IV
- `README.md` (positioning, Tools table)
- `CONTRIBUTING.md` (What belongs here)
- `docs/guide/introduction.md` (What it is not)
