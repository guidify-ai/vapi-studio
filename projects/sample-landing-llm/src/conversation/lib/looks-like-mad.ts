/** Angry / abusive caller language — mad portal, not discovery answers. */
export function looksLikeMad(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 3) return false;
  if (
    /\b(fuck|fucking|shit|asshole|idiot|stupid|dumbass|shut\s*up|useless|hate\s+(you|this)|go\s+to\s+hell|kill\s+yourself|motherfuck|damn\s+you|screw\s+you|you\s+suck|piece\s+of\s+shit)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  return /^(shut up|fuck you|screw you|you suck)[.!\s]*$/i.test(t);
}

/** Soft resume from a portal — never a discovery answer. */
export function looksLikeSoftContinue(userText: string): boolean {
  const t = userText.trim();
  if (!t || looksLikeMad(t)) return false;
  if (
    /^(sorry[,.]?\s*)?(ok|okay|sure|alright|continue|let'?s continue|go on|resume|keep going|i'?m fine|never ?mind)[.!]?\s*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return (
    t.length <= 48 &&
    /\b(continue|resume|go on|keep going)\b/i.test(t) &&
    !/\b(name|phone|transfer|caller|lead|book|crm)\b/i.test(t)
  );
}

/** Keyboard-mash / nonsense — unknown portal, not a use-case or discovery answer. */
export function looksLikeGibberish(userText: string): boolean {
  const t = userText.trim().toLowerCase();
  if (!t || looksLikeMad(t)) return false;
  if (/\b(asdf|qwer|zxcv|lorem|test123)\b/.test(t)) return true;
  if (/^(aaa+|bbb+|xyz+|asdf|qwer|zxcv)[.!\s]*$/.test(t)) return true;
  const letters = t.replace(/[^a-z]/g, '');
  if (letters.length >= 8) {
    const vowels = (letters.match(/[aeiou]/g) || []).length;
    if (vowels / letters.length < 0.12) return true;
  }
  return false;
}
