import type { Role } from '../../lib/role';
import { principalOf, type Principal } from './model';

/**
 * Anti-corruption layer: the legacy store's idea of a person, as a `Principal`.
 *
 * This is the only file in `identity` that may import `lib/`. The legacy `Role`
 * union is the source of truth for which roles exist today; `identity.test.ts`
 * holds `PRINCIPAL_ROLES` to it, so a role added there without being added here
 * fails a test instead of quietly becoming `applicant`.
 */
export interface LegacyPerson {
  accountId: string | null;
  role: Role;
  schoolId: string;
}

export const principalFromLegacy = (person: LegacyPerson): Principal =>
  principalOf({ accountId: person.accountId, role: person.role, schoolId: person.schoolId });
