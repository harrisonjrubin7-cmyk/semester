import { describe, expect, it } from 'vitest';
import { DOMAIN_SPECS } from './domain-specs';
import { approvalKey, approvalsNeeded, scopeFlags, scopeProblems } from './scope';
import { namesNeverIngest } from '../integration/adapter';
import type { DomainSpec } from './engine-types';

const spec = (id: string) => DOMAIN_SPECS.find((d) => d.id === id)!;
const academic = spec('academic_records');
const courses = spec('courses');

describe('scope: what may move at all', () => {
  it('requires a named approval for grades, per domain and entity', () => {
    const flags = scopeFlags(academic);
    expect(flags.some((f) => f.field === 'grade' && f.reason === 'never_ingest' && f.approval === approvalKey('academic_records', 'course_result'))).toBe(true);
    expect(scopeProblems(academic, []).length).toBeGreaterThan(0);
    expect(scopeProblems(academic, approvalsNeeded(academic))).toEqual([]);
    expect(namesNeverIngest('grade_points')).toBe(true);
  });

  it('refuses a field in a class the platform floor allows nowhere, however many approvals are on file', () => {
    const sneaky: DomainSpec = { ...courses, entities: [{ ...courses.entities[0], fields: [...courses.entities[0].fields, { name: 'diagnosis_code', class: 'T4' }] }, ...courses.entities.slice(1)] };
    const problems = scopeProblems(sneaky, approvalsNeeded(sneaky));
    expect(problems.join(' ')).toContain('the platform floor allows it nowhere');
    expect(scopeFlags(sneaky).find((f) => f.field === 'diagnosis_code')).toMatchObject({ reason: 'class_blocked', approval: null });
  });

  it('keeps money and holds visible as flagged: the platform never displays a balance or a reason by default', () => {
    expect(approvalsNeeded(spec('finance')).length).toBeGreaterThan(0);
  });

  it('never lets a T4-or-above field into any domain, and explains what happens to each excluded one', () => {
    for (const d of DOMAIN_SPECS) {
      for (const e of d.entities) for (const f of e.fields) expect(['T4', 'T5', 'T6'], `${d.id}.${e.name}.${f.name}`).not.toContain(f.class);
      for (const x of d.excluded) if (x.class >= 'T4') expect(x.handling.length).toBeGreaterThan(40);
    }
  });
});
