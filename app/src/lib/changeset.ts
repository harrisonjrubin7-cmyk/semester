import { flatten } from './cite';
import type { Piece } from './harvest';
import type { CourseUpdate, GradeRow, Guide, Item, StudyCard, Term } from './types';

/**
 * What is actually new, and what the course already has.
 *
 * Called `changeset` because the two obvious names were taken by two different
 * things: `lib/merge.ts` is the sync merge — two devices, one account — and
 * `lib/reconcile.ts` is the app's dates against the ones the LMS shows today.
 * Three problems that all reduce to "these two disagree, now what", and they
 * stay three files.
 *
 * Every import before this one appended. That is why a course re-imported
 * after a syllabus revision came out with two of every deadline, and why
 * adding the reading behind a lecture put the same fact on two cards a
 * student then drilled twice and believed twice as hard.
 *
 * So nothing is appended and nothing is overwritten. Every extracted piece is
 * compared against what the course holds and comes out as one of five things,
 * and four of the five are a proposal that somebody has to accept.
 *
 * ## Substance, not string equality
 *
 * The comparison is on what a piece *says*, not how it says it. A card whose
 * answer is the same fact in different words is a DUPLICATE; a deadline
 * renamed from "Midterm" to "Midterm 1" on the same day is the same deadline.
 * String equality would call both of those new, which is the failure this file
 * exists to prevent — and it would produce it on exactly the material somebody
 * imports twice.
 *
 * ## Re-importing the same file does nothing
 *
 * That guarantee rests on two hashes. The source hash says this exact file has
 * been read before; the piece hash says this exact fact is already held. The
 * first is the cheap path and the second is what still holds when a professor
 * re-posts the same slides under a new filename.
 */

/** What comparing a piece against the course concluded. */
export type Verdict =
  /** Nothing in the course covers this. */
  | 'new'
  /** Already there, in substance. Skipped silently and counted. */
  | 'duplicate'
  /** Covers something already there, in more depth. Proposed as a replacement. */
  | 'fuller'
  /** Contradicts something already there. Always surfaced, never resolved. */
  | 'conflict'
  /** Completes something already marked incomplete. Merged into it. */
  | 'gap-fill';

export interface Change {
  piece: Piece;
  verdict: Verdict;
  /**
   * What it is up against, in the course's own words — the existing card, the
   * existing date. Absent for `new`.
   */
  against?: string;
  /** Why this verdict, in a sentence the student can disagree with. */
  because: string;
}

export interface ChangeSet {
  changes: Change[];
  /** Duplicates are not shown one at a time; they are counted. */
  duplicates: number;
  /**
   * True when this exact file has been read into this course before.
   *
   * The whole set will be duplicates in that case, and saying so once beats
   * showing an empty review sheet and letting somebody work out why.
   */
  seenBefore: boolean;
}

/** What the course already holds, in the one shape the comparison needs. */
export interface Held {
  guide: Guide;
  items: Item[];
  updates: CourseUpdate[];
  /** The weight table, which lives on the course rather than on the guide. */
  grading: GradeRow[];
  /** Source hashes of every import already folded into this course. */
  sources: string[];
}

/**
 * Words that carry no weight in a comparison.
 *
 * Two answers to the same question overlap heavily on these and on nothing
 * else, so leaving them in makes everything look like a near-duplicate of
 * everything.
 */
const NOISE = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that',
  'with', 'as', 'by', 'from', 'which', 'when', 'than', 'then', 'so',
]);

function bagOf(text: string): Set<string> {
  return new Set(
    flatten(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !NOISE.has(w)),
  );
}

/**
 * How much two passages say the same thing, from 0 to 1.
 *
 * Jaccard over content words. Deliberately not an embedding: this runs on
 * every piece against every existing card, offline, on a phone, and a measure
 * somebody can reason about is worth more here than one that is a little
 * better and cannot be explained when it is wrong.
 */
