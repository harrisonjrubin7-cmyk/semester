import { idOf, labelFor, stamp, strategyFor } from './merge';
import { formatDateTime } from './locale';

/**
 * Two devices edited the same thing, and the student gets to choose.
 *
 * ## What the merge could not tell apart
 *
 * `lib/merge.ts` keeps the later edit of a record both sides hold, and that
 * is the right default for the common case — one device edited it, the other
 * did not, and "later" is simply "the edit". It is the wrong answer for the
 * rare one: the same note rewritten on the phone on the bus and on the laptop
 * in the library, both before either synced. "Later" then throws one of two
 * real edits away, and nothing said so.
 *
 * Telling those apart needs the version both devices last agreed on. Without
 * it, a record that differs could have been edited here, there, or in both
 * places, and only the last is a conflict. So this keeps a **base**: a
 * fingerprint of every identified record as of the last moment this device
 * and the account held the same copy — after a push lands (the account now
 * holds what was sent) and after a pull is taken (this device now holds what
 * the account had). A record whose local copy differs from the base *and*
 * whose remote copy differs from the base *and* the two differ from each
 * other was edited on both sides. That is a conflict, and nothing else is.
 *
 * ## What happens to one
 *
 * The merge still runs exactly as before, so the app is never left holding
 * two copies of one note. What changes is that the copy it did not keep is
 * written down, on this device only, with the one it did — and the student is
 * asked. Keeping the one in use dismisses the question. Keeping the other puts
 * it back, stamped now, so it wins the next merge and goes up on the next
 * push like any other edit.
 *
 * ## What it covers
 *
 * Lists of identified records — notes, tasks, appointments, drafts, courses,
 * everything `union` merges — and the settings a student chose (`SETTINGS`
 * below): the look, the arrangements they made, the rules they wrote about
 * their own time. A setting is `theirs` to the merge, so the incoming value
 * wins; changed on both devices since they last agreed, the value this
 * device had is kept on the review list the same way a note is.
 *
 * Not the rest of `theirs`, which is the app's own state rather than a
 * choice anybody made — a live session, a cached geocode, whether onboarding
 * was seen. Asking which of two of those to keep would be asking the student
 * a question about the app's plumbing.
 *
 * And the per-key maps (`ticks`): a deadline ticked done, a grade typed in, a
 * course renamed, a link saved. The merge takes the account's value key by
 * key; a key changed on both devices to different values since they agreed —
 * a grade entered as B+ on one and A- on the other, a course given two new
 * names — is offered like a note is, one key at a time.
 */

/** A short, stable fingerprint of a value. FNV-1a over its JSON; not a security hash. */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** `field/id` → fingerprint, for every identified record in a `union` list. */
export type Base = Record<string, string>;

const key = (field: string, id: string) => `${field}/${id}`;

/**
 * The settings offered as conflicts, each a group of fields that mean one
 * thing together. Named by the first field, which is also what `labelFor`
 * calls it on screen.
 *
 * Grouped where one choice writes several fields: a dragged accent colour is
 * `accent: 'hue'` plus the hue itself, and offering the two apart would let
 * somebody keep half a colour.
 */
export const SETTINGS: readonly (readonly string[])[] = [
  // The look.
  ['accent', 'hue'],
  ['ground'],
  ['corners'],
  ['typeface'],
  ['bodyface'],
  ['iconShape'],
  ['calm'],
  ['courseColours'],
  ['badges'],
  ['feed'],
  // Arrangements somebody made on purpose.
  ['boardOrder'],
  ['groupOrder'],
  ['favourites'],
  ['shortcuts'],
  ['feedOrder'],
  ['courseOrder'],
  // What they said about themselves and their time.
  ['myName'],
  ['aboutMe'],
  ['dayBudget'],
  ['floor'],
  ['contract'],
  ['myRules'],
  ['quiet'],
  ['accessLeadDays'],
  // Access and focus, and how a name is said: both chosen by the person.
  ['access'],
  ['pronounce'],
];

/** Every field some group covers — what `restoreSettings` may write, and nothing else. */
export const SETTING_FIELDS: ReadonlySet<string> = new Set(SETTINGS.flat());

/** The group's fields out of a copy, as one value to compare and to keep. */
function pickGroup(from: Record<string, unknown>, group: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of group) out[f] = from[f];
  return out;
}

function recordLists(persisted: Record<string, unknown>): [string, unknown[]][] {
  return Object.entries(persisted).filter(
    (entry): entry is [string, unknown[]] => strategyFor(entry[0]) === 'union' && Array.isArray(entry[1]),
  );
}

