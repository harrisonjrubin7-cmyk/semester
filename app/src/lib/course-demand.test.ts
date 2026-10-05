import { describe, expect, it } from 'vitest';
import {
  backupLine,
  byDepartment,
  capacityLine,
  contributionChanged,
  contributionFrom,
  departmentOf,
  normalizeCode,
  pressureLine,
  readContribution,
  readDemand,
  readDemandRow,
} from './course-demand';
import type { CatalogCourse } from './registration';

/**
 * Phase K's model. The database is the authority on consent, scope and the
 * threshold (`supabase/demand.check.sql`); these hold what the student sends
 * — course codes and primary/backup, nothing else — and that no count below
 * ten reaches a staff screen whatever arrives.
 */

const section = (id: string, code: string, over: Partial<CatalogCourse> = {}): CatalogCourse =>
  ({
    id, code, section: 'S07', title: `${code} title`, term: '2027SP', department: code.split(' ')[0], credits: 3,
    instructor: 'Prof. Ruiz', location: 'Calhoun 101', description: 'd', prerequisites: '', seats: 10,
    meetings: [{ days: [1, 3], start: 541, end: 615 }],
    ...over,
  }) as CatalogCourse;

const catalog = [
  section('e1', 'ECON 1010'),
  section('e2', 'ECON 1010', { section: '02' }),
  section('e3', 'ECON 1020'),
  section('m1', 'MATH 1300'),
  section('h1', 'HIST 1000'),
  section('f1', 'FREN 1010', { term: '2026FA' }),
  section('x1', 'Independent study'),
];

describe('what a student contributes', () => {
  it('is each course code once, as planned, from the cart', () => {
    const c = contributionFrom([catalog[0], catalog[1], catalog[3]], {}, catalog)!;
    expect(c.term).toBe('2027SP');
    expect(c.courses).toEqual([
      { course: 'ECON 1010', role: 'primary' },
      { course: 'MATH 1300', role: 'primary' },
    ]);
  });

  it('adds backups at their best rank, and never a course already planned', () => {
    const c = contributionFrom([catalog[0], catalog[3]], { e1: ['e2', 'e3', 'h1'], m1: ['h1'] }, catalog)!;
    expect(c.courses).toEqual([
      { course: 'ECON 1010', role: 'primary' },
      { course: 'MATH 1300', role: 'primary' },
      { course: 'HIST 1000', role: 'backup', rank: 1 },
      { course: 'ECON 1020', role: 'backup', rank: 2 },
    ]);
  });

  it('sends nothing but a code, a role and a rank — no section, time, instructor or title', () => {
    const c = contributionFrom([catalog[0], catalog[3]], { e1: ['e3'] }, catalog)!;
    for (const item of c.courses) expect(Object.keys(item).sort()).toEqual(item.role === 'backup' ? ['course', 'rank', 'role'] : ['course', 'role']);
    const sent = JSON.stringify(c.courses);
    for (const withheld of ['Prof. Ruiz', 'Calhoun', 'title', 'S07', '541']) expect(sent).not.toContain(withheld);
  });

  it('keeps to one term: the cart’s commonest', () => {
    const c = contributionFrom([catalog[0], catalog[3], catalog[5]], { e1: ['f1'] }, catalog)!;
    expect(c.term).toBe('2027SP');
    expect(c.courses.map((x) => x.course)).not.toContain('FREN 1010');
  });

  it('leaves out, and names, anything that is not a course code', () => {
    const c = contributionFrom([catalog[0], catalog[6]], {}, catalog)!;
    expect(c.courses).toEqual([{ course: 'ECON 1010', role: 'primary' }]);
    expect(c.skipped).toEqual(['Independent study']);
  });

  it('is nothing for an empty cart, and at most thirty courses', () => {
    expect(contributionFrom([], {}, catalog)).toBeNull();
    const many = Array.from({ length: 40 }, (_, i) => section(`s${i}`, `ECON ${2000 + i}`));
    expect(contributionFrom(many, {}, many)!.courses).toHaveLength(30);
  });

  it('writes codes the way the department scope reads them', () => {
    expect(normalizeCode(' econ1010 ')).toBe('ECON 1010');
    expect(normalizeCode('cs  101')).toBe('CS 101');
    expect(departmentOf('ECON 1010')).toBe('ECON');
  });

  it('notices when the cart has changed since it was sent', () => {
    const sent = [{ course: 'ECON 1010', role: 'primary' as const }];
    expect(contributionChanged(sent, [{ course: 'ECON 1010', role: 'primary' }])).toBe(false);
    expect(contributionChanged(sent, [{ course: 'ECON 1010', role: 'primary' }, { course: 'MATH 1300', role: 'primary' }])).toBe(true);
  });

  it('reads back the student’s own contribution and whether they stopped', () => {
    expect(readContribution([])).toBeNull();
    const c = readContribution([
      { course_code: 'ECON 1010', role: 'primary', backup_rank: null, consented_at: '2026-09-27T12:00:00Z', revoked_at: null },
      { course_code: 'ECON 1020', role: 'backup', backup_rank: 2, consented_at: '2026-09-27T12:00:00Z', revoked_at: null },
    ])!;
    expect(c.courses).toEqual([{ course: 'ECON 1010', role: 'primary' }, { course: 'ECON 1020', role: 'backup', rank: 2 }]);
    expect(c.revokedAt).toBeNull();
    // A stopped contribution has its consent and no courses.
    expect(readContribution([{ course_code: null, consented_at: '2026-09-27T12:00:00Z', revoked_at: '2026-09-28T12:00:00Z' }])).toMatchObject({ courses: [], revokedAt: Date.parse('2026-09-28T12:00:00Z') });
  });
});

