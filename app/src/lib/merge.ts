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

export type Strategy = 'union' | 'theirs' | 'ticks' | 'latest' | 'mine';

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
 * - `mine` — a setting about *this device* rather than about the person. It
 *   is stored and it syncs to the account, but an incoming copy never
 *   overrides the one here. Text size and spacing are the whole category: a
 *   phone at arm's length and a laptop at desk distance want different
 *   answers, and having one push its answer onto the other is a setting that
 *   appears to un-set itself every time the other device is opened.
 *
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
  windows: 'union',
  costs: 'union',
  balances: 'union',
  residences: 'union',
  feeds: 'union',
  feedEvents: 'union',
  extraLinks: 'union',
  // Schools added by hand. Two devices adding two different ones should end
  // with both, which is what `union` on id does.
  mySchools: 'union',

  // Maps keyed by id, where each key is its own small decision.
  done: 'ticks',
  tickedAt: 'ticks',
  // Same shape and the same reason: starting a paper on the laptop is still
  // having started it, and a phone that syncs later must not un-start it.
  // `ticks` keeps both sides' keys rather than letting one map replace the
  // other wholesale.
  started: 'ticks',
  saved: 'ticks',
  picked: 'ticks',
  grades: 'ticks',
  // Cutoffs per course. Keyed the same way and merged the same way: typing
  // this course's scale off its syllabus on the laptop must not wipe the one
  // typed for another course on the phone.
  gradeSystems: 'ticks',
  linkUrls: 'ticks',
  feedHidden: 'ticks',
  notifs: 'ticks',

  // Drill history. Answering a card on the laptop and again on the phone is
  // not a conflict, it is two answers; the later one is the current state of
  // that card, whichever device synced first.
  reviews: 'latest',

  // Settings and single values: the last device to touch them is right.
  // Taste: the same everywhere, because it is about the person.
  accent: 'theirs',
  ground: 'theirs',
  corners: 'theirs',
  typeface: 'theirs',
  iconShape: 'theirs',
  // The accent hue travels with the accent it replaces, or the two would
  // disagree about what colour the app is.
  hue: 'theirs',
  // A body face is chosen for how it reads, which is a fact about the person
  // rather than about the screen — somebody who picked Hyperlegible because
  // reading is tiring wants it on the laptop too.
  bodyface: 'theirs',
  // How you want your day drawn, and how loudly the app may claim your
  // attention. Both about you.
  feed: 'theirs',
  badges: 'theirs',
  // Ergonomics: about the screen in front of you, not about you. See `mine`.
  textSize: 'mine',
  density: 'mine',
  /*
   * The shape this device writes, which is never the other device's business.
   *
   * `mine` rather than `theirs` or `latest`: a laptop three releases behind
   * must not be told by a phone that its storage is version 6, because the
   * migration would then skip the steps that laptop still needs. Each device
   * stamps its own on save. See `lib/migrate.ts`.
   */
  schemaVersion: 'mine',
  // The same three-way split as textSize. A comfortable measure on a laptop is
  // not one on a phone, and tab labels are height a small screen wants back
  // and a large one does not.
  lineHeight: 'mine',
  readingWidth: 'mine',
  labels: 'mine',
  // An arrangement rather than a list you add to — merging two orderings
  // would produce an order neither device chose.
  feedOrder: 'theirs',
  // Same reasoning, and one more: unioning two bars would overflow it, and
  // the overflow would be silently trimmed by whichever device read it next.
  tabs: 'theirs',
  // Per course, not wholesale: two devices renaming two different courses
  // should end with both names, and `theirs` would keep one device's whole
  // set and drop the other's.
  yours: 'ticks',
  // An arrangement of rules the student wrote, not a list of things they
  // collect — merging two devices' would produce a set neither asked for.
  myRules: 'theirs',
  myName: 'theirs',
  // A choice about whether the app counts anything, so it follows the person.
  // The counts it governs never sync at all — see `lib/usage.ts`.
  countScreens: 'theirs',
  // What this device last merged is a fact about this device. See the note on
  // the field in `state/shape.ts` for why the plan's `latest` would not work.
  lastSync: 'mine',
  // Which units were guessed at before reading. Two devices pre-testing two
  // different units should end with both, and a pretest is never un-done.
  pretested: 'ticks',
  // Who you are and what you want suggested. A fact about the person, and
  // dismissals should follow them rather than be re-offered on a second
  // device.
  wanted: 'theirs',
  // Closing a term on one device is closing it. Two devices closing two
  // different terms should end with both closed, which is what a union of
  // plain strings does.
  archivedTerms: 'union',
  // A mark on a class is a fact about a day, and two devices marking two
  // different days should end with both. Keyed by course and date inside
  // `readLog`, so a duplicate cannot become a second absence.
  attendance: 'union',
  attendPolicy: 'ticks',
  pieces: 'ticks',
  drops: 'ticks',
  dayBudget: 'theirs',
  // A countdown belongs to the device it is counting on: a timer running on a
  // phone in a kitchen means nothing on a laptop in the library, and syncing
  // one across would either ring in the wrong room or arrive already expired.
  // Alarms go the same way — an alarm can only ring where the app is open, so
  // it is set on the device meant to do the ringing.
  timers: 'mine',
  alarms: 'mine',
  // Unlike the clocks: an application is a fact about your term, not about a
  // device, and two devices adding two different ones should end with both.
  // Ids are generated per application, so a union cannot duplicate one.
  applications: 'union',
  // Each record carries its own `updated`, so two devices reading the same
  // chapter keep the later position rather than whichever synced last.
  progress: 'latest',
  // A piece of work coming back is a fact with an id, and two devices marking
  // two different pieces should end with both.
  returned: 'union',
  regradeWindows: 'ticks',
  // A consent, and consent given on one device is consent given. `theirs`
  // rather than `mine` so turning it off anywhere turns it off everywhere.
  geocode: 'theirs',
  // Four years of transcript, not one term's. Losing a row here is losing work
  // that cannot be re-imported from anywhere.
  requirements: 'union',
  taken: 'union',
  // A grading scale is one table about one university, not a list to add to.
  scale: 'theirs',
  // Years of relationships. Losing one of these is losing something that
  // cannot be reconstructed from anywhere else.
  people: 'union',
  visits: 'union',
  letters: 'union',
  // A log rather than a list of things with stable ids: two devices drilling
  // produce two disjoint runs and both are real. Deduplicated by nothing,
  // because two answers to the same card at different moments are two answers.
  answers: 'union',
  // About the person, not the device: a sleep floor set on a laptop is a sleep
  // floor.
  floor: 'theirs',
  contract: 'theirs',
  rest: 'union',
  // An arrangement, like feedOrder — merging two would produce an order
  // neither device chose.
  courseOrder: 'theirs',
  nav: 'theirs',
  sample: 'theirs',
  term: 'theirs',
  seenOnboarding: 'theirs',
  // Where you study. A fact about the person, not the device — and the last
  // device to be told is the one that is right, because somebody transferring
  // sets it once and expects both phones to follow.
  schoolId: 'theirs',
  // How much of the app somebody wants listed. A choice about them, so it
  // follows them — and because it only ever adds, the worst a wrong guess does
  // is show a screen they had not asked for yet.
  showAll: 'theirs',
  cleared: 'theirs',
  waysOpen: 'theirs',
  accessLeadDays: 'theirs',
  // Where you have been lately, newest first. Interleaving two devices'
  // histories would make it a list of nowhere in particular.
  recent: 'theirs',
  // Not `theirs`: opening a screen on a laptop is still having opened it, and
  // a phone that syncs later should not un-see it.
  visited: 'ticks',
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
  return withNotes(local, remote).merged;
}

