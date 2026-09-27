import { ACTIONS_PREFIX, readActionChoices } from './actions';
import { readAthletics } from './athletics';
import { CLARITY_PREFIX, readClarity } from './clarity';
import { readCareer } from './career';
import { readCreations } from './creations';
import { obj, textValue } from './device-library';
import { readFamily } from './family';
import { PATH_PROFILE_PREFIX, readPathProfile } from './path-profile';
import { readPathway } from './pathway';
import { readUniversityDrafts } from './university';

/**
 * A backup for the device workspaces the main one does not reach.
 *
 * `lib/export.ts` backs up the term — courses, deadlines, notes, grades — by
 * taking `pickPersisted` and writing it out. Athletics, Career, Family,
 * Pathway, Create and the University drafts are not in there: each is a
 * `useDeviceLibrary` store under a key of its own, which is what makes them
 * account- and term-scoped without bloating the synced state, and also what
 * left them in no backup at all. A résumé, a season's travel and a withdrawal
 * draft were one cleared browser away from gone.
 *
 * This is a second file rather than a bigger first one, deliberately. The core
 * backup restores through `dispatch({ type: 'restore' })` and the reducer's
 * own validation; these restore by writing `localStorage` keys directly. Those
 * are different enough that folding them together would mean one importer
 * doing two unrelated things to two unrelated stores, with one set of error
 * messages for both.
 *
 * ## What it is not
 *
 * Not synchronisation, and not a substitute for the core backup — the two
 * cover disjoint things and a student needs both. Attachments are in neither;
 * they are in the zip. Credentials are in neither, on purpose.
 *
 * ## Scope is part of the key, so it is part of the record
 *
 * A term workspace's key carries the account *and* the term; an account
 * workspace's carries only the account. Restoring writes the key for the
 * account doing the restoring, never the key the file was written from —
 * otherwise a backup taken on one account would write into another's storage,
 * which is the one thing a per-account store exists to prevent.
 */

interface Definition {
  label: string;
  prefix: string;
  scope: 'account' | 'term';
  read: (value: unknown) => unknown;
}

const DEFINITIONS: Record<string, Definition> = {
  creations: {
    label: 'Forms, designs and videos',
    prefix: 'semester.creations.v1',
    scope: 'term',
    read: readCreations,
  },
  athletics: {
    label: 'Athletics plans',
    prefix: 'semester.athletics.v1',
    scope: 'term',
    read: readAthletics,
  },
  career: { label: 'Career plans', prefix: 'semester.career.v1', scope: 'term', read: readCareer },
  university: {
    label: 'University preparation drafts',
    prefix: 'semester.university.drafts.v1',
    scope: 'term',
    // The one reader that takes text rather than a value, because it is also
    // the importer for a drafts file somebody was handed.
    read: (value) => readUniversityDrafts(JSON.stringify(value)),
  },
  family: {
    label: 'Family permission plans',
    prefix: 'semester.family.v1',
    scope: 'account',
    read: readFamily,
  },
  pathway: {
    label: 'Education pathway',
    prefix: 'semester.pathway.v1',
    scope: 'account',
    read: readPathway,
  },
  actions: {
    label: 'What you did about your next steps',
    prefix: ACTIONS_PREFIX,
    scope: 'account',
    read: readActionChoices,
  },
  pathProfile: {
    label: 'Your degree path details',
    prefix: PATH_PROFILE_PREFIX,
    scope: 'account',
    read: readPathProfile,
  },
  clarity: {
    label: 'Your answers to "Did this help?"',
    prefix: CLARITY_PREFIX,
    scope: 'account',
    read: readClarity,
  },
};

export interface WorkspaceRecord {
  kind: string;
  term: string;
  value: unknown;
}

export interface WorkspaceBackup {
  format: 'semester.workspaces.v1';
  exported: string;
  records: WorkspaceRecord[];
}

/**
 * A term that can go into a key without changing its shape.
 *
 * A colon would split into a key naming a different account, and a control
 * character is not something any term picker produces. This is the check that
 * stops a crafted backup file writing outside its own scope.
 */
// Matching control characters is the point: they are what a term must not
// hold. The rule fires now only because the range is finally written as
// characters rather than as the bytes themselves, which it could not see.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f:]/;
const validTerm = (v: unknown): v is string => textValue(v, 100) && v.length > 0 && !CONTROL.test(v);

function keyFor(kind: string, term: string, account: string): string {
  const definition = DEFINITIONS[kind];
  if (!definition) throw new Error('This backup names a workspace this version does not have.');
  if (definition.scope === 'term' && !validTerm(term)) {
    throw new Error('A workspace in this backup has a term it could not have been saved under.');
  }
  if (definition.scope === 'account' && term !== '') {
    throw new Error('A workspace in this backup carries a term it cannot have.');
  }
  return definition.scope === 'term' ? `${definition.prefix}:${account}:${term}` : `${definition.prefix}:${account}`;
}

export function workspaceLabel(record: WorkspaceRecord): string {
  return `${DEFINITIONS[record.kind]?.label ?? record.kind}${record.term ? ` · ${record.term}` : ''}`;
}

