// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { NotifKey } from '../data/misc';
import { landingFor } from './land';
import { dueReminders } from './notify';
import { parseCatalog, type CatalogCourse } from './registration';
import {
  EMPTY_REGISTRATION_DAY,
  REGISTRATION_DAY_KEY,
  addBackup,
  clockDigits,
  courseReferences,
  derivedChecks,
  modeActive,
  readRegistrationDay,
  safePortalUrl,
  storedWindow,
  summaryLines,
  windowReminders,
  type RegistrationDayData,
} from './registration-day';

/**
 * Registration Day Mode (`registration_day_mode`, Phase C): what #762's
 * registration day gained — the mode's activation, the brief's three summary
 * lines, the checks Semester can see for itself, course references, the
 * official link's safety, and the two reminders.
 */

const course = (id: string, patch: Partial<CatalogCourse> = {}): CatalogCourse => ({
  id,
  code: 'PSY 220',
  section: '01',
  title: 'Research Methods',
  term: 'Spring 2027',
  department: 'PSY',
  credits: 3,
  instructor: '',
  location: '',
  description: '',
  prerequisites: '',
  seats: 10,
  meetings: [{ days: [1, 3], start: 540, end: 590 }],
  ...patch,
});
const psy = course('psy');
const stat = course('stat', { code: 'STAT 101', department: 'STAT', credits: 4, meetings: [{ days: [2, 4], start: 540, end: 615 }] });
const eng = course('eng', { code: 'ENG 201', department: 'ENG', meetings: [{ days: [5], start: 600, end: 750 }] });
const econ = course('econ', { code: 'ECON 120', department: 'ECON', meetings: [{ days: [2, 4], start: 780, end: 850 }] });
const clash = course('clash', { code: 'PHIL 115', department: 'PHIL', meetings: [{ days: [1], start: 560, end: 620 }] });
const catalog = [psy, stat, eng, econ, clash];

const data = (patch: Partial<RegistrationDayData> = {}): RegistrationDayData => ({ ...EMPTY_REGISTRATION_DAY, ...patch });

afterEach(() => localStorage.clear());

describe('reading a plan saved before the mode existed', () => {
  it('fills the new fields with their defaults, and keeps what was there', () => {
    const old = { opensAt: '2027-04-03T08:00', source: 'student_entered', backups: { psy: ['econ'] }, checks: ['holds'] };
    expect(readRegistrationDay(old)).toEqual({
      ...old, creditTarget: null, minCredits: null, maxCredits: null, studyHours: null, portalUrl: null, remind: true, manual: false, handoff: null,
    });
  });

  it('refuses a credit target it cannot believe, and an address that is not https', () => {
    expect(readRegistrationDay(data({ creditTarget: 0 })).creditTarget).toBeNull();
    expect(readRegistrationDay(data({ creditTarget: 99 })).creditTarget).toBeNull();
    expect(readRegistrationDay({ ...data(), portalUrl: 'javascript:alert(1)' }).portalUrl).toBeNull();
    expect(readRegistrationDay({ ...data(), portalUrl: 'http://reg.example.edu' }).portalUrl).toBeNull();
    expect(readRegistrationDay({ ...data(), portalUrl: 'https://reg.example.edu/start' }).portalUrl).toBe('https://reg.example.edu/start');
  });

  it('only ever keeps https addresses', () => {
    for (const bad of ['', 'reg.example.edu', 'ftp://x.edu', 'data:text/html,hi', 'javascript:0', 'https://']) {
      expect(safePortalUrl(bad), bad).toBeNull();
    }
    expect(safePortalUrl('  https://yes.vanderbilt.edu  ')).toBe('https://yes.vanderbilt.edu/');
  });
});

describe('when the mode shows', () => {
  const now = new Date(2027, 3, 1, 12, 0);
  it('shows within 72 hours of the window, and for a day after it opens', () => {
    expect(modeActive(data({ opensAt: '2027-04-04T11:00' }), now)).toBe(true);
    expect(modeActive(data({ opensAt: '2027-04-04T12:01' }), now)).toBe(false);
    expect(modeActive(data({ opensAt: '2027-03-31T13:00' }), now)).toBe(true);
    expect(modeActive(data({ opensAt: '2027-03-31T11:00' }), now)).toBe(false);
  });

  it('shows when the student turns it on, even with no time entered', () => {
    expect(modeActive(data(), now)).toBe(false);
    expect(modeActive(data({ manual: true }), now)).toBe(true);
  });

  it('ticks as a clock only in the last day', () => {
    const at = new Date(2027, 3, 1, 10, 17, 42);
    expect(clockDigits('2027-04-01T12:00', at)).toBe('01:42:18');
    expect(clockDigits('2027-04-03T12:00', at)).toBeNull();
    expect(clockDigits('2027-04-01T10:00', at)).toBeNull();
    expect(clockDigits(null, at)).toBeNull();
  });
});

