/**
 * Color-coded conversation console for live call debugging.
 * Toggle with RA9_CONSOLE_DEBUG=1|true|yes (default: on unless explicitly 0|false|no|off).
 */

import { appendDailyLog } from './daily-log.driver';

export type Ra9LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgMagenta: '\x1b[45m',
  bgYellow: '\x1b[43m',
  bgCyan: '\x1b[46m',
  bgRed: '\x1b[41m',
  bgGray: '\x1b[100m',
} as const;

function paint(color: string, text: string): string {
  return `${color}${text}${ANSI.reset}`;
}

function roleTag(bg: string, fg: string, label: string): string {
  return `${bg}${fg}${ANSI.bold} ${label} ${ANSI.reset}`;
}

/** Compact JSON for console — single-level preference, truncated long strings. */
function formatValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return paint(ANSI.dim, String(value));
  if (typeof value === 'string') {
    const t = value.length > 240 ? `${value.slice(0, 237)}...` : value;
    return paint(ANSI.white, JSON.stringify(t));
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return paint(ANSI.yellow, String(value));
  }
  if (depth >= 2) {
    return paint(ANSI.dim, JSON.stringify(value));
  }
  if (Array.isArray(value)) {
    if (!value.length) return paint(ANSI.dim, '[]');
    if (value.every((v) => typeof v !== 'object' || v === null)) {
      return `[${value.map((v) => formatValue(v, depth + 1)).join(', ')}]`;
    }
    return paint(ANSI.dim, JSON.stringify(value));
  }
  if (typeof value === 'object') {
    return paint(ANSI.dim, JSON.stringify(value));
  }
  return String(value);
}

/**
 * User-facing memory for console diffs / turn forensics.
 * Keep conversation-critical flags (e.g. `introSpoken`) — hiding them made
 * greeting-reset bugs invisible in MEMORY diffs. Only skip bootstrap infra.
 */
export function snapshotUserMemory(
  memory: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!memory || typeof memory !== 'object') return {};
  const skip = new Set(['conversationReady', 'setupAt', 'tornDownAt']);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(memory)) {
    if (skip.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    // Booleans like introSpoken=false must appear (truthy filter would hide them).
    out[key] = value;
  }
  return out;
}

export function isConversationConsoleEnabled(): boolean {
  const raw = (process.env.RA9_CONSOLE_DEBUG ?? '1').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(raw);
}

let lineSink: string[] | null = null;

function line(parts: string[]): void {
  const text = parts.join(' ');
  if (lineSink) {
    lineSink.push(text);
    return;
  }
   
  console.log(text);
}

function blank(): void {
  if (lineSink) {
    lineSink.push('');
    return;
  }
   
  console.log('');
}

/** Last printed user-memory snapshot per call/conversation — for diffs only. */
const lastMemoryByScope = new Map<string, Record<string, unknown>>();

function memoryScopeId(payload: Record<string, unknown>): string {
  if (typeof payload.providerCallId === 'string' && payload.providerCallId) {
    return payload.providerCallId;
  }
  if (typeof payload.conversationId === 'string' && payload.conversationId) {
    return payload.conversationId;
  }
  if (typeof payload.runtimeInstanceId === 'string' && payload.runtimeInstanceId) {
    return payload.runtimeInstanceId;
  }
  return 'default';
}

function stableEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/** Print only memory keys that changed since the last print for this call. */
function printMemoryDiff(
  memory: unknown,
  payload: Record<string, unknown>,
): void {
  const snap =
    memory && typeof memory === 'object'
      ? snapshotUserMemory(memory as Record<string, unknown>)
      : {};
  const scope = memoryScopeId(payload);
  const prev = lastMemoryByScope.get(scope) ?? {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(snap)]);
  const changes: Array<{
    op: '+' | '~' | '-';
    key: string;
    from?: unknown;
    to?: unknown;
  }> = [];

  for (const key of [...keys].sort()) {
    const before = prev[key];
    const after = snap[key];
    const had = Object.prototype.hasOwnProperty.call(prev, key);
    const has = Object.prototype.hasOwnProperty.call(snap, key);
    if (!had && has) {
      changes.push({ op: '+', key, to: after });
    } else if (had && !has) {
      changes.push({ op: '-', key, from: before });
    } else if (!stableEqual(before, after)) {
      changes.push({ op: '~', key, from: before, to: after });
    }
  }

  lastMemoryByScope.set(scope, snap);

  if (!changes.length) {
    return;
  }

  line([roleTag(ANSI.bgGray, ANSI.white, 'MEMORY')]);
  for (const change of changes) {
    if (change.op === '+') {
      line([
        paint(ANSI.dim, '       '),
        paint(ANSI.green + ANSI.bold, '+'),
        paint(ANSI.cyan, change.key),
        paint(ANSI.dim, '='),
        formatValue(change.to),
      ]);
    } else if (change.op === '-') {
      line([
        paint(ANSI.dim, '       '),
        paint(ANSI.red + ANSI.bold, '-'),
        paint(ANSI.cyan, change.key),
        paint(ANSI.dim, 'was'),
        formatValue(change.from),
      ]);
    } else {
      line([
        paint(ANSI.dim, '       '),
        paint(ANSI.yellow + ANSI.bold, '~'),
        paint(ANSI.cyan, change.key),
        formatValue(change.from),
        paint(ANSI.dim, '→'),
        formatValue(change.to),
      ]);
    }
  }
}

