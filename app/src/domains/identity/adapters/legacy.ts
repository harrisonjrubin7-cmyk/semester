import { forSchool, type Grant } from '../../../lib/capabilities';
import { roleOf } from '../../../lib/role';
import type { IdentitySource } from '../application/ports';

/** What the legacy app holds that says who the person is. */
export interface LegacyIdentity {
  readonly role: string;
  readonly userId: string | null;
  readonly schoolId: string | null;
  readonly grants: readonly Grant[];
}

/**
 * Identity as the legacy app keeps it.
 *
 * Two translations that are the point of an anti-corruption layer. `roleOf`
 * turns a stored role string the app no longer recognises into the default
 * rather than letting an unknown value reach a domain. `forSchool` keeps only
 * grants over exactly the person's school — a platform grant opens a screen
 * whose reads the database then refuses, so it must not show up as a
 * capability here either.
 */
export function legacyIdentity(read: () => LegacyIdentity): IdentitySource {
  return {
    read() {
      const l = read();
      return {
        userId: l.userId,
        roleId: roleOf(l.role).id,
        schoolId: l.schoolId,
        capabilities: l.schoolId ? forSchool(l.grants, l.schoolId) : [],
      };
    },
  };
}