/**
 * What a sync did, field by field.
 *
 * The decisions were always being made and never reported. When `theirs` wins
 * on a setting the local value is gone with no notice at all — which is
 * defensible for a setting and indefensible as a silence, because the person
 * whose value was replaced is the one who cannot tell it happened.
 *
 * Observing only. Nothing here changes what the merge does.
 */
export type Outcome = 'kept-local' | 'took-remote' | 'combined' | 'no-change';

export interface MergeNote {
  /** The store field, e.g. `grades`. */
  key: string;
  strategy: Strategy;
  outcome: Outcome;
  /** Rows or fields affected. Zero when nothing moved. */
  changed: number;
  /** What to call it on a screen. */
  label: string;
  /**
   * Whether the value this device held was the shipped default.
   *
   * A first sync replacing a default with a real choice is the sync working,
   * and a new device that announced that would open on a banner about its own
   * setup. Computed here, where the pre-merge value is in hand — nothing
   * downstream has it any more.
   */
  wasDefault: boolean;
}

/**
 * Names for the fields worth naming.
 *
 * Only the ones somebody would recognise. Anything absent falls back to the
 * field name, which is honest — a note about `regradeWindows` is better than
 * no note, and better than a name invented at render time.
 */
const LABELS: Record<string, string> = {
  courses: 'Courses',
  notes: 'Notes',
  tasks: 'Your tasks',
  appointments: 'Appointments',
  grades: 'Grades',
  gradeSystems: 'Grading cutoffs',
  done: 'What you have ticked off',
  reviews: 'Study card history',
  sittings: 'Practice papers',
  attendance: 'Attendance',
  spent: 'Timings',
  ground: 'Theme',
  accent: 'Accent',
  typeface: 'Typeface',
  dayBudget: 'Hours in a day',
  contract: 'Your rules',
  floor: 'Sleep window',
  scale: 'Grade scale',
  nav: 'Home layout',
  tabs: 'The tab bar',
  schoolId: 'Where you study',
  mySchools: 'Schools you added',
};