/** The base for a copy of the persisted half. */
export function baseOf(persisted: Record<string, unknown>): Base {
  const out: Base = {};
  for (const [field, rows] of recordLists(persisted)) {
    for (const row of rows) {
      const id = idOf(row);
      if (id !== null) out[key(field, id)] = fingerprint(row);
    }
  }
  for (const group of SETTINGS) {
    if (group.some((f) => f in persisted)) out[key('settings', group[0])] = fingerprint(pickGroup(persisted, group));
  }
  // Every key of every per-key map, and a mark that the map was seen at all,
  // so a key missing from the base can be told from a map the base never had.
  for (const [field, value] of Object.entries(persisted)) {
    if (strategyFor(field) !== 'ticks' || !isMap(value)) continue;
    out[key('ticks', field)] = '1';
    for (const [k, v] of Object.entries(value)) out[`ticks/${field}/${k}`] = fingerprint(v);
  }
  // And every field the merge takes from the account, one by one — what
  // `keptHere` asks whether the account has moved away from.
  for (const [field, value] of Object.entries(persisted)) {
    if (strategyFor(field) === 'theirs' && value !== undefined) out[key('theirs', field)] = fingerprint(value);
  }
  return out;
}

/**
 * The fields a pull must not take, because the account has not changed them
 * since this device and it last agreed — so any difference is this device's
 * own change, not yet pushed.
 *
 * `theirs` means the incoming value wins, and without a base it had to:
 * there was no way to tell "the account changed this" from "this device
 * changed this and the account has not heard yet". So a setting changed here
 * and pulled over before its push went up was simply lost — rare when a pull
 * meant signing in, and not rare once the app pulls on focus and on
 * reconnect. With the base it is a question with an answer: if the account's
 * value is still the one both sides agreed, this device's is the newer one.
 *
 * No base, or a field the base never saw: nothing is held back, and the
 * merge's old rule stands.
 */
export function keptHere(remote: Record<string, unknown>, base: Base | null): string[] {
  if (!base) return [];
  return Object.keys(remote).filter((field) => {
    if (strategyFor(field) !== 'theirs') return false;
    const agreed = base[key('theirs', field)];
    return agreed !== undefined && remote[field] !== undefined && fingerprint(remote[field]) === agreed;
  });
}

export interface Conflict {
  /** `field/id`. Unique per record, and what the student's choice is keyed on. */
  key: string;
  field: string;
  id: string;
  /** This device's copy. */
  mine: unknown;
  /** The account's copy — the other device's edit. */
  theirs: unknown;
  /** Which one the merge kept, and so which is in use now. */
  kept: 'mine' | 'theirs';
  /** When it was found, epoch ms. */
  found: number;
}

/**
 * The records edited on both sides since the base.
 *
 * `remote` is what a pull brought, in the same shape as `local` (courses
 * unwrapped to their modules). A field the remote does not carry is skipped,
 * as the merge skips it. No base means this device has never agreed with the
 * account on anything, and every difference would look like a conflict — so
 * none are reported, and the merge's default stands.
 */
export function conflictsIn(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  base: Base | null,
  now = Date.now(),
): Conflict[] {
  if (!base) return [];
  const out: Conflict[] = [];
  for (const [field, theirsRows] of recordLists(remote)) {
    const mineRows = local[field];
    if (!Array.isArray(mineRows)) continue;
    const mineById = new Map<string, unknown>();
    for (const row of mineRows) {
      const id = idOf(row);
      if (id !== null) mineById.set(id, row);
    }
    for (const theirs of theirsRows) {
      const id = idOf(theirs);
      if (id === null) continue;
      const mine = mineById.get(id);
      const agreed = base[key(field, id)];
      if (mine === undefined || agreed === undefined) continue;
      const a = fingerprint(mine);
      const b = fingerprint(theirs);
      if (a === b || a === agreed || b === agreed) continue;
      // Both moved, apart. The same comparison `union` makes decides which
      // one is in use after the merge.
      out.push({
        key: key(field, id),
        field,
        id,
        mine,
        theirs,
        kept: stamp(theirs) >= stamp(mine) ? 'theirs' : 'mine',
        found: now,
      });
    }
  }

  /*
   * The settings, compared the same three ways. What the merge leaves in use
   * is the account's value for every field the pull carried — `theirs` — so
   * the account's side of the comparison is those fields over this device's
   * for any it did not carry, which is exactly what the merge will produce.
   */
  for (const group of SETTINGS) {
    if (!group.some((f) => f in remote)) continue;
    const agreed = base[key('settings', group[0])];
    if (agreed === undefined) continue;
    const mine = pickGroup(local, group);
    const theirs = pickGroup({ ...local, ...pickPresent(remote, group) }, group);
    const a = fingerprint(mine);
    const b = fingerprint(theirs);
    if (a === b || a === agreed || b === agreed) continue;
    out.push({ key: key('settings', group[0]), field: 'settings', id: group[0], mine, theirs, kept: 'theirs', found: now });
  }
  return out;
}

