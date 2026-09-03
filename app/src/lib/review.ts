/**
 * What you actually know, measured rather than declared.
 *
 * Until now every mastery figure in the app was a static number that shipped
 * with the guide. Drilling a unit twenty times moved nothing: `markCard` bumped
 * a counter that lived in ephemeral state and was thrown away when you left the
 * screen. So "your weakest unit" was fixed for the semester, tonight's plan
 * recommended the same units every night, and the end-of-drill screen promised
 * "missed ones come back first tomorrow" while keeping no record of what you
 * missed. The app looked adaptive and was not.
 *
 * This is the missing half. Every answer is recorded against the card, the card
 * is scheduled by a plain SM-2 variant, and a unit's mastery is computed from
 * its cards instead of asserted.
 *
 * **On the seeded numbers.** The four hand-built guides ship with real mastery
 * estimates written by a person reading the material. Those stay meaningful for
 * a card you have never seen — throwing them away would show a new install 0%
 * everywhere and make "weakest unit" a coin toss on day one. So a unit blends:
 * a card you have answered is scored on your answers, and a card you have not
 * keeps the guide's estimate. Your own evidence displaces the estimate one card
 * at a time.
 */

export interface CardReview {
  /** Times answered correctly, ever. */
  right: number;
  /** Times missed, ever. */
  wrong: number;
  /** Consecutive correct answers. Reset to 0 by a miss. */
  streak: number;
  /** SM-2 ease factor: how fast this card's interval grows. */
  ease: number;
  /** Days until it is due again, from the last answer. */
  interval: number;
  /** When it was last answered, epoch ms. */
  seen: number;
  /** When it comes up again, epoch ms. */
  due: number;
}

export type Reviews = Record<string, CardReview>;

const DAY = 86_400_000;
const MIN_EASE = 1.3;
const START_EASE = 2.5;

/**
 * A stable key for a card.
 *
 * Cards are `{q, a}` with no id, so identity has to come from the content. The
 * question is what identifies a card to a person, so it is what identifies it
 * here: hashed, because the raw text would put kilobytes of duplicated prose in
 * localStorage and then in every sync.
 *
 * The trade-off is stated plainly: reword a question and its history starts
 * over. That is the right failure — a materially different question deserves to
 * be re-learned, and pretending otherwise would credit you for work you did on
 * a different card.
 */
export function cardKey(courseId: string, question: string): string {
  // FNV-1a, 32-bit. Small, fast, and good enough for a few thousand cards.
  let h = 0x811c9dc5;
  for (let i = 0; i < question.length; i++) {
    h ^= question.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${courseId}:${(h >>> 0).toString(36)}`;
}

export function emptyReview(now: number): CardReview {
  return { right: 0, wrong: 0, streak: 0, ease: START_EASE, interval: 0, seen: 0, due: now };
}

/**
 * Fold one answer into a card's record.
 *
 * Standard SM-2 shape, with the grades collapsed to the two the drill actually
 * offers. A miss does not send the card to the back of a queue days away; it
 * comes back in the same sitting, which is the whole reason to say you missed
 * it.
 */
export function score(prev: CardReview | undefined, got: boolean, now: number): CardReview {
  const r = prev ?? emptyReview(now);

  if (!got) {
    return {
      ...r,
      wrong: r.wrong + 1,
      streak: 0,
      ease: Math.max(MIN_EASE, r.ease - 0.2),
      interval: 0,
      seen: now,
      // Ten minutes: back before you leave, not back next week.
      due: now + 10 * 60_000,
    };
  }

  const streak = r.streak + 1;
  const interval = streak === 1 ? 1 : streak === 2 ? 6 : Math.round(r.interval * r.ease);
  return {
    right: r.right + 1,
    wrong: r.wrong,
    streak,
    ease: Math.min(3.2, r.ease + 0.1),
    interval,
    seen: now,
    due: now + interval * DAY,
  };
}

/**
 * How well one card is known, by streak: missed, then one, two, three right.
 *
 * The curve is not linear, and the reason is worth stating. A linear
 * streak/3 makes the first correct answer worth 0.33 — below the ~50% a guide
 * typically claims for an unseen unit — so drilling a unit *correctly* made
 * the number on screen go down. Watching your mastery fall for getting things
 * right is the fastest way to stop trusting a study app. One right answer is
 * real evidence and lands near the middle; three running is knowing it.
 */
const STEP = [0.15, 0.5, 0.8, 1];

/**
 * How well one card is known, 0–1.
 *
 * Being overdue costs, because a card you last saw six weeks ago is not a card
 * you know today.
 */
export function strength(r: CardReview, now: number): number {
  if (r.seen === 0) return 0;
  const base = STEP[Math.min(r.streak, 3)];
  if (r.due >= now) return base;
  // Past due: decay toward half over roughly one further interval.
  const over = (now - r.due) / Math.max(DAY, r.interval * DAY);
  return base * Math.max(0.35, 1 - over * 0.5);
}

/**
 * A unit's mastery as a percentage, blending measurement with the estimate.
 *
 * `seeded` is what the guide claimed; it stands in for every card you have not
 * answered yet, so a fresh install still reads sensibly and each answer moves
 * the number by exactly one card's worth.
 */
export function unitMastery(
  keys: string[],
  reviews: Reviews,
  seeded: number,
  now: number,
): number {
  if (keys.length === 0) return seeded;
  const total = keys.reduce((sum, k) => {
    const r = reviews[k];
    return sum + (r && r.seen > 0 ? strength(r, now) : seeded / 100);
  }, 0);
  return Math.round((total / keys.length) * 100);
}

/** Cards due now, hardest first — what a drill should actually put in front of you. */
export function dueFirst<T extends { key: string }>(cards: T[], reviews: Reviews, now: number): T[] {
  const rank = (c: T) => {
    const r = reviews[c.key];
    if (!r || r.seen === 0) return 1; // unseen: after anything overdue, before the known
    if (r.due <= now) return 0; // due or overdue: first
    return 2; // not due: last
  };
  return [...cards].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    // Within a band, the weakest first.
    return strength(reviews[a.key] ?? emptyReview(now), now) -
      strength(reviews[b.key] ?? emptyReview(now), now);
  });
}

/** How many of these are due right now. Drives "N cards waiting" copy. */
export function dueCount(keys: string[], reviews: Reviews, now: number): number {
  return keys.filter((k) => {
    const r = reviews[k];
    return !r || r.seen === 0 || r.due <= now;
  }).length;
}

/** Totals for a progress read-out: reviewed, right, and the running accuracy. */
export function tally(reviews: Reviews): { cards: number; right: number; wrong: number; pct: number } {
  const rows = Object.values(reviews).filter((r) => r.seen > 0);
  const right = rows.reduce((n, r) => n + r.right, 0);
  const wrong = rows.reduce((n, r) => n + r.wrong, 0);
  const answered = right + wrong;
  return { cards: rows.length, right, wrong, pct: answered ? Math.round((right / answered) * 100) : 0 };
}
