/**
 * Ways of pointing at somebody.
 *
 * §7 of `docs/VIDEO_PODCAST_ROADMAP.md`: "no real person's name, voice or
 * likeness in any persona preset or character sheet." It reads as a rule about
 * personas and it is not — the same sentence typed into a B-roll shot gets the
 * same clip, so the rule belongs wherever free text reaches a generative model.
 *
 * Two callers now, which is why this is its own file rather than a copy:
 * `personas.mjs` checks a persona's appearance note, `broll.mjs` checks what a
 * shot is of. A rule enforced in one of two places is a rule with a door next
 * to it.
 *
 * This is the half that transfers. The other half of the persona check — no
 * capital letter after the first — does not, because a shot's subject is a
 * noun phrase that may legitimately begin a proper noun the app itself wrote,
 * and `broll.mjs` has its own rules instead.
 */

const POINTS_AT = [
  /\b(?:like|resembling|resembles|modell?ed (?:on|after)|based on|inspired by|a la|à la)\b/i,
  /\bin the (?:style|manner|likeness) of\b/i,
  /\b(?:lookalike|look-alike|doppelg[aä]nger|impression of|cosplay(?:ing)? as)\b/i,
  /\b(?:vibes?|energy|aura)\s+of\b/i,
  /-(?:like|esque|core)\b/i,
];

/**
 * The phrase that points, or undefined.
 *
 * Returns the match rather than a boolean so the caller can quote it back:
 * "note points at somebody (\"like\")" is a message somebody can act on, and
 * "invalid note" is one they argue with.
 */
export function pointsAtSomebody(text) {
  for (const pattern of POINTS_AT) {
    const hit = String(text ?? '').match(pattern);
    if (hit) return hit[0];
  }
  return undefined;
}
