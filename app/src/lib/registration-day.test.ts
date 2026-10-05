import { describe, expect, it } from 'vitest';
import type { CatalogCourse } from './registration';
import {
  CHECKLIST,
  EMPTY_REGISTRATION_DAY,
  MAX_BACKUPS,
  addBackup,
  candidates,
  countdown,
  moveBackup,
  prune,
  readRegistrationDay,
  readiness,
  removeBackup,
  sectionList,
  toggleCheck,
  type RegistrationDayData,
} from './registration-day';

const course = (id: string, patch: Partial<CatalogCourse> = {}): CatalogCourse => ({
  id,
  code: 'CS 101',
  section: '01',
  title: 'Programming',
  term: 'Spring 2027',
  department: 'CS',
  credits: 3,
  instructor: '',
  location: '',
  description: '',
  prerequisites: '',
  seats: 10,
  meetings: [{ days: [1, 3], start: 540, end: 590 }],
  ...patch,
});

const cs1 = course('cs1');
const cs2 = course('cs2', { section: '02', meetings: [{ days: [2, 4], start: 540, end: 615 }] });
const cs3 = course('cs3', { section: '03', seats: 0, meetings: [{ days: [5], start: 600, end: 750 }] });
const cs4 = course('cs4', { section: '04', seats: null, meetings: [{ days: [5], start: 780, end: 930 }] });
const math = course('m1', { code: 'MATH 150', department: 'MATH', meetings: [{ days: [2, 4], start: 540, end: 615 }] });
const csOther = course('cs201', { code: 'CS 201', section: '01', meetings: [{ days: [5], start: 480, end: 530 }] });
const clash = course('clash', { code: 'CS 110', meetings: [{ days: [2], start: 560, end: 600 }] });
const otherTerm = course('fall', { term: 'Fall 2027', section: '09' });

const catalog = [cs1, cs2, cs3, cs4, math, csOther, clash, otherTerm];

describe('reading saved data', () => {
  it('accepts the empty plan', () => {
    expect(readRegistrationDay(EMPTY_REGISTRATION_DAY)).toEqual(EMPTY_REGISTRATION_DAY);
  });

  it('drops a section listed as its own backup and duplicate backups', () => {
    const got = readRegistrationDay({ ...EMPTY_REGISTRATION_DAY, backups: { cs1: ['cs1', 'cs2', 'cs2'] } });
    expect(got.backups.cs1).toEqual(['cs2']);
  });

  it('ignores checklist ids it does not know', () => {
    expect(readRegistrationDay({ ...EMPTY_REGISTRATION_DAY, checks: ['holds', 'nonsense', 'holds'] }).checks).toEqual(['holds']);
  });

  it('refuses a malformed time, too many backups, and a non-object', () => {
    expect(() => readRegistrationDay({ ...EMPTY_REGISTRATION_DAY, opensAt: 'tomorrow' })).toThrow();
    expect(() =>
      readRegistrationDay({ ...EMPTY_REGISTRATION_DAY, backups: { cs1: ['a', 'b', 'c', 'd', 'e', 'f'] } }),
    ).toThrow();
    expect(() => readRegistrationDay(null)).toThrow();
  });
});

describe('the countdown', () => {
  const now = new Date(2027, 3, 1, 9, 0);

  it('asks for a time when there is none', () => {
    expect(countdown(null, now).phase).toBe('unset');
  });

  it('is "later" beyond three days and "soon" inside them', () => {
    expect(countdown('2027-04-10T08:00', now).phase).toBe('later');
    const soon = countdown('2027-04-03T08:00', now);
    expect(soon.phase).toBe('soon');
    expect(soon.line).toBe('Opens in 1 day, 23 hours.');
  });

  it('counts minutes on the last hour, and says open once it is', () => {
    expect(countdown('2027-04-01T09:25', now).line).toBe('Opens in 25 minutes.');
    expect(countdown('2027-04-01T09:00', now).phase).toBe('open');
    expect(countdown('2027-04-01T08:00', now).phase).toBe('open');
  });
});

