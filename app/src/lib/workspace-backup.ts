import { keepNotes, readMeetings } from './advisor-meeting';
import { keepMemory, readCalm } from './calm-controls';
import { obj } from './device-library';
import { keepReflections, readResets } from './weekly-reset';
import {
  DEFINITIONS,
  keyFor,
  type WorkspaceBackup,
  type WorkspaceRecord,
} from './workspace-backup-create';

export {
  BACKED_UP_PREFIXES,
  workspaceBackup,
  type WorkspaceBackup,
  type WorkspaceRecord,
} from './workspace-backup-create';

const RESTORES: Partial<Record<string, (incoming: unknown, existing: unknown) => unknown>> = {
  advisorMeeting: (incoming, existing) => keepNotes(readMeetings(incoming), existing),
  weeklyReset: (incoming, existing) => keepReflections(readResets(incoming), existing),
  calm: (incoming, existing) => keepMemory(readCalm(incoming), existing),
};

export function workspaceLabel(record: WorkspaceRecord): string {
  return `${DEFINITIONS[record.kind]?.label ?? record.kind}${record.term ? ` · ${record.term}` : ''}`;
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
  const entries = checked.records.map((record) => {
    const key = keyFor(record.kind, record.term, account);
    const merge = RESTORES[record.kind];
    if (!merge) return { key, value: JSON.stringify(record.value) };
    let existing: unknown = null;
    try {
      existing = JSON.parse(storage.getItem(key) ?? 'null');
    } catch {
      existing = null;
    }
    return { key, value: JSON.stringify(merge(record.value, existing)) };
  });

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
