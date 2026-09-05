/** Registered A/B tests for the Roofr PoC (persisted per caller). */

export type AbVariant = 'A' | 'B';

export const GREETING_AB_TEST_ID = 'greeting_v1' as const;

export const AB_EVENTS = {
  /** First durable assignment of a variant for this caller. */
  REGISTERED: 'AB_TEST_REGISTERED',
  /** Greeting text for the assigned variant was spoken. */
  GREETING_USED: 'GREETING_AB_USED',
} as const;

/** Stable 50/50 assignment. */
export function pickAbVariant(): AbVariant {
  return Math.random() < 0.5 ? 'A' : 'B';
}

function companyName(): string {
  return process.env.POC_COMPANY_NAME?.trim() || 'Roofr';
}

/** Consent line — private, professional (no buddy language). */
function consentLine(variant: AbVariant): string {
  const company = companyName();
  if (variant === 'B') {
    return `Hello, you've reached ${company}. This call may be recorded, and by continuing you consent to the processing of your information.`;
  }
  return `Thank you for calling ${company}. This call is being recorded, and by continuing you consent to the processing of your information.`;
}

/** New / unrecognized caller — ask how we can help. */
export function introFirstMessage(variant: AbVariant = 'A'): string {
  return `${consentLine(variant)} How can I help you today?`;
}

/**
 * Returning caller with a known first name — name the recognition, then confirm.
 * Do not ask “how can I help” until identity is confirmed.
 */
export function introReturningCallerMessage(
  firstName: string,
  variant: AbVariant = 'A',
): string {
  const name = firstName.trim() || 'there';
  return (
    `${consentLine(variant)} ` +
    `I see ${name} is calling back — am I speaking with ${name}?`
  );
}
