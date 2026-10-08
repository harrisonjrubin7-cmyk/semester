import { describe, expect, it } from 'vitest';
import { EMPTY_MEETINGS, namedAgendaText, type Meeting } from './advisor-meeting';
import { CHECKLIST, EMPTY_REGISTRATION_DAY } from './registration-day';
import { namedCoursesFrom, overallReadiness, pathReadiness, readinessCount, readinessFacts, type PathReadinessInput } from './path-readiness';
import type { CatalogCourse } from './registration';

const course = (id: string, start: number, end: number): CatalogCourse => ({
  id, code: id.toUpperCase(), section: '01', title: id, term: 'Fall 2026', department: 'TEST', credits: 3,
  instructor: '', location: '', description: '', prerequisites: '', seats: null, meetings: [{ days: [1], start, end }],
});

describe('path registration readiness', () => {
  it('starts honestly empty and never treats missing official checks as ready', () => {
    const items = pathReadiness({
      pathConfigured: false, requirementTotal: 0, cart: [], catalog: [],
      registration: EMPTY_REGISTRATION_DAY, meetings: EMPTY_MEETINGS, institution: null,
    });
    expect(readinessCount(items)).toEqual({ ready: 0, total: 9 });
    expect(items.find((item) => item.id === 'named')?.state).toBe('not_started');
    expect(items.find((item) => item.id === 'official_checks')?.detail).toContain('official system');
  });

  it('separates schedule conflicts, missing backups and advisor preparation', () => {
    const a = course('a', 540, 600);
    const b = course('b', 570, 630);
    const items = pathReadiness({
      pathConfigured: true,
      requirementTotal: 4,
      cart: [a, b],
      catalog: [a, b],
      registration: { ...EMPTY_REGISTRATION_DAY, opensAt: '2026-10-02T09:00', checks: ['holds'] },
      meetings: { version: 1, meetings: [{ id: 'm', title: 'Plan', date: null, agenda: [{ id: 'a', text: 'Review plan' }], questions: [], attach: { scenario: null, courses: [], followUps: false }, followUps: [], notes: '', created: 1 }] },
      institution: 'Northstar University',
    });
    expect(items.find((item) => item.id === 'schedule')?.state).toBe('attention');
    expect(items.find((item) => item.id === 'backups')?.state).toBe('attention');
    expect(items.find((item) => item.id === 'advisor')?.state).toBe('ready');
    expect(items.find((item) => item.id === 'courses')?.detail).toContain('Northstar University');
  });

  it('keeps a course the student named short of ready, and does not call it an enrollment', () => {
    const items = pathReadiness({
      pathConfigured: false,
      requirementTotal: 0,
      namedCourses: [{ code: 'ECON 1020', term: 'Fall 2026' }],
      cart: [],
      catalog: [],
      registration: EMPTY_REGISTRATION_DAY,
      meetings: EMPTY_MEETINGS,
      institution: null,
    });
    const named = items.find((item) => item.id === 'named');
    expect(named?.state).toBe('attention');
    expect(named?.destination).toBe('yes');
    expect(named?.detail).toMatch(/ECON 1020/);
    expect(named?.detail).toMatch(/not an enrollment/i);
    expect(named?.detail).not.toMatch(/\benrolled\b|\bregistered\b/i);
    expect(items.find((item) => item.id === 'courses')?.state).toBe('not_started');
  });

  it('still does not mark named courses ready when a cart section exists', () => {
    const section = course('econ', 540, 600);
    const items = pathReadiness({
      pathConfigured: false,
      requirementTotal: 0,
      namedCourses: [{ code: 'ECON 1020', term: 'Fall 2026' }],
      cart: [{ ...section, code: 'ECON 1020' }],
      catalog: [section],
      registration: EMPTY_REGISTRATION_DAY,
      meetings: EMPTY_MEETINGS,
      institution: null,
    });
    expect(items.find((item) => item.id === 'named')).toMatchObject({ state: 'attention' });
    expect(items.find((item) => item.id === 'courses')?.state).toBe('ready');
  });

  const meetingWith = (text: string, notes = ''): Meeting => ({
    id: 'm', title: 'Courses I am considering', date: null,
    agenda: [{ id: 'a', text }], questions: [],
    attach: { scenario: null, courses: [], followUps: false },
    followUps: [], notes, created: 1,
  });

  it('marks a named course ready only once that code is on the student agenda', () => {
    const line = namedAgendaText({ code: 'ECON 1020', term: 'Fall 2026' });
    const items = pathReadiness({
      pathConfigured: false,
      requirementTotal: 0,
      namedCourses: [{ code: 'ECON 1020', term: 'Fall 2026' }],
      cart: [],
      catalog: [],
      registration: EMPTY_REGISTRATION_DAY,
      meetings: { version: 1, meetings: [meetingWith(line, 'SECRET-GRADE-99')] },
      institution: null,
    });
    const named = items.find((item) => item.id === 'named');
    expect(named?.state).toBe('ready');
    expect(named?.detail).toMatch(/ECON 1020/);
    expect(named?.detail).toMatch(/not an enrollment/i);
    expect(named?.detail).toMatch(/nothing was shared/i);
    expect(named?.detail).not.toMatch(/SECRET-GRADE-99/);
    expect(named?.detail).not.toMatch(/\benrolled\b|\bregistered\b/i);
  });

  it('stays at attention when only some named codes are on the agenda', () => {
    const items = pathReadiness({
      pathConfigured: false,
      requirementTotal: 0,
      namedCourses: [
        { code: 'ECON 1020', term: 'Fall 2026' },
        { code: 'PSCI 1104', term: 'Fall 2026' },
      ],
      cart: [],
      catalog: [],
      registration: EMPTY_REGISTRATION_DAY,
      meetings: { version: 1, meetings: [meetingWith(namedAgendaText({ code: 'ECON 1020', term: 'Fall 2026' }))] },
      institution: null,
    });
    expect(items.find((item) => item.id === 'named')).toMatchObject({ state: 'attention' });
  });

  it('counts a hand-added course and leaves a syllabus course off the named row', () => {
    expect(namedCoursesFrom([
      { course: { code: 'ECON 1020', source: 'Added by hand', term: 'Fall 2026' } },
      { course: { code: 'PSCI 1104', source: 'Syllabus', term: 'Fall 2026' } },
    ])).toEqual([{ code: 'ECON 1020', term: 'Fall 2026' }]);
  });
});

