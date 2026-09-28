import { describe, expect, it } from 'vitest';
import {
  DICTIONARY,
  MIN_COHORT,
  approve,
  bottlenecks,
  capacityScenario,
  continuityGaps,
  curriculumMap,
  defineMetric,
  downstream,
  exportReport,
  findCycle,
  freshness,
  funnel,
  isRtl,
  keyProblems,
  mayRetire,
  operationsAllowed,
  questionThemes,
  suppress,
  termsTo,
  uncovered,
  type CourseNode,
  type Evidence,
} from './institution-ops';

/**
 * The institutional layer's governance, held as tests.
 *
 * The control for the suppression tests is the row that should survive: a
 * probe that withheld everything would pass every "is it hidden" assertion
 * here, so each one also checks that a large cell still shows.
 */

describe('metrics', () => {
  it('uses the same floor the database enforces', () => {
    expect(MIN_COHORT).toBe(10);
  });

  it('refuses a per-student grain', () => {
    expect(() => defineMetric({ id: 'x', name: 'x', definition: '', grain: 'student' as never, sources: ['a'], owner: 'o', sensitive: false })).toThrow(/aggregate/);
  });

  it('refuses a metric that sources a forbidden measure', () => {
    for (const bad of ['risk_score', 'reading_time', 'mouse', 'attention', 'ai_usage', 'integrity_flag', 'wellbeing_score', 'location']) {
      expect(() => defineMetric({ id: bad, name: bad, definition: '', grain: 'course', sources: ['ok', bad], owner: 'o', sensitive: false }), bad).toThrow(/forbidden/);
    }
  });

  it('every dictionary entry has lineage and an owner', () => {
    for (const m of DICTIONARY) {
      expect(m.sources.length, m.id).toBeGreaterThan(0);
      expect(m.owner, m.id).toBeTruthy();
    }
  });
});

describe('suppression', () => {
  it('withholds small cells, and one more where a total would give it back', () => {
    const out = suppress([
      { group: 'A', key: 'x', n: 4 },
      { group: 'A', key: 'y', n: 30 },
      { group: 'A', key: 'z', n: 12 },
      { group: 'B', key: 'x', n: 50 },
    ]);
    expect(out.map((c) => [c.key + c.group, c.shown, c.why ?? null])).toEqual([
      ['xA', null, 'small'],
      ['yA', 30, null],
      ['zA', null, 'complement'],
      ['xB', 50, null],
    ]);
  });

  it('does not over-suppress a group that already hides two', () => {
    const out = suppress([
      { group: 'A', key: 'x', n: 2 },
      { group: 'A', key: 'y', n: 3 },
      { group: 'A', key: 'z', n: 40 },
    ]);
    expect(out.find((c) => c.key === 'z')!.shown).toBe(40);
  });

  it('a funnel withholds a small stage and any rate that would use it', () => {
    const f = funnel([
      { stage: 'admitted', n: 200 },
      { stage: 'confirmed', n: 120 },
      { stage: 'deferred', n: 6 },
      { stage: 'enrolled', n: 110 },
    ]);
    expect(f[1]).toEqual({ stage: 'confirmed', shown: 120, conversion: 0.6 });
    expect(f[2].shown).toBeNull();
    expect(f[3].conversion).toBeNull();
  });

  it('question themes count distinct askers and carry no ids', () => {
    const qs = [
      ...Array.from({ length: 12 }, (_, i) => ({ theme: 'elasticity', asker: `h${i}` })),
      ...Array.from({ length: 12 }, () => ({ theme: 'the curve', asker: 'same' })),
    ];
    const r = questionThemes(qs);
    expect(r.shown).toEqual([{ theme: 'elasticity', students: 12 }]);
    expect(r.withheld).toBe(1);
    expect(JSON.stringify(r)).not.toContain('h1');
  });
});

describe('export', () => {
  const cells = [
    { group: 'Fall', key: 'admitted', n: 300 },
    { group: 'Fall', key: 'deferred', n: 3 },
    { group: 'Fall', key: 'confirmed', n: 210 },
  ];

  it('never carries a number the screen would withhold, and carries lineage', () => {
    const r = exportReport({ id: 'f', title: 'Funnel', metrics: ['funnel'], cells });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.csv).toContain('"Fall","admitted",300');
    expect(r.csv).toContain('"Fall","deferred",\n');
    expect(r.csv).not.toMatch(/,3$/m);
    expect(r.csv).toContain('Sources: launchpad_stage_aggregate');
  });

  it('holds a sensitive report for a reviewer who is not its author', () => {
    const base = { id: 'e', title: 'Gaps', metrics: ['equity_gap'], cells };
    expect(exportReport(base)).toEqual({ ok: false, why: 'needs_review' });
    expect(exportReport({ ...base, review: { author: 'ana', reviewer: 'ana', approvedAt: '2026-09-27' } })).toEqual({ ok: false, why: 'self_review' });
    expect(exportReport({ ...base, review: { author: 'ana', reviewer: 'ben', approvedAt: '2026-09-27' } }).ok).toBe(true);
  });

  it('will not accept a review with no author, or the same person in another case', () => {
    const base = { id: 'e', title: 'Gaps', metrics: ['equity_gap'], cells };
    expect(exportReport({ ...base, review: { author: '  ', reviewer: 'ben', approvedAt: '2026-09-27' } })).toEqual({ ok: false, why: 'needs_review' });
    expect(exportReport({ ...base, review: { author: 'Ana', reviewer: ' ana ', approvedAt: '2026-09-27' } })).toEqual({ ok: false, why: 'self_review' });
  });

  it('opens the studio only on a verified outcomes:read, never on nothing', () => {
    expect(operationsAllowed([])).toBe(false);
    expect(operationsAllowed(['integration:view'])).toBe(false);
    expect(operationsAllowed(['outcomes:read'])).toBe(true);
  });

  it('refuses unknown metrics and forbidden fields', () => {
    expect(exportReport({ id: 'x', title: 'x', metrics: ['vibes'], cells })).toEqual({ ok: false, why: 'unknown_metric' });
    expect(exportReport({ id: 'x', title: 'x', metrics: ['funnel'], cells: [{ group: 'Fall', key: 'risk_score', n: 400 }] })).toEqual({ ok: false, why: 'forbidden_field' });
  });
});

