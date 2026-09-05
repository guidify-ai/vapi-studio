/**
 * Brain clarify — ask a free-form question with a required object answer shape.
 * Used when the flow has an ambiguous / incomplete answer and needs a Brain judgment.
 *
 * Reserved failure: throws ClarifyCannotAnswerError (`studio.clarify.cannotAnswer`).
 */

import { sanitizeExtractedFieldValue } from './prompt-injection-guard';

/** Anything the runtime can stringify for Brain context. */
export type ClarifiableInput =
  | string
  | number
  | boolean
  | bigint
  | Date
  | null
  | undefined
  | { toString(): string };

export interface BrainAnswerField {
  key: string;
  description?: string;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
}

/**
 * Declares the object interface Brain must return.
 * On success, `answer` is always an object keyed by these fields.
 */
export interface BrainAnswerInterface {
  fields: BrainAnswerField[];
  /** Optional overall description of the answer object. */
  description?: string;
}

export interface BrainClarifyRequest {
  /** Arbitrary context convertible to string (user text, extracted blob, JSON, …). */
  input: ClarifiableInput;
  /** Question posed to Brain. */
  question: string;
  /** Required object answer shape. */
  answer: BrainAnswerInterface;
  /** Optional correlation for usage / console (filled by NodeContext). */
  meta?: {
    providerCallId?: string;
    conversationId?: string;
  };
}

/** Reserved clarify exception code — Brain cannot produce a reliable answer. */
export const STUDIO_CLARIFY_CANNOT_ANSWER = 'studio.clarify.cannotAnswer' as const;
/**
 * Reserved exception thrown by Brain.clarify when it cannot answer.
 * Catch this in Node.run / Node.catch to recover (restartNode, forceIntention, …).
 */
export class ClarifyCannotAnswerError extends Error {
  public readonly code: "studio.clarify.cannotAnswer" = STUDIO_CLARIFY_CANNOT_ANSWER;
  public readonly reason?: string;
  public readonly details?: Record<string, unknown>;

  public constructor(reason?: string, details?: Record<string, unknown>) {
    super(
      reason
        ? `${STUDIO_CLARIFY_CANNOT_ANSWER}: ${reason}`
        : STUDIO_CLARIFY_CANNOT_ANSWER,
    );
    this.name = 'ClarifyCannotAnswerError';
    this.reason = reason;
    this.details = details;
  }
}

export function isClarifyCannotAnswerError(
  error: unknown,
): error is ClarifyCannotAnswerError {
  return (
    error instanceof ClarifyCannotAnswerError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === STUDIO_CLARIFY_CANNOT_ANSWER)
  );
}

/** Throw the reserved cannot-answer exception. */
export function throwClarifyCannotAnswer(
  reason?: string,
  details?: Record<string, unknown>,
): never {
  throw new ClarifyCannotAnswerError(reason, details);
}

/**
 * Successful clarify result — always an object answer.
 * Failure is never returned here; adapters throw ClarifyCannotAnswerError.
 */
export interface BrainClarifyResult<
  TAnswer extends Record<string, unknown> = Record<string, unknown>,
> {
  answer: TAnswer;
}

function requiredFieldsMissing(
  answer: Record<string, unknown>,
  answerInterface: BrainAnswerInterface,
): boolean {
  const required = (answerInterface.fields ?? []).filter((f) => f.required);
  if (!required.length) {
    return false;
  }
  return required.every((f) => {
    const v = answer[f.key];
    return v === undefined || v === null || v === '';
  });
}

/**
 * Normalize raw Brain JSON into a successful clarify result,
 * or throw ClarifyCannotAnswerError (reserved).
 *
 * Accepts:
 * - `{ outcome: "studio.clarify.cannotAnswer", reason? }` → throw
 * - `{ cannotAnswer: true, reason? }` → throw
 * - `{ answer: {...} }` / `{ outcome: "answered", answer: {...} }`
 */
export function normalizeClarifyResult<
  TAnswer extends Record<string, unknown> = Record<string, unknown>,
>(
  raw: unknown,
  answerInterface: BrainAnswerInterface,
): BrainClarifyResult<TAnswer> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throwClarifyCannotAnswer('invalid_clarify_payload');
  }
  const obj = raw as Record<string, unknown>;

  if (
    obj.outcome === STUDIO_CLARIFY_CANNOT_ANSWER ||
    obj.outcome === 'studio.clarify.cannotAnswer' ||
    obj.cannotAnswer === true
  ) {
    throwClarifyCannotAnswer(
      typeof obj.reason === 'string' ? obj.reason : undefined,
    );
  }

  let answerRaw: Record<string, unknown> | undefined;
  if (
    obj.answer &&
    typeof obj.answer === 'object' &&
    !Array.isArray(obj.answer)
  ) {
    answerRaw = obj.answer as Record<string, unknown>;
  } else if ('outcome' in obj || 'cannotAnswer' in obj) {
    throwClarifyCannotAnswer(
      typeof obj.reason === 'string' ? obj.reason : 'missing_answer',
    );
  } else {
    answerRaw = obj;
  }

  const filtered = filterClarifyAnswer(answerRaw, answerInterface);
  if (requiredFieldsMissing(filtered, answerInterface)) {
    throwClarifyCannotAnswer('required_fields_missing', {
      answer: filtered,
    });
  }
  return { answer: filtered as TAnswer };
}

export function clarifiableInputToString(input: ClarifiableInput): string {
  if (input === null || input === undefined) {
    return '';
  }
  if (typeof input === 'string') {
    return input;
  }
  if (
    typeof input === 'number' ||
    typeof input === 'boolean' ||
    typeof input === 'bigint'
  ) {
    return String(input);
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  try {
    return String(input);
  } catch {
    return '';
  }
}

export function emptyAnswerFromInterface(
  answer: BrainAnswerInterface,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of answer.fields ?? []) {
    out[field.key] = null;
  }
  return out;
}

/** Keep only keys declared on the answer interface; sanitize string values fail-closed. */
export function filterClarifyAnswer(
  raw: Record<string, unknown> | null | undefined,
  answer: BrainAnswerInterface,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const allowed = new Set((answer.fields ?? []).map((f) => f.key));
  if (!raw || typeof raw !== 'object') {
    return out;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) continue;
    if (typeof value === 'string') {
      const sanitized = sanitizeExtractedFieldValue(value);
      if (sanitized === undefined) continue;
      out[key] = sanitized;
      continue;
    }
    out[key] = value;
  }
  return out;
}
