import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { JOURNEYS } from '../governance/journey-catalog';
import { ROLES } from '../rolelaunch';
import {
  CLOCK_POINTS,
  EDGE_PEOPLE,
  FIXTURE_NAMESPACE,
  TENANTS,
  TENANT_SLUGS,
  buildWorld,
  fixtureId,
  isFixtureIdentity,
  personaFor,
  rolesIn,
} from './world';

/**
 * A fixture world is only worth trusting if it cannot hold a real person, cannot
 * collide with itself and cannot quietly leave a role out. Each rule below has
 * a control: a probe that says "clean" must be seen to say "dirty" first.
 */

describe('the probe itself (controls)', () => {
  it('sees an address a real person could hold, and one that is reserved', () => {
    expect(isFixtureIdentity('student.zz-test-a@fixture.invalid')).toBe(true);
    expect(isFixtureIdentity('student.zz-test-a@vanderbilt.edu')).toBe(false);
    expect(isFixtureIdentity('student@fixture.invalid')).toBe(false);
    expect(isFixtureIdentity('student.acme@fixture.invalid')).toBe(false);
  });

  it('would see a collision if two personas shared an id', () => {
    const ids = [fixtureId('persona', 'x', 'y'), fixtureId('persona', 'x', 'y')];
    expect(new Set(ids).size).toBe(1);
    expect(fixtureId('persona', 'x', 'y')).not.toBe(fixtureId('persona', 'y', 'x'));
  });
});

describe('ids', () => {
  it('is md5 of the namespaced name, shaped as a uuid — the formula SQL fixtures use', () => {
    const hex = createHash('md5').update(`${FIXTURE_NAMESPACE}:persona:zz-test-a:student`).digest('hex');
    const expected = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    expect(fixtureId('persona', 'zz-test-a', 'student')).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('is the same on every call and different for different names', () => {
    expect(personaFor('student', 'zz-test-a')).toEqual(personaFor('student', 'zz-test-a'));
    expect(personaFor('student', 'zz-test-a').id).not.toBe(personaFor('student', 'zz-test-b').id);
    expect(personaFor('student', 'zz-test-a').id).not.toBe(personaFor('faculty', 'zz-test-a').id);
  });
});

describe('the world', () => {
  const world = buildWorld();

  it('has no two personas with the same id or the same address', () => {
    expect(new Set(world.map((p) => p.id)).size).toBe(world.length);
    expect(new Set(world.map((p) => p.email)).size).toBe(world.length);
  });

  it('holds only reserved identities and test tenants', () => {
    for (const p of world) {
      expect(isFixtureIdentity(p.email), p.email).toBe(true);
      expect(p.tenant, p.email).toMatch(/^zz-test-/);
      expect(TENANT_SLUGS).toContain(p.tenant);
      expect(p.name, p.email).toMatch(/^ZZ /);
    }
  });

  it('has a persona for every role in the role register, somewhere', () => {
    const present = new Set(world.map((p) => p.role));
    const missing = ROLES.map((r) => r.role).filter((role) => !present.has(role));
    expect(missing, `roles with no persona: ${missing.join(', ')}`).toEqual([]);
  });

  it('keeps the company’s staff out of customer tenants, and customers out of the company', () => {
    const internalRoles = new Set(
      ROLES.filter((r) => r.category === 'platform' || r.category === 'commercial').map((r) => r.role),
    );
    for (const p of world) {
      const inInternalTenant = p.tenant === 'zz-test-semester';
      expect(internalRoles.has(p.role), `${p.role} in ${p.tenant}`).toBe(inInternalTenant);
    }
  });

  it('gives a student with no institution only what such a student can be', () => {
    const individual = TENANTS.find((t) => t.kind === 'individual')!;
    const roles = rolesIn(individual);
    expect(roles).toContain('student');
    expect(roles).not.toContain('registrar');
    expect(roles).not.toContain('admitted_student');
  });
});

describe('time', () => {
  it('holds three valid instants', () => {
    for (const iso of Object.values(CLOCK_POINTS)) expect(Number.isNaN(Date.parse(iso)), iso).toBe(false);
  });

  it('puts the spring-forward point on the day Chicago loses an hour', () => {
    const day = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(iso));
    const point = CLOCK_POINTS.springForward;
    expect(day(point)).toBe('3/14/2027'); // 01:00 CST on the day itself, an hour before 02:00 becomes 03:00
    const offset = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'short' }).format(new Date(iso)).split(' ').pop();
    expect(offset('2027-03-14T07:59:00Z')).toBe('CST');
    expect(offset('2027-03-14T08:01:00Z')).toBe('CDT');
  });

  it('puts mid-term on a Wednesday morning and registration on a Monday at seven, local', () => {
    const local = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso));
    expect(local(CLOCK_POINTS.midTerm)).toContain('Wednesday');
    expect(local(CLOCK_POINTS.registrationOpens)).toContain('Monday');
    expect(local(CLOCK_POINTS.registrationOpens)).toContain('07');
  });
});

describe('edge people', () => {
  it('are unique, in real tenants, and the hard case for journeys that exist', () => {
    expect(new Set(EDGE_PEOPLE.map((e) => e.key)).size).toBe(EDGE_PEOPLE.length);
    const journeys = new Set(JOURNEYS.map((j) => j.id));
    for (const e of EDGE_PEOPLE) {
      expect(e.tenants.length, e.key).toBeGreaterThan(0);
      for (const t of e.tenants) expect(TENANT_SLUGS, `${e.key} in ${t}`).toContain(t);
      for (const j of e.journeys) expect(journeys.has(j), `${e.key} names ${j}, which is not a journey`).toBe(true);
    }
  });

  it('includes the one person in two schools, which is the hardest isolation case', () => {
    const both = EDGE_PEOPLE.find((e) => e.key === 'two-tenant-person');
    expect(both?.tenants).toEqual(['zz-test-a', 'zz-test-b']);
  });
});
