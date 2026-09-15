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
  const interval = soon ? 1 : grown;
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
 * The most cards one sitting hands you.
 *
 * A drill with no ceiling is the thing that ends studying. Come back after
 * reading week and `dueFirst` is perfectly happy to deal out two hundred and
 * forty cards, and the screen's only honest promise is that it will take an
 * hour — so it does not get started, and the backlog grows again. Anki's
 * daily limit is the oldest setting in spaced repetition and it exists for
 * exactly this: the work has to look finishable from the first card.
 *
 * Twenty-five rather than a number somebody tunes. It is about ten minutes at
 * this app's pace, it is the length of the gap between two classes — which is
 * when this screen is actually opened — and a cap you can change is a cap
 * somebody raises once, drowns, and never comes back to. Going again is one
 * press (`redrill`), so the ceiling costs nothing to anybody who wants more.
 */
export const A_SITTING = 25;

/** A sitting's worth of cards, and how many it left behind. */
export interface Sitting<T> {
  cards: T[];
  /** Still waiting after this run. Zero means the deck is clear. */
  left: number;
}

/**
 * The front of an ordered deck, with the remainder counted rather than hidden.
 *
 * Takes an already-ordered list — `dueFirst` decides *which* cards matter, and
 * this only decides how many of them one sitting is. Keeping those apart means
 * the cap can never quietly change the order, which is the way a limit turns
 * into "it keeps showing me the easy ones".
 *
 * The count comes back because a run that silently dropped two hundred cards
 * would be lying by omission: the end of the sitting says what is left, which
 * is the number that makes going again a decision rather than a guess.
 */
export function aSitting<T>(ordered: T[], most = A_SITTING): Sitting<T> {
  return { cards: ordered.slice(0, most), left: Math.max(0, ordered.length - most) };
}

/**
 * Misses before a card is called out as one you keep failing.
 *
 * Anki calls these leeches and suspends them at eight lapses. Six here, and
 * the streak condition matters more than the number: a card you missed six
 * times two months ago and have since got right four times running is a card
 * you learned, and calling it a problem would be reading your history
 * backwards.
 */
export const KEEPS_CATCHING = 6;

/**
 * A card that keeps catching you out.
 *
 * Worth naming rather than grinding. A miss sets the interval to zero and the
 * next showing to ten minutes, which is right for a card you nearly knew and
 * is a treadmill for one you do not: it comes back, and back, and the schedule
 * has no way of ever concluding that the *card* is the problem — that it asks
 * two things at once, or that the answer is a paragraph.
 *
 * So the app says so and leaves it there. It does not suspend the card the way
 * Anki does, because these cards are generated from the student's own course
 * material rather than typed by them, and hiding part of a syllabus to make a
 * number go up is the wrong trade in a study app. Naming it is what lets
 * somebody go and look at the reading instead of pressing Again for the ninth
 * time.
 */
export function keepsCatching(r: CardReview | undefined): boolean {
  return Boolean(r && r.wrong >= KEEPS_CATCHING && r.streak < 2);
}

/** The ones out of this deck that keep catching you, worst first. */
export function catching<T extends { key: string }>(cards: T[], reviews: Reviews): T[] {
  return cards
    .filter((c) => keepsCatching(reviews[c.key]))
    .sort((a, b) => (reviews[b.key]?.wrong ?? 0) - (reviews[a.key]?.wrong ?? 0));
}

/**
 * The caller's keys, with any key named twice read once.
 *
 * Every count below is a count of *cards*, and a key is a card — so a list
 * naming one twice has to be read as naming it once, whoever built the list.
 * The four counts here take the keys rather than the deck, which is what keeps
 * this file clear of the catalogue, and is also what makes the assumption
 * silent: nothing in a `string[]` says the caller de-duplicated it.
 *
 * It had not. Each shipped guide's self-test recaps a question or two from its
 * units, and the flattening that built these lists emitted both copies — so
 * one card counted twice in five decks, and the Study screen's figures ran one
 * high per course against reviews that only ever held one row. `allCards` in
 * `data/catalog` collapses that at the source now. This is the half of the fix
 * that does not depend on the next caller knowing to.
 *
 * Applied to the five that count or sum per key — {@link dueCount},
 * {@link comeRound}, {@link neverMet}, {@link tallyKeys} and {@link tallyBy}.
 * Not to {@link unitMastery}, which averages, so a key twice contributes the
 * same value to both halves of the fraction and the percentage does not move;
 * nor to {@link anyAnswered}, which asks whether any key at all qualifies.
 * Those two are right on a repeated list already, and a `Set` they do not need
 * would only suggest they had been wrong.
 */
const distinct = (keys: string[]): string[] => (keys.length > 1 ? [...new Set(keys)] : keys);

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
  return distinct(keys).filter((k) => {
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
  return distinct(keys).filter((k) => {
    const r = reviews[k];
    return !!r && r.seen > 0 && r.due <= now;
  }).length;
}

/** Cards nobody has answered yet — new material rather than a backlog. */
export function neverMet(keys: string[], reviews: Reviews): number {
  return distinct(keys).filter((k) => {
    const r = reviews[k];
    return !r || r.seen === 0;
  }).length;
}

/**
 * Has anything here been answered at all?
 *
 * The question `unitMastery` cannot answer about its own result. That function
 * blends what has been answered with the figure the guide declared, and the
 * declared figure stands in for every card not answered yet — so before the
 * first answer it returns the guide's number, and nothing in the number says
 * so. A caller that draws it as measured is drawing an estimate wearing a
 * measurement's clothes: "49% mastered" for a course nobody has opened, and —
 * worse, because it is advice — "all 11 units are above 40%, keep them warm"
 * about units nobody has ever seen.
 *
 * So the callers that *say* a mastery figure ask this first. It is one line
 * three of them had written out for themselves, and one line in three places
 * is the shape of a rule that will eventually be true in two of them.
 */
export function anyAnswered(keys: string[], reviews: Reviews): boolean {
  return keys.some((k) => {
    const r = reviews[k];
    return !!r && r.seen > 0;
  });
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
  return totals(distinct(keys).map((k) => reviews[k]).filter((r): r is CardReview => Boolean(r)));
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
    for (const q of distinct(deck.questions)) {
      const r = reviews[cardKey(deck.courseId, q)];
      if (!r || r.seen === 0) continue;
      right += r.right;
      wrong += r.wrong;
    }
    if (right + wrong > 0) out[deck.courseId] = { right, wrong };
  }
  return out;
}