describe('choosing backups', () => {
  it('offers another section of the same course first, open before unknown before closed', () => {
    const got = candidates(cs1, catalog, [cs1], []).map((c) => c.id);
    expect(got.slice(0, 3)).toEqual(['cs2', 'cs4', 'cs3']);
  });

  it('never offers a section in another term, in the cart, or already chosen', () => {
    const got = candidates(cs1, catalog, [cs1, math], ['cs2']).map((c) => c.id);
    expect(got).not.toContain('fall');
    expect(got).not.toContain('m1');
    expect(got).not.toContain('cs2');
  });

  it('never offers a section that clashes with a course being kept', () => {
    // MATH 150 meets Tue/Thu 9:00–10:15; CS 110 meets Tue 9:20–10:00.
    const got = candidates(cs1, catalog, [cs1, math], []).map((c) => c.id);
    expect(got).not.toContain('clash');
    // …but it is fine as a backup when nothing it clashes with is kept.
    expect(candidates(cs1, catalog, [cs1], []).map((c) => c.id)).toContain('clash');
  });

  it('adds, orders and removes, and caps the list', () => {
    let d = addBackup(EMPTY_REGISTRATION_DAY, 'cs1', 'cs2');
    d = addBackup(d, 'cs1', 'cs3');
    d = addBackup(d, 'cs1', 'cs3');
    d = addBackup(d, 'cs1', 'cs1');
    expect(d.backups.cs1).toEqual(['cs2', 'cs3']);
    d = moveBackup(d, 'cs1', 'cs3', -1);
    expect(d.backups.cs1).toEqual(['cs3', 'cs2']);
    expect(moveBackup(d, 'cs1', 'cs3', -1)).toBe(d);
    d = removeBackup(d, 'cs1', 'cs3');
    d = removeBackup(d, 'cs1', 'cs2');
    expect(d.backups).toEqual({});

    let full = EMPTY_REGISTRATION_DAY;
    for (let i = 0; i < MAX_BACKUPS + 2; i++) full = addBackup(full, 'cs1', `x${i}`);
    expect(full.backups.cs1).toHaveLength(MAX_BACKUPS);
  });
});

describe('readiness', () => {
  it('is complete only with every check, a backup each, no conflict and a time', () => {
    let d: RegistrationDayData = { ...EMPTY_REGISTRATION_DAY, opensAt: '2027-04-03T08:00' };
    for (const c of CHECKLIST) d = toggleCheck(d, c.id);
    expect(readiness(d, [cs1], catalog).ready).toBe(false);
    d = addBackup(d, 'cs1', 'cs2');
    const r = readiness(d, [cs1], catalog);
    expect(r).toMatchObject({ ready: true, unbacked: [], conflicts: 0 });
    expect(r.done).toBe(r.total);
  });

  it('does not count a backup that is no longer in the catalog', () => {
    const d = addBackup(EMPTY_REGISTRATION_DAY, 'cs1', 'gone');
    expect(readiness(d, [cs1], catalog).unbacked.map((c) => c.id)).toEqual(['cs1']);
  });

  it('counts a conflict in the cart against readiness', () => {
    expect(readiness(EMPTY_REGISTRATION_DAY, [math, clash], catalog).conflicts).toBe(1);
  });
});

describe('the list and pruning', () => {
  it('lists each primary with its backups in order, and says it submitted nothing', () => {
    let d = addBackup(EMPTY_REGISTRATION_DAY, 'cs1', 'cs2');
    d = addBackup(d, 'cs1', 'cs4');
    const text = sectionList(d, [cs1, math], catalog);
    expect(text).toContain('nothing was submitted');
    expect(text).toContain('CS 101 01 · Programming — if full: CS 101 02 → CS 101 04');
    expect(text).toContain('MATH 150 01 · Programming — no backup chosen');
  });

  it('drops backups for sections that left the cart or the catalog, and is identity when nothing changed', () => {
    let d = addBackup(EMPTY_REGISTRATION_DAY, 'cs1', 'cs2');
    d = addBackup(d, 'cs1', 'gone');
    d = addBackup(d, 'm1', 'cs2');
    const pruned = prune(d, [cs1], catalog);
    expect(pruned.backups).toEqual({ cs1: ['cs2'] });
    expect(prune(pruned, [cs1], catalog)).toBe(pruned);
  });
});
