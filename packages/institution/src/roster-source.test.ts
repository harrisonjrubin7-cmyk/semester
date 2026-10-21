import { describe, expect, it } from 'vitest';
import { walk, transition, workflowDefinitionProblems } from './workflow.ts';
import {
  ALLOWED_KEYS,
  ROSTER_SYNC,
  absenceCanRemove,
  batchProblems,
  cleverSectionsToRows,
  normalizeCourseCode,
  rowProblem,
  stageArguments,
  termCode,
  type CleverSection,
  type SourceBatch,
  type StagedRow,
} from './roster-source.ts';

/**
 * The roster source contract against synthetic fixtures: a Clever-style
 * section with co-teachers and an aide, a second section sharing a student, a
 * section with no usable course code, and the refusals the database would
 * give, named first. The database's own rules are proved by
 * supabase/roster-projection.check.sql.
 */

// A Clever API v3-style section, as a fixture — not a copied live response.
const bio: CleverSection & { subject: string; grade: string } = {
  id: 'sec_8f31',
  school: 'school_104',
  course: 'course_bio110',
  term_id: 'term_fall',
  sis_id: 'BIO110-02',
  name: 'Biology 110 - Section 02',
  teacher: 'user_t_392',
  teachers: ['user_t_392', 'user_t_400', 'user_ta_087'],
  students: ['user_s_116', 'user_s_209', 'user_s_116'],
  subject: 'science',
  grade: '13',
};
const hist: CleverSection = {
  id: 'sec_9a02',
  school: 'school_104',
  term_id: 'term_fall',
  sis_id: 'HIST2100-01',
  name: 'History 2100',
  teacher: 'user_t_400',
  students: ['user_s_116'],
};
const odd: CleverSection = { id: 'sec_x', term_id: 'term_unknown', sis_id: 'LAB', name: 'Lab block', students: ['user_s_209'] };

const map = {
  courseCodeOf: (s: CleverSection) => normalizeCourseCode((s.sis_id ?? '').split('-')[0]),
  termCodeOf: (t: string | undefined) => (t === 'term_fall' ? termCode('2026FA') : null),
  aides: new Set(['user_ta_087']),
};

describe('Clever sections become roster rows', () => {
  const rows = cleverSectionsToRows([bio, hist, odd], map);
  const of = (entity: string) => rows.filter((r) => r.entity === entity);

  it('makes one user per person, however many sections they are on', () => {
    expect(of('users').map((u) => u.sourcedId).sort()).toEqual(['user_s_116', 'user_s_209', 'user_t_392', 'user_t_400', 'user_ta_087']);
  });

  it('enrolls every teacher, so co-teachers each get their own grant, and the aide as aide', () => {
    const bioRoles = of('enrollments')
      .filter((e) => e.payload.classSourcedId === 'sec_8f31')
      .map((e) => `${e.payload.userSourcedId}:${e.payload.role}`)
      .sort();
    expect(bioRoles).toEqual(['user_s_116:student', 'user_s_209:student', 'user_t_392:teacher', 'user_t_400:teacher', 'user_ta_087:aide']);
  });

  it('enrolls a student listed twice on one section once', () => {
    expect(of('enrollments').filter((e) => e.sourcedId === 'user_s_116@sec_8f31')).toHaveLength(1);
  });

  it('gives a class the course and term codes the grants key on', () => {
    expect(of('classes').find((c) => c.sourcedId === 'sec_8f31')?.payload).toMatchObject({ courseCode: 'BIO 110', termCode: '2026FA', termSourcedId: 'term_fall' });
    expect(of('classes').find((c) => c.sourcedId === 'sec_9a02')?.payload).toMatchObject({ courseCode: 'HIST 2100', termCode: '2026FA' });
  });

  it('leaves a class with no usable code or term without them, so it grants nothing', () => {
    const c = of('classes').find((x) => x.sourcedId === 'sec_x')!.payload;
    expect(c.courseCode).toBeUndefined();
    expect(c.termCode).toBeUndefined();
  });

  it('copies nothing the database does not allow: no subject, grade, SIS id, email', () => {
    for (const r of rows) {
      for (const k of Object.keys(r.payload)) expect(ALLOWED_KEYS[r.entity]).toContain(k);
    }
    expect(JSON.stringify(rows)).not.toMatch(/science|BIO110-02|@school/);
  });

  it('passes the database row rules', () => {
    expect(batchProblems(rows)).toEqual([]);
  });
});

