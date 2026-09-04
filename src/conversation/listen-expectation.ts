/**
 * Listen registration — opened before Node speech so interrupts still bind to it.
 * Guides Brain intention scan + optional field extraction + ASR/LLM hints.
 */
export interface ListenIntentionBoost {
  /** Intention name to prioritize (e.g. isAcknowledge, studio.isGoodbye). */
  name: string;
  /**
   * Extra weight for Brain scoring (hint only — does not change Supervisor walk order).
   * Higher = more preferred by the scanner. Default when listed: 10.
   */
  boost?: number;
  /**
   * Supervisor walk order among scored intentions. Higher is tried first.
   * Default 1. Tie-break: intention name A–Z.
   */
  priority?: number;
}

/**
 * Field the Brain should pull from the next user utterance.
 * App writes memory itself via `onExtracted` — no framework auto-target.
 */
export interface ListenExtractField {
  /** Key in Brain JSON `extracted` object (e.g. "firstName"). */
  key: string;
  /** Helps LLM extraction. */
  description?: string;
  type?: 'string' | 'number' | 'boolean';
  /** If true and missing, extraction is incomplete (logged; routing still proceeds). */
  required?: boolean;
}

/** Context passed to the sayAndListen extract callback. */
export interface ListenExtractApplyContext {
  memory: Record<string, unknown>;
  variables: Record<string, unknown>;
  userText: string;
}

/**
 * App-owned handler: Brain returns `extracted`, you set memory/variables yourself.
 */
export type ListenExtractHandler = (
  extracted: Record<string, unknown>,
  ctx: ListenExtractApplyContext,
) => void | Promise<void>;

/** Closed-set cheap match before Brain (listed options: pick N / neither). */
export type ListenResolveIntention = (input: {
  userText: string;
  memory: Record<string, unknown>;
}) => string | null | Promise<string | null>;

/**
 * Extract registration for the next answer:
 * - `fields` tell Brain what to pull
 * - `onExtracted` lets the Node write memory (required for applying values)
 */
export interface ListenExtractSpec {
  fields: ListenExtractField[];
  onExtracted?: ListenExtractHandler;
}

export interface ListenExpectation {
  /** Intentions this Node expects / wants Brain to prioritize. */
  intentions: ListenIntentionBoost[];
  /**
   * Hints for Brain/ops: what the user might mean if ASR is messy.
   * Valuable context for LLM intention scanning.
   */
  hints?: string[];
  /** Optional free-form operator note. */
  note?: string;
  /** Structured extraction for the next user answer (fields + apply callback). */
  extract?: ListenExtractSpec;
  /**
   * Seconds the channel waits after a user pause before closing this listen.
   * Omit to use the Node class `listenTimeoutSeconds` (framework default 2.5).
   */
  timeoutSeconds?: number;
  /**
   * When false, overlapping Custom LLM POSTs are queued until this listen's
   * timeout of silence after the last fragment. Default true (barge-in).
   */
  interruptible?: boolean;
  /**
   * Cheap closed-set match **before** Brain scan. If this returns an intention
   * name that is on this listen, Supervisor skips OpenAI and walks that
   * intention at confidence 1. Return null to fall through to Brain (portals,
   * unknown, free-form). Use after the bot listed numbered options.
   */
  resolveIntention?: ListenResolveIntention;
}

/** Options passed to `sayAndListen` — especially extraction for the next answer. */
export interface SayAndListenOptions {
  /**
   * Ask Brain for fields, then run `onExtracted` so the Node sets memory itself.
   *
   * @example
   * sayAndListen("What's your first name?", {
   *   extract: {
   *     fields: [{ key: 'firstName', type: 'string', required: true }],
   *     onExtracted: (data) => { ctx.memory.callerName = String(data.firstName ?? ''); },
   *   },
   * })
   */
  extract?: ListenExtractSpec;
  /** If set, replaces listen intentions for the next turn. */
  intentions?: ListenIntentionBoost[];
  hints?: string[];
  note?: string;
  /** Per-turn listen window; wins over `listen()` and the Node class default. */
  timeoutSeconds?: number;
  /** Per-turn barge-in; wins over Node class `interruptible`. */
  interruptible?: boolean;
  /** Per-turn closed-set matcher; wins over `listen()`. */
  resolveIntention?: ListenResolveIntention;
}

export function applyListenBoosts(
  candidates: Array<{ name: string; rank: number; payload?: unknown }>,
  listen: ListenExpectation | null | undefined,
): Array<{ name: string; rank: number; payload?: unknown }> {
  if (!listen?.intentions?.length) {
    return candidates;
  }
  const boostByName = new Map(
    listen.intentions.map((i) => [i.name, i.boost ?? 10]),
  );
  return candidates.map((c) => {
    const boost = boostByName.get(c.name);
    if (boost == null) {
      return c;
    }
    return {
      ...c,
      rank: c.rank - boost,
      payload:
        typeof c.payload === 'object' && c.payload
          ? { ...(c.payload as object), listenBoost: boost }
          : { listenBoost: boost },
    };
  });
}

/**
 * Merge `sayAndListen` options into the listen registered by `node.listen()`.
 * Extract spec on sayAndListen wins for the upcoming user answer.
 */
