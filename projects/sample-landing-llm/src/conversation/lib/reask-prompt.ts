/**
 * Shared “didn’t quite get it” preface for re-asks of the same question.
 * First ask: `firstAsk`. Misheard answer → ask again: `reask`.
 */

export const DIDNT_QUITE_GET_IT =
  "I'm sorry, I didn't quite get it. ";

export type AskAttemptMemory = {
  askAttempts?: Record<string, number>;
};

/** Stable keys for intake questions that may be re-asked. */
export const ASK = {
  dayOrTime: 'dayOrTime',
  address: 'address',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  timeline: 'timeline',
  slope: 'slope',
  addressMatch: 'addressMatch',
  appointmentSlot: 'appointmentSlot',
  formSendConsent: 'formSendConsent',
  smsDestination: 'smsDestination',
  contactPhone: 'contactPhone',
  phoneConfirm: 'phoneConfirm',
  voiceFallback: 'voiceFallback',
  existingProject: 'existingProject',
  profileVerify: 'profileVerify',
  formConfirm: 'formConfirm',
  formReceiptConfirm: 'formReceiptConfirm',
  formFixPick: 'formFixPick',
  formFixValue: 'formFixValue',
} as const;

/** First (or intentional fresh) ask of a question — no sorry preface. */
export function firstAsk(
  memory: AskAttemptMemory,
  key: string,
  question: string,
): string {
  const bag = (memory.askAttempts ??= {});
  bag[key] = 1;
  return question;
}

/**
 * Same question again because the answer was missing / unusable.
 * attempt > 1 → "I'm sorry, I didn't quite get it. " + question.
 */
export function reask(
  memory: AskAttemptMemory,
  key: string,
  question: string,
): string {
  const bag = (memory.askAttempts ??= {});
  const next = (bag[key] ?? 1) + 1;
  bag[key] = next;
  return next > 1 ? DIDNT_QUITE_GET_IT + question : question;
}

/** First ask, or re-ask with sorry preface if this question was already asked. */
export function askOrReask(
  memory: AskAttemptMemory,
  key: string,
  question: string,
): string {
  const prior = memory.askAttempts?.[key] ?? 0;
  return prior >= 1
    ? reask(memory, key, question)
    : firstAsk(memory, key, question);
}

export function clearAsk(memory: AskAttemptMemory, key: string): void {
  if (memory.askAttempts) delete memory.askAttempts[key];
}