describe('the summary lines', () => {
  it('reads like the brief when one backup is missing', () => {
    const plan = addBackup(data(), 'psy', 'econ');
    const lines = summaryLines(plan, [psy, stat, eng], catalog);
    expect(lines).toEqual([
      { ok: true, text: '10 credits selected' },
      { ok: true, text: 'No schedule conflicts' },
      { ok: false, text: '2 backup options needed' },
    ]);
  });

  it('checks credits only against a target the student set', () => {
    expect(summaryLines(data({ creditTarget: 10 }), [psy, stat, eng], catalog)[0]).toEqual({ ok: true, text: '10 credits selected, your target' });
    expect(summaryLines(data({ creditTarget: 15 }), [psy, stat, eng], catalog)[0]).toEqual({
      ok: false, text: '10 credits selected, 5 under your 15-credit target',
    });
    expect(summaryLines(data({ creditTarget: 6 }), [psy, stat, eng], catalog)[0].text).toContain('4 over');
  });

  it('counts a conflict', () => {
    expect(summaryLines(data(), [psy, clash], catalog)[1]).toEqual({ ok: false, text: '1 schedule conflict to resolve' });
  });

  it('works the checks out rather than letting them be ticked', () => {
    const plan = addBackup(addBackup(data({ creditTarget: 7 }), 'psy', 'econ'), 'stat', 'eng');
    expect(derivedChecks(plan, [psy, stat], catalog).map((c) => c.ok)).toEqual([true, true, true]);
    expect(derivedChecks(data(), [psy, clash], catalog).map((c) => c.ok)).toEqual([false, false, false]);
  });
});

describe('course references', () => {
  it('lists code, section and the reference number where the catalog has one', () => {
    expect(courseReferences([course('a', { crn: '40123' }), stat])).toBe(
      'PSY 220 01 · CRN 40123\nSTAT 101 01 · reference number not in your catalog',
    );
  });

  it('reads a CRN column from an imported catalog, and leaves it out when there is none', () => {
    const csv = 'code,section,title,term,credits,crn\nPSY 220,01,Methods,Spring 2027,3,40123\nSTAT 101,01,Stats,Spring 2027,4,';
    const [a, b] = parseCatalog(csv).courses;
    expect(a.crn).toBe('40123');
    expect(b.crn).toBeUndefined();
  });
});

describe('the two reminders', () => {
  const OPENS = new Date(2027, 3, 2, 8, 0).getTime();
  const ALL = { class: true, today: true, two: true, start: true, free: true, sun: true, exam: true, term: true, attend: true, bill: true } satisfies Record<NotifKey, boolean>;

  it('says the day before, from 8 a.m., and in the hour before', () => {
    expect(windowReminders(OPENS, new Date(2027, 3, 1, 7, 59))).toEqual([]);
    expect(windowReminders(OPENS, new Date(2027, 3, 1, 8, 0)).map((r) => r.id)).toEqual([`regday:${OPENS}:day`]);
    expect(windowReminders(OPENS, new Date(2027, 3, 2, 7, 15)).map((r) => r.id)).toEqual([`regday:${OPENS}:hour`]);
    expect(windowReminders(OPENS, new Date(2027, 3, 2, 8, 1))).toEqual([]);
    expect(windowReminders(null, new Date(2027, 3, 1, 9, 0))).toEqual([]);
  });

  it('never says Semester registers anybody', () => {
    for (const at of [new Date(2027, 3, 1, 9, 0), new Date(2027, 3, 2, 7, 30)]) {
      for (const r of windowReminders(OPENS, at)) expect(`${r.title} ${r.body}`).not.toMatch(/\byou are registered|we registered|registered you\b/i);
    }
  });

  it('fires through the registrar-deadline rule, and is silenced by its toggle and by quiet hours', () => {
    const src = { items: [], classes: [], registrationOpens: OPENS };
    const hourBefore = new Date(2027, 3, 2, 7, 30);
    expect(dueReminders(hourBefore, ALL, src).map((r) => r.rule)).toContain('term');
    expect(dueReminders(hourBefore, { ...ALL, term: false }, src).some((r) => r.id.startsWith('regday:'))).toBe(false);
    expect(dueReminders(hourBefore, ALL, { ...src, quiet: { from: 22 * 60, to: 8 * 60 } }).some((r) => r.id.startsWith('regday:'))).toBe(false);
  });

  it('opens the registration workspace when tapped', () => {
    expect(landingFor(`regday:${OPENS}:hour`)).toEqual({ screen: 'yes' });
  });

  it('reads the window from this device, and not when reminders are off', () => {
    localStorage.setItem(REGISTRATION_DAY_KEY, JSON.stringify(data({ opensAt: '2027-04-02T08:00' })));
    expect(storedWindow()).toBe(OPENS);
    localStorage.setItem(REGISTRATION_DAY_KEY, JSON.stringify(data({ opensAt: '2027-04-02T08:00', remind: false })));
    expect(storedWindow()).toBeNull();
    localStorage.setItem(REGISTRATION_DAY_KEY, '{not json');
    expect(storedWindow()).toBeNull();
  });

  it('is passed by all three places that build the notifier source', () => {
    // The in-page tick and both push fillers. The notes in PushSwitch record
    // a field that reached one caller and not the others; this is that check.
    for (const file of ['src/state/reminders.ts', 'src/components/PushTop.tsx', 'src/components/PushSwitch.tsx']) {
      expect(readFileSync(file, 'utf8'), file).toContain('registrationOpens: storedWindow()');
    }
    // The tick's source is built in reminders.ts; the provider must still go through it.
    expect(readFileSync('src/state/store.tsx', 'utf8')).toContain('remindersFor(state');
  });
});
