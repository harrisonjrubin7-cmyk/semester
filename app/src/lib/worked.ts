/**
 * What actually worked, at the end of a term.
 *
 * Four months of evidence about how you study is thrown away every December,
 * which is the moment it becomes worth something. The app records every card
 * answered, every practice paper sat and every box ticked, with the times —
 * so it knows one thing nobody else does: which way of working preceded your
 * good results, and how far in advance the things that went well got started.
 *
 * ## Silence where the evidence is thin, and that is the whole design
 *
 * Every claim here has a floor under it, and a claim that does not clear its
 * floor is not made at all. Six data points is not a pattern; two practice
 * papers is not a trend; one course finishing well is not a habit. An
 * end-of-term report that manufactures four insights out of a quiet semester
 * is a report nobody reads twice, and it would be the second thing this app
 * has done that it could not stand behind.
 *
 * So `findings` can honestly return nothing, and `nothingLine` says why in a
 * sentence rather than padding. That is a feature.
 *
 * ## What it never does
 *
 * No score, no grade for the semester, no comparison with anybody else, and
 * no advice that does not follow from a number on this page. The app is
 * reporting what it saw.
 */

import type { Sitting } from './sitting';
import type { Spent } from './pace';

export interface Finding {
  /** What was noticed, with the number in it. */
  said: string;
  /** How many observations it rests on, so the reader can weigh it. */
  from: number;
}

export interface TermInput {
  /** Practice papers sat this term, any course. */
  sittings: Sitting[];
  /** Deadlines that were ticked, with when they were due and when ticked. */
  ticks: { id: string; courseId: string; dueAt: number; tickedAt: number }[];
  /** Work you timed. */
  spent: Spent[];
  /** Right and wrong answers per course, over the term. */
  drilled: Record<string, { right: number; wrong: number }>;
  /** For naming a course in a sentence. */
  codeOf: (courseId: string) => string;
}

/** The floors. Below these, nothing is claimed. */
const MIN_TICKS = 8;
const MIN_PAPERS = 3;
const MIN_DRILLED = 30;
const MIN_TIMED = 6;

const DAY = 86_400_000;

function median(ns: number[]): number {
  if (ns.length === 0) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * How far ahead you finished things, in days.
 *
 * The median rather than the mean, because one thing finished three weeks
 * early would otherwise make a term of last-minute work look measured.
 * Negative means late.
 */
export function leadDays(ticks: TermInput['ticks']): number[] {
  return ticks.map((t) => Math.round((t.dueAt - t.tickedAt) / DAY));
}

/**
 * Everything the term's data will honestly support, and nothing else.
 *
 * Each block is guarded by its own floor. The order is deliberate: the
 * finding about *when* you work comes first, because it is the one a person
 * can act on next term without changing anything else about how they study.
 */
export function findings(input: TermInput): Finding[] {
  const { sittings, ticks, spent, drilled, codeOf } = input;
  const out: Finding[] = [];

  // ── How far ahead you actually finish ──────────────────────────────────
  if (ticks.length >= MIN_TICKS) {
    const leads = leadDays(ticks);
    const mid = median(leads);
    const early = leads.filter((d) => d >= 1).length;
    const share = Math.round((early / leads.length) * 100);
    if (mid >= 1) {
      out.push({
        said: `You finished the typical thing ${mid === 1 ? 'a day' : `${mid} days`} early, and ${share}% of everything ahead of its deadline.`,
        from: ticks.length,
      });
    } else if (mid <= 0) {
      out.push({
        said: `You finished the typical thing on the day it was due, and ${share}% of everything ahead of time.`,
        from: ticks.length,
      });
    }
  }

  // ── Whether practice papers moved anything ─────────────────────────────
  if (sittings.length >= MIN_PAPERS) {
    const ordered = [...sittings].sort((a, b) => a.at - b.at);
    const half = Math.floor(ordered.length / 2);
    const first = Math.round(median(ordered.slice(0, half || 1).map((s) => s.pct)));
    const last = Math.round(median(ordered.slice(-(half || 1)).map((s) => s.pct)));
    const move = last - first;
    if (Math.abs(move) >= 5) {
      out.push({
        said: `Your practice papers went ${move > 0 ? 'up' : 'down'} ${Math.abs(move)} points across the term, ${first}% to ${last}%.`,
        from: ordered.length,
      });
    } else {
      out.push({
        said: `Your practice papers stayed level across the term, around ${last}%.`,
        from: ordered.length,
      });
    }
  }

  // ── Which course you got most right ────────────────────────────────────
  const decks = Object.entries(drilled).filter(
    ([, d]) => d.right + d.wrong >= MIN_DRILLED,
  );
  if (decks.length >= 2) {
    const rated = decks
      .map(([courseId, d]) => ({ courseId, pct: Math.round((d.right / (d.right + d.wrong)) * 100), n: d.right + d.wrong }))
      .sort((a, b) => b.pct - a.pct);
    const best = rated[0];
    const worst = rated[rated.length - 1];
    // Only worth saying when the two are actually different.
    if (best.pct - worst.pct >= 10) {
      out.push({
        said: `You got ${best.pct}% of ${codeOf(best.courseId)}'s cards right and ${worst.pct}% of ${codeOf(worst.courseId)}'s.`,
        from: best.n + worst.n,
      });
    }
  }

  // ── What ate the term ──────────────────────────────────────────────────
  if (spent.length >= MIN_TIMED) {
    const byKind = new Map<string, number>();
    for (const s of spent) byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + s.minutes);
    const [kind, minutes] = [...byKind.entries()].sort((a, b) => b[1] - a[1])[0];
    const all = [...byKind.values()].reduce((n, m) => n + m, 0);
    const share = Math.round((minutes / all) * 100);
    if (share >= 35) {
      const hours = Math.round((minutes / 60) * 10) / 10;
      out.push({
        said: `${share}% of the time you timed went on ${kind} — ${hours} hours of it.`,
        from: spent.length,
      });
    }
  }

  return out;
}