function intentionSummary(intentions: unknown): string {
  if (!Array.isArray(intentions) || !intentions.length) {
    return paint(ANSI.dim, '(none)');
  }
  return intentions
    .slice(0, 5)
    .map((item) => {
      if (!item || typeof item !== 'object') return String(item);
      const row = item as {
        name?: string;
        rank?: number;
        confidence?: number;
        priority?: number;
        payload?: { listenBoost?: number; reason?: string };
      };
      const name = row.name ?? '?';
      const bits: string[] = [];
      if (row.confidence != null) {
        bits.push(paint(ANSI.dim, Number(row.confidence).toFixed(6)));
      } else if (row.rank != null) {
        bits.push(paint(ANSI.dim, `r${row.rank}`));
      }
      if (row.priority != null && row.priority !== 1) {
        bits.push(paint(ANSI.dim, `p${row.priority}`));
      }
      const boost = row.payload?.listenBoost;
      if (boost != null && boost !== 0) {
        bits.push(paint(ANSI.dim, `b${boost}`));
      }
      const score = bits.length ? ` ${bits.join(' ')}` : '';
      return `${paint(ANSI.magenta, name)}${score}`;
    })
    .join(paint(ANSI.dim, ' · '));
}

function listenSummary(listen: unknown): string {
  if (!listen || typeof listen !== 'object') return paint(ANSI.dim, '(none)');
  const L = listen as {
    intentions?: Array<{ name?: string; boost?: number; priority?: number }>;
    hints?: string[];
    extract?: { fields?: Array<{ key?: string }> };
    timeoutSeconds?: number;
  };
  const intents = (L.intentions ?? [])
    .map((i) => {
      const name = paint(ANSI.cyan, i.name ?? '?');
      const boost =
        i.boost != null && i.boost !== 0
          ? paint(ANSI.dim, `+${i.boost}`)
          : '';
      return `${name}${boost}`;
    })
    .join(paint(ANSI.dim, ', '));
  const fields = (L.extract?.fields ?? [])
    .map((f) => paint(ANSI.yellow, f.key ?? '?'))
    .join(paint(ANSI.dim, ', '));
  const timeout =
    typeof L.timeoutSeconds === 'number'
      ? paint(ANSI.dim, `${L.timeoutSeconds}s`)
      : '';
  const parts = [
    intents || paint(ANSI.dim, 'no intents'),
    fields ? `extract[${fields}]` : '',
    timeout,
  ].filter(Boolean);
  return parts.join(paint(ANSI.dim, ' | '));
}

/**
 * Pretty-print a structured RA9 event to stdout with role colors.
 */