describe('what staff are shown', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    tenant_id: 'u', course_code: 'ECON 1010', planned_students: 12, backup_students: null, generated_at: '2026-09-27T12:00:00Z',
    capacity: null, waitlist: null, sections: 0, capacity_source: null, capacity_synced_at: null, ...over,
  });

  it('never shows a count below ten, however it arrived', () => {
    expect(readDemandRow(row({ planned_students: 9 }))).toBeNull();
    expect(readDemandRow(row({ planned_students: 3 }))).toBeNull();
    expect(readDemandRow(row({ backup_students: 4 }))!.backups).toBeNull();
    expect(readDemand([row(), row({ course_code: 'MATH 1300', planned_students: 2 })]).map((r) => r.course)).toEqual(['ECON 1010']);
  });

  it('says a backup below ten in words, never as a number', () => {
    expect(backupLine(readDemandRow(row())!)).toBe('Fewer than 10 hold it as a backup');
    expect(backupLine(readDemandRow(row({ backup_students: 11 }))!)).toBe('11 as a backup');
  });

  it('says capacity is not connected rather than guessing it', () => {
    const r = readDemandRow(row())!;
    expect(capacityLine(r)).toBe('Capacity not connected');
    expect(pressureLine(r)).toBeNull();
    // Capacity from zero synced sections is not capacity.
    expect(readDemandRow(row({ capacity: 40, sections: 0 }))!.capacity).toBeNull();
  });

  it('shows synced seats, waitlist and the gap as facts', () => {
    const r = readDemandRow(row({ planned_students: 70, capacity: 55, waitlist: 4, sections: 2, capacity_source: 'banner', capacity_synced_at: '2026-09-27T10:00:00Z' }))!;
    expect(capacityLine(r)).toBe('55 seats in 2 sections · 4 waitlisted');
    expect(pressureLine(r)).toBe('15 more planned than seats');
    expect(r.capacitySource).toBe('banner');
  });

  it('groups by department, largest first', () => {
    const rows = readDemand([row({ course_code: 'MATH 1300', planned_students: 10 }), row({ course_code: 'ECON 1020', planned_students: 30 }), row()]);
    expect(byDepartment(rows).map((g) => [g.department, g.rows.map((r) => r.course)])).toEqual([
      ['ECON', ['ECON 1020', 'ECON 1010']],
      ['MATH', ['MATH 1300']],
    ]);
  });
});