describe('overall readiness', () => {
  const a = course('a', 540, 600);
  const b = course('b', 570, 630);
  const c = course('c', 700, 760);
  const base = (over: Partial<PathReadinessInput>): PathReadinessInput => ({
    pathConfigured: false, requirementTotal: 0, cart: [], catalog: [],
    registration: EMPTY_REGISTRATION_DAY, meetings: EMPTY_MEETINGS, institution: null, ...over,
  });
  const overall = (over: Partial<PathReadinessInput>) => {
    const input = base(over);
    return overallReadiness(pathReadiness(input), readinessFacts(input));
  };

  it('says information is unavailable, not "not started", when there is no catalog to check against', () => {
    expect(overall({}).state).toBe('unavailable');
    expect(overall({}).why).toContain('cannot be checked');
  });

  it('is blocked only by a conflict the app computed, and says which', () => {
    const o = overall({ pathConfigured: true, requirementTotal: 4, cart: [a, b], catalog: [a, b, c] });
    expect(o.state).toBe('blocked');
    expect(o.why).toContain('1 conflict');
  });

  it('never invents a block from what lives in the official system', () => {
    // Every check unconfirmed is "not started", not "blocked": holds are not known here.
    const o = overall({ pathConfigured: true, requirementTotal: 4, cart: [a, c], catalog: [a, b, c] });
    expect(o.state).not.toBe('blocked');
  });

  it('counts steps: getting ready, then almost ready, then ready', () => {
    const items = pathReadiness(base({ catalog: [a, b, c] }));
    const facts = { catalogSize: 3, conflicts: 0, unchecked: 0 };
    const withReady = (n: number) => items.map((item, i) => ({ ...item, state: i < n ? ('ready' as const) : ('not_started' as const) }));
    expect(overallReadiness(withReady(2), facts)).toMatchObject({ state: 'getting_ready' });
    expect(overallReadiness(withReady(7), facts)).toMatchObject({ state: 'almost_ready', why: expect.stringContaining('Two steps left') });
    expect(overallReadiness(withReady(8), facts)).toMatchObject({ state: 'almost_ready', why: expect.stringContaining('One step left') });
    expect(overallReadiness(withReady(9), facts)).toMatchObject({ state: 'ready' });
  });

  it('does not hold the headline short of Ready when no course has been named', () => {
    const done = {
      pathConfigured: true,
      requirementTotal: 4,
      cart: [a],
      catalog: [a, c],
      registration: { ...EMPTY_REGISTRATION_DAY, opensAt: '2026-10-02T09:00', checks: CHECKLIST.map((item) => item.id), backups: { [a.id]: [c.id] } },
      meetings: { version: 1 as const, meetings: [{ id: 'm', title: 'Plan', date: null, agenda: [{ id: 'x', text: 'Review plan' }], questions: [], attach: { scenario: null, courses: [], followUps: false }, followUps: [], notes: '', created: 1 }] },
      institution: 'Northstar University',
    };
    expect(pathReadiness(base(done)).find((item) => item.id === 'named')?.state).toBe('not_started');
    expect(overall(done).state).toBe('ready');
    const named = { code: 'ECON 1020', term: 'Fall 2026' };
    expect(overall({ ...done, namedCourses: [named] }).state).not.toBe('ready');
    const onAgenda = {
      ...done,
      namedCourses: [named],
      meetings: { version: 1 as const, meetings: [{ ...done.meetings.meetings[0], agenda: [{ id: 'x', text: 'Review plan' }, { id: 'n', text: namedAgendaText(named) }] }] },
    };
    expect(pathReadiness(base(onAgenda)).find((item) => item.id === 'named')?.state).toBe('ready');
    expect(overall(onAgenda).state).toBe('ready');
  });

  it('ready still says the official system decides', () => {
    const items = pathReadiness(base({ catalog: [a] })).map((item) => ({ ...item, state: 'ready' as const }));
    expect(overallReadiness(items, { catalogSize: 1, conflicts: 0, unchecked: 0 }).why).toContain('official system still decide');
  });

  it('is unavailable, not ready, when a selected section has no meeting times to check', () => {
    const noTimes: CatalogCourse = { ...course('d', 0, 0), meetings: [] };
    const everyOtherStepDone = {
      pathConfigured: true,
      requirementTotal: 4,
      cart: [a, noTimes],
      catalog: [a, noTimes, c],
      registration: { ...EMPTY_REGISTRATION_DAY, opensAt: '2026-10-02T09:00', checks: CHECKLIST.map((item) => item.id), backups: { [a.id]: [c.id], [noTimes.id]: [c.id] } },
      meetings: { version: 1 as const, meetings: [{ id: 'm', title: 'Plan', date: null, agenda: [{ id: 'x', text: 'Review plan' }], questions: [], attach: { scenario: null, courses: [], followUps: false }, followUps: [], notes: '', created: 1 }] },
      institution: 'Northstar University',
    };
    const o = overall(everyOtherStepDone);
    expect(o.state).toBe('unavailable');
    expect(o.why).toContain('no meeting times');
    // The step itself says so too, instead of "No conflicts found".
    const step = pathReadiness(base(everyOtherStepDone)).find((item) => item.id === 'schedule')!;
    expect(step.state).toBe('attention');
    expect(step.detail).toContain('cannot be checked');
  });

  it('a real conflict still blocks even when another section has no times', () => {
    const noTimes: CatalogCourse = { ...course('d', 0, 0), meetings: [] };
    expect(overall({ cart: [a, b, noTimes], catalog: [a, b, noTimes] }).state).toBe('blocked');
  });
});
