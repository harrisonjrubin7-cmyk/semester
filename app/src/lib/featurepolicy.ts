import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A flag's narrowing at a school, and what of it the caller holds — read
 * through `public.feature_narrowing`, the same function the server gates
 * decide from (`private.feature_admits_caller`, in
 * `supabase/migrations/20260929370000_feature_policy_narrowing.sql`).
 *
 * `tenant_feature_policy` says three things about a flag: its `state`, and two
 * narrowings, `permitted_roles` and `permitted_cohorts`. Callers used to read
 * the state alone (`public.feature_state`) and hand `evaluateFlag` a row with
 * no narrowing, so a staff-only preview or a cohort pilot read as open to the
 * whole school. This reads the other two, with the caller's own live roles at
 * the school and live cohort memberships that those lists name. The function
 * is security invoker and takes no user parameter: it answers from the rows
 * the caller's own row-level security shows it, and about nobody else.
 *
 * It fails loudly. A lookup that did not answer — or answered in a shape it
 * does not recognise — throws, rather than reading as "no narrowing", which
 * would admit everybody, or as "not a member", which would be a claim about
 * the caller nobody checked. The database refuses the same callers either
 * way; this keeps the screen honest.
 */

export interface Narrowing {
  /** Empty admits every role the earlier steps admitted. */
  permittedRoles: string[];
  /** Empty admits everybody; otherwise only live members of a named cohort. */
  permittedCohorts: string[];
  /** The caller's live roles at this school that `permittedRoles` names. */
  roles: string[];
  /** The caller's live cohorts at this school that `permittedCohorts` names. */
  cohorts: string[];
}

export class NarrowingUnread extends Error {
  constructor() {
    super('Could not read who this feature is open to at your school.');
    this.name = 'NarrowingUnread';
  }
}

const strings = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;

export async function readNarrowing(db: SupabaseClient, capability: string, school: string): Promise<Narrowing> {
  const { data, error } = await db.rpc('feature_narrowing', { want_capability: capability, want_tenant: school });
  if (error || !Array.isArray(data)) throw new NarrowingUnread();
  // No policy row: the flag is off by its state, and nothing narrows it.
  if (data.length === 0) return { permittedRoles: [], permittedCohorts: [], roles: [], cohorts: [] };
  const row = data[0] as Record<string, unknown>;
  const permittedRoles = strings(row.permitted_roles);
  const permittedCohorts = strings(row.permitted_cohorts);
  const roles = strings(row.roles);
  const cohorts = strings(row.cohorts);
  if (!permittedRoles || !permittedCohorts || !roles || !cohorts) throw new NarrowingUnread();
  return { permittedRoles, permittedCohorts, roles, cohorts };
}

/** Whether the narrowing admits the caller: the evaluator's steps 7 and 7b, for a caller that is not running it whole. */
export function narrowingAdmits(n: Narrowing): boolean {
  const byRole = n.permittedRoles.length === 0 || n.roles.some((r) => n.permittedRoles.includes(r));
  const byCohort = n.permittedCohorts.length === 0 || n.cohorts.some((c) => n.permittedCohorts.includes(c));
  return byRole && byCohort;
}