/**
 * Everything stored for one account, and nothing else.
 *
 * Built outwards from the definitions rather than by walking `localStorage`
 * and keeping what looks familiar: a sweep of every key is how a token, a
 * cache, or another account's workspace ends up in a file somebody emails
 * themselves. Each candidate key is rebuilt through `keyFor` and compared, so
 * a key that merely starts with the right prefix is not enough.
 *
 * A workspace that cannot be read throws rather than being skipped. A backup
 * that quietly omits the one corrupted workspace is the file somebody restores
 * from six months later to find it was never in there.
 */
export function workspaceBackup(account = 'device', storage: Storage = localStorage): WorkspaceBackup {
  const records: WorkspaceRecord[] = [];
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
    (k): k is string => k !== null,
  );

  for (const [kind, definition] of Object.entries(DEFINITIONS)) {
    const prefix = `${definition.prefix}:${account}:`;
    const selected =
      definition.scope === 'term'
        ? keys.filter((k) => k.startsWith(prefix))
        : keys.filter((k) => k === keyFor(kind, '', account));

    for (const key of selected) {
      const term = definition.scope === 'term' ? key.slice(prefix.length) : '';
      // Rebuilt and compared: a term with a colon in it would pass the prefix
      // test above while naming a key this account does not own.
      if (definition.scope === 'term' && !validTerm(term)) continue;
      if (key !== keyFor(kind, term, account)) continue;
      try {
        records.push({ kind, term, value: definition.read(JSON.parse(storage.getItem(key) as string)) });
      } catch {
        throw new Error(
          `${definition.label}${term ? ` (${term})` : ''} could not be read, so it is not in this backup. ` +
            'Its stored data has been kept — take the recovery copy from that screen first.',
        );
      }
    }
  }

  return { format: 'semester.workspaces.v1', exported: new Date().toISOString(), records };
}

/** Parse and validate a whole file. Throws on the first thing that is wrong. */
export function readWorkspaceBackup(text: string): WorkspaceBackup {
  if (text.length > 20_000_000) throw new Error('Choose a workspace backup smaller than 20 MB.');
  const value: unknown = JSON.parse(text);
  if (
    !obj(value) ||
    value.format !== 'semester.workspaces.v1' ||
    !Array.isArray(value.records) ||
    value.records.length > 500
  ) {
    throw new Error('This is not a Semester workspace backup.');
  }

  const seen = new Set<string>();
  const records = value.records.map((record: unknown) => {
    if (
      !obj(record) ||
      typeof record.kind !== 'string' ||
      !Object.hasOwn(DEFINITIONS, record.kind) ||
      typeof record.term !== 'string'
    ) {
      throw new Error('This backup has an entry that is not a workspace.');
    }
    // Keyed against a fixed account: this is a duplicate check, not a write.
    const key = keyFor(record.kind, record.term, 'device');
    if (seen.has(key)) throw new Error('This backup names the same workspace twice.');
    seen.add(key);
    return { kind: record.kind, term: record.term, value: DEFINITIONS[record.kind]!.read(record.value) };
  });

  return {
    format: 'semester.workspaces.v1',
    exported: typeof value.exported === 'string' ? value.exported : '',
    records,
  };
}

/**
 * Write them all, or write none of them.
 *
 * Validated in full before the first `setItem`, so a file that goes wrong at
 * record nine does not leave eight workspaces already replaced. And if storage
 * refuses partway — quota is the realistic one, and it arrives without warning
 * — every key already written is put back to what it held.
 *
 * The rollback can itself fail, and that case gets its own message rather than
 * being folded into the first. "Nothing was changed" and "some of what was
 * there could not be put back" call for different actions from the person
 * reading them, and saying the first when the second happened is how somebody
 * clears their site data on top of a half-restored store.
 */
export function restoreWorkspaces(
  backup: WorkspaceBackup,
  account = 'device',
  storage: Storage = localStorage,
): void {
  const checked = readWorkspaceBackup(JSON.stringify(backup));
  const entries = checked.records.map((record) => ({
    key: keyFor(record.kind, record.term, account),
    value: JSON.stringify(record.value),
  }));

  const before = new Map(entries.map((entry) => [entry.key, storage.getItem(entry.key)]));
  const written: string[] = [];
  try {
    for (const entry of entries) {
      storage.setItem(entry.key, entry.value);
      written.push(entry.key);
    }
  } catch {
    let stuck = false;
    for (const key of written.reverse()) {
      try {
        const old = before.get(key);
        if (old === null || old === undefined) storage.removeItem(key);
        else storage.setItem(key, old);
      } catch {
        stuck = true;
      }
    }
    throw new Error(
      stuck
        ? 'Storage failed and some of what was there could not be put back. Keep both backup files, and do not clear this site’s data.'
        : 'Storage is full or unavailable. Nothing was changed.',
    );
  }

  // The screens are listening; this is what makes an open Career tab redraw
  // rather than sit on what it read before the restore.
  for (const entry of entries) {
    window.dispatchEvent(new CustomEvent('semester-device-library', { detail: entry.key }));
  }
}