describe('curriculum', () => {
  const courses: CourseNode[] = [
    { id: 'E101', prereqs: [], outcomes: ['supply'] },
    { id: 'M130', prereqs: [], outcomes: [] },
    { id: 'E150', prereqs: ['E101'], outcomes: [] },
    { id: 'E301', prereqs: ['E150', 'M130'], outcomes: ['models'] },
    { id: 'E401', prereqs: ['E301'], outcomes: [] },
  ];

  it('finds the shortest path in terms, and what a change touches', () => {
    expect(termsTo('E301', courses)).toBe(3);
    expect(termsTo('M130', courses)).toBe(1);
    expect(downstream('E101', courses)).toEqual(['E150', 'E301', 'E401']);
    expect(findCycle(courses)).toBeNull();
  });

  it('names a prerequisite cycle rather than looping on it', () => {
    const cyc = [...courses, { id: 'E101', prereqs: ['E401'], outcomes: [] }];
    const loop = findCycle(cyc.filter((c, i) => !(c.id === 'E101' && i === 0)))!;
    expect(loop[0]).toBe(loop[loop.length - 1]);
    expect([...new Set(loop)].sort()).toEqual(['E101', 'E150', 'E301', 'E401']);
    expect(() => termsTo('E401', cyc.filter((c, i) => !(c.id === 'E101' && i === 0)))).toThrow(/cycle/);
  });

  it('ranks bottlenecks by unmet demand and what depends on them, ignoring small cohorts', () => {
    const b = bottlenecks(courses, [
      { id: 'E150', planned: 60, seats: 40 },
      { id: 'E401', planned: 60, seats: 40 },
      { id: 'M130', planned: 8, seats: 0 },
    ]);
    expect(b.map((x) => x.id)).toEqual(['E150', 'E401']);
  });

  it('models sections', () => {
    expect(capacityScenario(95, 30, 3)).toEqual({ seats: 90, unmet: 5, sectionsNeeded: 4, spare: 0 });
  });

  it('flattens course → outcome → skill', () => {
    const m = curriculumMap(courses, [{ outcome: 'models', skills: ['regression'], credentials: [], careers: ['analyst'] }]);
    expect(m.find((r) => r.outcome === 'models')).toMatchObject({ course: 'E301', skills: ['regression'], careers: ['analyst'] });
  });
});

describe('evidence', () => {
  const e: Evidence = { id: '1', standard: '8.2', title: 'Assessment plan', owner: 'dana', updated: '2025-10-01', every: 12, state: 'review' };

  it('ages out on its cycle, and nobody-owned is its own state', () => {
    expect(freshness(e, '2026-03-01')).toBe('fresh');
    expect(freshness(e, '2026-09-15')).toBe('due');
    expect(freshness(e, '2026-10-02')).toBe('stale');
    expect(freshness({ ...e, owner: ' ' }, '2026-03-01')).toBe('unowned');
  });

  it('is approved by somebody other than its owner, and only from review', () => {
    expect(() => approve(e, 'dana')).toThrow(/other than/);
    expect(() => approve({ ...e, state: 'draft' }, 'lee')).toThrow(/review/);
    expect(approve(e, 'lee')).toMatchObject({ state: 'approved', approver: 'lee' });
  });

  it('finds standards with nothing approved behind them', () => {
    expect(uncovered(['8.2', '9.1'], [approve(e, 'lee')])).toEqual(['9.1']);
  });
});

describe('platform and readiness', () => {
  it('flags stale keys, unknown scopes and orphaned keys', () => {
    expect(keyProblems({ id: 'k', scopes: ['catalog:read'], rotated: '2026-09-01', tenant: 't' }, '2026-09-27')).toEqual([]);
    expect(keyProblems({ id: 'k', scopes: ['students:read'], rotated: '2026-01-01', tenant: '' }, '2026-09-27')).toEqual(['no_tenant', 'unknown_scope', 'needs_rotation']);
  });

  it('retires a version only after twelve months of notice', () => {
    expect(mayRetire('2026-01-15', '2027-01-15')).toBe(true);
    expect(mayRetire('2026-01-15', '2026-12-15')).toBe(false);
  });

  it('names continuity gaps against stated targets', () => {
    expect(continuityGaps({ rtoHours: 4, rpoHours: 1, lastRestoreTest: '2026-08-01', regions: 2, emergencyAccessReviewed: '2026-02-01' }, '2026-09-27')).toEqual([]);
    expect(continuityGaps({ rtoHours: 48, rpoHours: 1, lastRestoreTest: '', regions: 1, emergencyAccessReviewed: '' }, '2026-09-27')).toHaveLength(4);
  });

  it('knows which scripts run right to left', () => {
    expect(isRtl('ar-EG')).toBe(true);
    expect(isRtl('he')).toBe(true);
    expect(isRtl('en-US')).toBe(false);
  });
});
