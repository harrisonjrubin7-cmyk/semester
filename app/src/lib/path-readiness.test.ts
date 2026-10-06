import { describe, expect, it } from 'vitest';
import { EMPTY_MEETINGS } from './advisor-meeting';
import { CHECKLIST, EMPTY_REGISTRATION_DAY } from './registration-day';
import { overallReadiness, pathReadiness, readinessCount, readinessFacts, type PathReadinessInput } from './path-readiness';
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
    expect(readinessCount(items)).toEqual({ ready: 0, total: 8 });
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
    expect(overallReadiness(withReady(6), facts)).toMatchObject({ state: 'almost_ready', why: expect.stringContaining('Two steps left') });
    expect(overallReadiness(withReady(7), facts)).toMatchObject({ state: 'almost_ready', why: expect.stringContaining('One step left') });
    expect(overallReadiness(withReady(8), facts)).toMatchObject({ state: 'ready' });
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
