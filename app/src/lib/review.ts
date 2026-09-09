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

/**
 * The saved review history, read back before anything iterates it.
 *
 * Three places take `Object.values(reviews)` and read a number off each —
 * `totals` below, `seenSince` in `lib/revise.ts` and the Study screen's own
 * top line in `lib/softtop.ts`. None of them can check first, because a record
 * this build wrote holds only whole reviews. `state/shape.ts` read it as
 * `saved.reviews ?? {}`, and `??` catches null and undefined for the record
 * itself and says nothing about what is in it.
 *
 * Measured with a single `null` under one card's key: `Cannot read properties
 * of null (reading 'seen')` from `softtop.ts`, uncaught, and the app blank
 * from Study onward.
 *
 * This is also the one record worth being careful with. It is a term of spaced
 * repetition — the thing the app cannot rebuild and the student cannot retype
 * — and it syncs, so a half-written copy is a real shape rather than a
 * hypothetical one. A value that is not an object is dropped, because there is
 * no history in it to keep; one that is has every number read back as a
 * number, so a card with a damaged field keeps the rest of its record.
 */
export function readReviews(raw: unknown): Reviews {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Reviews = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const r = value as Partial<CardReview>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    out[key] = {
      ...r,
      right: n(r.right),
      wrong: n(r.wrong),
      streak: n(r.streak),
      // The two SM-2 constants have real defaults rather than zero: an ease of
      // nought would make every interval nought and the card would never leave
      // the front of the queue.
      ease: typeof r.ease === 'number' && Number.isFinite(r.ease) ? r.ease : START_EASE,
      interval: n(r.interval),
      seen: n(r.seen),
      due: n(r.due),
    } as CardReview;
  }
  return out;
}

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

/**
 * The longest a card can be pushed out.
 *
 * The interval compounds — six, then times the ease each time — and the ease
 * runs to 3.2, so it grows without limit. Measured, answering one card right
 * on the day it came round every time:
 *
 *     right #6   393 days      due 2028-04-23
 *     right #7   1,218 days    due 2031-08-24
 *     right #17  1.37e8 days   due beyond what a Date can hold
 *
 * Nothing draws `due` as a date, so there is no "Invalid Date" on screen; what
 * there is, past the seventeenth, is a timestamp that has stopped being one.
 * Every comparison in this file still works on it, which is why this was
 * invisible.
 *
 * A hundred years is Anki's own default and is chosen the same way: it is far
 * outside any schedule a person is really keeping, so it changes nothing for
 * anybody, and it keeps the number a number.
 *
 * It is deliberately *not* a semester-length cap. Whether a card answered
 * right six times in three weeks should be retired until 2028 — while
 * `strength` below reports it at 1.00 for ever, because it only decays a card
 * that is past due — is a question about what this app is for, and that is the
 * author's to answer rather than a bug to fix quietly.
 */
const MAX_INTERVAL = 36_500;

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
export function score(
  prev: CardReview | undefined,
  got: boolean,
  now: number,
  /**
   * Cut the interval even though the answer was right.
   *
   * Set for a right answer the student said they guessed at. Letting a guess
   * start a three-day interval is how a card disappears until the week of the
   * exam — see `lib/sure.ts`, which decides this and hands it in rather than
   * this file learning about confidence.
   */
  soon = false,
): CardReview {
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
  const grown = streak === 1 ? 1 : streak === 2 ? 6 : Math.round(r.interval * r.ease);
  // A guess that happened to be right earns the streak but not the runway: it
  // comes back tomorrow rather than in a week, and the ease does not grow.
  const interval = soon ? 1 : Math.min(MAX_INTERVAL, grown);
  return {
    right: r.right + 1,
    wrong: r.wrong,
    streak,
    ease: soon ? r.ease : Math.min(3.2, r.ease + 0.1),
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

/**
 * How many of these are waiting: never met, or come round again.
 *
 * The lumped number, and the right one for a queue — a drill has the same
 * work to do either way, which is why `Drill` counts with this and calls it
 * "waiting".
 *
 * It is the wrong number to call *due*. See {@link comeRound}.
 */
export function dueCount(keys: string[], reviews: Reviews, now: number): number {
  return keys.filter((k) => {
    const r = reviews[k];
    return !r || r.seen === 0 || r.due <= now;
  }).length;
}

/**
 * Cards that have genuinely come round: answered before, and due again now.
 *
 * The distinction {@link dueCount} deliberately does not make, and the one any
 * sentence with the word "due" or "review" in it has to. A card you have never
 * seen has not come round — nothing went out, so nothing came back — and a
 * course where you have answered one card of a hundred and seven was being
 * told that a hundred and one had "come round for review", which is a backlog
 * the student created by studying. The first answer in a course should not
 * produce a hundred-card debt.
 */
export function comeRound(keys: string[], reviews: Reviews, now: number): number {
  return keys.filter((k) => {
    const r = reviews[k];
    return !!r && r.seen > 0 && r.due <= now;
  }).length;
}

/** Cards nobody has answered yet — new material rather than a backlog. */
export function neverMet(keys: string[], reviews: Reviews): number {
  return keys.filter((k) => {
    const r = reviews[k];
    return !r || r.seen === 0;
  }).length;
}

export interface Tally {
  /** Distinct cards answered at least once. Never more than the deck holds. */
  cards: number;
  right: number;
  wrong: number;
  /** Right as a share of every answer given, rounded. Zero when none were. */
  pct: number;
}

/** Totals for a progress read-out: reviewed, right, and the running accuracy. */
export function tally(reviews: Reviews): Tally {
  return totals(Object.values(reviews));
}

/**
 * The same totals for a named set of cards.
 *
 * `tally` reads the whole review map, which is right for a diagnostics dump
 * and wrong for a screen: the map keeps the answers you gave to a course you
 * removed in September, and a screen reporting this term's studying would
 * count them. Hand over the keys of the decks that exist and it cannot.
 */
export function tallyKeys(keys: string[], reviews: Reviews): Tally {
  return totals(keys.map((k) => reviews[k]).filter((r): r is CardReview => Boolean(r)));
}

/** The arithmetic both of the above are, so there is one copy of it. */
function totals(all: CardReview[]): Tally {
  const rows = all.filter((r) => r.seen > 0);
  const right = rows.reduce((n, r) => n + r.right, 0);
  const wrong = rows.reduce((n, r) => n + r.wrong, 0);
  const answered = right + wrong;
  return { cards: rows.length, right, wrong, pct: answered ? Math.round((right / answered) * 100) : 0 };
}

/**
 * The same tally, split by course.
 *
 * A card's key is a hash of its question, so a course cannot be recovered from
 * one — the caller hands over each course's questions and the keys are
 * recomputed. Done this way round so this file stays free of the catalogue,
 * which imports half the app.
 *
 * Only cards you have actually answered count. A deck of two hundred you have
 * never opened is not evidence of anything.
 */
export function tallyBy(
  reviews: Reviews,
  decks: { courseId: string; questions: string[] }[],
): Record<string, { right: number; wrong: number }> {
  const out: Record<string, { right: number; wrong: number }> = {};
  for (const deck of decks) {
    let right = 0;
    let wrong = 0;
    for (const q of deck.questions) {
      const r = reviews[cardKey(deck.courseId, q)];
      if (!r || r.seen === 0) continue;
      right += r.right;
      wrong += r.wrong;
    }
    if (right + wrong > 0) out[deck.courseId] = { right, wrong };
  }
  return out;
}
