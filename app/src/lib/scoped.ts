import type { State } from '../state/shape';
import { destination } from './nav';
import { has } from './search';
import type { Screen } from './types';

/**
 * "12 sources match that — search in Sources."
 *
 * The whole-app search finds deadlines, notes, tasks, courses and screens. It
 * does not find the eleven other collections somebody keeps in this app, and
 * it should not try to: listing every application, source and saved place
 * inline would bury the four kinds of hit people are usually after under a
 * hundred rows of everything else.
 *
 * So it offers the screen instead, with the count that makes the offer worth
 * taking. "Sources" on its own is a place; "12 sources match" is an answer.
 *
 * ## Why this does not run the screens' own filters
 *
 * Each filtered screen builds its adapter from what that screen is currently
 * showing — Sources filters within the project chip you have selected, Degree
 * filters the Taken tab and not the requirements, Applying skips the add form.
 * That is right, and it is also why those adapters cannot be lifted out: they
 * close over a tab and a chip that only exist while the screen is mounted.
 *
 * What can be counted from here is the collection underneath, which is a
 * plain array on the store. So the count is of the records, and the filter you
 * land in may show fewer because of a chip — which is why the row says how
 * many matched rather than promising what you will see.
 */

export interface Scope {
  screen: Screen;
  /** The screen's name, for the row. */
  label: string;
  /** How many records of that kind matched. */
  count: number;
  /** "12 applications", for the line under it. */
  said: string;
}

/**
 * The collections, and what counts as a match in each.
 *
 * One entry per filtered screen whose records live on the store as an array.
 * Screens whose list is computed — the report screens, the guide, the
 * calendar — are deliberately absent: a count that came from a derivation
 * would go stale against the screen the moment either changed.
 */
const IN: {
  screen: Screen;
  one: string;
  many: string;
  rows: (s: State) => unknown[];
  hit: (row: never, q: string) => boolean;
}[] = [
  {
    screen: 'sources',
    one: 'source',
    many: 'sources',
    rows: (s) => s.sources,
    hit: (r: { raw?: string; role?: string; project?: string }, q) => has(q, r.raw, r.role, r.project),
  },
  {
    screen: 'applying',
    one: 'application',
    many: 'applications',
    rows: (s) => s.applications,
    hit: (r: { org?: string; role?: string; next?: string; where?: string; note?: string }, q) =>
      has(q, r.org, r.role, r.next, r.where, r.note),
  },
  {
    screen: 'degree',
    one: 'course taken',
    many: 'courses taken',
    rows: (s) => s.taken,
    hit: (r: { code?: string; title?: string; term?: string; grade?: string }, q) =>
      has(q, r.code, r.title, r.term, r.grade),
  },
  {
    screen: 'links',
    one: 'link',
    many: 'links',
    rows: (s) => s.extraLinks,
    hit: (r: { label?: string; url?: string; group?: string }, q) => has(q, r.label, r.url, r.group),
  },
  {
    screen: 'activities',
    one: 'commitment',
    many: 'commitments',
    rows: (s) => s.commitments,
    hit: (r: { name?: string; kind?: string; note?: string; where?: string }, q) =>
      has(q, r.name, r.kind, r.note, r.where),
  },
  {
    screen: 'costs',
    one: 'cost',
    many: 'costs',
    rows: (s) => s.costs,
    hit: (r: { what?: string; kind?: string }, q) => has(q, r.what, r.kind),
  },
  {
    screen: 'registrar',
    one: 'term date',
    many: 'term dates',
    rows: (s) => s.registrar,
    hit: (r: { label?: string; cost?: string; kind?: string }, q) => has(q, r.label, r.cost, r.kind),
  },
  {
    screen: 'maps',
    one: 'saved place',
    many: 'saved places',
    rows: (s) => s.places,
    hit: (r: { label?: string; address?: string }, q) => has(q, r.label, r.address),
  },
  /*
   * `people` is not here, and that is the same rule as everywhere else.
   *
   * Not because the search would be wrong — it runs on the device like every
   * other one — but because this list is read by `Command.tsx`, which is one
   * `dispatch` away from the assistant's context builder, and the one place in
   * this app that is refused `people` should be refused it in every file that
   * could plausibly grow a second reader. The People screen has its own filter
   * and that is where searching your professors belongs.
   */
];

/** The screens worth offering for this query, biggest count first. */
export function scopesFor(q: string, state: State, min = 1): Scope[] {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const out: Scope[] = [];
  for (const kind of IN) {
    const rows = kind.rows(state);
    let count = 0;
    for (const row of rows) if (kind.hit(row as never, query)) count += 1;
    if (count < min) continue;
    out.push({
      screen: kind.screen,
      label: destination(kind.screen)?.label ?? kind.screen,
      count,
      said: `${count} ${count === 1 ? kind.one : kind.many}`,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}
