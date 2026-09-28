import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, PROMISES, impact, verify, workload, type ImpactCatalog, type Shift } from './consolechecks';

describe('the customer promise checker', () => {
  const support = PROMISES.find((p) => p.id === 'support-24-7')!;
  const all = Object.fromEntries(support.verifies.map((c) => [c.id, true]));

  it('names each promise and check once', () => {
    expect(new Set(PROMISES.map((p) => p.id)).size).toBe(PROMISES.length);
    for (const p of PROMISES) expect(new Set(p.verifies.map((c) => c.id)).size, p.id).toBe(p.verifies.length);
  });

  it('keeps a promise only when every check it names is true', () => {
    expect(verify(support, all).kept).toBe(true);
    for (const c of support.verifies) {
      const v = verify(support, { ...all, [c.id]: false });
      expect(v.kept, c.id).toBe(false);
      expect(v.unmet.map((u) => u.id)).toEqual([c.id]);
    }
  });

  it('treats an unknown fact as unmet, not as met', () => {
    const { roster: _, ...rest } = all;
    expect(verify(support, rest).unmet.map((u) => u.id)).toEqual(['roster']);
    expect(verify(support, {}).unmet).toHaveLength(support.verifies.length);
  });

  it('holds the two examples the brief gives, and two more a pilot would sign', () => {
    expect(PROMISES.map((p) => p.id)).toEqual(['support-24-7', 'sis-read-only', 'export-on-request', 'aggregate-only']);
    expect(PROMISES.find((p) => p.id === 'sis-read-only')!.verifies.map((c) => c.id)).toEqual(['no-write-scope', 'no-write-workflow', 'data-map-approved', 'fallback', 'freshness-alert']);
  });
});

describe('the release impact checker', () => {
  const catalog: ImpactCatalog = { tenants: ['vanderbilt', 'preview'], rolesByScreen: { Registrar: ['student', 'advisor'], Moderation: ['staff'] } };

  it('finds nothing material in a change to prose', () => {
    const i = impact({ files: ['README.md', 'docs/PROOF-CALENDAR.md'], flags: [] }, catalog);
    expect(i.material).toBe(false);
    expect(i.tenants).toEqual([]);
    expect(i.why).toEqual([]);
  });

  it('makes a migration material for every tenant', () => {
    const i = impact({ files: ['supabase/migrations/20261001000000_x.sql'], flags: [] }, catalog);
    expect(i.material).toBe(true);
    expect(i.tenants).toEqual(['vanderbilt', 'preview']);
    expect(i.documents).toContain('RETENTION.md');
    expect(i.alerts).toContain('migration-applied');
  });

  it('names the roles a screen serves, and asks for training', () => {
    const i = impact({ files: ['app/src/screens/Registrar.tsx', 'app/src/screens/Today.tsx'], flags: [] }, catalog);
    expect(i.roles).toEqual(['student', 'advisor']);
    expect(i.training).toBe(true);
    expect(i.material).toBe(false);
  });

  it('names the integration, and the conformance claim a look change may move', () => {
    const i = impact({ files: ['app/src/lib/integration/workday.ts', 'app/src/lib/look.ts'], flags: [] }, catalog);
    expect(i.integrations).toEqual(['workday']);
    expect(i.alerts).toContain('integration:workday');
    expect(i.documents).toContain('docs/WCAG-UI-AUDIT-SCORECARD.md');
    expect(i.material).toBe(true);
  });

  it('notifies the tenants a moved flag is on for, and not the others', () => {
    const off = impact({ files: [], flags: [{ name: 'course_studio', onFor: [] }] }, catalog);
    expect(off.material).toBe(false);
    expect(off.documents).toEqual(['docs/FEATURE-FLAG-REGISTRY.md']);
    const on = impact({ files: [], flags: [{ name: 'course_studio', onFor: ['vanderbilt'] }] }, catalog);
    expect(on.material).toBe(true);
    expect(on.notifications).toEqual(['vanderbilt']);
    expect(on.tenants).toEqual(['vanderbilt']);
  });
});

