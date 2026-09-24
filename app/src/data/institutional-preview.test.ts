import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSTITUTIONAL_FIXTURES, PREVIEW_ROLES } from './institutional-preview';

const EXPECTED_ROLES = [
  'student',
  'faculty',
  'advisor',
  'campus_staff',
  'university_admin',
  'moderator',
  'employer',
  'authorized_payer',
];

describe('synthetic institutional preview fixtures', () => {
  it('contains exactly the two approved fictional institutions', () => {
    expect(INSTITUTIONAL_FIXTURES.map((fixture) => [fixture.name, fixture.domain])).toEqual([
      ['Northstar University', 'northstar.example'],
      ['Cedar Coast College', 'cedarcoast.example'],
    ]);
  });

  it('uses only reserved domains and no production school identity', () => {
    const serialized = JSON.stringify(INSTITUTIONAL_FIXTURES).toLowerCase();
    for (const fixture of INSTITUTIONAL_FIXTURES) {
      expect(fixture.domain.endsWith('.example')).toBe(true);
      expect(fixture.people.every((person) => person.email.endsWith(`@${fixture.domain}`))).toBe(true);
    }
    for (const realName of ['vanderbilt', 'harvard', 'stanford', 'yale', '.edu']) {
      expect(serialized).not.toContain(realName);
    }
  });

  it('provides every representative role with scoped verified grants', () => {
    expect(PREVIEW_ROLES).toEqual(EXPECTED_ROLES);
    for (const fixture of INSTITUTIONAL_FIXTURES) {
      expect(fixture.people.map((person) => person.role).sort()).toEqual([...EXPECTED_ROLES].sort());
      for (const person of fixture.people) {
        expect(person.grants.length).toBeGreaterThan(0);
        expect(person.grants.every((grant) => grant.scopeId.length > 0)).toBe(true);
        expect(person.grants.every((grant) => grant.capabilities.length > 0)).toBe(true);
      }
    }
  });

  it('is pilot-only, sandbox-explicit, complete, synthetic, and immutable', () => {
    const requiredRecords = ['course', 'event', 'message', 'hold', 'bill', 'housing', 'career', 'support'];
    for (const fixture of INSTITUTIONAL_FIXTURES) {
      expect(fixture.readiness).toBe('pilot');
      expect(fixture.connections.every((connection) => connection.status.startsWith('sandbox-'))).toBe(true);
      expect(fixture.records.map((record) => record.kind).sort()).toEqual([...requiredRecords].sort());
      expect(fixture.records.every((record) => record.synthetic)).toBe(true);
      expect(Object.isFrozen(fixture)).toBe(true);
      expect(Object.isFrozen(fixture.people)).toBe(true);
      expect(Object.isFrozen(fixture.records[0])).toBe(true);
    }
  });

  it('is imported by production source only through the preview boundary', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    const root = readFileSync(new URL('../components/institutional/PreviewRoot.tsx', import.meta.url), 'utf8');
    const screens = readFileSync(new URL('../screens.tsx', import.meta.url), 'utf8');

    expect(app).toContain("from './components/institutional/PreviewRoot'");
    expect(root).toContain("import('./PreviewContext')");
    expect(screens).toContain("import('./components/InstitutionalPreviewBar')");
    expect(app).toContain('InstitutionalPreviewBar');
    expect(app).not.toMatch(/from ['"]\.\/data\/institutional-preview['"]/);

    const sourceRoot = resolve(process.cwd(), 'src');
    const importers = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.'))
      .map((entry) => resolve(entry.parentPath, entry.name))
      .filter((path) => readFileSync(path, 'utf8').includes("data/institutional-preview"))
      .map((path) => relative(sourceRoot, path));
    expect(importers).toEqual(['components/institutional/PreviewContext.tsx']);
  });
});
