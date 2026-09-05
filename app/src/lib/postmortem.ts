/**
 * What a returned exam actually says, once it is more than a number.
 *
 * A mark comes back and the app records the mark. The mark is the least
 * informative thing on the paper: two people can lose the same fifteen points
 * for opposite reasons, and the reason decides what to do next. Losing them
 * because a topic never went in is a study problem. Losing them to arithmetic
 * slips is not a study problem at all, and every extra hour spent re-reading
 * the material is an hour spent on the wrong thing.
 *
 * Nobody does this on their own, because the moment a paper comes back is the
 * moment you want to stop thinking about it. So it is offered once, right
 * then, and it takes under a minute.
 *
 * ## It never blocks marking something returned
 *
 * Recording that work came back is what starts the regrade countdown in
 * `lib/returned.ts`, and that clock matters more than any of this. So the
 * post-mortem is an offer beside a record that already exists, skippable, and
 * skipping it leaves no half-finished state behind.
 *
 * ## What it does to the cards, and what it refuses to do
 *
 * The units somebody lost marks on come back sooner — the same idea as a card
 * answered wrongly with certainty in `lib/sure.ts`, which is treated as a
 * belief to correct rather than an ordinary gap.
 *
 * What it does *not* do is mark those cards wrong. The student did not answer
 * them; they lost marks on an exam question that touched the same material.
 * Writing a wrong answer into the record would corrupt the one honest thing
 * the drill has — its count of what you actually got right and wrong — and it
 * would drag the ease of cards that may be perfectly well known. So the cards
 * are brought forward and their counts are left exactly as they were.
 */

import { emptyReview, type CardReview, type Reviews } from './review';

/** Why the marks went, in the four ways a student would say it. */
export type MissKind = 'did-not-know' | 'misread' | 'careless' | 'out-of-time';

export const KINDS: { id: MissKind; label: string; blurb: string }[] = [
  {
    id: 'did-not-know',
    label: 'Did not know it',
    blurb: 'The material was not there. This is the one more studying fixes.',
  },
  {
    id: 'misread',
    label: 'Misread the question',
    blurb: 'You knew it and answered something else.',
  },
  {
    id: 'careless',
    label: 'Careless slip',
    blurb: 'Arithmetic, a sign, a line skipped. Not a gap.',
  },
  {
    id: 'out-of-time',
    label: 'Ran out of time',
    blurb: 'A pacing problem, which is practised rather than revised.',
  },
];

export interface PostMortem {
  /** Unit indexes in that course's guide. Empty is allowed. */
  units: number[];
  /** Anything the units do not cover, in their own words. */
  other: string;
  /** One paper can lose marks in several ways at once. */
  kinds: MissKind[];
  at: number;
}

export function newMortem(at: number): PostMortem {
  return { units: [], other: '', kinds: [], at };
}

/** Whether there is anything in it worth storing. */
export function saidSomething(m: PostMortem): boolean {
  return m.units.length > 0 || m.kinds.length > 0 || m.other.trim() !== '';
}

/**
 * Bring a unit's cards forward without pretending they were answered.
 *
 * Counts, streak and ease are untouched — see the note at the top of the file.
 * A card with no history at all gets a record so it can be brought forward;
 * everything in it is zero, which is the truth about a card nobody has seen.
 */
export function resurface(reviews: Reviews, keys: string[], now: number): Reviews {
  if (keys.length === 0) return reviews;
  const out: Reviews = { ...reviews };
  for (const key of keys) {
    const prev: CardReview = out[key] ?? emptyReview(now);
    out[key] = { ...prev, due: now, interval: 0 };
  }
  return out;
}

/** How many post-mortems named each kind. */
export function tally(all: PostMortem[]): Record<MissKind, number> {
  const out: Record<MissKind, number> = {
    'did-not-know': 0,
    misread: 0,
    careless: 0,
    'out-of-time': 0,
  };
  for (const m of all) for (const k of m.kinds) out[k] += 1;
  return out;
}

/** Fewer than this and there is a story where there is only an anecdote. */
export const ENOUGH = 2;

/**
 * The pattern across a term, or nothing.
 *
 * Silent under two post-mortems: one paper is what happened on one morning.
 * And it never says "you are careless" — it says where the marks went, which
 * is a fact about the papers rather than a verdict about the person.
 */
export function pattern(all: PostMortem[]): string {
  if (all.length < ENOUGH) return '';
  const counts = tally(all);
  const total = Object.values(counts).reduce((n, x) => n + x, 0);
  if (total === 0) return '';

  const gaps = counts['did-not-know'];
  const notGaps = total - gaps;
  const share = Math.round((notGaps / total) * 100);

  if (notGaps === 0) {
    return `Across ${all.length} pieces of work, every lost mark you recorded was material you did not know. More studying is the answer, which is not always true.`;
  }
  if (gaps === 0) {
    return `Across ${all.length} pieces of work, none of the marks you lost were material you did not know — they were slips, misreadings and time. More studying would not have caught any of them.`;
  }
  const top = biggest(counts);
  return `${share}% of the marks you recorded losing were not gaps in what you knew — mostly ${top.toLowerCase()}. Re-reading the material does not fix those.`;
}

function biggest(counts: Record<MissKind, number>): string {
  let best: MissKind = 'careless';
  let n = -1;
  for (const k of KINDS) {
    if (k.id === 'did-not-know') continue;
    if (counts[k.id] > n) {
      best = k.id;
      n = counts[k.id];
    }
  }
  return KINDS.find((k) => k.id === best)?.label ?? 'slips';
}

/** A stored post-mortem, made safe to render. */
export function readMortem(raw: unknown): PostMortem | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const ids = new Set(KINDS.map((k) => k.id));
  const m: PostMortem = {
    units: Array.isArray(r.units)
      ? r.units.filter((u): u is number => typeof u === 'number' && Number.isInteger(u) && u >= 0)
      : [],
    other: typeof r.other === 'string' ? r.other.slice(0, 400) : '',
    kinds: Array.isArray(r.kinds)
      ? (r.kinds.filter((k): k is MissKind => typeof k === 'string' && ids.has(k as MissKind)))
      : [],
    at: typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : 0,
  };
  return saidSomething(m) ? m : undefined;
}

/** What the offer says, in the place somebody has just recorded a mark. */
export const OFFER =
  'Two questions about where the marks went. It takes under a minute, and it decides whether more studying is the answer or the wrong answer.';

/** What is said once it has been filled in. */
export function doneLine(m: PostMortem, unitNames: string[]): string {
  const named = m.units.map((u) => unitNames[u]).filter(Boolean);
  const kinds = m.kinds.map((k) => KINDS.find((x) => x.id === k)?.label ?? k);
  const bits: string[] = [];
  if (named.length > 0) bits.push(`${named.join(', ')} brought forward in your cards`);
  if (kinds.length > 0) bits.push(kinds.join(', ').toLowerCase());
  return bits.length === 0 ? 'Recorded.' : `${bits.join(' · ')}.`;
}
