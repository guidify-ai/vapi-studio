/** Soft praise of the sample — not a change request. */
export function looksLikeSamplePraise(userText: string): boolean {
  const t = userText.trim();
  if (!t || t.length > 100) return false;
  if (
    /\b(change|fix|tweak|wrong|rewrite|instead|unnatural|update the sample)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  return (
    /\b(looks (nearly |pretty |almost |really )?good|nearly good|pretty good|almost good|good enough|sounds good|looks great)\b/i.test(
      t,
    ) || /^(ok|okay|thanks|great|perfect|fine|sure|good)[.!]?\s*$/i.test(t)
  );
}

/** Soft “all good / nothing else” after sample — close, never a correction. */
export function looksLikeSatisfiedClose(userText: string): boolean {
  const t = userText.trim();
  if (!t || t.length > 80) return false;
  if (
    /\b(change|fix|tweak|wrong|rewrite|instead|unnatural|update the sample)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  if (
    /^(no[,.]?\s*)?(all good|all set|i'?m good|we'?re good|that'?s (all|it|fine|good)|nothing else|no thanks|i'?m done|done|nope)[.!]?\s*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /\b(nothing else|all good|all set|that'?s all|no thanks|i'?m (all )?done)\b/i.test(
    t,
  );
}
