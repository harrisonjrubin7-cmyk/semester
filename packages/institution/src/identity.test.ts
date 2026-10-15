import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  IDENTITY_CLAIMS,
  PROHIBITED_ATTRIBUTE_FRAGMENTS,
  checkAttributeMapping,
  minimizeClaims,
  prohibitedCategory,
} from './identity.ts';

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260927120000_identity_claim_minimization.sql', import.meta.url),
  'utf8',
);

/** The quoted strings of the first `array[...]` after a marker in the SQL. */
const sqlArray = (after: string): string[] => {
  const start = migration.indexOf(after);
  const body = migration.slice(start, migration.indexOf(']', start));
  return [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};

describe('identity claim minimization', () => {
  it('holds the TypeScript and SQL rules to the same lists', () => {
    expect(sqlArray("entry.claim <> all (array[")).toEqual([...IDENTITY_CLAIMS]);
    expect(sqlArray('from unnest(array[')).toEqual(PROHIBITED_ATTRIBUTE_FRAGMENTS.map(([f]) => f));
  });

  it('accepts a minimal eduPerson-style mapping', () => {
    const verdict = checkAttributeMapping({
      subject: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
      email: 'mail',
      display_name: 'displayName',
      affiliation: 'eduPersonAffiliation',
      groups: 'isMemberOf',
      campus: 'campusCode',
    });
    expect(verdict.ok).toBe(true);
  });

  it.each([
    ['cumulativeGPA', 'grades and GPA'],
    ['Financial_Aid_Status', 'financial aid'],
    ['disability-status', 'health, disability and counseling'],
    ['conductRecord', 'conduct records'],
    ['visaType', 'immigration records'],
    ['socialSecurityNumber', 'government identifiers'],
    ['courseEnrollments', 'rosters and enrollments'],
  ])('refuses %s as %s, even mapped into an allowed claim', (attribute, category) => {
    expect(prohibitedCategory(attribute)).toBe(category);
    const verdict = checkAttributeMapping({ department: attribute });
    expect(verdict).toMatchObject({ ok: false, claim: 'department' });
  });

  // The control. Each of these holds a letter run near a fragment; a guard
  // that refused them would be refusing by accident, not by rule.
  it.each(['graduationYear', 'adobeId', 'advisorName', 'displayName', 'eduPersonPrincipalName'])(
    'leaves %s clear',
    (attribute) => expect(prohibitedCategory(attribute)).toBeNull(),
  );

  it('fails closed on ssn inside a longer name, as documented', () => {
    expect(prohibitedCategory('className')).toBe('government identifiers');
  });

  it('refuses claims outside the allowlist and malformed values', () => {
    expect(checkAttributeMapping({ role: 'eduPersonAffiliation' })).toMatchObject({ ok: false, claim: 'role' });
    expect(checkAttributeMapping({ email: ['mail'] })).toMatchObject({ ok: false, claim: 'email' });
    expect(checkAttributeMapping({ email: ' ' })).toMatchObject({ ok: false });
    expect(checkAttributeMapping([])).toMatchObject({ ok: false });
  });

  it('keeps only mapped claims from an assertion and drops the rest', () => {
    const kept = minimizeClaims(
      {
        mail: 'student@example.edu',
        isMemberOf: ['semester-students', 42, ''],
        cumulativeGPA: '3.9',
        unrelated: 'dropped',
      },
      { email: 'mail', groups: 'isMemberOf', department: 'cumulativeGPA' },
    );
    expect(kept).toEqual({ email: 'student@example.edu', groups: ['semester-students'] });
  });
});
