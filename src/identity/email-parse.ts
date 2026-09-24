/**
 * Voice / ASR email recovery — boxed PII helper for apps.
 *
 * Prefer Brain extract + {@link EMAIL_EXTRACT_DESCRIPTION}, then fail-closed
 * via {@link collectedEmail} / {@link parseSpelledEmail} before writing memory.
 */

/**
 * GOT / listen `extract.fields[].description` for email collection.
 * Teach the Brain spelled-out ASR as well as normal `name@domain` forms.
 */
export const EMAIL_EXTRACT_DESCRIPTION =
  'Caller email address. Accept normal forms (name@domain.tld) and spelled-out ASR (letter by letter, "at" / "at sign" / "at the rate", "dot" / "period"). Prefer the first recoverable address; fail if none can be parsed.';

/** Prefer Brain extract, then spoken / spelled email. */
export function collectedEmail(
  extracted: unknown,
  spoken: string,
): string | null {
  if (typeof extracted === 'string') {
    const fromExtract = parseSpelledEmail(extracted);
    if (fromExtract) return fromExtract;
  }
  return parseSpelledEmail(spoken);
}

/**
 * Parse ASR / spelled-out emails into a normal address.
 * e.g. "m a r k at e x a m p l e dot com" → mark@example.com
 * Also tolerates digit “0” for letter “o” when spelling letter-by-letter.
 */
export function parseSpelledEmail(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  // Already looks like an email.
  const direct = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (direct) return direct[0]!.toLowerCase();

  const normalized = text
    .replace(/\b(at the rate|at sign)\b/g, ' @ ')
    .replace(/\b(at|@)\b/g, ' @ ')
    .replace(/\b(dot|period)\b/g, ' . ')
    .replace(/\bzero\b/g, '0')
    .replace(/[^a-z0-9@.\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized.includes('@')) return null;

  const parts = normalized.split('@').map((p) => p.trim());
  if (parts.length < 2) return null;
  const localPart = parts[0]!;
  const domainPart = parts.slice(1).join('@');
  if (!localPart || !domainPart) return null;

  const local = collapseSpelledEmailSegment(localPart);
  const domain = collapseSpelledEmailSegment(domainPart);
  if (!local || !domain.includes('.')) return null;
  if (!/^[a-z0-9._%+-]+$/i.test(local)) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return null;
  return `${local}@${domain}`;
}

/**
 * Join letter-by-letter ASR ("m a r k", "r o 0 f r") into a token.
 * Isolated "0" between letters → "o" (common ASR for the letter O).
 */
function collapseSpelledEmailSegment(segment: string): string {
  const tokens = segment
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      if (tok === '0') return 'o';
      return tok;
    });

  if (!tokens.length) return '';

  // Mostly single-character tokens → join (classic spelling).
  const singleLetterish = tokens.filter((t) => /^[a-z0-9]$/i.test(t)).length;
  if (tokens.length >= 2 && singleLetterish >= Math.ceil(tokens.length * 0.6)) {
    return tokens.join('');
  }

  // Mixed: join only runs of single letters; keep multi-char words.
  let out = '';
  for (const tok of tokens) {
    if (/^[a-z0-9]$/i.test(tok)) {
      out += tok;
    } else if (tok === '.' || tok === '_' || tok === '-' || tok === '+') {
      out += tok;
    } else {
      out += tok;
    }
  }
  return out.replace(/\s+/g, '');
}