export function labelFor(key: string): string {
  return LABELS[key] ?? key;
}

/** How many keys of a map differ between two copies. */
function movedKeys(before: unknown, after: unknown): number {
  if (!isMap(before) || !isMap(after)) return before === after ? 0 : 1;
  let n = 0;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) n += 1;
  }
  return n;
}

/** How many entries of a list differ, by id where there is one. */
function movedRows(before: unknown, after: unknown): number {
  if (!Array.isArray(before) || !Array.isArray(after)) return before === after ? 0 : 1;
  const byId = (list: unknown[]) => {
    const m = new Map<string, string>();
    for (const row of list) {
      const id = idOf(row);
      m.set(id ?? JSON.stringify(row), JSON.stringify(row));
    }
    return m;
  };
  const a = byId(before);
  const b = byId(after);
  let n = 0;
  for (const [id, value] of b) if (a.get(id) !== value) n += 1;
  return n;
}

/** The merge, and a note per field it touched. */
export function withNotes<T extends object>(
  local: T,
  remote: NoInfer<Partial<T>>,
  /** The shipped defaults, so a note can say whether anything was really lost. */
  defaults?: NoInfer<Partial<T>>,
): { merged: T; notes: MergeNote[] } {
  const out: Record<string, unknown> = { ...(local as Record<string, unknown>) };
  const notes: MergeNote[] = [];

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
      case 'mine':
        // Left exactly as it was. The remote copy is not read at all — which
        // is the point, and is why this is a strategy rather than an omission
        // from the loop: an omitted field would fall through to `union`.
        break;
      default:
        out[field] = theirs;
    }

    const strategy = strategyFor(field);
    const after = out[field];
    const same = JSON.stringify(mine) === JSON.stringify(after);
    const changed =
      strategy === 'union'
        ? movedRows(mine, after)
        : strategy === 'ticks' || strategy === 'latest'
          ? movedKeys(mine, after)
          : same
            ? 0
            : 1;
    const outcome: Outcome =
      strategy === 'mine'
        ? // Reported even when identical: "this device kept its own" is the
          // fact, and it is the same fact either way.
          'kept-local'
        : same
          ? 'no-change'
          : strategy === 'union' || strategy === 'ticks' || strategy === 'latest'
            ? 'combined'
            : 'took-remote';
    const wasDefault =
      defaults !== undefined &&
      JSON.stringify((defaults as Record<string, unknown>)[field]) === JSON.stringify(mine);
    notes.push({ key: field, strategy, outcome, changed, label: labelFor(field), wasDefault });
  }

  return { merged: out as T, notes };
}

/**
 * The notes worth putting in front of somebody.
 *
 * Everything that did nothing is dropped: a sync that reports "no change" for
 * sixty fields is a sync report nobody reads twice. `kept-local` is dropped
 * too — that this device kept its own text size is not news.
 */
export function worthSaying(notes: MergeNote[]): MergeNote[] {
  return notes
    .filter((n) => n.changed > 0 && n.outcome !== 'kept-local')
    .sort((a, b) => b.changed - a.changed || a.label.localeCompare(b.label));
}

/** What the Account screen says under the last-sync time, or empty. */
export function syncLine(notes: MergeNote[]): string {
  const said = worthSaying(notes);
  if (said.length === 0) return 'Nothing came back that this device did not already have.';
  const names = said.slice(0, 3).map((n) => n.label.toLowerCase());
  const more = said.length - names.length;
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${list}${more > 0 ? `, and ${more} more,` : ''} updated from another device.`;
}

/**
 * The ones where the other device's copy replaced this one's, or empty.
 *
 * These are the notes that need saying out loud rather than being available to
 * read: a setting merged by `theirs` is gone here without a trace, and the
 * person it happened to is the one who cannot tell.
 */
export function replaced(notes: MergeNote[]): MergeNote[] {
  return notes.filter((n) => n.outcome === 'took-remote' && n.changed > 0 && !n.wasDefault);
}

/** What the banner says. Empty when there is nothing that was replaced. */
export function replacedLine(notes: MergeNote[]): string {
  const gone = replaced(notes);
  if (gone.length === 0) return '';
  const names = gone.map((n) => n.label.toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Your ${list} ${gone.length === 1 ? 'was' : 'were'} replaced by settings from another device.`;
}

/** A stored sync report, made safe to render. */
export function readLastSync(raw: unknown): { at: number; notes: MergeNote[]; told?: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  const notes = Array.isArray(r.notes)
    ? r.notes.filter(
        (n): n is MergeNote =>
          Boolean(n) &&
          typeof n === 'object' &&
          typeof (n as MergeNote).key === 'string' &&
          typeof (n as MergeNote).label === 'string' &&
          typeof (n as MergeNote).changed === 'number',
      )
    : [];
  return { at: r.at, notes, told: r.told === true };
}