function isMap(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A key's value as the base records it; absent is its own answer. */
const ABSENT = '∅';
const tickPrint = (map: Record<string, unknown>, k: string) => (k in map && map[k] !== undefined ? fingerprint(map[k]) : ABSENT);

/**
 * The keys of the per-key maps changed on both sides since the base, apart.
 * Only maps the base has seen; a key the base never had counts as absent
 * there, so one device adding it and the other adding something else is a
 * conflict, and both adding the same is not.
 */
export function tickConflictsIn(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  base: Base | null,
  now = Date.now(),
): Conflict[] {
  if (!base) return [];
  const out: Conflict[] = [];
  for (const [field, theirsMap] of Object.entries(remote)) {
    if (strategyFor(field) !== 'ticks' || !isMap(theirsMap) || base[key('ticks', field)] === undefined) continue;
    const mineMap = isMap(local[field]) ? (local[field] as Record<string, unknown>) : {};
    for (const k of new Set([...Object.keys(mineMap), ...Object.keys(theirsMap)])) {
      const agreed = base[`ticks/${field}/${k}`] ?? ABSENT;
      const a = tickPrint(mineMap, k);
      const b = tickPrint(theirsMap, k);
      if (a === b || a === agreed || b === agreed) continue;
      // The merge only ever adds or overwrites a key from the account, so a
      // key the account does not carry leaves this device's value in use.
      out.push({
        key: `ticks/${field}/${k}`,
        field: 'ticks',
        id: `${field}/${k}`,
        mine: mineMap[k],
        theirs: theirsMap[k],
        kept: k in theirsMap ? 'theirs' : 'mine',
        found: now,
      });
    }
  }
  return out;
}

/**
 * Each per-key map from a pull, cut down to the keys the account changed
 * since the base — `keptHere` for the maps. The merge lays the account's map
 * over this device's key by key, so a key this device changed and the
 * account did not would otherwise be put back. Maps the base never saw come
 * through whole.
 */
export function takenTicks(remote: Record<string, unknown>, base: Base | null): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [field, map] of Object.entries(remote)) {
    if (strategyFor(field) !== 'ticks' || !isMap(map)) continue;
    if (!base || base[key('ticks', field)] === undefined) {
      out[field] = map;
      continue;
    }
    out[field] = Object.fromEntries(
      Object.entries(map).filter(([k]) => tickPrint(map, k) !== (base[`ticks/${field}/${k}`] ?? ABSENT)),
    );
  }
  return out;
}

/**
 * The keys the account removed that this device still has and has not
 * touched since — which the merge cannot remove by itself.
 *
 * The per-key merge lays the account's map over this device's, so it can add
 * and overwrite a key and never take one away. A grade cleared on the laptop
 * went up as a map without it; the phone pulled, kept its own copy of the
 * key, and pushed it straight back. With the base it has an answer: a key the
 * base has, the account no longer carries, and this device still holds
 * unchanged was removed over there, and goes here too.
 *
 * A key this device changed since the base is not in here — removed there and
 * changed here is a conflict, and `tickConflictsIn` offers it. A key the base
 * never had was added here and is not the account's to remove.
 */
export function removedThere(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  base: Base | null,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!base) return out;
  for (const [field, theirsMap] of Object.entries(remote)) {
    if (strategyFor(field) !== 'ticks' || !isMap(theirsMap) || base[key('ticks', field)] === undefined) continue;
    const mineMap = local[field];
    if (!isMap(mineMap)) continue;
    const gone = Object.keys(mineMap).filter((k) => {
      const agreed = base[`ticks/${field}/${k}`];
      return agreed !== undefined && !(k in theirsMap) && tickPrint(mineMap, k) === agreed;
    });
    if (gone.length > 0) out[field] = gone;
  }
  return out;
}

/** Only the group's fields the copy actually carries. */
function pickPresent(from: Record<string, unknown>, group: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of group) if (f in from && from[f] !== undefined) out[f] = from[f];
  return out;
}

/**
 * The list with this record in place of the one with its id, stamped now so
 * the next merge keeps it. A record that is not there any more is added back:
 * choosing a version of something is a stronger statement than a deletion
 * that happened while the question was open.
 */
export function putRecord(rows: unknown[], record: unknown, now = Date.now()): unknown[] {
  const id = idOf(record);
  // `updated` whether or not the record had one: it is the first stamp the
  // merge reads, so a chosen copy without it could lose the next merge to
  // the very copy the student just chose against.
  const fresh = record && typeof record === 'object' ? { ...(record as object), updated: now } : record;
  if (id === null) return [...rows, fresh];
  let found = false;
  const out = rows.map((row) => {
    if (idOf(row) !== id) return row;
    found = true;
    return fresh;
  });
  return found ? out : [...out, fresh];
}