describe('the database row rules, said first', () => {
  const ok: StagedRow = { entity: 'enrollments', sourcedId: 'e1', payload: { userSourcedId: 'u1', classSourcedId: 'c1', role: 'student', status: 'active' } };

  it('CONTROL: a good row has no problem', () => {
    expect(rowProblem(ok)).toBeNull();
  });

  it('refuses a key outside the allowlist, such as email', () => {
    expect(rowProblem({ entity: 'users', sourcedId: 'u1', payload: { role: 'student', email: 'x@y.example' } })).toBe('key email is not allowed on users');
  });

  it('refuses an enrollment without both ends', () => {
    expect(rowProblem({ ...ok, payload: { userSourcedId: 'u1', role: 'student' } })).toBe('an enrollment names a user and a class');
  });

  it('refuses a duplicate sourcedId in one batch, as the database does', () => {
    expect(batchProblems([ok, ok])).toEqual([{ index: 1, problem: 'duplicate sourcedId in this batch' }]);
  });
});

describe('course and term codes', () => {
  it.each([
    ['BIO110', 'BIO 110'],
    ['bio 110', 'BIO 110'],
    ['HIST-2100', 'HIST 2100'],
    ['ECON 1020A', 'ECON 1020A'],
  ])('normalizes %s to %s', (raw, want) => {
    expect(normalizeCourseCode(raw)).toBe(want);
  });

  it.each(['LAB', 'B110', 'BIOLOGY110', '', null])('refuses %s', (raw) => {
    expect(normalizeCourseCode(raw)).toBeNull();
  });

  it('accepts only the gradebook term shape', () => {
    expect(termCode('2026fa')).toBe('2026FA');
    expect(termCode('Fall 2026')).toBeNull();
  });
});

describe('completeness', () => {
  const provenance = { connectionId: 'conn_01', sourceSystem: 'clever-secure-sync', authorityOwner: 'institution_registrar', observedAt: '2026-10-19T23:00:00Z' };
  const batch = (completeness: SourceBatch<StagedRow>['completeness'], records: StagedRow[] = []): SourceBatch<StagedRow> => ({ records, completeness, provenance, sourceVersion: 'sis-842' });

  it('only a complete batch the school approved can end access by absence', () => {
    expect(absenceCanRemove('complete', true)).toBe(true);
    expect(absenceCanRemove('complete', false)).toBe(false);
    expect(absenceCanRemove('partial', true)).toBe(false);
    expect(absenceCanRemove('unknown', true)).toBe(false);
  });

  it('shapes the stage call, carrying completeness, version and observation time', () => {
    const r = stageArguments('inst_01', batch('partial', cleverSectionsToRows([hist], map)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args).toMatchObject({ want_tenant: 'inst_01', want_completeness: 'partial', want_source_version: 'sis-842', want_observed_at: '2026-10-19T23:00:00Z' });
    }
  });

  it('refuses to shape a batch the database would reject', () => {
    const r = stageArguments('inst_01', batch('complete', [{ entity: 'users', sourcedId: 'u1', payload: { email: 'x@y.example' } }]));
    expect(r).toEqual({ ok: false, problems: [{ index: 0, problem: 'key email is not allowed on users' }] });
  });

  it('refuses a completeness that is not one of the three', () => {
    const r = stageArguments('inst_01', batch('mostly' as never));
    expect(r.ok).toBe(false);
  });
});

describe('the sync lifecycle', () => {
  it('is a well-formed workflow', () => {
    expect(workflowDefinitionProblems(ROSTER_SYNC)).toEqual([]);
  });

  it('walks fetch → staged → validated → held → promoted', () => {
    expect(walk(ROSTER_SYNC, 'fetching', ['staged', 'validated', 'held', 'promoted'])).toMatchObject({ ok: true, state: 'promoted' });
  });

  it('never promotes what was not validated, and a failed fetch is final', () => {
    expect(transition(ROSTER_SYNC, 'staged', 'promoted').ok).toBe(false);
    expect(transition(ROSTER_SYNC, 'failed', 'staged').ok).toBe(false);
  });
});