describe('on-call workload', () => {
  const shift = (seat: string, from: string, to: string, over: Partial<Shift> = {}): Shift => ({ seat, from, to, backup: 'b', incidents: 0, ...over });
  const sound = [shift('a', '2026-10-01', '2026-10-07'), shift('b', '2026-10-08', '2026-10-14', { backup: 'a' }), shift('a', '2026-10-15', '2026-10-21')];

  it('finds nothing wrong with a roster people can keep', () => {
    expect(workload(sound, { ...DEFAULT_RULES, runbooksBySeat: { a: ['restore'], b: ['restore'] } })).toEqual([]);
  });

  it('refuses one seat covering longer than the ceiling, across touching shifts', () => {
    const long = [shift('a', '2026-10-01', '2026-10-07'), shift('a', '2026-10-08', '2026-10-09')];
    const f = workload(long);
    expect(f.map((x) => x.rule)).toEqual(['consecutive']);
    expect(f[0].said).toContain('9 consecutive days');
    // A day's gap breaks the run.
    expect(workload([shift('a', '2026-10-01', '2026-10-07'), shift('a', '2026-10-09', '2026-10-10')])).toEqual([]);
  });

  it('reads each seat’s calendar on its own: another seat’s shift in between neither ends a run nor counts as rest', () => {
    // A covers Oct 1–4 and Oct 5–8 with B in between: eight consecutive days for A.
    const interleaved = [shift('a', '2026-10-01', '2026-10-04'), shift('b', '2026-10-02', '2026-10-03', { backup: 'a' }), shift('a', '2026-10-05', '2026-10-08')];
    const f = workload(interleaved);
    expect(f.map((x) => x.rule)).toEqual(['consecutive']);
    expect(f[0].said).toContain('a covers 8 consecutive days');
    // A heavy shift, B for a day, then A again the next day: no rest for A.
    const tired = [shift('a', '2026-10-01', '2026-10-03', { incidents: 4 }), shift('b', '2026-10-03', '2026-10-03', { backup: 'a' }), shift('a', '2026-10-04', '2026-10-05')];
    expect(workload(tired).map((x) => x.rule)).toEqual(['no-recovery']);
    // A day off between them is rest, whoever covered it.
    const rested = [shift('a', '2026-10-01', '2026-10-03', { incidents: 4 }), shift('b', '2026-10-04', '2026-10-04', { backup: 'a' }), shift('a', '2026-10-05', '2026-10-06')];
    expect(workload(rested)).toEqual([]);
  });

  it('wants a backup who is somebody else', () => {
    expect(workload([shift('a', '2026-10-01', '2026-10-02', { backup: null })]).map((x) => x.rule)).toEqual(['no-backup']);
    expect(workload([shift('a', '2026-10-01', '2026-10-02', { backup: 'a' })]).map((x) => x.rule)).toEqual(['self-backup']);
  });

  it('wants recovery after a heavy shift', () => {
    const heavy = [shift('a', '2026-10-01', '2026-10-03', { incidents: 4 }), shift('a', '2026-10-04', '2026-10-05')];
    expect(workload(heavy).map((x) => x.rule)).toEqual(['no-recovery']);
    const relieved = [shift('a', '2026-10-01', '2026-10-03', { incidents: 4 }), shift('b', '2026-10-04', '2026-10-05', { backup: 'a' })];
    expect(workload(relieved)).toEqual([]);
  });

  it('names a runbook only one person can run', () => {
    const f = workload(sound, { ...DEFAULT_RULES, runbooksBySeat: { a: ['restore', 'rotate-keys'], b: ['restore'] } });
    expect(f).toEqual([{ rule: 'single-point', seat: 'a', said: 'Only a can run rotate-keys.' }]);
  });
});
