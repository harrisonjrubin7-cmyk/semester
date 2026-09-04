/**
 * Two devices, one account, and neither one losing what it did.
 *
 * Sync used to be `{ ...local, ...remote }` when the remote copy was newer.
 * That is right for a setting — your accent is whatever you last chose,
 * wherever you chose it — and wrong for everything that is a list you add to.
 * Two devices each write a note offline; the one that syncs second is newer,
 * so its whole list wins, and the other note is gone. Nothing warns anybody,
 * because from each device's side it simply never arrived.
 *
 * The lists have been append-only since the app had notes, so this predates
 * the papers and sources that made it worth chasing.
 *
 * ## One table, and a default that cannot lose data quietly
 *
 * `STRATEGY` says how each persisted field is merged, and a field missing
 * from it falls to `union` rather than `theirs`. That is the safe direction:
 * a field added later and forgotten here keeps both sides' entries — untidy
 * at worst — rather than silently dropping one device's work, which is the
 * failure this file exists to end. `merge.test.ts` checks the table against
 * the real persisted shape, so a new field is noticed rather than defaulted
 * to forever.
 */

export type Strategy = 'union' | 'theirs' | 'ticks' | 'latest';

/**
 * How each field of the store is merged when another device's copy arrives.
 *
 * - `union` — a list of things with ids. Both sides' entries, one per id,
 *   newest kept where both have the same id.
 * - `ticks` — a map of id to a flag or a short string. Every key from both
 *   sides, so ticking one box here and another there leaves both ticked.
 * - `latest` — a map of id to a record that carries its own timestamp. Same
 *   union of keys, but where both hold a key the newer record wins rather
 *   than whichever synced last.
 * - `theirs` — a setting or a single value. The copy that synced later wins,
 *   which is what "I changed it on my laptop" should mean.
 */
export const STRATEGY: Record<string, Strategy> = {
  // Things you add to. Losing one of these is losing work.
  courses: 'union',
  notes: 'union',
  tasks: 'union',
  appointments: 'union',
  commitments: 'union',
  updates: 'union',
  places: 'union',
  sittings: 'union',
  sources: 'union',
  registrar: 'union',
  spent: 'union',
  feeds: 'union',
  feedEvents: 'union',
  extraLinks: 'union',

  // Maps keyed by id, where each key is its own small decision.
  done: 'ticks',
  tickedAt: 'ticks',
  saved: 'ticks',
  picked: 'ticks',
  grades: 'ticks',
  linkUrls: 'ticks',
  feedHidden: 'ticks',
  notifs: 'ticks',

  // Drill history. Answering a card on the laptop and again on the phone is
  // not a conflict, it is two answers; the later one is the current state of
  // that card, whichever device synced first.
  reviews: 'latest',

  // Settings and single values: the last device to touch them is right.
  accent: 'theirs',
  textSize: 'theirs',
  ground: 'theirs',
  density: 'theirs',
  corners: 'theirs',
  typeface: 'theirs',
  // An arrangement rather than a list you add to — merging two orderings
  // would produce an order neither device chose.
  feedOrder: 'theirs',
  nav: 'theirs',
  sample: 'theirs',
  term: 'theirs',
  seenOnboarding: 'theirs',
  cleared: 'theirs',
  waysOpen: 'theirs',
  // Where you have been lately, newest first. Interleaving two devices'
  // histories would make it a list of nowhere in particular.
  recent: 'theirs',
};

export function strategyFor(field: string): Strategy {
  // The default is union, not theirs. A field added later and forgotten here
  // keeps both sides' entries rather than dropping one device's work.
  return STRATEGY[field] ?? 'union';
}

interface Stamped {
  id?: unknown;
  updated?: unknown;
  created?: unknown;
  added?: unknown;
  seen?: unknown;
  at?: unknown;
}

/**
 * When a record last changed, for choosing between two versions of it.
 *
 * `at` is read last and only as a fallback, because it means two things in
 * this app: a sitting's `at` is an epoch stamp, an appointment's is minutes
 * past midnight. Every record that has an appointment-shaped `at` also has a
 * `created`, which is read first, so the ambiguous field is never reached for
 * one of those.
 */
function stamp(row: unknown): number {
  const r = row as Stamped;
  for (const key of ['updated', 'seen', 'created', 'added', 'at'] as const) {
    const value = r?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function idOf(row: unknown): string | null {
  const r = row as Stamped;
  if (typeof r?.id === 'string') return r.id;
  // Courses are wrapped: { course: { id }, items, guide … }.
  const inner = (row as { course?: { id?: unknown } })?.course?.id;
  return typeof inner === 'string' ? inner : null;
}

/**
 * Two lists of identified things, as one.
 *
 * Local order first, then anything only the remote has, which keeps a list
 * somebody has arranged looking arranged. Where both sides hold the same id
 * the newer stamp wins; where neither carries a stamp the remote does, which
 * matches what "the newer copy" meant before this existed.
 *
 * A row with no id at all is kept from both sides — dropping it would be the
 * exact failure this replaces, and a duplicate is visible while a deletion is
 * not.
 */
export function union(local: unknown[], remote: unknown[]): unknown[] {
  const byId = new Map<string, unknown>();
  const loose: unknown[] = [];

  for (const row of local) {
    const id = idOf(row);
    if (id === null) loose.push(row);
    else byId.set(id, row);
  }

  for (const row of remote) {
    const id = idOf(row);
    if (id === null) {
      // Only if the local side does not already hold something identical.
      const already = loose.some((l) => JSON.stringify(l) === JSON.stringify(row));
      if (!already) loose.push(row);
      continue;
    }
    const mine = byId.get(id);
    if (mine === undefined || stamp(row) >= stamp(mine)) byId.set(id, row);
  }

  return [...byId.values(), ...loose];
}

/**
 * Two maps, as one.
 *
 * Every key from both sides. Where both hold the same key and the values
 * differ, the remote wins — one device ticking a box and the other unticking
 * it is a genuine conflict with no right answer, and "whichever synced later"
 * is at least the answer a person can predict.
 */
export function ticks(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  return { ...local, ...remote };
}

/** Two maps of stamped records, as one, keeping the newer record per key. */
export function latest(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...local };
  for (const [key, theirs] of Object.entries(remote)) {
    const mine = out[key];
    if (mine === undefined || stamp(theirs) >= stamp(mine)) out[key] = theirs;
  }
  return out;
}

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The whole store, merged.
 *
 * Only fields the remote actually carries are touched — an older account
 * whose saved copy has no `sittings` should not blank the ones on this
 * device, which is a second way the wholesale spread lost data.
 */
export function mergePersisted<T extends object>(local: T, remote: NoInfer<Partial<T>>): T {
  const out: Record<string, unknown> = { ...(local as Record<string, unknown>) };

  for (const [field, theirs] of Object.entries(remote)) {
    if (theirs === undefined) continue;
    const mine = (local as Record<string, unknown>)[field];

    switch (strategyFor(field)) {
      case 'union':
        out[field] = Array.isArray(mine) && Array.isArray(theirs) ? union(mine, theirs) : theirs;
        break;
      case 'ticks':
        out[field] = isMap(mine) && isMap(theirs) ? ticks(mine, theirs) : theirs;
        break;
      case 'latest':
        out[field] = isMap(mine) && isMap(theirs) ? latest(mine, theirs) : theirs;
        break;
      default:
        out[field] = theirs;
    }
  }

  return out as T;
}
