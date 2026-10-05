import { describe, expect, it } from 'vitest';
import { PILOT_ROLES } from '../../../packages/institution/src/index';
import { INTERNAL_CATEGORIES, ROLES } from './rolelaunch';

/**
 * The pilot roster, held to the register it was chosen from (D-1315).
 *
 * `PILOT_ROLES` names app roles by string. If the register renames one, or the roster picks a role
 * that is not a customer role at all, the login tests would still pass against a name nothing else
 * recognises. So the roster is checked against `ROLES`, which `rolelaunch.test.ts` already holds to
 * `public.app_roles`.
 */
describe('the pilot roster against the Role Launch Register', () => {
  const byRole = new Map(ROLES.map((r) => [r.role, r]));

  it('names only roles the register lists', () => {
    for (const r of PILOT_ROLES) expect(byRole.has(r.app), `${r.app} is not in the register`).toBe(true);
  });

  it('names no company-internal role: a university signs in its own people, not ours', () => {
    for (const r of PILOT_ROLES) {
      const row = byRole.get(r.app)!;
      expect(INTERNAL_CATEGORIES, `${r.app} is ${row.category}`).not.toContain(row.category);
    }
  });

  it('control: the check can fail, a company role is refused', () => {
    expect(INTERNAL_CATEGORIES).toContain(byRole.get('platform_admin')!.category);
  });
});