/**
 * Why there is nothing to say, when there is nothing to say.
 *
 * Names the specific thing that was too thin rather than apologising in
 * general, because "you sat two practice papers and three is the floor" tells
 * somebody how to get a report next term and "not enough data" does not.
 */
export function nothingLine(input: TermInput): string {
  const gaps: string[] = [];
  if (input.ticks.length < MIN_TICKS) {
    gaps.push(`${input.ticks.length} of ${MIN_TICKS} ticked deadlines`);
  }
  if (input.sittings.length < MIN_PAPERS) {
    gaps.push(`${input.sittings.length} of ${MIN_PAPERS} practice papers`);
  }
  const answered = Object.values(input.drilled).reduce((n, d) => n + d.right + d.wrong, 0);
  if (answered < MIN_DRILLED) gaps.push(`${answered} of ${MIN_DRILLED} cards answered`);

  if (gaps.length === 0) return '';
  return `Not enough happened in the app this term to say anything worth reading — ${gaps.join(', ')}. That is not a judgement about the term; it is a fact about what was recorded.`;
}

/** The headline: how much the report rests on, so nobody has to guess. */
export function basis(input: TermInput): string {
  const answered = Object.values(input.drilled).reduce((n, d) => n + d.right + d.wrong, 0);
  const bits: string[] = [];
  if (input.ticks.length > 0) bits.push(`${input.ticks.length} deadlines ticked`);
  if (answered > 0) bits.push(`${answered} cards answered`);
  if (input.sittings.length > 0) {
    bits.push(`${input.sittings.length} ${input.sittings.length === 1 ? 'paper' : 'papers'} sat`);
  }
  if (input.spent.length > 0) bits.push(`${input.spent.length} things timed`);
  return bits.length > 0 ? bits.join(' · ') : 'Nothing recorded';
}

/** The whole report as text, for keeping and for printing. */
export function document(termLabel: string, input: TermInput): string {
  const found = findings(input);
  const lines = [`# ${termLabel}`, '', basis(input), ''];

  if (found.length === 0) {
    lines.push(nothingLine(input));
  } else {
    for (const f of found) lines.push(`- ${f.said} *(from ${f.from})*`);
  }

  lines.push(
    '',
    '---',
    '',
    'Every line above is counted from what this app recorded. Anything it could not',
    'support with enough observations was left out rather than softened.',
  );
  return lines.join('\n');
}