/** What to call a record on the review list: its kind, and its own name. */
export function describe(field: string, record: unknown, id = ''): { kind: string; title: string; preview: string } {
  if (field === 'settings') return describeSetting(id, record);
  if (field === 'ticks') return describeTick(id, record);
  const r = (record ?? {}) as Record<string, unknown>;
  const course = (r.course ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const title =
    text(r.title) || text(r.subject) || text(r.name) || text(course.code) || text(course.name) || 'Untitled';
  const body = text(r.body) || text(r.note) || text(r.text) || text(r.detail);
  return {
    kind: labelFor(field),
    title,
    preview: body.length > 140 ? `${body.slice(0, 139)}…` : body,
  };
}

/**
 * A setting, in words: its name, and each version as the value somebody
 * would recognise — "Oxide", "7", "On" — or, for an arrangement, how many
 * things are in it. Never the raw JSON of a list of screen ids.
 */
function describeSetting(id: string, value: unknown): { kind: string; title: string; preview: string } {
  const v = (value ?? {}) as Record<string, unknown>;
  const say = (x: unknown): string => {
    if (x === null || x === undefined || x === '') return 'Not set';
    if (typeof x === 'boolean') return x ? 'On' : 'Off';
    if (typeof x === 'number') return String(x);
    if (typeof x === 'string') return x.length > 60 ? `${x.slice(0, 59)}…` : x.charAt(0).toUpperCase() + x.slice(1);
    if (Array.isArray(x)) return x.length === 1 ? '1 item' : `${x.length} items`;
    return 'Set';
  };
  // The first field is the setting; the rest ride along with it (a hue with
  // its accent) and only show when the first says it is using them.
  const first = say(v[id]);
  const extra = id === 'accent' && v.accent === 'hue' && typeof v.hue === 'number' ? ` (hue ${v.hue})` : '';
  return { kind: 'Setting', title: labelFor(id), preview: `${first}${extra}` };
}

/**
 * One key of a per-key map, in words. The title is the key unless the
 * caller has a better name for it (the review list looks deadlines up by id);
 * the value is what a person would call it.
 */
function describeTick(id: string, value: unknown): { kind: string; title: string; preview: string } {
  const slash = id.indexOf('/');
  const field = id.slice(0, slash);
  const k = id.slice(slash + 1);
  let preview: string;
  if (value === undefined || value === null) preview = 'Not set';
  else if (typeof value === 'boolean') preview = value ? 'Yes' : 'No';
  else if (typeof value === 'number') preview = value > 1e11 ? formatDateTime(value) : String(value);
  else if (typeof value === 'string') preview = value.length > 60 ? `${value.slice(0, 59)}…` : value || 'Empty';
  else preview = 'Set';
  if (field === 'done' || field === 'saved' || field === 'visited' || field === 'feedHidden') {
    preview = value === true ? 'Ticked' : 'Not ticked';
  }
  return { kind: labelFor(field), title: k, preview };
}

// ── On this device ────────────────────────────────────────────────────────
//
// Both kept in localStorage and never synced. The base is this device's own
// memory of what it last agreed; the review list holds the copy the merge did
// not keep, which exists nowhere else.

export const BASE_KEY = 'semester.base';
export const REVIEW_KEY = 'semester.review';

export function readBase(): Base | null {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Base) : null;
  } catch {
    return null;
  }
}

export function writeBase(base: Base): void {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify(base));
  } catch {
    // Without a base the next pull reports no conflicts and the merge's
    // default stands — the behaviour before this existed.
  }
}

export function readReview(): Conflict[] {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (c): c is Conflict =>
            !!c && typeof c === 'object' && typeof (c as Conflict).key === 'string' &&
            ((c as Conflict).kept === 'mine' || (c as Conflict).kept === 'theirs'),
        )
      : [];
  } catch {
    return [];
  }
}

export function writeReview(list: Conflict[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(REVIEW_KEY);
    else localStorage.setItem(REVIEW_KEY, JSON.stringify(list));
  } catch {
    // See writeBase.
  }
}

/**
 * New conflicts folded into the waiting ones. A record already waiting keeps
 * its entry but takes the newest pair of copies — the question is still the
 * same question, about the latest two versions.
 */
export function addReview(waiting: Conflict[], found: Conflict[]): Conflict[] {
  const byKey = new Map(waiting.map((c) => [c.key, c]));
  for (const c of found) byKey.set(c.key, c);
  return [...byKey.values()];
}
