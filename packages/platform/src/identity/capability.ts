/**
 * Capabilities: the named things a role lets someone do, resolved at a scope.
 *
 * A **capability** (`grades.release`) is the unit policy checks. A **role**
 * (`instructor`) is a bundle of capabilities. A **role grant** gives a role at
 * a **scope** — the whole tenant, or an org node and everything under it — and
 * may expire. Resolution answers one question: *which capabilities does this
 * actor hold over this node, right now?*
 *
 * This mirrors `private.has_capability()` and `role_capabilities` in the
 * database (ADR 0002) rather than replacing them: RLS stays the boundary at
 * the data, and this is the same answer computed for the layers above it. The
 * migration plan (docs/platform/MIGRATION.md) runs the two side by side and
 * compares before any caller switches.
 *
 * Capability names are `domain.verb` and are registered; an unknown capability
 * is never held, so a typo in a rule fails closed instead of open.
 */

import type { RoleGrant } from '../seam/institution.ts';
import type { OrgDirectory } from '../tenancy/organization.ts';

export const CAPABILITY_PATTERN = /^[a-z][a-z_]*\.[a-z][a-z_]*$/;

export interface RoleDefinition {
  role: string;
  capabilities: readonly string[];
  /** Roles that are about *someone else's* data need a relationship or consent too; policy reads this. */
  needsRelationshipOrConsent?: boolean;
}

export class CapabilityRegistry {
  private readonly known = new Set<string>();
  private readonly roles = new Map<string, RoleDefinition>();

  register(capability: string): void {
    if (!CAPABILITY_PATTERN.test(capability)) throw new Error(`"${capability}" is not a domain.verb capability.`);
    this.known.add(capability);
  }

  defineRole(def: RoleDefinition): void {
    for (const c of def.capabilities) {
      if (!this.known.has(c)) throw new Error(`Role ${def.role} names unregistered capability ${c}.`);
    }
    this.roles.set(def.role, def);
  }

  isRegistered(capability: string): boolean {
    return this.known.has(capability);
  }

  role(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }
}

/** Whether a grant's scope covers a target node (or the tenant when `nodeId` is null) in this directory. */
export function scopeCovers(dir: OrgDirectory, grant: RoleGrant, nodeId: string | null): boolean {
  if (grant.scopeKind === 'tenant') return grant.scopeId === dir.tenantId;
  if (nodeId === null) return false;
  return dir.isWithin(nodeId, grant.scopeId);
}

export function grantIsLive(grant: RoleGrant, nowMs: number): boolean {
  if (grant.expiresAt === undefined) return true;
  const t = Date.parse(grant.expiresAt);
  return Number.isFinite(t) && t > nowMs;
}

/** Capabilities held over `nodeId` (null = tenant level). Expired grants, unknown roles and out-of-scope grants contribute nothing. */
export function resolveCapabilities(
  registry: CapabilityRegistry,
  dir: OrgDirectory,
  grants: readonly RoleGrant[],
  nodeId: string | null,
  nowMs: number,
): Set<string> {
  const out = new Set<string>();
  for (const g of grants) {
    if (!grantIsLive(g, nowMs) || !scopeCovers(dir, g, nodeId)) continue;
    const def = registry.role(g.role);
    if (!def) continue;
    for (const c of def.capabilities) out.add(c);
  }
  return out;
}
