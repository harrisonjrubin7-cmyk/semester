/**
 * Reference implementations of the platform's ports, in memory.
 *
 * These are the contract, executable: every port has one, and a port's real
 * adapter (Postgres, object storage, a search service) is accepted when it
 * passes the same conformance suite these pass (`testing/conformance.ts`).
 * They are also what the other packages' tests build on, so a domain's test
 * exercises the real command pipeline with a fake database rather than a mock
 * of the pipeline.
 */

import type { Clock, IdSource } from '../kernel/clock.ts';
import { fixedClock, sequentialIds } from '../kernel/clock.ts';
import { MemoryAuditLog } from '../identity/audit.ts';
import type { AuditDraft, AuditEvent } from '../identity/audit.ts';
import { MemoryIdempotencyStore } from '../gateway/idempotency.ts';
import { transactionFor } from '../gateway/command.ts';
import type { CommandDeps, Transaction, UnitOfWork } from '../gateway/command.ts';
import { PolicyEngine } from '../policy/engine.ts';
import type { ActionRule, PolicyInformation } from '../policy/engine.ts';
import { MemoryOutbox } from '../seam/institution.ts';
import type { RequestContext, TrustedIdentity } from '../tenancy/context.ts';
import { buildRequestContext } from '../tenancy/context.ts';
import { OrgDirectory } from '../tenancy/organization.ts';
import type { RoleGrant } from '../seam/institution.ts';
import { CapabilityRegistry, resolveCapabilities } from '../identity/capability.ts';
import { findCoveringConsent } from '../identity/consent.ts';
import type { ConsentRecord } from '../identity/consent.ts';

export interface Snapshottable {
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

/** Atomic by snapshot-and-restore. Anything registered as a store rolls back with the audit log and outbox. */
export class MemoryUnitOfWork implements UnitOfWork {
  private readonly deps: { clock: Clock; ids: IdSource; producer: string };
  private readonly audit: MemoryAuditLog;
  private readonly outbox: MemoryOutbox;
  private readonly stores: readonly Snapshottable[];

  constructor(
    deps: { clock: Clock; ids: IdSource; producer: string },
    audit: MemoryAuditLog,
    outbox: MemoryOutbox,
    stores: readonly Snapshottable[] = [],
  ) {
    this.deps = deps;
    this.audit = audit;
    this.outbox = outbox;
    this.stores = stores;
  }

  async run<T>(ctx: RequestContext, fn: (tx: Transaction, audit: (d: AuditDraft) => Promise<AuditEvent>) => Promise<T>): Promise<T> {
    const auditSnap = this.audit.snapshot();
    const outboxSnap = this.outbox.rows.map((r) => ({ ...r }));
    const storeSnaps = this.stores.map((s) => s.snapshot());
    try {
      return await fn(transactionFor(ctx, this.deps, this.outbox), (d) => this.audit.append(ctx, d));
    } catch (e) {
      this.audit.restore(auditSnap);
      this.outbox.rows.splice(0, this.outbox.rows.length, ...outboxSnap);
      this.stores.forEach((s, i) => s.restore(storeSnaps[i]));
      throw e;
    }
  }
}

/** Capabilities from role grants and the org tree; consent from a list. The shape the database-backed one must match. */
export class MemoryPolicyInformation implements PolicyInformation {
  readonly consents: ConsentRecord[] = [];
  private readonly registry: CapabilityRegistry;
  private readonly dirs: ReadonlyMap<string, OrgDirectory>;
  private readonly nowMs: () => number;

  constructor(registry: CapabilityRegistry, dirs: ReadonlyMap<string, OrgDirectory>, nowMs: () => number) {
    this.registry = registry;
    this.dirs = dirs;
    this.nowMs = nowMs;
  }

  capabilities(ctx: RequestContext, nodeId: string | null): ReadonlySet<string> {
    const dir = this.dirs.get(ctx.tenantId);
    return dir ? resolveCapabilities(this.registry, dir, ctx.roleGrants as RoleGrant[], nodeId, this.nowMs()) : new Set();
  }

  hasConsent(ctx: RequestContext, q: { subjectId: string; purpose: string; scope: string; resourceId: string }): boolean {
    return (
      findCoveringConsent(
        this.consents,
        {
          tenantId: ctx.tenantId,
          subjectPersonId: q.subjectId,
          granteePersonId: ctx.actor.personId,
          purpose: q.purpose as ConsentRecord['purpose'],
          scope: q.scope,
          resourceId: q.resourceId,
        },
        this.nowMs(),
      ) !== undefined
    );
  }
}

export interface Harness {
  clock: ReturnType<typeof fixedClock>;
  ids: IdSource;
  registry: CapabilityRegistry;
  dirs: Map<string, OrgDirectory>;
  pip: MemoryPolicyInformation;
  audit: MemoryAuditLog;
  outbox: MemoryOutbox;
  idempotency: MemoryIdempotencyStore;
  uow: MemoryUnitOfWork;
  policy: PolicyEngine;
  deps: CommandDeps;
  /** Register a store so the unit of work rolls it back. */
  enroll(store: Snapshottable): void;
  context(tenantId: string, personId: string, opts?: { grants?: RoleGrant[]; headers?: Record<string, string>; mfa?: 'none' | 'standard' | 'fresh'; key?: string; purpose?: string }): RequestContext;
}

export const TENANT_A = 'tenant-a';
export const TENANT_B = 'tenant-b';

/** A complete platform in memory, with two tenants. The thing a domain's tests start from. */
export function harness(rules: readonly ActionRule[], setup?: (h: { registry: CapabilityRegistry; dirs: Map<string, OrgDirectory> }) => void): Harness {
  const clock = fixedClock('2026-10-04T12:00:00Z');
  const ids = sequentialIds();
  const registry = new CapabilityRegistry();
  const dirs = new Map<string, OrgDirectory>([
    [TENANT_A, new OrgDirectory(TENANT_A)],
    [TENANT_B, new OrgDirectory(TENANT_B)],
  ]);
  setup?.({ registry, dirs });
  const pip = new MemoryPolicyInformation(registry, dirs, () => clock.now().getTime());
  const audit = new MemoryAuditLog({ clock, ids });
  const outbox = new MemoryOutbox();
  const idempotency = new MemoryIdempotencyStore();
  const stores: Snapshottable[] = [];
  const uow = new MemoryUnitOfWork({ clock, ids, producer: 'platform-test' }, audit, outbox, stores);
  const policy = new PolicyEngine(pip, rules, () => clock.now().getTime());
  const deps: CommandDeps = { clock, ids, policy, idempotency, uow, audit, producer: 'platform-test' };

  return {
    clock,
    ids,
    registry,
    dirs,
    pip,
    audit,
    outbox,
    idempotency,
    uow,
    policy,
    deps,
    enroll: (s) => {
      stores.push(s);
    },
    context: (tenantId, personId, opts = {}) => {
      const identity: TrustedIdentity = {
        actor: {
          personId,
          type: 'user',
          sessionId: `sess-${personId}`,
          authenticatedAt: clock.now().toISOString(),
          mfaLevel: opts.mfa ?? 'standard',
        },
        tenant: { id: tenantId, status: 'active', environment: 'production', verifiedBy: 'membership' },
        membershipIds: [`mem-${personId}`],
        roleGrants: opts.grants ?? [],
      };
      return buildRequestContext(
        { headers: { ...(opts.key && { 'idempotency-key': opts.key }), ...opts.headers }, purpose: opts.purpose },
        identity,
        { clock, ids },
      );
    },
  };
}
