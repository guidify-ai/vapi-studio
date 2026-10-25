# Text the form, keep the call: collecting caller details by SMS mid-call

- **Status:** Draft
- **Applies to:** Vapi Studio 0.2.0
- **Tested variant:** self-hosted HTML form + Twilio SMS + Vapi Live Call Control

## The short version

Voice is good at decisions and terrible at data. "Yes, book it" takes one turn.
"My email is m-a-r-k dot p at…" takes four, and one of them is wrong.

Vapi Studio has a pattern for this that we run on real calls: the assistant
asks permission, **texts the caller a short form while the call stays open**,
waits, and the moment the form is submitted it **speaks again on its own** —
"I received your form. I have name …, email …, address …. Does that look
correct?" One "yes" and the call moves on. The caller types the hard parts on
the screen in their hand; the voice agent does what voice is good at.

The form can be anything — Studio's own HTML page, a page with as much
JavaScript as you like, Google Forms, Formester, or your own form service. The
only contract is: a link Studio can text, and an HTTP callback when the form is
submitted.

## Why voice-only collection hurts

Every voice agent eventually needs a name, an email and an address. By voice,
each one is a small negotiation:

- **Spelling.** Speech recognition hears "Pyskunov" four different ways. Emails
  arrive as "mark at example dot com" and must be reassembled and read back.
- **Addresses.** Callers pause mid-address to remember the postal code; the
  agent has to wait without cutting them off, then confirm every part.
- **Read-backs.** Every field needs "I heard X — is that correct?", and every
  "no" restarts that field.

Four fields become eight to twelve turns of the least pleasant part of the
call. A form turns them into one turn: "Here's what I got — correct?"

## How the call goes

```text
Caller   I need an estimate for my roof.
Bot      Is it okay if I text you a short form for your details?
Caller   Yes.
Bot      Is the phone you are calling from suitable to receive a text? Say yes
         if that works, or give me a different mobile number.
Caller   Yes, it is.
Bot      I texted a short form link to your phone. Please open it, fill it out,
         and stay on the line. I will wait. Take your time with the form.
         If you did not get the text, just say so.
         … caller fills the form on their phone, still on the call …
Bot      I received your form. I have name …, email …, address ….
         Does that look correct, or should I fix something?
Caller   Yes, that's correct.
Bot      Thanks — your details are confirmed. Are you calling about an existing
         project we have on file, or a new project?
```

That is a real call (the roofing-estimate assistant built on Studio, October
2026), with the caller's details removed. The bot's line after the form was not
a reply to anything the caller said — it was triggered by the form submit.

### The parts that make it feel good

These came from real calls, not from a whiteboard:

| Moment | What the assistant does | Why |
| --- | --- | --- |
| Before texting | Asks permission, one question | Texting a stranger's phone unasked is rude and, in many places, regulated |
| Which number | Offers the number they are calling from first | One "yes" instead of dictating ten digits |
| After texting | Says it once, then **waits quietly** | Callers fill faster when they are not being talked at |
| Silence while filling | The "are you still there?" check **does not hang up** while a form is open | Typing an address takes longer than any silence timeout |
| "I didn't get it" | Resends the same link, then asks "did you get it this time?" — one question, not a list of instructions | Up to two resends |
| Form submitted | The bot speaks first, reads the details back, asks one question | The caller should not have to say "done" |
| Something is wrong | "Which should I fix — first name, last name, email, or address?" then just that field, by voice | Fixing one field by voice is fine; re-filling the form is not |
| Form never arrives | One offer: "Is it okay if we finish your details by voice?" | Always a way forward, never a dead end |
| Caller asks for a person | One re-engage; if they stay, the call returns to the question it was on | Re-engaging must not lose the caller's place |

## What was tested

- **Real call.** The October 2026 sign-off call on the roofing assistant, on a
  Vapi phone number with live Twilio SMS, went through every step: consent →
  caller-ID number → text sent → form filled on the phone during the call →
  bot spoke the details unprompted → confirmed. The text, the callback and the
  read-back worked on the first try, and the caller confirmed in one turn.
- **Framework tests** (`node:test`, no network): form sendout and delivery
  events, delivery timeout, resend with the same form id, HTML rendering and
  escaping; Twilio delivery in dry-run, E.164-only numbers, required SMS text,
  and the default link built from `PUBLIC_BASE_URL`.
- **Project tests**: the full scripted call from greeting to confirmed
  details (`estimate-flow.mock.test.mjs`), expose → render → submit
  (`html-form.test.mjs`), and the talk-to-human re-engage returning to the
  question the caller was on (`transfer-reengage.mock.test.mjs`).
