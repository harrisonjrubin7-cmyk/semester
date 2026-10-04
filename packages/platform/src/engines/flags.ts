/**
 * Feature flags: staged release, kill switches and tenant gating, with an
 * owner and an end date on every one.
 *
 * Two lessons from this repository's own history shape the rules.
 * First, **sensitive institutional features default OFF and are enabled per
 * tenant, never by a build flag** (ARCHITECTURE.md invariant 9): a `tenant_gated`
 * flag's default must be `false` and every rule that turns it on must name
 * tenants. Second, flags rot: the env-driven `off / preview / sandbox /
 * production` ladder in `lib/experience-flags.ts` has no expiry. A flag here
 * has `owner` and `expiresAt`, and an expired flag evaluates to its default
 * and is reported by `staleFlags` so it is deleted, not forgotten on.
 *
 * Evaluation is a pure function of the definition and a subject, and is
 * deterministic: the same person gets the same answer for a percentage
 * rollout on every request and every node, because the bucket is a hash of
 * `(flag key, person id)`. The reason is returned with the value so support
 * can answer "why can't I see it".
 *
 * A kill switch (`kill: true`) overrides everything, including a rule that
 * would turn the flag on. A flag is **never** an authorization: it controls
 * what is *offered*, and policy still decides what is *allowed*.
 */

export const FLAG_KINDS = ['release', 'ops', 'experiment', 'tenant_gated'] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

export interface FlagRule {
  id: string;
  tenantIds?: readonly string[];
  cohorts?: readonly string[];
  roles?: readonly string[];
  environments?: readonly string[];
  /** 0–100, applied after the other predicates match. */
  percentage?: number;
  value: boolean;
}

export interface FlagDefinition {
  key: string;
  kind: FlagKind;
  owner: string;
  description: string;
  defaultValue: boolean;
  kill?: boolean;
  /** ISO date after which the flag is stale. */
  expiresAt: string;
  rules: readonly FlagRule[];
}

export interface FlagSubject {
  tenantId: string;
  personId: string;
  environment: string;
  roles: readonly string[];
  cohorts: readonly string[];
}

export type FlagReason = 'kill_switch' | `rule:${string}` | 'default' | 'expired_default';

export interface FlagValue {
  value: boolean;
  reason: FlagReason;
}

/** FNV-1a, 32-bit. Not cryptographic and does not need to be: it only has to be stable and evenly spread. */
export function bucket(key: string, personId: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${key}\u0000${personId}`) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

export function evaluateFlag(def: FlagDefinition, subject: FlagSubject, nowMs: number): FlagValue {
  if (def.kill) return { value: false, reason: 'kill_switch' };
  if (Date.parse(def.expiresAt) <= nowMs) return { value: def.defaultValue, reason: 'expired_default' };
  for (const r of def.rules) {
    if (r.tenantIds && !r.tenantIds.includes(subject.tenantId)) continue;
    if (r.environments && !r.environments.includes(subject.environment)) continue;
    if (r.roles && !r.roles.some((x) => subject.roles.includes(x))) continue;
    if (r.cohorts && !r.cohorts.some((x) => subject.cohorts.includes(x))) continue;
    if (r.percentage !== undefined && bucket(def.key, subject.personId) >= r.percentage) continue;
    return { value: r.value, reason: `rule:${r.id}` };
  }
  return { value: def.defaultValue, reason: 'default' };
}

export function flagProblems(def: FlagDefinition): string[] {
  const out: string[] = [];
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(def.key)) out.push(`${def.key}: key must be dotted lower_snake`);
  if (!def.owner.trim()) out.push(`${def.key}: no owner`);
  if (!Number.isFinite(Date.parse(def.expiresAt))) out.push(`${def.key}: expiresAt is not a date`);
  const ids = new Set<string>();
  for (const r of def.rules) {
    if (ids.has(r.id)) out.push(`${def.key}: rule ${r.id} listed twice`);
    ids.add(r.id);
    if (r.percentage !== undefined && !(r.percentage >= 0 && r.percentage <= 100)) out.push(`${def.key}: rule ${r.id} percentage out of range`);
  }
  if (def.kind === 'tenant_gated') {
    if (def.defaultValue) out.push(`${def.key}: a tenant-gated flag must default to off`);
    for (const r of def.rules) {
      if (r.value && !(r.tenantIds && r.tenantIds.length > 0)) out.push(`${def.key}: rule ${r.id} enables a tenant-gated flag without naming tenants`);
    }
  }
  return out;
}

export const staleFlags = (defs: readonly FlagDefinition[], nowMs: number): string[] =>
  defs.filter((d) => Date.parse(d.expiresAt) <= nowMs).map((d) => d.key);
