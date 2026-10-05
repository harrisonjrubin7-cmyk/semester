// @vitest-environment jsdom
/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMPTY_REGISTRATION_DAY } from './registration-day';
import { BACKED_UP_PREFIXES, restoreWorkspaces, workspaceBackup } from './workspace-backup';

/**
 * Every device store is backed up, or is named here with the reason it is not
 * (Phase N, DECISION-LOG D-018 and D-057).
 *
 * D-018 found Export missing two stores, and the phases after it added nine
 * more, each a `useDeviceLibrary` key of its own and in no backup at all. A
 * list maintained by hand is how that happened, so this reads the source:
 *
 * 1. Every file that calls `useDeviceLibrary` is listed with how many times.
 *    A new call anywhere fails here until somebody decides where it goes.
 * 2. Every store prefix is either in the backup or exempt with a sentence.
 * 3. Every `semester.*` prefix written in a file that calls it is one of those.
 */

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Files that call it, and how many times. Update this when you add one — and decide the store's backup below. */
const CALLS: Record<string, number> = {
  'components/ActionCenter.tsx': 1,
  'components/OperatingRhythmWorkspace.tsx': 2,
  'components/AdvisorMeeting.tsx': 2,
  'components/CampusDirectory.tsx': 4,
  'components/CalmSettings.tsx': 1,
  'components/CareerEvidence.tsx': 1,
  'components/CredentialWallet.tsx': 1,
  'components/ClarityQuestion.tsx': 1,
  'components/CourseCompare.tsx': 1,
  'components/CourseDetailV2.tsx': 2,
  'components/CourseSkills.tsx': 1,
  'components/CrunchWeekCard.tsx': 1,
  'components/FeedbackPanel.tsx': 1,
  'components/GraduationSimulator.tsx': 1,
  'components/LifeEvents.tsx': 1,
  'components/MomentPrompt.tsx': 1,
  'components/NilTaxNote.tsx': 1,
  'components/OfflineBanner.tsx': 1,
  'screens/Recovery.tsx': 1,
  'components/PathProfileForm.tsx': 1,
  'components/PathSnapshotCard.tsx': 1,
  'components/PushTop.tsx': 1,
  'components/QuizFeedback.tsx': 1,
  'components/RegistrationDay.tsx': 1,
  'components/RegistrationPortal.tsx': 1,
  'components/RegistrationReadiness.tsx': 1,
  'components/SemesterWrapped.tsx': 5,
  'components/FeedbackInbox.tsx': 1,
  'components/LearningMap.tsx': 1,
  'components/LearningPreferences.tsx': 1,
  'components/SaveAsEvidence.tsx': 1,
  'components/SharedWithYou.tsx': 1,
  'components/SharingList.tsx': 1,
  'components/SourceLocker.tsx': 1,
  'components/StudyAbroad.tsx': 1,
  'components/StudyJournal.tsx': 1,
  'components/StudyReadiness.tsx': 1,
  'components/StudyStudio.tsx': 1,
  'components/TodayActionCenter.tsx': 1,
  'components/TodayGuide.tsx': 2,
  'components/TrustCenter.tsx': 2,
  'components/WeeklyReflection.tsx': 1,
  'components/WeeklyReset.tsx': 1,
  'components/DailyRhythm.tsx': 1,
  'components/institutional/OperationsStudio.tsx': 1,
  'components/soft/SoftTopBody.tsx': 3,
  'components/toolkit/store.ts': 1,
  'composition/react.ts': 1,
  'lib/advisor-attachments.ts': 1,
  'lib/athletics.hook.ts': 1,
  'lib/life-balance.hook.ts': 1,
  'lib/registration-plan.ts': 2,
  'screens/Athletics.tsx': 1,
  'screens/Career.tsx': 2,
  'screens/Create.tsx': 1,
  'screens/Family.tsx': 1,
  'screens/Hub.tsx': 3,
  'screens/Launchpad.tsx': 1,
  'screens/Nil.tsx': 1,
  'screens/Opportunities.tsx': 1,
  'screens/Pathway.tsx': 1,
  'components/ProductivityWorkspace.tsx': 1,
  'components/QuickAdd.tsx': 1,
  'screens/Support.tsx': 1,
  'screens/University.tsx': 1,
};

const OTHER_MODULE = 'Added by another module and not yet in the backup. Its owner decides; this list is where that decision is waiting (D-057).';

