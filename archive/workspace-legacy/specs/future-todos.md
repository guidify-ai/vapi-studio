# Future todos (post-PoC)

Parking lot. Do **not** implement these in the current Vapi Custom LLM MVP unless a live-call happy path is blocked. Evidence so far: ASR garbage is **shit in, shit out** for RA9 — we do not special-case Vapi transcripts as conversation meaning.

---

## FT-001 — Vapi Custom Transcriber (own STT / context)

**Logged**: 2026-08-18  
**Why**: Live calls mangle names and addresses (`Pyskunov. It is P Y S K U N O V` → `k u m OV.`; `it is 1 2 3 Main Street…` → `Place 1 2 3…`). Server URL / conversation events are **post-transcription only** — no raw audio.

**What Vapi supports**: Custom Transcriber. Set the assistant `transcriber.provider` to `custom-transcriber` with our WebSocket URL. Vapi then:

1. Sends start: `{"type": "start", "encoding": "linear16", "container": "raw", "sampleRate": 16000, "channels": 2}`
2. Streams continuous binary PCM (2 channels — customer / assistant)
3. Expects: `{"type": "transcriber-response", "transcription": "...", "channel": "customer", "transcriptType": "final"}` (or `"partial"`)

That **replaces Deepgram**. We run Whisper, a keyword-boosted provider, etc., and inject domain vocabulary (names, streets, Roofr terms) that Vapi’s default path is not passing through.

**Practical constraints**

- Real-time streaming only. Buffering and late finals will hurt live-call latency (first speech still must stay snappy).
- Auth via `credentialId` (Bearer / OAuth2 / HMAC) or legacy secret header.
- Must not confuse this with the Server URL events page (webhooks after ASR).

**Do this first (lighter than a full pipeline)**

Check whether the pain is “no bring-your-own STT” vs “Vapi’s built-in Deepgram block does not expose keywords / keyterm / model / language.” If Deepgram already has keyword/context fields in the assistant transcriber config, try that before building a custom-transcriber WebSocket.

**Not in MVP.** When we pick this up: new spec + tasks; keep RA9 Nodes free of STT wire protocol (adapter-owned).
