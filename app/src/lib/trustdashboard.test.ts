import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { experienceFlags, moduleFlags } from './experience-flags';
import { MIN_COHORT } from './institution-ops';
import { NOTES } from './whatsnew';
import { TRUST_DOCUMENTS, ago, trustDashboard, type TrustInput } from './trustdashboard';

const root = join(import.meta.dirname, '../../..');
const NOW = Date.UTC(2026, 8, 29, 12);

const base: TrustInput = {
  build: '',
  modules: moduleFlags({}),
  experience: experienceFlags({}),
  integrations: [],
  openIssues: null,
  incidents: [],
  notes: NOTES,
  governedAI: false,
  usage: [],
  now: NOW,
};

describe('the customer trust dashboard', () => {
  it('answers the twelve questions the brief lists, in that order', () => {
    expect(trustDashboard(base).map((r) => r.id)).toEqual([
      'version', 'modules', 'integrations', 'support', 'limitations', 'documents', 'accessibility', 'maintenance', 'retention', 'ai', 'changes', 'usage',
    ]);
  });

  it('says plainly when there is nothing behind a row, rather than inventing a value', () => {
    const rows = Object.fromEntries(trustDashboard(base).map((r) => [r.id, r]));
    expect(rows.version.kind).toBe('none');
    expect(rows.version.value).toMatch(/Unstamped/);
    expect(rows.integrations.value).toMatch(/No institutional connection is live/);
    expect(rows.support.kind).toBe('none');
    expect(rows.usage.value).toContain(`n = ${MIN_COHORT}`);
    expect(rows.maintenance.value).toBe('None scheduled, and no incident open.');
  });

  it('derives the live rows from what it is given', () => {
    const rows = Object.fromEntries(
      trustDashboard({
        ...base,
        build: 'abc1234',
        modules: moduleFlags({ VITE_COURSE_STUDIO: 'production', VITE_OFFLINE_MODE: 'production' }),
        integrations: [{ name: 'Brightspace calendar', lastSync: NOW - 2 * 3_600_000, scope: 'Dates, read-only', owner: 'The student' }],
        openIssues: 3,
        incidents: [
          { id: 'm1', date: '2026-10-02', title: 'Database maintenance', status: 'scheduled', kind: 'maintenance', screens: [], from: NOW + 86_400_000, until: NOW + 90_000_000, affects: 'Sync pauses', still: 'Everything on the device' },
          { id: 'i1', date: '2026-09-29', title: 'Slow calendar feed', status: 'monitoring', kind: 'incident', screens: ['calendar'], from: NOW - 1000, until: null, affects: 'Feeds are late', still: 'Everything else' },
        ],
        governedAI: true,
        usage: [{ label: 'Students who opened Today this week', n: 42 }, { label: 'Advisors who shared an agenda', n: 4 }],
      }).map((r) => [r.id, r]),
    );
    expect(rows.version.value).toBe('Build abc1234');
    expect(rows.modules.value).toBe('3 of 18 modules on');
    expect(rows.modules.lines).toEqual(['Action Center on Today', 'Offline mode', 'Course Studio']);
    expect(rows.integrations.lines[0]).toContain('last sync 2 h ago');
    expect(rows.support.value).toBe('3 open');
    expect(rows.maintenance.value).toBe('1 scheduled');
    expect(rows.maintenance.lines).toHaveLength(2);
    expect(rows.ai.value).toMatch(/^Governed/);
    expect(rows.ai.lines[0]).toMatch(/^Course Studio on/);
    expect(rows.usage.value).toBe('1 aggregate at n ≥ 10; 1 suppressed as too small');
    expect(rows.usage.lines).toEqual(['Students who opened Today this week — 42']);
  });

  it('lists retention as the clocks the simulator reads, and student work as kept until deleted', () => {
    const r = trustDashboard(base).find((x) => x.id === 'retention')!;
    expect(r.value).toContain('until the student deletes it');
    expect(r.lines.some((l) => l.includes('90 days'))).toBe(true);
    expect(r.lines.some((l) => /Notes, tasks/.test(l))).toBe(false);
  });

  it('names only documents that exist', () => {
    for (const d of TRUST_DOCUMENTS) expect(existsSync(join(root, d.path)), d.path).toBe(true);
  });

  it('says how long ago in the coarsest honest unit', () => {
    expect(ago(null, NOW)).toBe('never');
    expect(ago(NOW - 30_000, NOW)).toBe('1 min ago');
    expect(ago(NOW - 5 * 3_600_000, NOW)).toBe('5 h ago');
    expect(ago(NOW - 3 * 86_400_000, NOW)).toBe('3 days ago');
  });
});