- **Not tested on calls:** Google Forms and Formester. The recipes below follow
  their documented features; treat them as starting points until you have run
  them on your own calls.

## How it is built

| Part | Who owns it | What it does |
| --- | --- | --- |
| `ctx.forms.open()` | Studio | Registers the form, calls the delivery adapter, waits for delivery (default 15 s), then lets the call turn finish so the voice keeps talking |
| `TwilioSmsFormDisposeAdapter` | Studio | Texts the link; dry-run by default; E.164 numbers only; your SMS wording (`{formUrl}` placeholder) |
| `forms.submit()` / `claimSubmitted()` | Studio | Accepts values (required fields enforced), parks them until the Node claims them |
| `forms.resend()` | Studio | Re-sends the same open form |
| Events | Studio | `FORM_SENDOUT`, `FORM_DELIVERED`, `FORM_SUBMITTED`, `FORM_RESENT`, `FORM_DELIVER_TIMEOUT`, `FORM_FILLOUT_TIMEOUT`, `OUTBOUND_NOTIFICATION` — every step is visible in logs and analytics |
| The form page | **Your app** | Any page, any engine |
| The submit callback | **Your app** | HTTP endpoint → `forms.submit()` |
| Speaking after submit | **Your app** | Runs the Node with the claimed values and speaks through Vapi Live Call Control (`controlUrl`, `type: "say"`) — about 100 lines in the roofing project's `FormResumeService` |
| Copy, retries, fallback | **Your app** | What the bot says, how many resends, when to fall back to voice |

Why `open()` and not a blocking wait: Vapi's Custom LLM request is a stream. If
the server holds it open for the minutes a caller spends typing, speech gets
cut off and the call can hit its silence timeout. `open()` sends the text,
speaks, **ends the turn**, and the submit callback starts a new one.

### The Node

```ts
await ctx.forms.open({
  formId: IDENTITY_FORM_ID,
  branch: 'identity_html_form',
  fields: IDENTITY_FORM_FIELDS, // firstName, lastName, email, address
  disposeContext: {
    contactPhone: '+15550100999', // E.164
    body: 'Please fill out this short form: {formUrl}',
    // formUrl: optional — your own engine's link (see below)
  },
  onDelivered: async () => {
    await ctx.output.say('I texted a short form link to your phone.');
    await ctx.output.say('Please open it, fill it out, and stay on the line. I will wait.');
  },
});
return ctx.output.sayAndListen(
  'Take your time with the form. If you did not get the text, just say so.',
  formWaitListen(),
);
```

On the next run of the same Node, `ctx.forms.claimSubmitted()` returns the
values; the Node stores them and asks the one confirmation question.

### The callback

Whatever engine you use, the submit ends up here:

```ts
@Post('form-callbacks/:engine')
async onSubmit(@Body() body: unknown) {
  const { conversationId, values } = mapEngineBody(body); // engine-specific
  const pending = this.forms.getPending(conversationId);
  if (!pending) return { ok: false }; // expired, already used, or unknown
  this.forms.submit(pending.exposeId, values); // throws on missing required fields
  void this.resume.afterSubmit(conversationId); // bot speaks on the live call
  return { ok: true };
}
```

`values` must use your field names (`firstName`, `email`, …). Answer quickly —
the resume runs in the background.

## Pick a form engine

The engine only has to do two things: open from a link that carries a
reference back to the call, and call your server when submitted. For external
engines the reference is the conversation id (`ctx.runtime.conversationId`),
which your Node knows when it builds the link; the callback turns it back into
the open form with `forms.getPending(conversationId)`.

| Engine | Carries the call reference | Submit callback | Status |
| --- | --- | --- | --- |
| Self-hosted HTML | In the URL path (`/forms/{exposeId}`) | Your own `POST` | **Tested on real calls** |
| Google Forms | Pre-filled answer (`entry.<id>=…`) — visible to the caller | Apps Script `onFormSubmit` trigger → `UrlFetchApp` POST | Recipe |
| Formester | Hidden field filled from a URL parameter | Built-in webhook (`Submission.Created`) | Recipe |

### 1. Self-hosted HTML (tested)

The default. The texted link is `{PUBLIC_BASE_URL}/forms/{exposeId}` and your
app serves both the page and the `POST`. Studio gives you `renderFormHtml()`
(fields from JSON, escaped labels, your copy and `lang`) plus thanks and
"link expired" pages — or render your own.

Because the page is yours, it can be anything a browser can run: input masks,
address autocomplete, validation, prefilled values you already know, a file
upload, a signature pad, several steps. Extract and clean data in the browser
with JavaScript, then post plain field values. Nothing leaves your
infrastructure except the SMS itself.