export function mergeSayAndListenOptions(
  current: ListenExpectation | null | undefined,
  options: SayAndListenOptions | undefined,
): ListenExpectation | null {
  if (!options) {
    return current ?? null;
  }
  const base: ListenExpectation = current ?? { intentions: [] };
  return {
    intentions: options.intentions ?? base.intentions,
    hints: options.hints ?? base.hints,
    note: options.note ?? base.note,
    extract:
      options.extract !== undefined ? options.extract : base.extract,
    timeoutSeconds:
      options.timeoutSeconds !== undefined
        ? options.timeoutSeconds
        : base.timeoutSeconds,
    interruptible:
      options.interruptible !== undefined
        ? options.interruptible
        : base.interruptible,
    resolveIntention:
      options.resolveIntention !== undefined
        ? options.resolveIntention
        : base.resolveIntention,
  };
}

/**
 * Run a listen's cheap matcher. Returns an intention name only when it is
 * listed on this listen. Null → Brain scan as usual.
 */
export async function tryResolveListenIntention(input: {
  listen: ListenExpectation | null | undefined;
  userText: string;
  memory: Record<string, unknown>;
}): Promise<string | null> {
  const listen = input.listen;
  if (!listen?.resolveIntention) {
    return null;
  }
  const name = await listen.resolveIntention({
    userText: input.userText,
    memory: input.memory,
  });
  if (!name || typeof name !== 'string') {
    return null;
  }
  const allowed = new Set(listen.intentions.map((i) => i.name));
  if (!allowed.has(name)) {
    return null;
  }
  return name;
}

export function missingRequiredExtractKeys(
  fields: ListenExtractField[] | undefined,
  extracted: Record<string, unknown> | undefined,
): string[] {
  if (!fields?.length) {
    return [];
  }
  return fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = extracted?.[f.key];
      return v === undefined || v === null || v === '';
    })
    .map((f) => f.key);
}

/** Pronouns / fillers that must never be treated as a person name. */
const MOCK_NAME_STOPWORDS = new Set([
  'i',
  'me',
  'my',
  'you',
  'we',
  'they',
  'he',
  'she',
  'it',
  'a',
  'an',
  'the',
  'yes',
  'no',
  'ok',
  'okay',
  'yeah',
  'yep',
  'yup',
  'please',
  'hi',
  'hello',
  'hey',
  'um',
  'uh',
  'erm',
  'and',
  'or',
  'so',
]);

const MOCK_NAME_INTENT_WORDS = new Set([
  'need',
  'want',
  'estimate',
  'roof',
  'roofs',
  'help',
  'calling',
  'about',
  'appointment',
  'quote',
  'today',
]);

const NAME_TOKEN_RE = /^[A-Za-z][A-Za-z'-]{0,30}$/;

function isNameLikeExtractKey(key: string): boolean {
  return /name/i.test(key);
}

function stripAsrNameNoise(text: string): string {
  return text
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokensFromUtterance(userText: string): string[] | undefined {
  const text = stripAsrNameNoise(userText);
  if (!text) return undefined;

  const phrase = text.match(
    /(?:my name is|i(?:'| a)?m|call me|it(?:'| i)?s)\s+([A-Za-z][A-Za-z'-]*)/i,
  );
  if (phrase && !MOCK_NAME_STOPWORDS.has(phrase[1].toLowerCase())) {
    return [phrase[1]];
  }

  const raw = text.split(/\s+/);
  if (raw.some((t) => MOCK_NAME_INTENT_WORDS.has(t.toLowerCase()))) {
    return undefined;
  }

  const names = raw
    .map((t) => t.replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, ''))
    .filter((t) => NAME_TOKEN_RE.test(t))
    .filter((t) => !MOCK_NAME_STOPWORDS.has(t.toLowerCase()));

  if (!names.length || names.length > 3) return undefined;
  return names;
}

/**
 * Pull a plausible person name from ASR text.
 * Accepts "Mark." / "yeah Mark" from voice ASR. Rejects pronouns and
 * intent sentences (e.g. "I need my roof estimate").
 */
export function mockExtractPersonName(
  userText: string,
  prefer: 'first' | 'last' = 'first',
): string | undefined {
  const names = nameTokensFromUtterance(userText);
  if (!names?.length) return undefined;
  return prefer === 'last' ? names[names.length - 1] : names[0];
}

/**
 * Deterministic mock extraction for tests / MockBrain (no LLM).
 */
export function mockExtractFromUserText(
  userText: string,
  fields: ListenExtractField[] | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields?.length) {
    return out;
  }
  const text = userText.trim();
  for (const field of fields) {
    if (field.type === 'number') {
      const n = text.match(/-?\d+(?:\.\d+)?/);
      if (n) out[field.key] = Number(n[0]);
      continue;
    }
    if (field.type === 'boolean') {
      const lower = text.toLowerCase();
      if (/\b(yes|yeah|yep|true)\b/.test(lower)) out[field.key] = true;
      else if (/\b(no|nope|false)\b/.test(lower)) out[field.key] = false;
      continue;
    }
    if (isNameLikeExtractKey(field.key)) {
      const prefer = /last|family|surname/i.test(field.key) ? 'last' : 'first';
      const name = mockExtractPersonName(text, prefer);
      if (name) out[field.key] = name;
      continue;
    }
    const named = mockExtractPersonName(text);
    if (named) {
      out[field.key] = named;
    } else if (text) {
      const cleaned = stripAsrNameNoise(text);
      const first = cleaned.split(/\s+/)[0];
      if (first) out[field.key] = first;
    }
  }
  return out;
}
