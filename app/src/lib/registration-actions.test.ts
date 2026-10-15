import { describe, expect, it } from 'vitest';
import { rank } from './actions';
import type { CatalogCourse } from './registration';
import { CHECKLIST, EMPTY_REGISTRATION_DAY, addBackup, type RegistrationDayData } from './registration-day';
import { READINESS_GROUP, registrationActions } from './registration-actions';
import { fromHash } from './route';
import { isCalm } from './today-center';

const course = (id: string, patch: Partial<CatalogCourse> = {}): CatalogCourse => ({
  id, code: 'PSY 220', section: '01', title: 'Methods', term: 'Spring 2027', department: 'PSY', credits: 3,
  instructor: '', location: '', description: '', prerequisites: '', seats: 10,
  meetings: [{ days: [1, 3], start: 540, end: 590 }], ...patch,
});
const psy = course('psy');
const stat = course('stat', { code: 'STAT 101', department: 'STAT', meetings: [{ days: [2, 4], start: 540, end: 615 }] });
const econ = course('econ', { code: 'ECON 120', department: 'ECON', meetings: [{ days: [2, 4], start: 780, end: 850 }] });
const clash = course('clash', { code: 'PHIL 115', department: 'PHIL', meetings: [{ days: [1], start: 560, end: 620 }] });
const catalog = [psy, stat, econ, clash];

const NOW = new Date(2027, 3, 1, 12, 0);
const plan = (patch: Partial<RegistrationDayData> = {}): RegistrationDayData => ({
  ...EMPTY_REGISTRATION_DAY, opensAt: '2027-04-04T08:00', ...patch,
});
const ids = (d: RegistrationDayData, cart: CatalogCourse[]) => registrationActions(d, cart, catalog, NOW).map((a) => a.id);

describe('registration readiness as actions', () => {
  it('proposes nothing outside Registration Day Mode', () => {
    expect(registrationActions(plan({ opensAt: '2027-05-01T08:00' }), [psy], catalog, NOW)).toEqual([]);
    expect(registrationActions({ ...EMPTY_REGISTRATION_DAY }, [psy], catalog, NOW)).toEqual([]);
  });

  it('asks for the time first when the mode was turned on without one', () => {
    expect(ids(plan({ opensAt: null, manual: true }), [])).toEqual(['regday:time', 'regday:cart']);
  });

  it('proposes a backup per unbacked section, a conflict, and each unticked checklist item', () => {
    const d = addBackup(plan({ checks: ['holds', 'copied'] }), 'psy', 'econ');
    expect(ids(d, [psy, stat, clash])).toEqual([
      'regday:backup:stat',
      'regday:backup:clash',
      'regday:conflicts',
      ...CHECKLIST.filter((c) => !['holds', 'copied'].includes(c.id)).map((c) => `regday:check:${c.id}`),
    ]);
  });

  it('proposes nothing once everything is done', () => {
    const d = addBackup(plan({ checks: CHECKLIST.map((c) => c.id) }), 'psy', 'econ');
    expect(ids(d, [psy])).toEqual([]);
  });

  it('becomes critical in the last three days, and ranks above an ordinary deadline then', () => {
    // The mode now shows from 72 hours out on its own, so a window further away
    // is only reachable when the student turned the mode on early.
    const later = registrationActions(plan({ opensAt: '2027-04-06T08:00', manual: true }), [stat], catalog, NOW).find((a) => a.id === 'regday:backup:stat')!;
    expect(later.priority).toBe('high');
    const soon = registrationActions(plan({ opensAt: '2027-04-03T08:00' }), [stat], catalog, NOW).find((a) => a.id === 'regday:backup:stat')!;
    expect(soon.priority).toBe('critical');
    const deadline = { ...soon, id: 'deadline:x', priority: 'normal' as const, dueAt: soon.dueAt };
    expect(rank([deadline, soon], {}, NOW.getTime()).mostImportant?.action.id).toBe('regday:backup:stat');
  });

  it('groups every action, opens the registration workspace, and speaks calmly', () => {
    const all = registrationActions(plan({ manual: true }), [psy, stat, clash], catalog, NOW);
    expect(all.length).toBeGreaterThan(3);
    for (const a of all) {
      expect(a.group).toBe(READINESS_GROUP);
      expect(fromHash(a.primary.target)?.screen).toBe('yes');
      expect(a.primary.kind).toBe('navigate');
      const e = a.explanation;
      expect(isCalm([a.title, a.whyItMatters, e.trigger, ...e.limitations].join(' '))).toBe(true);
      expect(e.limitations.join(' ')).toMatch(/Nothing here registers you/);
    }
  });
});