export function overlap(a: string, b: string): number {
  const x = bagOf(a);
  const y = bagOf(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared / (x.size + y.size - shared);
}

/**
 * The two thresholds, and why they are where they are.
 *
 * Above SAME, two passages are the same fact and the second is a duplicate.
 * Between RELATED and SAME they are about the same thing without being the
 * same — which is where FULLER and GAP-FILL live, and which is a proposal
 * rather than a silent action precisely because the middle is where a machine
 * is least sure and a person is most sure.
 */
export const SAME = 0.6;
export const RELATED = 0.3;

/** A card the student would recognise, for the "against" line. */
const showCard = (c: StudyCard) => `${c.q} — ${c.a}`;

/** Every card the course holds now, from the guide and from every update. */
function allCards(held: Held): { card: StudyCard; unit: string; thin: boolean }[] {
  const out: { card: StudyCard; unit: string; thin: boolean }[] = [];
  for (const u of held.guide.units) {
    for (const c of u.cards) out.push({ card: c, unit: u.name, thin: isThin(c) });
  }
  for (const up of held.updates) {
    const unit = up.unit !== null ? (held.guide.units[up.unit]?.name ?? '') : up.title;
    for (const c of up.cards) out.push({ card: c, unit, thin: isThin(c) });
  }
  return out;
}

/**
 * A card that was never really finished.
 *
 * "Know the GGL study" is a topic label somebody wrote as a placeholder. New
 * material that answers it should complete it rather than sit beside it as a
 * second card on the same thing — which is what GAP-FILL is for.
 *
 * Phrasing, not length. The first version called anything under sixty
 * characters thin, which made "A way of measuring trade-offs between product
 * features" — a complete definition — a placeholder, and swallowed a genuine
 * FULLER as a gap-fill. A placeholder is an instruction to the reader rather
 * than an answer to the question, and that is what reads as one.
 */
function isThin(c: StudyCard): boolean {
  const a = c.a.trim();
  if (/^(know|understand|remember|review|memoris|memoriz|be familiar|revise)/i.test(a)) return true;
  // A handful of words with nothing specific in them — no figure, no name.
  return a.length < 25 && !/\d/.test(a);
}

function allTerms(held: Held): Term[] {
  return [...held.guide.terms, ...held.updates.flatMap((u) => u.terms)];
}

/**
 * Compare everything that came out of one file against one course.
 *
 * Pure, and deliberately: this is what the review sheet is built from, and a
 * review sheet that depended on a network call would be a review sheet that
 * sometimes could not be shown.
 */
export function diff(pieces: Piece[], held: Held): ChangeSet {
  const seenBefore =
    pieces.length > 0 && held.sources.includes(pieces[0].where.sourceHash);

  const cards = allCards(held);
  const terms = allTerms(held);
  const changes: Change[] = [];
  let duplicates = 0;

  /** Pieces already accounted for within this same file. */
  const within = new Set<string>();

  for (const piece of pieces) {
    // The cheap answer first: this exact fact is already held, by hash.
    if (within.has(piece.hash)) {
      duplicates += 1;
      continue;
    }
    within.add(piece.hash);

    const change = judge(piece, { cards, terms, held });
    if (change.verdict === 'duplicate') {
      duplicates += 1;
      continue;
    }
    changes.push(change);
  }

  return { changes, duplicates, seenBefore };
}

function judge(
  piece: Piece,
  ctx: { cards: { card: StudyCard; unit: string; thin: boolean }[]; terms: Term[]; held: Held },
): Change {
  switch (piece.what) {
    case 'card': {
      /*
       * Two scores, and the difference between them matters.
       *
       * `answer` is the substance and is what decides whether two cards say
       * the same thing. `question` is what they are about. Ranking on the
       * answer alone cannot find a placeholder: "Know the GGL study" is three
       * words, so its overlap with a real answer is near zero however plainly
       * they are about the same thing — the unfinished card would come back
       * as unrelated and the deck would gain the answer as a second card
       * beside the question. So relatedness is the better of the two and
       * sameness is still the answer.
       */
      let best: { card: StudyCard; unit: string; thin: boolean } | null = null;
      let score = 0;
      let near = 0;
      for (const existing of ctx.cards) {
        const a = overlap(piece.card.a, existing.card.a);
        const q = overlap(piece.card.q, existing.card.q);
        const rank = Math.max(a, q);
        if (rank > near) {
          near = rank;
          score = a;
          best = existing;
        }
      }
      if (!best || near < RELATED) {
        return { piece, verdict: 'new', because: 'Nothing in this course covers it.' };
      }
      if (score >= SAME) {
        return {
          piece,
          verdict: 'duplicate',
          against: showCard(best.card),
          because: 'The course already says this.',
        };
      }
      if (best.thin) {
        return {
          piece,
          verdict: 'gap-fill',
          against: showCard(best.card),
          because: 'An existing card on this was never finished. This completes it.',
        };
      }
      // Related, both complete, and the new one says more. Longer is a crude
      // proxy for fuller and it is honest about being one — which is why this
      // is a proposal with both sides shown rather than a replacement.
      if (piece.card.a.length > best.card.a.length * 1.4) {
        return {
          piece,
          verdict: 'fuller',
          against: showCard(best.card),
          because: 'It covers the same ground in more detail.',
        };
      }
      /*
       * Related on the question, unrelated on the answer.
       *
       * Ranking on the better of the two scores is what lets a placeholder be
       * found at all, and it has a cost: "What is conjoint analysis?" ranks
       * against "What is close-loop analysis?" on the shape of the question
       * while the answers have nothing to do with each other. The verdict was
       * right — new — but the line under it said "related to a card you have"
       * and pointed at a card that is not related, which is worse than saying
       * nothing. Caught by running a real deck against the real BUS 1600
       * guide. So the comparison is only shown when the substance overlaps.
       */
      if (score < RELATED) {
        return { piece, verdict: 'new', because: 'Nothing in this course covers it.' };
      }
      return {
        piece,
        verdict: 'new',
        against: showCard(best.card),
        because: 'Related to a card you have, but not the same point.',
      };
    }

    case 'term': {
      const same = ctx.terms.find((t) => flatten(t.t) === flatten(piece.term.t));
      if (!same) return { piece, verdict: 'new', because: 'This term is not defined yet.' };
      if (overlap(same.d, piece.term.d) >= SAME) {
        return {
          piece,
          verdict: 'duplicate',
          against: `${same.t} — ${same.d}`,
          because: 'Already defined the same way.',
        };
      }
      /*
       * The same word, defined differently. This is a contradiction and not a
       * choice of wording, and it is exactly what must never be resolved
       * quietly: one of the two definitions is what the exam will use.
       */
      return {
        piece,
        verdict: 'conflict',
        against: `${same.t} — ${same.d}`,
        because: 'You already have a different definition of this term.',
      };
    }

    case 'item': {
      const sameName = ctx.held.items.filter(
        (i) => overlap(i.title, piece.title) >= SAME || flatten(i.title) === flatten(piece.title),
      );
      if (sameName.length === 0) {
        return { piece, verdict: 'new', because: 'No deadline like this on the course.' };
      }
      const sameDay = sameName.find((i) => i.month === piece.month && i.day === piece.day);
      if (sameDay) {
        // Same thing, same day. A changed weight is still a conflict.
        if (piece.weight && sameDay.weight && flatten(piece.weight) !== flatten(sameDay.weight)) {
          return {
            piece,
            verdict: 'conflict',
            against: `${sameDay.title} — ${sameDay.weight}`,
            because: `This says ${piece.weight}; your syllabus says ${sameDay.weight}.`,
          };
        }
        return {
          piece,
          verdict: 'duplicate',
          against: `${sameDay.title}, ${sameDay.month + 1}/${sameDay.day}`,
          because: 'Already on the course, on the same day.',
        };
      }
      const moved = sameName[0];
      return {
        piece,
        verdict: 'conflict',
        against: `${moved.title}, ${moved.month + 1}/${moved.day}`,
        because: `This says ${piece.month + 1}/${piece.day}; your course says ${moved.month + 1}/${moved.day}.`,
      };
    }

    case 'grade': {
      const existing = ctx.held.grading.find(
        (g) => overlap(g.what, piece.row.what) >= SAME || flatten(g.what) === flatten(piece.row.what),
      );
      if (!existing) return { piece, verdict: 'new', because: 'Not in your grading table.' };
      if (flatten(existing.pct) === flatten(piece.row.pct)) {
        return {
          piece,
          verdict: 'duplicate',
          against: `${existing.what} — ${existing.pct}`,
          because: 'Already weighted the same.',
        };
      }
      // The numbers the whole grade projection rests on. Never quietly.
      return {
        piece,
        verdict: 'conflict',
        against: `${existing.what} — ${existing.pct}`,
        because: `This says ${piece.row.pct}; your course says ${existing.pct}.`,
      };
    }

    case 'unit': {
      const same = ctx.held.guide.units.find(
        (u) => overlap(u.name, piece.name) >= SAME || flatten(u.name) === flatten(piece.name),
      );
      if (!same) return { piece, verdict: 'new', because: 'A topic the course does not have yet.' };
      return {
        piece,
        verdict: 'gap-fill',
        against: same.name,
        because: 'The course already has this unit. Its cards go into it.',
      };
    }

    case 'note':
      // A note is never a duplicate of anything: it is the material itself,
      // kept because it did not fit a shape the app studies from.
      return { piece, verdict: 'new', because: piece.why };
  }
}

