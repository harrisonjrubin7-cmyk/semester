/**
 * The organization model: who owns the data, and what sits inside what.
 *
 * ```
 * CustomerAccount          the contract and the invoice; may own several tenants
 *  └─ Tenant               the isolation boundary — every row, key and message carries its id
 *      └─ OrgNode tree     campus → college → department → program → term → section → cohort
 * ```
 *
 * A **tenant** is the unit nothing crosses without a decision. A **customer
 * account** is commercial (it is on the contract); a university system with
 * four campuses is one account and four tenants if the campuses must not see
 * each other, or one tenant with four campus nodes if they should. That choice
 * is an institution's and is recorded once, here, rather than rediscovered in
 * a query. Nodes below the tenant are *scopes*: a role granted at a
 * department covers everything inside it and nothing beside it.
 *
 * `students` and other person-owned data are not org nodes. A person belongs
 * to a tenant through an affiliation (`identity/affiliation.ts`), and to a
 * node through a role grant; neither is a parent link.
 */

import type { PolicyEnvironment } from '../seam/institution.ts';

export const TENANT_STATUSES = ['provisioning', 'active', 'suspended', 'closing', 'closed'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** Where a tenant's data may live. A tenant's zone is fixed at creation; moving it is a migration, not a setting. */
export const DATA_ZONES = ['us', 'eu', 'ca', 'uk'] as const;
export type DataZone = (typeof DATA_ZONES)[number];

export interface Tenant {
  id: string;
  customerAccountId: string;
  name: string;
  environment: PolicyEnvironment;
  status: TenantStatus;
  dataZone: DataZone;
  createdAt: string;
}

export const ORG_KINDS = ['campus', 'college', 'department', 'program', 'term', 'section', 'cohort', 'group'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export interface OrgNode {
  id: string;
  tenantId: string;
  kind: OrgKind;
  parentId: string | null;
  name: string;
}

export type OrgVerdict = { ok: true } | { ok: false; reason: string };

/** Ids are opaque to the platform but are put in keys and filters, so their alphabet is closed. */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const isId = (v: unknown): v is string => typeof v === 'string' && ID_PATTERN.test(v);

/**
 * The tree of nodes for one tenant. Memory-backed reference implementation of
 * the directory port; a Postgres one binds the same checks to a composite key
 * `(tenant_id, id)` so a parent in another tenant cannot be written at all.
 */
export class OrgDirectory {
  private readonly nodes = new Map<string, OrgNode>();

  readonly tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    if (!isId(tenantId)) throw new Error('A directory needs a tenant id.');
  }

  add(node: OrgNode): OrgVerdict {
    if (!isId(node.id)) return { ok: false, reason: 'node id is not a valid id' };
    if (node.tenantId !== this.tenantId) return { ok: false, reason: 'node belongs to another tenant' };
    if (this.nodes.has(node.id)) return { ok: false, reason: `node ${node.id} already exists` };
    if (node.parentId !== null) {
      const parent = this.nodes.get(node.parentId);
      if (!parent) return { ok: false, reason: `parent ${node.parentId} is not in this tenant` };
      if (parent.tenantId !== node.tenantId) return { ok: false, reason: 'parent belongs to another tenant' };
    }
    this.nodes.set(node.id, { ...node });
    return { ok: true };
  }

  get(id: string): OrgNode | undefined {
    return this.nodes.get(id);
  }

  /** The node and every ancestor up to the tenant's top, nearest first. Cycle-safe. */
  chain(id: string): OrgNode[] {
    const out: OrgNode[] = [];
    const seen = new Set<string>();
    let cur = this.nodes.get(id);
    while (cur && !seen.has(cur.id)) {
      out.push(cur);
      seen.add(cur.id);
      cur = cur.parentId === null ? undefined : this.nodes.get(cur.parentId);
    }
    return out;
  }

  /** Whether `id` is `ancestorId` or sits anywhere beneath it. */
  isWithin(id: string, ancestorId: string): boolean {
    return this.chain(id).some((n) => n.id === ancestorId);
  }

  size(): number {
    return this.nodes.size;
  }
}