**Choose it when:** you want the best experience, full control, and caller data
on your own servers.

### 2. Google Forms

Google Forms has no hidden fields and no built-in webhook, but it can do both
jobs:

- **Reference:** add a short-answer question "Reference (please leave as is)"
  and build a pre-filled link for it: `…/viewform?usp=pp_url&entry.123456=<conversationId>`
  (Form menu → *Get pre-filled link* shows the `entry.` id). Pass the link as
  `disposeContext.formUrl`.
- **Callback:** an Apps Script bound to the form with an installable *On form
  submit* trigger posts each response to your server:

```js
// Extensions → Apps Script. Triggers → Add trigger → onSubmit / From form / On form submit.
// Script properties: CALLBACK_URL, CALLBACK_SECRET.
function onSubmit(e) {
  const props = PropertiesService.getScriptProperties();
  const answers = {};
  e.response.getItemResponses().forEach((r) => {
    answers[r.getItem().getTitle()] = r.getResponse();
  });
  UrlFetchApp.fetch(props.getProperty('CALLBACK_URL'), {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Callback-Secret': props.getProperty('CALLBACK_SECRET') },
    payload: JSON.stringify({ answers }),
    muteHttpExceptions: true,
  });
}
```

Your callback maps question titles to field names and reads the reference.
Use the Apps Script trigger, not the Forms API `watches`: watches deliver to
Cloud Pub/Sub, carry no answers, and Google documents delivery as "usually
within minutes" — too slow for someone waiting on the line.

**Choose it when:** the team already lives in Google Workspace and a visible
reference field is acceptable.

### 3. Formester

[Formester](https://formester.com) covers both jobs out of the box:

- **Reference:** add a field named `ref`, hide it (eye icon), and pass the link
  with `?ref=<conversationId>` as `disposeContext.formUrl`. Formester fills
  fields from URL parameters whose names match the field label exactly.
- **Callback:** *Automate → Webhooks → Add Webhook*, your endpoint, event
  *Submission.Created*. Each submission is POSTed as JSON with values keyed by
  field label, hidden fields included. Use *Test Webhook* to see the exact
  payload before writing the mapper.

Protect the endpoint with a long random token in the webhook URL, and accept a
submission only when its `ref` matches a form that is still open.

**Choose it when:** you want a hosted form builder that non-engineers can edit,
with callbacks built in.

## Trade-offs and limits

- **Open forms live in memory.** The app instance that texted the form must
  receive its callback; a restart forgets open forms and the caller gets the
  "link expired" page. Run a single instance or route callbacks to the
  instance that owns the call.
- **The caller needs a phone that can open a link mid-call.** Most smartphones
  can; the voice fallback covers the rest.
- **SMS is regulated.** Ask before texting (the pattern does), and register your
  sender where required (for example US A2P 10DLC). Studio does not guess a
  country: numbers must be E.164.
- **Third-party engines hold caller data.** Google Forms and Formester store the
  answers on their side; self-hosted keeps them on yours.
- **Fill-out time.** Forms expire after 10 minutes by default
  (`filloutTimeoutMs`).

## LinkedIn post

```text
Voice agents are great at decisions and painful at data.

"Yes, book it" is one turn. "My email is m-a-r-k dot p at…" is four turns, and one of them is wrong. Names get misspelled, addresses get cut off mid-postal-code, and every field needs a read-back.

So in Vapi Studio we stopped asking callers to dictate. The assistant asks if it can text a short form, sends it to the number they're calling from, and stays on the line. The caller types on the phone in their hand. The moment they hit submit, the assistant speaks on its own: "I received your form. I have your name, email and address. Does that look correct?" One "yes", and the call moves on.

Small details make it feel human: it waits quietly instead of nagging, the "are you still there?" check never hangs up while a form is open, "I didn't get it" resends the same link, and if the text never arrives there's one offer to finish by voice.

This runs on real calls today with a self-hosted form and Twilio SMS. And the form can be anything: your own page with as much JavaScript as you like, Google Forms, or Formester. Studio needs a link to text and an HTTP callback on submit.

Article with the recipes: https://github.com/guidify-ai/vapi-studio/blob/master/docs/articles/sms-form-during-the-call.md
#Vapi #VoiceAI #ConversationDesign #NestJS #OpenSource
```

## Related

- [Forms guide](../guide/forms.md) — `open` / `expose` / `resend`, Twilio env, events
- [Identity and PII](../best-practices/identity-and-pii.md) — consent, one CTA, voice fallback
- [Conversation design](../best-practices/conversation-design.md)
