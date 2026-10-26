import { describe, expect, it } from 'vitest';
import {
  PILOT_ROLES,
  UNIVERSITY_ROLES,
  pilotGroupMapping,
} from '../../../packages/institution/src/index.ts';
import { createMembershipResolver, type AuthorizationAuditRecord } from './membership.ts';
import { createMockIdp, type MockIdpUser } from './mock-idp.ts';

/**
 * A test login for every pilot role, and what must not log in.
 *
 * Stream 02's exit gates are "test login per pilot role" and "role mapping tests". The first needs
 * the university's staging IdP and its test accounts, which this repository does not have, so what
 * is proven here is the half that does not need them: given an IdP that vouches for a person and
 * asserts some groups, does the gateway resolve exactly the institutional role the pilot expects, and
 * refuse everything else. `mock-idp.ts` says what is real and what is a stand-in.
 *
 * The groups are placeholders (`pilot.ts`). When the university's own names arrive, the mapping
 * changes and these tests are what tells you it still holds.
 */

const mapping = pilotGroupMapping();
const person = (nameId: string, groups: string[], attributes?: Record<string, unknown>): MockIdpUser => ({
  nameId,
  groups,
  ...(attributes ? { attributes } : {}),
});

function harness(options: Parameters<typeof createMockIdp>[0] = { mapping }) {
  const audit: AuthorizationAuditRecord[] = [];
  const idp = createMockIdp(options);
  return { idp, audit, resolve: createMembershipResolver(idp.directory, (r) => void audit.push(r)) };
}

describe('the pilot roster', () => {
  it('is thirteen distinct roles, each mapped to an institutional role the gateway knows', () => {
    expect(PILOT_ROLES).toHaveLength(13);
    expect(new Set(PILOT_ROLES.map((r) => r.app)).size).toBe(13);
    expect(new Set(PILOT_ROLES.map((r) => r.group)).size).toBe(13);
    for (const r of PILOT_ROLES) expect(UNIVERSITY_ROLES).toContain(r.signsInAs);
  });
});

describe('a test login per pilot role', () => {
  it.each(PILOT_ROLES.map((r) => [r.app, r] as const))('%s signs in as its institutional role and nothing more', async (_app, r) => {
    const { idp, resolve, audit } = harness();
    const identity = await resolve(idp.signIn(person(`${r.app}@vanderbilt.edu`, [r.group])));
    expect(identity).toMatchObject({ userId: `auth-${r.app}@vanderbilt.edu`, institutionId: 'vanderbilt', roles: [r.signsInAs] });
    expect(audit.map((a) => a.outcome)).toEqual(['accepted']);
  });

  it('gives a person in two groups both institutional roles, once each', async () => {
    const { idp, resolve } = harness();
    const ta = PILOT_ROLES.find((r) => r.app === 'teaching_assistant')!;
    const grad = PILOT_ROLES.find((r) => r.app === 'graduate_student')!;
    const identity = await resolve(idp.signIn(person('ta@vanderbilt.edu', [ta.group, grad.group, grad.group])));
    expect(identity?.roles.slice().sort()).toEqual(['student', 'teaching_assistant']);
  });
});

describe('what must not log in', () => {
  it('a person in no mapped group has no role and is denied', async () => {
    const { idp, resolve, audit } = harness();
    await expect(resolve(idp.signIn(person('nobody@vanderbilt.edu', ['some-other-group'])))).resolves.toBeNull();
    expect(audit.at(-1)).toMatchObject({ outcome: 'denied', reason: 'invalid-membership-roles' });
  });

  it('a group mapped to an app role grants nothing: SSO never assigns one', async () => {
    const { idp, resolve } = harness({ mapping: { rogue: ['platform_admin' as never, 'registrar' as never] } });
    await expect(resolve(idp.signIn(person('rogue@vanderbilt.edu', ['rogue'])))).resolves.toBeNull();
  });

  it('claims in the assertion do not authorize: the membership record does', async () => {
    const { idp, resolve } = harness();
    const student = PILOT_ROLES.find((r) => r.app === 'student')!;
    const identity = await resolve(
      idp.signIn(person('sneaky@vanderbilt.edu', [student.group], {
        semester_roles: ['admin'],
        eduPersonEntitlement: ['urn:semester:platform_admin'],
        app_metadata: { semester: { institutionId: 'vanderbilt', roles: ['admin'] } },
      })),
    );
    expect(identity?.roles).toEqual(['student']);
  });

  it.each(['suspended', 'deprovisioned', 'pending'] as const)('a %s membership is denied on the next check', async (status) => {
    const { idp, resolve, audit } = harness();
    const faculty = PILOT_ROLES.find((r) => r.app === 'faculty')!;
    const user = person('prof@vanderbilt.edu', [faculty.group]);
    await expect(resolve(idp.signIn(user))).resolves.not.toBeNull();
    idp.setStatus(user.nameId, status);
    await expect(resolve(idp.signIn(user))).resolves.toBeNull();
    expect(audit.at(-1)).toMatchObject({ outcome: 'denied', reason: 'membership-not-active' });
  });

  it.each(['pending', 'disabled'] as const)('no pilot role logs in through a %s provider', async (providerStatus) => {
    const { idp, resolve } = harness({ mapping, providerStatus });
    for (const r of PILOT_ROLES) {
      await expect(resolve(idp.signIn(person(`${r.app}@vanderbilt.edu`, [r.group])))).resolves.toBeNull();
    }
  });

  it('a user the IdP never provisioned has no membership', async () => {
    const { idp, resolve, audit } = harness();
    const ghost = {
      id: 'auth-ghost',
      providerIdentifier: idp.provider.providerIdentifier,
      userName: 'ghost@vanderbilt.edu',
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
    };
    await expect(resolve(ghost)).resolves.toBeNull();
    expect(audit.at(-1)).toMatchObject({ outcome: 'denied', reason: 'missing-membership' });
  });

  it('control: with an empty mapping no pilot role resolves, so the matrix above cannot pass vacuously', async () => {
    const { idp, resolve } = harness({ mapping: {} });
    for (const r of PILOT_ROLES) {
      await expect(resolve(idp.signIn(person(`${r.app}@vanderbilt.edu`, [r.group])))).resolves.toBeNull();
    }
  });
});
