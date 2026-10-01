import { describe, expect, it } from 'vitest';
import { EMPTY_MEETINGS } from './advisor-meeting';
import { EMPTY_REGISTRATION_DAY } from './registration-day';
import { pathReadiness, readinessCount } from './path-readiness';
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
