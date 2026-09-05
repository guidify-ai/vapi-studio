"use strict";
/**
 * Safe, Brain-free condition evaluation for flow transitions.
 * No `eval` — path lookups + a tiny boolean/compare grammar.
 *
 * Paths: `memory.foo`, `variables.bar` (also `var.` alias for variables).
 * Ops: `==`, `!=`, `!path` (falsy), bare `path` (truthy).
 * Join: `&&`, `||` (&& binds tighter). Parentheses supported.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCondition = compileCondition;
exports.evaluateCondition = evaluateCondition;
function isTruthy(value) {
    if (value === undefined || value === null)
        return false;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value !== 0 && !Number.isNaN(value);
    if (typeof value === 'string')
        return value.trim().length > 0;
    return true;
}
function readPath(ctx, path) {
    const parts = path.split('.').filter(Boolean);
    if (parts.length < 2)
        return undefined;
    const root = parts[0];
    const bag = root === 'memory'
        ? ctx.memory
        : root === 'variables' || root === 'var'
            ? ctx.variables
            : null;
    if (!bag)
        return undefined;
    let cur = bag;
    for (const key of parts.slice(1)) {
        if (cur == null || typeof cur !== 'object')
            return undefined;
        cur = cur[key];
    }
    return cur;
}
function parseLiteral(raw) {
    const t = raw.trim();
    if (t === 'true')
        return true;
    if (t === 'false')
        return false;
    if (t === 'null' || t === 'undefined')
        return null;
    if (/^-?\d+(\.\d+)?$/.test(t))
        return Number(t);
    if ((t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1);
    }
    // Bare word → treat as string (channel names, etc.)
    return t;
}
function tokenize(input) {
    const src = input.trim();
    const out = [];
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
        while (j < src.length && /[A-Za-z0-9_.-]/.test(src[j]))
            j += 1;
        const word = src.slice(i, j);
        if (!word) {
            throw new Error(`Unexpected character in condition: ${ch}`);
        }
        if (word === 'true' ||
            word === 'false' ||
            word === 'null' ||
            word === 'undefined' ||
            /^-?\d+(\.\d+)?$/.test(word)) {
            out.push({ kind: 'lit', value: parseLiteral(word) });
        }
        else if (word.startsWith('memory.') || word.startsWith('variables.') || word.startsWith('var.')) {
            out.push({ kind: 'path', value: word });
        }
        else {
            out.push({ kind: 'lit', value: word });
        }
        i = j;
    }
    return out;
}
class Parser {
    toks;
    i = 0;
    constructor(toks) {
        this.toks = toks;
    }
    parse() {
        const fn = this.parseOr();
        if (this.i < this.toks.length) {
            throw new Error('Trailing tokens in condition');
        }
        return fn;
    }
    peek() {
        return this.toks[this.i];
    }
    take() {
        const t = this.toks[this.i];
        if (!t)
            throw new Error('Unexpected end of condition');
        this.i += 1;
        return t;
    }
    parseOr() {
        let left = this.parseAnd();
        while (this.peek()?.kind === 'op' && this.peek()?.value === '||') {
            this.take();
            const right = this.parseAnd();
            const L = left;
            left = (ctx) => L(ctx) || right(ctx);
        }
        return left;
    }
    parseAnd() {
        let left = this.parseUnary();
        while (this.peek()?.kind === 'op' && this.peek()?.value === '&&') {
            this.take();
            const right = this.parseUnary();
            const L = left;
            left = (ctx) => L(ctx) && right(ctx);
        }
        return left;
    }
    parseUnary() {
        if (this.peek()?.kind === 'op' && this.peek()?.value === '!') {
            this.take();
            const inner = this.parseUnary();
            return (ctx) => !inner(ctx);
        }
        return this.parsePrimary();
    }
    parsePrimary() {
        const t = this.peek();
        if (!t)
            throw new Error('Unexpected end of condition');
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
                const expected = rhs.kind === 'lit'
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
function compileCondition(expression) {
    const trimmed = expression.trim();
    if (!trimmed) {
        return () => false;
    }
    return new Parser(tokenize(trimmed)).parse();
}
/** Evaluate once (compiles each call — prefer compileCondition in hot paths). */
function evaluateCondition(expression, ctx) {
    return compileCondition(expression)(ctx);
}
//# sourceMappingURL=condition.js.map