export function printConversationConsole(
  level: Ra9LogLevel,
  type: string,
  payload: Record<string, unknown>,
): void {
  const consoleOn = isConversationConsoleEnabled();
  lineSink = [];
  try {
  const turn =
    typeof payload.turnNumber === 'number'
      ? paint(ANSI.dim, `t${payload.turnNumber}`)
      : '';
  const call =
    typeof payload.providerCallId === 'string'
      ? paint(ANSI.dim, String(payload.providerCallId).slice(0, 8))
      : typeof payload.conversationId === 'string'
        ? paint(ANSI.dim, String(payload.conversationId).slice(0, 8))
        : '';

  switch (type) {
    case 'CUSTOM_LLM_TURN':
    case 'OPENING_TURN': {
      blank();
      line([
        paint(ANSI.dim, '────────'),
        paint(ANSI.bold, 'TURN'),
        turn,
        call,
        payload.series ? paint(ANSI.yellow, 'series') : '',
        paint(ANSI.dim, '────────'),
      ]);
      const userText =
        typeof payload.userText === 'string' ? payload.userText : '';
      if (type === 'OPENING_TURN' && !userText.trim()) {
        line([
          roleTag(ANSI.bgBlue, ANSI.white, 'USER'),
          paint(ANSI.dim, '(opening — no user speech)'),
        ]);
      } else if (payload.series && Array.isArray(payload.parts)) {
        line([
          roleTag(ANSI.bgBlue, ANSI.white, 'USER'),
          paint(ANSI.yellow, `(series of ${(payload.parts as unknown[]).length})`),
        ]);
        for (const [i, part] of (payload.parts as unknown[]).entries()) {
          line([
            paint(ANSI.dim, `       ${i + 1})`),
            paint(ANSI.cyan + ANSI.bold, String(part)),
          ]);
        }
      } else {
        line([
          roleTag(ANSI.bgBlue, ANSI.white, 'USER'),
          paint(ANSI.cyan + ANSI.bold, userText || '(empty)'),
        ]);
      }
      if (payload.memory) printMemoryDiff(payload.memory, payload);
      return;
    }

    case 'CUSTOM_LLM_TURN_QUEUED':
      line([
        roleTag(ANSI.bgYellow, ANSI.white, 'QUEUE'),
        paint(ANSI.yellow, 'buffered while node working'),
        typeof payload.userText === 'string'
          ? paint(ANSI.cyan, JSON.stringify(payload.userText))
          : '',
        payload.pendingCount != null
          ? paint(ANSI.dim, `pending=${payload.pendingCount}`)
          : '',
      ]);
      return;

    case 'CUSTOM_LLM_TURN_SKIPPED':
      line([
        roleTag(ANSI.bgGray, ANSI.white, 'SKIP'),
        paint(ANSI.dim, 'coalesced by leader'),
        typeof payload.userText === 'string'
          ? paint(ANSI.dim, JSON.stringify(payload.userText))
          : '',
        payload.replayed
          ? paint(ANSI.cyan, `replay ${payload.replayed}`)
          : paint(ANSI.yellow, 'empty SSE'),
      ]);
      return;

    case 'CUSTOM_LLM_TURN_DEBOUNCED':
      line([
        roleTag(ANSI.bgYellow, ANSI.white, 'SKIP'),
        paint(ANSI.yellow, 'debounced turn'),
        paint(ANSI.dim, String(payload.reason ?? '')),
        typeof payload.userText === 'string'
          ? paint(ANSI.dim, JSON.stringify(payload.userText))
          : '',
      ]);
      return;

    case 'SAY':
      line([
        roleTag(ANSI.bgGreen, ANSI.white, 'BOT '),
        paint(ANSI.green + ANSI.bold, String(payload.text ?? '')),
      ]);
      return;

    case 'BRAIN_SCAN_START':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'BRAIN'),
        paint(ANSI.magenta, 'scan'),
        paint(ANSI.dim, String(payload.model ?? '')),
        payload.series ? paint(ANSI.yellow, 'series') : '',
        paint(ANSI.dim, `cands=${payload.candidateCount ?? '?'}`),
      ]);
      if (typeof payload.userText === 'string' && payload.userText) {
        line([
          paint(ANSI.dim, '       user'),
          paint(ANSI.cyan, payload.userText.slice(0, 200)),
        ]);
      }
      return;

    case 'BRAIN_SCAN_RESULT':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'BRAIN'),
        paint(ANSI.green, '→'),
        paint(ANSI.magenta + ANSI.bold, String(payload.winner ?? '?')),
        payload.reason ? paint(ANSI.dim, String(payload.reason)) : '',
        payload.extracted
          ? paint(ANSI.yellow, `extract=${formatValue(payload.extracted)}`)
          : '',
        payload.durationMs != null
          ? paint(ANSI.dim, `${payload.durationMs}ms`)
          : '',
      ]);
      if (Array.isArray(payload.scores)) {
        for (const s of payload.scores as Array<{
          name?: string;
          confidence?: number;
          reason?: string;
        }>) {
          line([
            paint(ANSI.dim, '       '),
            paint(ANSI.cyan, String(s.name ?? '')),
            paint(ANSI.yellow, String(s.confidence ?? '')),
            s.reason ? paint(ANSI.dim, String(s.reason)) : '',
          ]);
        }
      }
      return;

    case 'BRAIN_CLARIFY_START':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'BRAIN'),
        paint(ANSI.magenta, 'clarify'),
        paint(ANSI.dim, String(payload.model ?? '')),
        paint(ANSI.white, String(payload.question ?? '')),
      ]);
      return;

    case 'BRAIN_CLARIFY_RESULT':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'BRAIN'),
        paint(ANSI.green, 'clarify✓'),
        formatValue(payload.answer),
      ]);
      return;

    case 'BRAIN_JUDGE_START':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'BRAIN'),
        paint(ANSI.magenta, 'judge'),
        paint(ANSI.dim, String(payload.model ?? '')),
        paint(ANSI.white, String(payload.goals ?? '')),
      ]);
      return;

    case 'BRAIN_JUDGE_RESULT':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'BRAIN'),
        payload.passed ? paint(ANSI.green, 'judge✓') : paint(ANSI.red, 'judge✗'),
        paint(ANSI.yellow, `c=${payload.confidence ?? '?'}`),
        payload.belowThreshold ? paint(ANSI.red, 'below-threshold') : '',
        Array.isArray(payload.reasoning)
          ? paint(ANSI.dim, (payload.reasoning as string[]).join(' · '))
          : '',
      ]);
      return;

    case 'INTEGRATION_REQUEST':
      line([
        roleTag(ANSI.bgBlue, ANSI.white, 'HTTP '),
        paint(ANSI.cyan, String(payload.method ?? 'POST')),
        paint(ANSI.white, String(payload.name ?? '')),
        paint(ANSI.dim, String(payload.url ?? '')),
      ]);
      return;

    case 'INTEGRATION_RESPONSE':
      line([
        roleTag(ANSI.bgBlue, ANSI.white, 'HTTP '),
        payload.ok ? paint(ANSI.green, 'ok') : paint(ANSI.red, 'fail'),
        paint(ANSI.yellow, String(payload.status ?? '')),
        paint(ANSI.white, String(payload.name ?? '')),
        paint(ANSI.dim, `${payload.durationMs ?? '?'}ms`),
      ]);
      return;

    case 'INTEGRATION_ERROR':
      line([
        roleTag(ANSI.bgRed, ANSI.white, 'HTTP '),
        paint(ANSI.red, 'error'),
        paint(ANSI.white, String(payload.name ?? '')),
        paint(ANSI.dim, String(payload.error ?? '')),
      ]);
      return;

    case 'BRAIN_USAGE':
      line([
        roleTag(ANSI.bgGray, ANSI.white, 'TOKENS'),
        paint(ANSI.dim, String(payload.kind ?? '')),
        paint(ANSI.cyan, String(payload.model ?? '')),
        paint(
          ANSI.dim,
          `in=${payload.promptTokens ?? 0} out=${payload.completionTokens ?? 0}`,
        ),
        paint(ANSI.yellow + ANSI.bold, String(payload.money ?? '')),
        payload.durationMs != null
          ? paint(ANSI.dim, `${payload.durationMs}ms`)
          : '',
      ]);
      return;

    case 'BRAIN_COST_SUMMARY': {
      blank();
      line([
        paint(ANSI.dim, '════════'),
        paint(ANSI.bold + ANSI.yellow, 'CALL COST'),
        paint(ANSI.dim, '════════'),
      ]);
      line([
        roleTag(ANSI.bgYellow, ANSI.white, ' $$$ '),
        paint(
          ANSI.yellow + ANSI.bold,
          String(payload.money ?? `$${payload.estimatedUsd ?? 0}`),
        ),
        paint(
          ANSI.dim,
          `tokens=${payload.totalTokens ?? 0} (in ${payload.promptTokens ?? 0} / out ${payload.completionTokens ?? 0})`,
        ),
        paint(ANSI.dim, `calls=${payload.calls ?? 0}`),
      ]);
      if (payload.byModel && typeof payload.byModel === 'object') {
        for (const [model, row] of Object.entries(
          payload.byModel as Record<string, { estimatedUsd?: number; calls?: number }>,
        )) {
          line([
            paint(ANSI.dim, '       '),
            paint(ANSI.cyan, model),
            paint(ANSI.dim, `×${row.calls ?? 0}`),
            paint(
              ANSI.yellow,
              typeof row.estimatedUsd === 'number'
                ? `$${row.estimatedUsd.toFixed(6)}`
                : '',
            ),
          ]);
        }
      }
      blank();
      return;
    }

    case 'INTENTION_SCAN':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'BRAIN'),
        intentionSummary(payload.intentions),
      ]);
      if (payload.listen) {
        line([
          paint(ANSI.dim, '       listen←'),
          listenSummary(payload.listen),
        ]);
      }
      if (payload.extracted && Object.keys(payload.extracted as object).length) {
        line([
          paint(ANSI.dim, '       extract'),
          formatValue(payload.extracted),
        ]);
      }
      return;

    case 'NODE_ENTER':
      line([
        roleTag(ANSI.bgYellow, ANSI.white, 'NODE'),
        paint(ANSI.yellow + ANSI.bold, String(payload.class ?? '')),
        paint(ANSI.dim, `/ ${payload.nodeId ?? ''}`),
        paint(ANSI.magenta, `← ${payload.intention ?? ''}`),
        payload.portal ? paint(ANSI.red, 'portal') : '',
        turn,
      ]);
      return;

    case 'LISTEN_RESOLVED':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'CHOICE'),
        paint(ANSI.cyan, String(payload.intention ?? '')),
        paint(ANSI.dim, 'listen_resolve'),
        paint(ANSI.white, String(payload.userText ?? '')),
      ]);
      return;

    case 'LISTEN_REGISTERED':
      line([
        roleTag(ANSI.bgGray, ANSI.white, 'LISTEN'),
        listenSummary(payload.listen),
        paint(ANSI.dim, String(payload.class ?? payload.nodeId ?? '')),
      ]);
      return;

    case 'LISTEN_EXTRACT_REGISTERED':
      line([
        roleTag(ANSI.bgGray, ANSI.white, 'EXTRACT'),
        formatValue(payload.fields),
        paint(ANSI.dim, String(payload.nodeId ?? '')),
      ]);
      return;

    case 'LISTEN_EXTRACTED':
      line([
        roleTag(ANSI.bgGray, ANSI.white, 'EXTRACTED'),
        formatValue(payload.extracted),
        Array.isArray(payload.missingRequired) &&
        (payload.missingRequired as unknown[]).length
          ? paint(ANSI.red, `missing=${formatValue(payload.missingRequired)}`)
          : '',
      ]);
      if (payload.memory) printMemoryDiff(payload.memory, payload);
      return;

    case 'NODE_AFTER':
      line([
        roleTag(ANSI.bgGray, ANSI.white, 'DONE'),
        paint(ANSI.dim, String(payload.class ?? payload.nodeId ?? '')),
        paint(ANSI.cyan, `→ ${payload.resultKind ?? ''}`),
      ]);
      if (payload.resultDetail) {
        line([
          paint(ANSI.dim, '       result'),
          formatValue(payload.resultDetail),
        ]);
      }
      if (payload.memory) printMemoryDiff(payload.memory, payload);
      if (payload.actions) {
        line([
          paint(ANSI.dim, '       actions'),
          formatValue(payload.actions),
        ]);
      }
      return;

    case 'ROUTE_DECISION':
    case 'ROUTE_FAILED': {
      const winner = payload.winner as
        | { nodeId?: string; class?: string; intention?: string }
        | null
        | undefined;
      const rejected = Array.isArray(payload.rejected)
        ? (payload.rejected as unknown[])
        : [];
      line([
        roleTag(
          type === 'ROUTE_FAILED' ? ANSI.bgRed : ANSI.bgGreen,
          ANSI.white,
          type === 'ROUTE_FAILED' ? 'FAIL' : 'ROUTE',
        ),
        winner
          ? paint(
              ANSI.green + ANSI.bold,
              `${winner.class ?? '?'} / ${winner.nodeId ?? '?'} ← ${winner.intention ?? ''}`,
            )
          : paint(ANSI.red, '(no winner)'),
        payload.resolvedVia
          ? paint(ANSI.dim, String(payload.resolvedVia))
          : '',
        turn,
      ]);
      if (payload.userText) {
        line([
          paint(ANSI.dim, '       user'),
          paint(ANSI.white, String(payload.userText)),
        ]);
      }
      if (payload.walk) {
        line([
          paint(ANSI.dim, '       walk'),
          intentionSummary(payload.walk),
        ]);
      }
      if (rejected.length) {
        line([
          paint(ANSI.dim, '       rejected'),
          formatValue(rejected),
        ]);
      }
      if (payload.memory) printMemoryDiff(payload.memory, payload);
      return;
    }

    case 'CONDITION_TRANSITION': {
      const force = payload.force === true;
      line([
        roleTag(force ? ANSI.bgYellow : ANSI.bgCyan, ANSI.white, force ? 'FORCE' : 'WHEN '),
        paint(ANSI.bold, String(payload.transitionId ?? '?')),
        paint(ANSI.dim, `${payload.from ?? '?'} →`),
        paint(ANSI.cyan + ANSI.bold, String(payload.to ?? '?')),
        payload.reason ? paint(ANSI.dim, String(payload.reason)) : '',
        turn,
      ]);
      if (payload.when) {
        line([
          paint(ANSI.dim, '       when'),
          paint(ANSI.white, String(payload.when)),
        ]);
      }
      if (payload.memory) printMemoryDiff(payload.memory, payload);
      return;
    }

    case 'INTENTION_FORCE':
    case 'INTENTION_MATCH':
    case 'INTENTION_MATCHED': {
      line([
        roleTag(
          type === 'INTENTION_FORCE' ? ANSI.bgYellow : ANSI.bgCyan,
          ANSI.white,
          type === 'INTENTION_FORCE' ? 'IFORCE' : 'IMATCH',
        ),
        paint(ANSI.bold, String(payload.intention ?? '?')),
        payload.to
          ? paint(ANSI.cyan, `→ ${payload.to}`)
          : paint(ANSI.dim, 'score'),
        payload.confidence != null
          ? paint(ANSI.yellow, String(payload.confidence))
          : '',
        payload.phase ? paint(ANSI.dim, String(payload.phase)) : '',
        payload.reason ? paint(ANSI.dim, String(payload.reason)) : '',
        turn,
      ]);
      if (payload.memory) printMemoryDiff(payload.memory, payload);
      return;
    }

    case 'CONDITION_TRANSITION_MISSED':
    case 'INTENTION_FORCE_MISSED':
      line([
        roleTag(ANSI.bgYellow, ANSI.white, 'WHEN '),
        paint(ANSI.yellow, type),
        formatValue({
          tried: payload.tried,
          intention: payload.intention,
          note: payload.note,
        }),
        turn,
      ]);
      return;

    case 'FORM_SENDOUT':
    case 'FORM_EXPOSE':
    case 'FORM_LINK_READY':
    case 'FORM_DELIVERED':
    case 'FORM_RESEND':
    case 'FORM_RESENT':
    case 'FORM_SUBMITTED':
    case 'FORM_DELIVER_TIMEOUT':
    case 'FORM_FILLOUT_TIMEOUT': {
      const phase =
        type === 'FORM_SENDOUT'
          ? 'sendout'
          : type === 'FORM_EXPOSE'
            ? 'expose'
            : type === 'FORM_LINK_READY'
              ? 'link'
              : type === 'FORM_DELIVERED'
                ? 'delivered'
                : type === 'FORM_RESEND'
                  ? 'resend'
                  : type === 'FORM_RESENT'
                    ? 'resent'
                    : type === 'FORM_SUBMITTED'
                      ? 'submitted'
                      : type === 'FORM_DELIVER_TIMEOUT'
                        ? 'deliver⏱'
                        : 'fillout⏱';
      const bg =
        type.endsWith('TIMEOUT')
          ? ANSI.bgRed
          : type === 'FORM_SUBMITTED'
            ? ANSI.bgGreen
            : type === 'FORM_RESEND' || type === 'FORM_RESENT'
              ? ANSI.bgYellow
              : ANSI.bgCyan;
      line([
        roleTag(bg, ANSI.white, 'FORM'),
        paint(ANSI.cyan + ANSI.bold, phase),
        payload.branch
          ? paint(ANSI.yellow, `branch=${payload.branch}`)
          : paint(ANSI.dim, 'branch=?'),
        payload.deliveryBranch
          ? paint(ANSI.magenta, `via=${payload.deliveryBranch}`)
          : '',
        payload.adapter ? paint(ANSI.dim, String(payload.adapter)) : '',
        payload.exposeId
          ? paint(ANSI.dim, String(payload.exposeId).slice(0, 8))
          : '',
        payload.formId != null ? paint(ANSI.dim, `form=${payload.formId}`) : '',
      ]);
      if (payload.localUrl || payload.url || payload.liveWatcher) {
        line([
          paint(ANSI.dim, '       urls'),
          payload.liveWatcher
            ? paint(ANSI.green, String(payload.liveWatcher))
            : '',
          payload.localUrl ? paint(ANSI.white, String(payload.localUrl)) : '',
          payload.url ? paint(ANSI.dim, String(payload.url)) : '',
        ]);
      }
      if (payload.fields) {
        line([
          paint(ANSI.dim, '       fields'),
          formatValue(payload.fields),
        ]);
      }
      if (payload.keys) {
        line([
          paint(ANSI.dim, '       keys'),
          formatValue(payload.keys),
        ]);
      }
      if (payload.note) {
        line([paint(ANSI.dim, '       note'), paint(ANSI.white, String(payload.note))]);
      }
      return;
    }

    case 'NODE_CATCH':
    case 'NODE_REJECT':
    case 'NODE_MISSING':
    case 'CUSTOM_LLM_ERROR':
      line([
        roleTag(ANSI.bgRed, ANSI.white, level === 'error' ? 'ERR ' : 'WARN'),
        paint(ANSI.red, type),
        formatValue({
          class: payload.class,
          nodeId: payload.nodeId,
          intention: payload.intention,
          reason: payload.reason,
          error: payload.error,
          directive: payload.directive,
        }),
      ]);
      return;

    case 'TOOL_CALL_EMITTED':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'TOOL'),
        formatValue(payload.emittedTools),
      ]);
      return;

    case 'PORTAL_ENTER':
    case 'PORTAL_REENTER':
    case 'PORTAL_EXIT':
      line([
        roleTag(ANSI.bgMagenta, ANSI.white, 'PORTAL'),
        paint(ANSI.magenta, type),
        formatValue({
          portalId: payload.portalId ?? payload.activePortalId,
          origin: payload.originNodeId,
        }),
      ]);
      return;

    case 'CUSTOM_LLM_ABORT':
      line([
        roleTag(ANSI.bgYellow, ANSI.white, 'ABORT'),
        paint(ANSI.yellow, 'client closed SSE'),
        call,
      ]);
      return;

    case 'CUSTOM_LLM_OVERLAP':
      line([
        roleTag(ANSI.bgYellow, ANSI.white, 'HOLD'),
        paint(ANSI.yellow, 'uninterruptible — overlap queued'),
        call,
      ]);
      return;

    case 'RUNTIME_REMOVED':
      lastMemoryByScope.delete(memoryScopeId(payload));
      line([
        roleTag(ANSI.bgGray, ANSI.white, 'SYS '),
        paint(ANSI.dim, type),
        call,
      ]);
      return;

    case 'CALL_STARTED_BOOTSTRAP':
    case 'CUSTOM_LLM_LAZY_BOOTSTRAP':
    case 'ASSISTANT_REQUEST':
    case 'WEBHOOK_RECEIVED':
    case 'STATUS_UPDATE':
    case 'USER_INTERRUPTED':
    case 'BOOTSTRAP_REUSE':
    case 'FINALIZE_MISSING_RUNTIME':
    case 'CATCH_FORCE_INTENTION':
    case 'OPENING_FORCE_INTENTION':
    case 'CUSTOM_LLM_REQUEST':
      line([
        roleTag(ANSI.bgGray, ANSI.white, 'SYS '),
        paint(ANSI.dim, type),
        call,
        payload.messageType
          ? paint(ANSI.dim, String(payload.messageType))
          : '',
        payload.intention
          ? paint(ANSI.magenta, String(payload.intention))
          : '',
      ]);
      return;

    default:
      if (level === 'error' || level === 'warn') {
        line([
          roleTag(
            level === 'error' ? ANSI.bgRed : ANSI.bgYellow,
            ANSI.white,
            level.toUpperCase().padEnd(4, ' '),
          ),
          paint(level === 'error' ? ANSI.red : ANSI.yellow, type),
          formatValue(payload),
        ]);
      } else if (process.env.RA9_CONSOLE_DEBUG_ALL === '1') {
        line([
          roleTag(ANSI.bgGray, ANSI.white, 'EVT '),
          paint(ANSI.dim, type),
          formatValue(payload),
        ]);
      }
  }
  } finally {
    const rows = lineSink ?? [];
    lineSink = null;
    if (consoleOn) {
      for (const row of rows) {
         
        console.log(row);
      }
    }
    appendDailyLog(rows, payload);
  }
}