/** Every store prefix: backed up, or exempt with the reason. */
const STORES: Record<string, 'backed up' | { exempt: string }> = {
  'semester.productivity.v1': 'backed up',
  'semester.creations.v1': 'backed up',
  'semester.athletics.v1': 'backed up',
  'semester.career.v1': 'backed up',
  'semester.university.drafts.v1': 'backed up',
  'semester.family.v1': 'backed up',
  'semester.journal.v1': 'backed up',
  'semester.pathway.v1': 'backed up',
  'semester.actions.v1': 'backed up',
  'semester.registration.v1': 'backed up',
  'semester.registration-day.v1': 'backed up',
  'semester.graduation.v1': 'backed up',
  'semester.life-balance.v1': 'backed up',
  'semester.course-shortlist.v1': 'backed up',
  'semester.advisor-meeting.v1': 'backed up',
  'semester.source-locker.v1': 'backed up',
  'semester.study-readiness.v1': 'backed up',
  'semester.career-evidence.v1': 'backed up',
  'semester.path-profile.v1': 'backed up',
  'semester.quizfeedback.v1': 'backed up',
  'semester.abroad.v1': 'backed up',
  'semester.clarity.v1': 'backed up',
  'semester.feedback-inbox.v1': 'backed up',
  'semester.learning-map.v1': 'backed up',
  'semester.learning-prefs.v1': 'backed up',
  'semester.study-journal.v1': 'backed up',
  'semester.life-events.v1': { exempt: 'Which change of circumstances the student chose and the day (lib/lifeevents.ts). Deliberately not in a backup: it is a sensitive choice made without giving a reason, it lapses on its own after four weeks, and a downloaded file would outlive it and travel. Choosing again is one tap.' },
  'semester.moment-feedback.v1': { exempt: 'Optional answers to one-question prompts and the on/off choice (lib/momentfeedback.ts). Not the student’s work and not sent anywhere; a restored copy would carry old answers onto another device as if they were fresh. The panel on What’s new can delete them.' },
  'semester.familyseen.v1': { exempt: 'Which supporter shares this browser has already shown, so an ended one can say "This share has ended" (D-038). The server holds the shares; this is only a display marker, and wrong on any other device.' },
  'semester.offline-ledger.v1': { exempt: 'Sync bookkeeping (Phase M): when this account last took this device’s copy. Not the student’s work, and wrong on any other device.' },
  'semester.operations.v1': { exempt: 'Staff-side Operations studio drafts, not a student’s record. ' + OTHER_MODULE },
  'semester.directory': { exempt: 'A campus directory imported from the school, which can be imported again. ' + OTHER_MODULE },
  'semester.housing-plan': { exempt: OTHER_MODULE },
  'semester.meal-plan': { exempt: OTHER_MODULE },
  'semester.support.v1': { exempt: OTHER_MODULE },
  'semester.nil.v1': { exempt: OTHER_MODULE },
  'semester.toolkit.v1': { exempt: OTHER_MODULE },
  'semester.toolkit-data.v1': { exempt: OTHER_MODULE },
  'semester.hub.v1': { exempt: OTHER_MODULE },
  'semester.launchpad.v1': { exempt: OTHER_MODULE },
  'semester.opportunities.v1': { exempt: OTHER_MODULE },
  'semester.guide-choices.v1': { exempt: 'Which Guide suggestions the student snoozed, passed on or hid, and until when (lib/guide-bar.ts). A display marker that expires on its own; a restored copy would only hide a suggestion that had already come back.' },
  'semester.weekly-reset.v1': 'backed up',
  'semester.daily-rhythm.v1': 'backed up',
  'semester.calm.v1': 'backed up',
  'semester.operating-rhythm.v1': { exempt: 'Explicit private JSON backup and validated preview/confirm restore in OperatingRhythm. Daily and weekly backups are separate. Private notes and reflections intentionally require this dedicated export rather than entering the general workspace backup.' },
};

