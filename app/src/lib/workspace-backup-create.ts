import { readProductivity } from './productivity';
import { ABROAD_PREFIX, readAbroad } from './abroad';
import { PREFIX as JOURNAL_PREFIX, readEntries } from './journal';
import { ACTIONS_PREFIX, readActionChoices } from './actions';
import { MEETING_KEY, readMeetings, withoutNotes } from './advisor-meeting';
import { EVIDENCE_PREFIX, readEvidence } from './career-evidence';
import { SHORTLIST_KEY, readShortlist } from './course-detail';
import { GRADUATION_KEY, readGraduation } from './graduation';
import { LIFE_BALANCE_KEY, readSettings as readLifeBalance } from './life-balance-storage';
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
import { textValue } from './device-library';
import { readFamily } from './family';
import { PATH_PROFILE_PREFIX, readPathProfile } from './path-profile';
import { readPathway } from './pathway';
import { readUniversityDrafts } from './university';
import { FEEDBACK_PREFIX, readInbox } from './feedbackloop';
import { MAP_PREFIX, readMap } from './learningmap';
import { PREFS_PREFIX, readPrefs } from './learningprefs';
import { STUDY_JOURNAL_PREFIX, readJournal } from './studyjournal';
import { RESET_KEY, readResets, withoutReflections } from './weekly-reset';
import { RHYTHM_KEY, readRhythm } from './daily-rhythm';
import { CALM_KEY, readCalm, withoutMemory } from './calm-controls';
import { readDataProjects } from './toolkit/data-storage';
import { readToolkit, TOOLKIT_DATA_PREFIX, TOOLKIT_PREFIX } from './toolkit/store';

/**
 * Synchronous workspace-backup creation and its canonical storage registry.
 *
 * Recovery imports this module directly so taking an offline recovery copy
 * does not also load the restore parser, transaction, and rollback UI path.
 */
export interface WorkspaceDefinition {
  label: string;
  prefix: string;
  /**
   * `device` is a store keyed by its name alone, shared by whoever uses this
   * browser — the registration workspace and the stores built on it. It
   * restores to the same key, and carries no term.
   */
  scope: 'account' | 'term' | 'device';
  read: (value: unknown) => unknown;
}

export const DEFINITIONS: Record<string, WorkspaceDefinition> = {
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
  },
  // The student's Guide settings, without what the assistant remembers.
  calm: {
    label: 'Guide settings',
    prefix: CALM_KEY,
    scope: 'device',
    read: (v) => withoutMemory(readCalm(v)),
  },
  toolkit: { label: 'Toolkit assignments, research and declarations', prefix: TOOLKIT_PREFIX, scope: 'account', read: readToolkit },
  toolkitData: { label: 'Toolkit data projects', prefix: TOOLKIT_DATA_PREFIX, scope: 'account', read: readDataProjects },
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

export function keyFor(kind: string, term: string, account: string): string {
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

