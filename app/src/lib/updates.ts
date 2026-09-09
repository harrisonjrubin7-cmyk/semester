import { num, rows, str } from './stored';
import type { CourseUpdate } from './types';

/**
 * The saved updates, with the lists every reader of them iterates.
 *
 * `cards` and `terms` are spread and mapped in five places — `addedCards` and
 * `mergeGuide` in `lib/live.ts`, `lib/gaps.ts`, `lib/changeset.ts` and
 * `insights/facts.ts` — and not one of them checks first, because an update
 * this build wrote always has both. `insights/facts.ts` is the one that fires
 * first: `for (const card of update.cards)` threw "update.cards is not
 * iterable" and the whole Progress screen was replaced by a panel.
 *
 * Empty rather than dropped. An update is material somebody added by hand — a
 * photographed board, a posted reading — and `lib/live.ts` says it about a
 * neighbouring case: "Losing somebody's own material quietly is worse than any
 * of the shapes this file refuses." Its title and body still draw.
 *
 * Here rather than in `lib/live.ts`, beside the type's own machinery, only
 * because that file imports the store and the store imports the shape this
 * reader is wired into — a cycle that leaves `DEFAULT_PERSISTED` undefined at
 * the moment the persist layer reads its keys.
 */
export function readUpdates(raw: unknown): CourseUpdate[] {
  return rows<CourseUpdate>(raw, 'up').map((u) => ({
    ...u,
    id: u.id as string,
    courseId: str(u.courseId),
    // Null is the real state — "a unit of its own" — and anything that is not
    // a whole number reads as that rather than as unit zero.
    unit: typeof u.unit === 'number' && Number.isInteger(u.unit) ? u.unit : null,
    title: str(u.title),
    source: str(u.source),
    body: str(u.body),
    cards: Array.isArray(u.cards) ? u.cards : [],
    terms: Array.isArray(u.terms) ? u.terms : [],
    created: num(u.created),
  })) as CourseUpdate[];
}
