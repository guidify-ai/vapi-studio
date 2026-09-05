/**
 * Soft affirmatives / refusals for yes-no and menu recovery.
 * Colloquial yes (“yeah, why not”) must not fall through to Brain/unknown.
 */

export function looksLikeSoftAffirmative(text: string): boolean {
  const t = text.toLowerCase().replace(/\.{2,}/g, ' ').trim();
  if (!t) return false;
  // “why not” is affirmative; do not treat the embedded “not” as refusal.
  if (/\bwhy\s+not\b/.test(t)) return true;
  if (looksLikeSoftNegative(t)) return false;
  return /\b(yes|yeah|yep|yeap|yup|sure|ok|okay|please|fine|absolutely|of\s*course|go\s*ahead|sounds\s*good|that\s*works|this\s*number|let'?s\s*do\s*it)\b/.test(
    t,
  );
}

export function looksLikeSoftNegative(text: string): boolean {
  const t = text.toLowerCase().replace(/\.{2,}/g, ' ').trim();
  if (!t) return false;
  if (/\bwhy\s+not\b/.test(t)) return false;
  if (
    /\b(no\s*thanks|not\s*now|pass|decline|nope|nah|don't|do\s*not|prefer\s*not|wrap\s*up|goodbye|good\s*bye|hang\s*up|that'?s\s*all|all\s*set)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return /^(no|nope|nah)[.!?]*$/.test(t);
}

/** Appointment / visit lane named explicitly. */
export function looksLikeAppointmentLane(text: string): boolean {
  return /\b(appoint|appt|schedule|book|visit|come\s*out)\b/i.test(text);
}

/** Instant estimate / quote lane named explicitly. */
export function looksLikeInstantEstimateLane(text: string): boolean {
  return /\b(estimate|instant|quote|pricing|price)\b/i.test(text);
}
