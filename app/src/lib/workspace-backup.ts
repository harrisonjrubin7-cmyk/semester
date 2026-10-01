import { readProductivity } from './productivity';
import { ABROAD_PREFIX, readAbroad } from './abroad';
import { PREFIX as JOURNAL_PREFIX, readEntries } from './journal';
import { ACTIONS_PREFIX, readActionChoices } from './actions';
import { keepNotes, MEETING_KEY, readMeetings, withoutNotes } from './advisor-meeting';
import { EVIDENCE_PREFIX, readEvidence } from './career-evidence';
import { SHORTLIST_KEY, readShortlist } from './course-detail';
import { GRADUATION_KEY, readGraduation } from './graduation';
import { LIFE_BALANCE_KEY, readSettings as readLifeBalance } from './life-balance';
import { readRegistration } from './portal-storage';
import { REGISTRATION_DAY_KEY, readRegistrationDay } from './registration-day';
import { REGISTRATION_KEY } from './registration-plan';
import { LOCKER_KEY, readLocker } from './source-locker';
import { READINESS_KEY, readReadiness } from './study-readiness';
import { readAthletics } from './athletics';
import { CLARITY_PREFIX, readClarity } from './clarity';
import { QUIZ_FEEDBACK_PREFIX, readQuizFeedback } from './quiz-feedback';
import { readCareer } from './career';
import { readCreations } from './creations';
import { obj, textValue } from './device-library';
import { readFamily } from './family';
import { PATH_PROFILE_PREFIX, readPathProfile } from './path-profile';
import { readPathway } from './pathway';
import { readUniversityDrafts } from './university';
import { FEEDBACK_PREFIX, readInbox } from './feedbackloop';
import { MAP_PREFIX, readMap } from './learningmap';
import { PREFS_PREFIX, readPrefs } from './learningprefs';
import { STUDY_JOURNAL_PREFIX, readJournal } from './studyjournal';
import { RESET_KEY, keepReflections, readResets, withoutReflections } from './weekly-reset';
import { RHYTHM_KEY, readRhythm } from './daily-rhythm';
import { CALM_KEY, keepMemory, readCalm, withoutMemory } from './calm-controls';

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
  /**
   * `device` is a store keyed by its name alone, shared by whoever uses this
   * browser — the registration workspace and the stores built on it. It
   * restores to the same key, and carries no term.
   */
  scope: 'account' | 'term' | 'device';
  read: (value: unknown) => unknown;
  /**
   * What a restore writes, given the validated record and what the device
   * already holds under that key. Absent, the record replaces it.
   */
  restore?: (incoming: unknown, existing: unknown) => unknown;
}

const DEFINITIONS: Record<string, Definition> = {
  dailyRhythm: { label: 'Private daily plans and reflections', prefix: RHYTHM_KEY, scope: 'account', read: readRhythm },
  productivity: { label: 'Decisions and productivity', prefix: 'semester.productivity.v1', scope: 'account', read: readProductivity },
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
  journal: {
    label: 'Activity trail',
    prefix: JOURNAL_PREFIX,
    scope: 'account',
    read: readEntries,
  },
  pathway: {
    label: 'Education pathway',
    prefix: 'semester.pathway.v1',
    scope: 'account',
    read: readPathway,
  },
  abroad: {
    label: 'Study abroad plan',
    prefix: ABROAD_PREFIX,
    scope: 'account',
    read: readAbroad,
  },
  quizfeedback: {
    label: 'Quiz questions you reported',
    prefix: QUIZ_FEEDBACK_PREFIX,
    scope: 'account',
    read: readQuizFeedback,
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
  // The device stores the feature expansion added (DECISION-LOG D-018, D-057).
  // Before these, Export left out a registration-day plan and graduation
  // scenarios, and everything after them.
  registration: { label: 'Registration cart and saved schedules', prefix: REGISTRATION_KEY, scope: 'device', read: readRegistration },
  registrationDay: { label: 'Registration day plan', prefix: REGISTRATION_DAY_KEY, scope: 'device', read: readRegistrationDay },
  graduation: { label: 'Graduation scenarios', prefix: GRADUATION_KEY, scope: 'device', read: readGraduation },
  lifeBalance: { label: 'Life balance settings', prefix: LIFE_BALANCE_KEY, scope: 'device', read: readLifeBalance },
  shortlist: { label: 'Course shortlist', prefix: SHORTLIST_KEY, scope: 'device', read: readShortlist },
  // Per account, and without private notes: the meeting screen promises
  // those never leave the device, and a restore keeps the ones it has.
  advisorMeeting: {
    label: 'Advisor meetings',
    prefix: MEETING_KEY,
    scope: 'account',
    read: (v) => withoutNotes(readMeetings(v)),
    restore: (incoming, existing) => keepNotes(readMeetings(incoming), existing),
  },
  sourceLocker: { label: 'Source Locker choices', prefix: LOCKER_KEY, scope: 'device', read: readLocker },
  studyReadiness: { label: 'Study readiness marks', prefix: READINESS_KEY, scope: 'device', read: readReadiness },
  careerEvidence: { label: 'Career evidence', prefix: EVIDENCE_PREFIX, scope: 'term', read: readEvidence },
  feedbackInbox: { label: 'Feedback you filed', prefix: FEEDBACK_PREFIX, scope: 'term', read: readInbox },
  learningMap: { label: 'Your learning map: concepts, questions and Start Here Check', prefix: MAP_PREFIX, scope: 'term', read: readMap },
  studyJournal: { label: 'Your study journal: mistakes, what you learned and when to revisit', prefix: STUDY_JOURNAL_PREFIX, scope: 'term', read: readJournal },
  learningPrefs: { label: 'Learning preferences', prefix: PREFS_PREFIX, scope: 'account', read: readPrefs },
  // Weekly Reset picks, without reflection answers: reflection is private by
  // default and the file is the thing people email themselves. A restore keeps
  // the answers this device has and never invents any.
  weeklyReset: {
    label: 'Weekly resets',
    prefix: RESET_KEY,
    scope: 'device',
    read: (v) => withoutReflections(readResets(v)),
    restore: (incoming, existing) => keepReflections(readResets(incoming), existing),
  },
  // The student's Guide settings, without what the assistant remembers.
  calm: {
    label: 'Guide settings',
    prefix: CALM_KEY,
    scope: 'device',
    read: (v) => withoutMemory(readCalm(v)),
    restore: (incoming, existing) => keepMemory(readCalm(incoming), existing),
  },
};

/** Every prefix this backup covers, for the guard in `workspace-backup.coverage.test.ts`. */
export const BACKED_UP_PREFIXES: readonly string[] = Object.values(DEFINITIONS).map((d) => d.prefix);

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
  if (definition.scope !== 'term' && term !== '') {
    throw new Error('A workspace in this backup carries a term it cannot have.');
  }
  if (definition.scope === 'device') return definition.prefix;
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
  const entries = checked.records.map((record) => {
    const key = keyFor(record.kind, record.term, account);
    const merge = DEFINITIONS[record.kind].restore;
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
