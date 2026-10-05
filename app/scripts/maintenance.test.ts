import { describe, expect, it } from 'vitest';
import { scheduleMaintenance } from './maintenance';
import { incidentFeed, incidentProblems } from './status-history.mjs';
import { live, readIncidents } from '../src/lib/statusnotice';

const now = new Date('2026-10-01T12:00:00Z');
const file = { updated: '2026-10-01T00:00:00Z', incidents: [] };
const plan = {
  id: 'calendar-maintenance', title: 'Calendar maintenance',
  from: '2026-10-03T01:00:00Z', until: '2026-10-03T02:00:00Z',
  components: ['sync'], screens: ['calendar'],
  affects: 'Calendar sync pauses during this window.', still: 'Saved plans remain available.',
  protectedWindows: [{ name: 'Registration', from: '2026-10-02T01:00:00Z', until: '2026-10-02T02:00:00Z' }],
};

describe('maintenance scheduling', () => {
  it('publishes one valid scheduled notice with an Atom update and an expiring in-app notice', () => {
    const result = scheduleMaintenance(file, plan, now);
    expect(incidentProblems(result)).toEqual([]);
    expect(result.incidents[0].updates[0].status).toBe('scheduled');
    const feed = incidentFeed(result, { site: 'https://example.com/status', feedUrl: 'https://example.com/feed' });
    expect(feed).toContain('Calendar maintenance (scheduled)');
    expect(feed).toContain(plan.until);
    const [notice] = readIncidents(result);
    expect(notice.screens).toEqual(['calendar']);
    expect(live(notice, Date.parse('2026-10-03T01:30:00Z'))).toBe(true);
    expect(live(notice, Date.parse('2026-10-03T02:00:01Z'))).toBe(false);
    expect(file.incidents).toEqual([]);
  });
  it('refuses registration/finals overlap but permits adjacent windows', () => {
    const blocked = { name: 'Finals', from: plan.from, until: plan.until };
    expect(() => scheduleMaintenance(file, { ...plan, protectedWindows: [blocked] }, now)).toThrow('Finals');
    expect(() => scheduleMaintenance(file, { ...plan, from: blocked.until, until: '2026-10-03T03:00:00Z', protectedWindows: [blocked] }, now)).not.toThrow();
  });
  it('refuses invalid dates, past starts, backwards windows and duplicate IDs', () => {
    for (const from of ['2026-02-30T01:00:00Z', 'not-a-date', '2026-09-30T01:00:00Z']) {
      expect(() => scheduleMaintenance(file, { ...plan, from }, now)).toThrow();
    }
    expect(() => scheduleMaintenance(file, { ...plan, until: plan.from }, now)).toThrow();
    const first = scheduleMaintenance(file, plan, now);
    expect(() => scheduleMaintenance(first, plan, now)).toThrow('already exists');
  });
  it('requires an explicit protected-window review and clear affected/remaining service wording', () => {
    expect(() => scheduleMaintenance(file, { ...plan, protectedWindows: undefined }, now)).toThrow('protectedWindows');
    expect(() => scheduleMaintenance(file, { ...plan, affects: '' }, now)).toThrow('affects');
    expect(() => scheduleMaintenance(file, { ...plan, components: ['unknown'] }, now)).toThrow();
    expect(() => scheduleMaintenance(file, { ...plan, screens: ['calender'] }, now)).toThrow('screen');
  });
  it('rejects hand-authored scheduled notices without a real maintenance window', () => {
    const result = scheduleMaintenance(file, plan, now);
    const notice = result.incidents[0];
    for (const until of [undefined, '2026-02-30T02:00:00Z', plan.from]) {
      expect(incidentProblems({ ...result, incidents: [{ ...notice, until }] }).join()).toContain('scheduled');
    }
    expect(incidentProblems({ ...result, incidents: [{ ...notice, impact: 'partial' }] }).join()).toContain('scheduled');
  });
});