describe('every device store is backed up or named', () => {
  const files = sources(SRC)
    .map((path) => ({ path: relative(SRC, path).replace(/\\/g, '/'), text: readFileSync(path, 'utf8') }))
    .filter((f) => f.path !== 'lib/device-library.ts');
  const calling = files
    .map((f) => ({ ...f, calls: (f.text.match(/useDeviceLibrary\(/g) ?? []).length }))
    .filter((f) => f.calls > 0);

  it('finds the calls at all (the control)', () => {
    expect(calling.length).toBeGreaterThan(20);
    expect(calling.find((f) => f.path === 'screens/Career.tsx')?.calls).toBe(2);
  });

  it('knows every file that calls useDeviceLibrary, and how often', () => {
    const found = Object.fromEntries(calling.map((f) => [f.path, f.calls]));
    expect(found, 'a device store was added or removed: back it up in workspace-backup.ts or add it to STORES with a reason, then update CALLS').toEqual(CALLS);
  });

  it('backs up every store it says it does, and none it exempts', () => {
    for (const [prefix, verdict] of Object.entries(STORES)) {
      if (verdict === 'backed up') expect(BACKED_UP_PREFIXES, prefix).toContain(prefix);
      else expect(BACKED_UP_PREFIXES, prefix).not.toContain(prefix);
    }
    for (const prefix of BACKED_UP_PREFIXES) expect(STORES[prefix], prefix).toBe('backed up');
  });

  it('names every store prefix written in a file that uses one', () => {
    const named = new Set(Object.keys(STORES));
    const stray = new Set<string>();
    for (const f of calling) {
      for (const m of f.text.matchAll(/['"`](semester\.[a-z][a-z0-9-]*(?:\.v\d+|\.drafts\.v\d+)?)[:'"`.$]/g)) {
        const prefix = m[1];
        if (prefix === 'semester.v1' || prefix === 'semester.auth') continue;
        if (!named.has(prefix) && ![...named].some((n) => prefix.startsWith(`${n}.`))) stray.add(`${prefix} (${f.path})`);
      }
    }
    expect([...stray], 'store prefixes nobody has decided about').toEqual([]);
  });
});

describe('the stores this phase added to the backup', () => {
  it('go out and come back', () => {
    const store = new Map<string, string>();
    const storage = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    } as Storage;
    storage.setItem('semester.registration-day.v1', JSON.stringify({ ...EMPTY_REGISTRATION_DAY, creditTarget: 15 }));
    storage.setItem('semester.advisor-meeting.v1:acct', JSON.stringify({ version: 1, meetings: [] }));
    storage.setItem('semester.career-evidence.v1:acct:2026FA', JSON.stringify({ version: 1, decisions: {}, own: [], artifacts: [], bullets: [], versions: [], interviewDone: {}, fairs: {} }));
    const backup = workspaceBackup('acct', storage);
    expect(backup.records.map((r) => r.kind).sort()).toEqual(['advisorMeeting', 'careerEvidence', 'registrationDay']);
    store.clear();
    restoreWorkspaces(backup, 'acct', storage);
    expect(JSON.parse(storage.getItem('semester.registration-day.v1')!).creditTarget).toBe(15);
    expect(storage.getItem('semester.career-evidence.v1:acct:2026FA')).not.toBeNull();
  });
});

describe('advisor meetings in a backup', () => {
  const meeting = (notes: string) => ({
    id: 'm1', title: 'Spring', date: null, agenda: [{ id: 'a1', text: 'Spring courses' }], questions: [],
    attach: { scenario: null, courses: [], followUps: false }, followUps: [], notes, created: 1,
  });
  const memory = () => {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    } as Storage;
  };

  it('leave private notes out, as the meeting screen promises', () => {
    const storage = memory();
    storage.setItem('semester.advisor-meeting.v1:acct', JSON.stringify({ version: 1, meetings: [meeting('I am worried about money')] }));
    const backup = workspaceBackup('acct', storage);
    const text = JSON.stringify(backup);
    expect(text).toContain('Spring courses');
    expect(text).not.toContain('worried');
  });

  it('take only this account’s meetings (the control: another account’s are not in it)', () => {
    const storage = memory();
    storage.setItem('semester.advisor-meeting.v1:other', JSON.stringify({ version: 1, meetings: [meeting('')] }));
    expect(workspaceBackup('acct', storage).records).toEqual([]);
  });

  it('restore without erasing the notes this device already has', () => {
    const storage = memory();
    storage.setItem('semester.advisor-meeting.v1:acct', JSON.stringify({ version: 1, meetings: [meeting('Kept here')] }));
    const backup = workspaceBackup('acct', storage);
    restoreWorkspaces(backup, 'acct', storage);
    expect(JSON.parse(storage.getItem('semester.advisor-meeting.v1:acct')!).meetings[0].notes).toBe('Kept here');
  });
});
