/**
 * Boxed identity / PII helpers for voice agents.
 *
 * Prefer the dedicated import path so apps do not dig through the main barrel:
 *
 * ```ts
 * import {
 *   EMAIL_EXTRACT_DESCRIPTION,
 *   collectedEmail,
 *   parseSpelledEmail,
 * } from '@guidify-ai/vapi-studio/identity';
 * ```
 *
 * Also re-exported from `@guidify-ai/vapi-studio`.
 */

export {
  EMAIL_EXTRACT_DESCRIPTION,
  collectedEmail,
  parseSpelledEmail,
} from './email-parse';
