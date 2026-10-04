import type { TodayView } from './model';

/**
 * Shadow comparison: does the domain's Today agree with the one on screen?
 *
 * Step 3 of `docs/architecture/modular-monolith.md`. The legacy screen derives
 * its day from selectors; the domain derives it from entries. Before the screen
 * reads the domain (step 4), both are asked the same three questions about the
 * same moment and the answers are compared. This file is only the comparison —
 * plain ids in, disagreements out — so it knows nothing about how either side
 * got its answer, and a test can hand it any two.
 *
 * What is compared is **membership and order of ids**, because that is what the
 * student would see change: a deadline that appeared, one that vanished, two
 * that swapped. Wording and styling are the screen's, not the domain's.
 *
 * ## What is deliberately not compared
 *
 * - **Overdue tasks.** The domain lists them; the legacy Today has no concept of
 *   an overdue *task* (its overdue banner counts deadlines). Comparing them
 *   would report a difference on every account with one, forever. Step 4 decides
 *   whether the screen adopts it.
 * - **Whether a deadline is done.** That is a separate map in the legacy state
 *   the domain does not model, so both sides are asked without it.
 */

export const SHADOW_FACTS = ['deadlinesToday', 'tasksToday', 'deadlinesComingUp'] as const;
export type ShadowFact = (typeof SHADOW_FACTS)[number];

/** What the legacy selectors say, as bare ids in the order they would be shown. */
export type TodayFacts = Readonly<Record<ShadowFact, readonly string[]>>;

export interface Disagreement {
  fact: ShadowFact;
  /** Ids the screen shows and the domain does not. */
  onlyLegacy: string[];
  /** Ids the domain shows and the screen does not. */
  onlyDomain: string[];
  /** Same ids, different order. Only reported when nothing is missing either way. */
  orderDiffers: boolean;
}

const bare = (id: string, prefix: string) => (id.startsWith(prefix) ? id.slice(prefix.length) : id);

/** The same three facts, read off the domain's view. */
export function factsOfView(view: TodayView): TodayFacts {
  return {
    deadlinesToday: view.schedule.filter((e) => e.kind === 'deadline').map((e) => bare(e.id, 'deadline:')),
    tasksToday: view.dueToday.map((t) => t.id),
    deadlinesComingUp: view.comingUp.map((e) => bare(e.id, 'deadline:')),
  };
}

export function compareToday(legacy: TodayFacts, view: TodayView): Disagreement[] {
  const domain = factsOfView(view);
  const out: Disagreement[] = [];
  for (const fact of SHADOW_FACTS) {
    const a = legacy[fact];
    const b = domain[fact];
    const onlyLegacy = a.filter((id) => !b.includes(id));
    const onlyDomain = b.filter((id) => !a.includes(id));
    const orderDiffers = onlyLegacy.length === 0 && onlyDomain.length === 0 && a.some((id, i) => id !== b[i]);
    if (onlyLegacy.length || onlyDomain.length || orderDiffers) out.push({ fact, onlyLegacy, onlyDomain, orderDiffers });
  }
  return out;
}

/** A stable string for one set of disagreements, so a sink can say each only once. */
export const signatureOf = (day: string, found: readonly Disagreement[]): string =>
  `${day}|${found.map((d) => `${d.fact}:${d.onlyLegacy.join(',')}:${d.onlyDomain.join(',')}:${d.orderDiffers ? 'o' : ''}`).join(';')}`;
