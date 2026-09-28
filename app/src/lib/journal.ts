/**
 * The student's own activity history: what you did, what you shared, and what
 * you took back — in order, with the source, the scope and the state of each.
 *
 * The app keeps several logs already, and every one of them is somebody else's
 * view: `access_log` is who read a share, `lib/actions.ts` is what happened to
 * an action, the audit tables are the institution's. None of them is the
 * student's own record of the things they did that matter — saved a plan,
 * shared an agenda, let support in, asked for an export — and a person who
 * cannot see their own trail cannot check it. `screens/Activity.tsx` draws
 * this; `lib/controls.ts` puts it one tap under Me.
 *
 * ## The rules, since it is a trail and not a feed
 *
 *  - **Only the student's own acts, and things done to their account.** No
 *    reminder, no recommendation, no "you have not opened X". A trail that
 *    includes the app talking to you is a trail nobody reads twice.
 *  - **Nothing in it is content.** An entry says a plan was saved, not what
 *    was in it; an agenda was shared, with whom and until when, not what it
 *    said. The `about` field names an object by id and label so a timeline
 *    can be drawn for a plan or a course (`forObject`), and no more.
 *  - **Every entry carries source, scope and status**, the pattern the whole
 *    app is meant to wear (`lib/provenance.ts`): where it came from (you),
 *    who can see it, and whether it stands.
 *  - **Capped and on the device.** `LIMIT` entries, oldest dropped, under a
 *    key per account so two people on one device do not read each other's.
 *    Backed up with the other device libraries (`workspace-backup.ts` lists
 *    it) and erased with them (`lib/erase.ts` clears the prefix).
 *
 * `record()` is a plain function rather than a hook so a library that does the
 * thing — revoking a grant in `lib/support-access.ts`, exporting in
 * `screens/Privacy.tsx` — can note it where it happens. It never throws: a
 * browser that refuses storage loses the trail entry, not the act.
 */

import { sourceScopeStatus, type Provenance } from './provenance';

export const JOURNAL_KINDS = {
  'plan-saved': 'Plan saved',
  'backup-added': 'Course backup added',
  'agenda-shared': 'Advisor agenda shared',
  'share-revoked': 'Share revoked',
  'support-granted': 'Support access granted',
  'support-revoked': 'Support access revoked',
  'file-added': 'File added',
  'file-deleted': 'File deleted',
  'account-connected': 'Connected account updated',
  'ai-deleted': 'AI conversation deleted',
  'export-requested': 'Data export requested',
  'credential-shared': 'Credential shared',
  'profile-viewed': 'Profile viewed by an employer',
  'term-archived': 'Term archived',
} as const;

export type JournalKind = keyof typeof JOURNAL_KINDS;

export interface About {
  /** `plan`, `course`, `agenda`, `grant`, `file`, `account`, `term` … */
  type: string;
  id: string;
  /** A label safe to show: a course code, a plan's name. Never content. */
  label: string;
}

export interface Entry {
  /** Epoch ms. */
  at: number;
  kind: JournalKind;
  /** One clause beyond the kind's label, or empty. "with Dr. Smith until 4 Oct". */
  detail: string;
  about?: About;
  /** Where it came from, who can see it, whether it stands. */
  provenance: Provenance;
}

export const LIMIT = 500;
export const PREFIX = 'semester.journal.v1';
export const keyFor = (account: string | null) => `${PREFIX}:${account ?? 'device'}`;

const isKind = (v: unknown): v is JournalKind => typeof v === 'string' && v in JOURNAL_KINDS;

/** A stored value made safe, or empty. Anything malformed is dropped, not repaired. */
export function readEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  const out: Entry[] = [];
  for (const v of value) {
    if (typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.at !== 'number' || !Number.isFinite(o.at) || !isKind(o.kind)) continue;
    const p = o.provenance as Record<string, unknown> | undefined;
    if (!p || typeof p.source !== 'string' || typeof p.scope !== 'string' || typeof p.status !== 'string') continue;
    const about = o.about as Record<string, unknown> | undefined;
    out.push({
      at: o.at,
      kind: o.kind,
      detail: typeof o.detail === 'string' ? o.detail.slice(0, 200) : '',
      provenance: { source: p.source.slice(0, 80), scope: p.scope.slice(0, 120), status: p.status.slice(0, 80) },
      ...(about && typeof about.type === 'string' && typeof about.id === 'string' && typeof about.label === 'string'
        ? { about: { type: about.type, id: about.id, label: about.label.slice(0, 80) } }
        : {}),
    });
  }
  return out;
}

/** The entries with one more, newest first, held to `LIMIT`. Pure. */
export function append(entries: readonly Entry[], entry: Entry, limit = LIMIT): Entry[] {
  return [entry, ...entries].sort((a, b) => b.at - a.at).slice(0, limit);
}

/** The timeline of one object — a plan, a course, an agenda — newest first. */
export function forObject(entries: readonly Entry[], about: Pick<About, 'type' | 'id'>): Entry[] {
  return entries.filter((e) => e.about?.type === about.type && e.about.id === about.id);
}

/** Entries grouped by calendar day, newest day first. Keys are `YYYY-MM-DD` in local time. */
export function byDay(entries: readonly Entry[]): { day: string; entries: Entry[] }[] {
  const groups = new Map<string, Entry[]>();
  for (const e of [...entries].sort((a, b) => b.at - a.at)) {
    const d = new Date(e.at);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = groups.get(day) ?? [];
    list.push(e);
    groups.set(day, list);
  }
  return [...groups.entries()].map(([day, entries]) => ({ day, entries }));
}

/** "Advisor agenda shared with Dr. Smith until 4 Oct", or just the kind's label. */
export function line(e: Entry): string {
  const label = JOURNAL_KINDS[e.kind];
  return e.detail ? `${label} — ${e.detail}` : label;
}

/** The three-line provenance under an entry, in the app's one pattern. */
export const provenanceLine = (e: Entry): string => sourceScopeStatus(e.provenance);

// ── Storage ──────────────────────────────────────────────────────────────────

/** What this account's trail holds, or nothing where storage refuses. */
export function readJournal(account: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): Entry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(keyFor(account));
    return raw === null ? [] : readEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Note one act. Returns the entry written, or null where storage refused —
 * never throws, because the act it records has already happened.
 */
export function record(
  account: string | null,
  entry: Omit<Entry, 'at'> & { at?: number },
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
): Entry | null {
  if (!storage) return null;
  const full: Entry = { ...entry, at: entry.at ?? Date.now() };
  try {
    const next = append(readJournal(account, storage), full);
    storage.setItem(keyFor(account), JSON.stringify(next));
    return full;
  } catch {
    return null;
  }
}

/** The student's own provenance for something they just did. */
export function yours(scope: string, status = 'Active'): Provenance {
  return { source: 'You', scope, status };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
