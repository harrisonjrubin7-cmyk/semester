/**
 * Marking an answer somebody typed, rather than one they picked.
 *
 * Every question this app has asked so far has been answered by tapping one of
 * a set it drew itself: four options, two, or four pairs. That shape is easy to
 * mark and it has a ceiling — recognising the right answer among four is a
 * different and easier thing than producing it, and the exam asks for the
 * second. `docs/STUDY_REQUIREMENTS.md` has asked for fill-in-the-blank and
 * short-answer questions since before the app had a quiz screen, and both of
 * them come down to one problem this file exists to solve: **deciding whether
 * what somebody typed is the answer.**
 *
 * ## The two ways to get that wrong, and they are not symmetric
 *
 * Mark too strictly and a student who knew it is told they did not. A missing
 * accent, a capital letter, a trailing full stop, "the" in front — none of
 * those is the thing being tested, and a quiz that fails somebody for one is a
 * quiz they stop trusting after the second time.
 *
 * Mark too loosely and the reverse happens, and it is worse. A tolerance wide
 * enough to turn `oligopoly` into `monopoly` does not forgive a typo; it marks
 * a wrong answer right and tells the student they know something they do not.
 * That is the failure this app can least afford, because the whole point of
 * `lib/knowing.ts` is that a mastery figure is read off evidence — and evidence
 * that says you knew a term you could not produce is not evidence.
 *
 * So the rule here is deliberately lopsided. Normalisation is generous, and
 * the typo tolerance is narrow **and conditional**: a near-miss is accepted
 * only when it is not also a near-miss for some other term in the same guide.
 * A tolerance that turns one term into another is not a tolerance, it is a
 * wrong answer marked right.
 */

/**
 * The form two answers are compared in.
 *
 * Everything removed here is something a person could differ on while knowing
 * the answer perfectly well:
 *
 *   * **case**, obviously;
 *   * **accents**, because a phone keyboard makes `naïve` hard work and the
 *     distinction is never what a term is testing;
 *   * **punctuation**, including the full stop somebody ends a sentence with
 *     out of habit and the hyphen in `cost-benefit` that half the world writes
 *     as two words;
 *   * **a leading article**, because "the invisible hand" and "invisible hand"
 *     are one term, and which one a guide happened to write it as is not a
 *     fact about the student;
 *   * **repeated whitespace**, which is what a fast typist produces.
 *
 * Deliberately *not* removed: a trailing `s`. Stripping it would make `good`
 * and `goods` the same string, and in the economics guide those are two
 * different entries. The typo tolerance below reaches a plural by one edit
 * anyway, and reaches it *conditionally*, which is the difference that
 * matters — an unconditional rule cannot tell the two cases apart and this
 * one can.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    // Combining marks, which is what NFD has just split the accents into.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Punctuation and symbols to spaces rather than to nothing: `cost-benefit`
    // has to become `cost benefit` and not `costbenefit`, or it stops matching
    // the guide that wrote it as two words.
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^(?:the|a|an)\s+/, '')
    .replace(/\s+/g, ' ');
}

/**
 * Levenshtein distance, stopped early.
 *
 * `cap` is not an optimisation with a rounding error in it — it is what makes
 * the answer usable. Every caller here asks "is this within one or two edits",
 * never "how far apart are these", and a full matrix over two long answers to
 * report a distance of 31 is work done to throw away. Bounded, the loop also
 * cannot be made expensive by somebody pasting a paragraph into the box.
 */
export function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  // A length gap larger than the cap cannot be closed: each edit changes the
  // length by at most one.
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      row.push(v);
      if (v < best) best = v;
    }
    // Every cell of this row is already past the cap, and a later row can only
    // be larger — the distance is at least `best` from here on.
    if (best > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * How far off a typed answer may be and still count.
 *
 * Proportional, because one edit in `gdp` is a third of the word and one edit
 * in `comparative advantage` is a slip of the thumb. Flat tolerance does the
 * wrong thing at both ends: a single edit on a three-letter term is enough to
 * reach a different three-letter term, and two edits on a twenty-letter phrase
 * is a stricter test than anybody types to.
 *
 * Short answers therefore get **nothing**. That is not an oversight. A
 * four-letter term has too few neighbours-at-distance-one for the guard below
 * to be doing any work, and a student who cannot spell a four-letter term has
 * not produced it.
 */
export function tolerance(answer: string): number {
  if (answer.length <= 4) return 0;
  if (answer.length <= 10) return 1;
  return 2;
}

/** What marking a typed answer concluded, and why. */
export type Judgement =
  /** Typed the answer, or near enough that nothing else it could be. */
  | { ok: true; exact: boolean }
  /**
   * Not the answer.
   *
   * `confusedWith` is set only in the case worth telling somebody about: what
   * they typed was within the tolerance of the right answer **and** of another
   * term, so it was refused for being ambiguous rather than for being far off.
   * The screen can say so — "that is within a letter of two different terms" is
   * a more useful thing to read than "wrong", and it is the one case where a
   * student is entitled to feel hard done by.
   */
  | { ok: false; confusedWith?: string };

/**
 * Whether what somebody typed is the answer.
 *
 * `others` is every *other* answer the same guide could have wanted — the
 * guide's own terms, minus this one. It is what makes the tolerance safe, and
 * it is a required argument rather than an optional one on purpose: a caller
 * that does not have the list should not be getting a lenient mark, and making
 * it optional is how the guard quietly stops running.
 *
 * The order of the tests is the argument:
 *
 *  1. **An exact match is an exact match.** Checked before anything else so
 *     that a correct answer is never refused for being close to something —
 *     a student who types `monopoly` when the answer is `monopoly` is right
 *     even though `monopsony` exists.
 *  2. **Otherwise, within tolerance of the answer**, or it is wrong.
 *  3. **And no closer to, or equally close to, anything else.** This is the
 *     line that stops the tolerance inventing knowledge. `oligopoly` typed
 *     against an answer of `monopoly` is two edits away — inside the
 *     tolerance for a word that length — and it is also exactly `oligopoly`,
 *     which is another term in the same guide. Accepting it would tell
 *     somebody they knew the difference between the two things they had just
 *     demonstrated they did not.
 */
export function judge(typed: string, answer: string, others: string[]): Judgement {
  const t = normalise(typed);
  const a = normalise(answer);
  if (!t) return { ok: false };
  if (t === a) return { ok: true, exact: true };

  const room = tolerance(a);
  if (room === 0) return { ok: false };

  const d = editDistance(t, a, room);
  if (d > room) return { ok: false };

  for (const other of others) {
    const o = normalise(other);
    if (!o || o === a) continue;
    const rival = editDistance(t, o, d);
    if (rival <= d) return { ok: false, confusedWith: other };
  }

  return { ok: true, exact: false };
}
