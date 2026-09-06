import { attendance } from './attendance';
import { calibration } from './calibration';
import { confident } from './confident';
import { projection } from './projection';
import type { Facts, Insight, Scope, Source } from './types';

export type { EvidenceRef, Facts, Insight, Kind, Scope, Source } from './types';

/**
 * The engine: every insight, run against the same facts, ranked together.
 *
 * Four surfaces read from here and none of them computes anything. That is the
 * point — `brief`, `weekly`, `worked` and `behind` were four screens that each
 * worked out their own version of how the term was going, and the risk in that
 * is not duplication but disagreement: two screens on one phone quoting
 * different numbers for the same thing.
 *
 * Pure, and it has to stay pure. No network, no model call, no clock beyond
 * the `now` it is handed. Identical state gives identical output, which is
 * what lets it run offline and what makes a test of it worth writing.
 */

const SOURCES: Source[] = [confident, projection, attendance, calibration];

/**
 * Everything the data supports saying, best first.
 *
 * Ranked by what it would cost to not know — a grade weight at risk above a
 * study habit — and never by recency. An insight from three weeks ago that
 * still costs marks outranks one from this morning that does not.
 */
export function insights(facts: Facts): Insight[] {
  const out: Insight[] = [];
  for (const source of SOURCES) {
    try {
      out.push(...source.run(facts));
    } catch {
      /*
       * One insight that throws must not take the report with it.
       *
       * These read user-entered data — a weight typed as "twenty percent", a
       * date that is not one — and the screen they appear on is the one
       * somebody opens when they want to know where they stand. A blank
       * screen is a worse answer than a shorter one.
       */
    }
  }
  return out
    .filter((i) => i.evidence.length > 0)
    .sort((a, b) => a.rank - b.rank || b.sampleSize - a.sampleSize);
}

/** The ones a given surface shows. `worked` takes everything. */
export function forScope(all: Insight[], scope: Scope | 'all', limit?: number): Insight[] {
  const mine = scope === 'all' ? all : all.filter((i) => i.scope === scope);
  return typeof limit === 'number' ? mine.slice(0, limit) : mine;
}

/**
 * What the minimum sample is for each, for a screen that wants to say why it
 * is showing nothing — without showing a card that says nothing.
 */
export const MINIMUMS: Record<string, number> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s.minimum]),
);
