/**
 * Safe, Brain-free condition evaluation for flow transitions.
 * No `eval` — path lookups + a tiny boolean/compare grammar.
 *
 * Paths: `memory.foo`, `variables.bar` (also `var.` alias for variables).
 * Ops: `==`, `!=`, `!path` (falsy), bare `path` (truthy).
 * Join: `&&`, `||` (&& binds tighter). Parentheses supported.
 */

export type ConditionContext = {
  memory: Record<string, unknown>;
  variables: Record<string, unknown>;
};

function isTruthy(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function readPath(ctx: ConditionContext, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  if (parts.length < 2) return undefined;
  const root = parts[0];
  const bag =
    root === 'memory'
      ? ctx.memory
      : root === 'variables' || root === 'var'
        ? ctx.variables
        : null;
  if (!bag) return undefined;
  let cur: unknown = bag;
  for (const key of parts.slice(1)) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function parseLiteral(raw: string): unknown {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === 'undefined') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  // Bare word → treat as string (channel names, etc.)
  return t;
}

type Tok =
  | { kind: 'path'; value: string }
  | { kind: 'lit'; value: unknown }
  | { kind: 'op'; value: '==' | '!=' | '!' | '&&' | '||' | '(' | ')' };

function tokenize(input: string): Tok[] {
  const src = input.trim();
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (src.startsWith('&&', i)) {
      out.push({ kind: 'op', value: '&&' });
      i += 2;
      continue;
    }
    if (src.startsWith('||', i)) {
      out.push({ kind: 'op', value: '||' });
      i += 2;
      continue;
    }
    if (src.startsWith('==', i)) {
      out.push({ kind: 'op', value: '==' });
      i += 2;
      continue;
    }
    if (src.startsWith('!=', i)) {
      out.push({ kind: 'op', value: '!=' });
      i += 2;
      continue;
    }
    if (ch === '!' || ch === '(' || ch === ')') {
      out.push({ kind: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let buf = '';
      while (j < src.length && src[j] !== quote) {
        buf += src[j];
        j += 1;
      }
      out.push({ kind: 'lit', value: buf });
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < src.length && /[A-Za-z0-9_.-]/.test(src[j])) j += 1;
    const word = src.slice(i, j);
    if (!word) {
      throw new Error(`Unexpected character in condition: ${ch}`);
    }
    if (
      word === 'true' ||
      word === 'false' ||
      word === 'null' ||
      word === 'undefined' ||
      /^-?\d+(\.\d+)?$/.test(word)
    ) {
      out.push({ kind: 'lit', value: parseLiteral(word) });
    } else if (word.startsWith('memory.') || word.startsWith('variables.') || word.startsWith('var.')) {
      out.push({ kind: 'path', value: word });
    } else {
      out.push({ kind: 'lit', value: word });
    }
    i = j;
  }
  return out;
}

class Parser {
  private i = 0;
  constructor(private readonly toks: Tok[]) {}

  parse(): (ctx: ConditionContext) => boolean {
    const fn = this.parseOr();
    if (this.i < this.toks.length) {
      throw new Error('Trailing tokens in condition');
    }
    return fn;
  }

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }

  private take(): Tok {
    const t = this.toks[this.i];
    if (!t) throw new Error('Unexpected end of condition');
    this.i += 1;
    return t;
  }

  private parseOr(): (ctx: ConditionContext) => boolean {
    let left = this.parseAnd();
    while (this.peek()?.kind === 'op' && this.peek()?.value === '||') {
      this.take();
      const right = this.parseAnd();
      const L = left;
      left = (ctx) => L(ctx) || right(ctx);
    }
    return left;
  }

  private parseAnd(): (ctx: ConditionContext) => boolean {
    let left = this.parseUnary();
    while (this.peek()?.kind === 'op' && this.peek()?.value === '&&') {
      this.take();
      const right = this.parseUnary();
      const L = left;
      left = (ctx) => L(ctx) && right(ctx);
    }
    return left;
  }

  private parseUnary(): (ctx: ConditionContext) => boolean {
    if (this.peek()?.kind === 'op' && this.peek()?.value === '!') {
      this.take();
      const inner = this.parseUnary();
      return (ctx) => !inner(ctx);
    }
    return this.parsePrimary();
  }

  private parsePrimary(): (ctx: ConditionContext) => boolean {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of condition');
    if (t.kind === 'op' && t.value === '(') {
      this.take();
      const inner = this.parseOr();
      const close = this.take();
      if (close.kind !== 'op' || close.value !== ')') {
        throw new Error('Expected )');
      }
      return inner;
    }
    if (t.kind === 'path') {
      this.take();
      const path = t.value;
      const next = this.peek();
      if (next?.kind === 'op' && (next.value === '==' || next.value === '!=')) {
        this.take();
        const rhs = this.take();
        const expected =
          rhs.kind === 'lit'
            ? rhs.value
            : rhs.kind === 'path'
              ? undefined
              : (() => {
                  throw new Error('Expected literal after comparison');
                })();
        if (rhs.kind === 'path') {
          const other = rhs.value;
          return (ctx) => {
            const a = readPath(ctx, path);
            const b = readPath(ctx, other);
            return next.value === '==' ? a === b : a !== b;
          };
        }
        // `null` / `undefined` literals use loose nullish compare so missing
        // memory keys match `== undefined` / `== null`.
        const nullish = expected === null || expected === undefined;
        return (ctx) => {
          const a = readPath(ctx, path);
          if (nullish) {
            return next.value === '==' ? a == null : a != null;
          }
          return next.value === '==' ? a === expected : a !== expected;
        };
      }
      return (ctx) => isTruthy(readPath(ctx, path));
    }
    throw new Error(`Expected path or (, got ${JSON.stringify(t)}`);
  }
}

/** Compile a condition string into a predicate. Throws on syntax error. */
export function compileCondition(
  expression: string,
): (ctx: ConditionContext) => boolean {
  const trimmed = expression.trim();
  if (!trimmed) {
    return () => false;
  }
  return new Parser(tokenize(trimmed)).parse();
}

/** Evaluate once (compiles each call — prefer compileCondition in hot paths). */
export function evaluateCondition(
  expression: string,
  ctx: ConditionContext,
): boolean {
  return compileCondition(expression)(ctx);
}

export interface FlowConditionTransition {
  id: string;
  /** If set, only when current node is one of these (or absent = any except `to`). */
  from?: string[];
  /** Destination node id in the same flow. */
  to: string;
  /** Condition expression over memory / variables. */
  when: string;
  /**
   * true → skip listen_resolve + Brain; route straight to `to`.
   * false → inject a high-priority synthetic intention for cascade with Brain.
   */
  force?: boolean;
  /** Walk / log priority when force=false (default 1_000_000). */
  priority?: number;
  /** Forensic reason string (also FLOW_CONTINUE-style). */
  reason?: string;
}
