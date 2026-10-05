/**
 * Tenant isolation, layer by layer.
 *
 * Row-level security protects the database. It does not protect the cache, the
 * queue, the object store, the search index, the warehouse, the support tools
 * or the AI retrieval path, and a cross-tenant leak in any of those is the
 * same incident. So each layer has its own adapter port here with the tenant
 * boundary *inside* it — the caller passes a `RequestContext`, never a tenant
 * string — and each is held to the same cases by `testing/conformance.ts`.
 *
 * What the reference (memory) adapters model is the **contract**: what a real
 * adapter must refuse. A Redis, S3, Postgres or warehouse adapter is accepted
 * when it passes the same conformance cases against the real service. The
 * controls are catalogued in `ISOLATION_CONTROLS`, which `docs/platform/
 * ISOLATION.md` is generated from and `architecture.test.ts` checks against.
 */

import type { Clock } from '../kernel/clock.ts';
import { hmacSha256, toHex, utf8 } from '../kernel/canonical.ts';
import { redact } from '../observability/redact.ts';
import type { AuditLog } from '../identity/audit.ts';
import { consentIsLive, type ConsentRecord } from '../identity/consent.ts';
import { PlatformError } from '../gateway/errors.ts';
import type { RequestContext, TenantScope } from '../tenancy/context.ts';
import { scopeOf } from '../tenancy/context.ts';
import { consumeForTenant } from '../events/emit.ts';
import type { ReceiptLedger, SemesterEvent } from '../seam/institution.ts';
import { MemoryReceiptLedger } from '../seam/institution.ts';
import type { SearchHit, SearchIndex } from '../engines/search.ts';
import { scopeFor } from '../engines/search.ts';

export const ISOLATION_LAYERS = [
  'api',
  'database',
  'object_storage',
  'queue',
  'cache',
  'search',
  'analytics',
  'support_tools',
  'ai_retrieval',
] as const;
export type IsolationLayer = (typeof ISOLATION_LAYERS)[number];

export interface IsolationControl {
  layer: IsolationLayer;
  /** What the boundary is. */
  control: string;
  /** Where it is enforced — a path that must exist. */
  enforcedIn: string;
  /** What fails closed when it is violated. */
  failsAs: string;
}

export const ISOLATION_CONTROLS: readonly IsolationControl[] = [
  { layer: 'api', control: 'Tenant derived from verified identity; client hint that disagrees is refused; context frozen', enforcedIn: 'packages/platform/src/tenancy/context.ts', failsAs: 'tenant_mismatch / tenant_unresolved' },
  { layer: 'database', control: 'Repository reads and writes carry the request scope; foreign rows are invisible, foreign writes refused; RLS keyed on app.tenant_id', enforcedIn: 'packages/platform/src/isolation/layers.ts', failsAs: 'not_found / tenant_mismatch' },
  { layer: 'object_storage', control: 'Key is t/<tenant>/…; every operation parses the key and checks the prefix before the store is touched', enforcedIn: 'packages/platform/src/engines/files.ts', failsAs: 'not_found' },
  { layer: 'queue', control: 'Partitioned by tenant; consumer verifies the event\'s tenant; mismatches dead-letter and are never handled', enforcedIn: 'packages/platform/src/events/emit.ts', failsAs: 'wrong_tenant (dead-lettered)' },
  { layer: 'cache', control: 'Keys are c:<tenant>:<namespace>:<key>; no shared unkeyed response cache; tenant flush', enforcedIn: 'packages/platform/src/isolation/layers.ts', failsAs: 'miss' },
  { layer: 'search', control: 'Scope required to query; tenant and ACL predicates applied inside the index; records excluded by default', enforcedIn: 'packages/platform/src/engines/search.ts', failsAs: 'no hits' },
  { layer: 'analytics', control: 'Events stamped from context; person id pseudonymised per tenant; free-text and PII keys redacted; reads scoped', enforcedIn: 'packages/platform/src/isolation/layers.ts', failsAs: 'no rows' },
  { layer: 'support_tools', control: 'Support reads need a live, ticket-bound, scope-limited consent in the same tenant; every read is audited; platform-admin alone grants nothing', enforcedIn: 'packages/platform/src/isolation/layers.ts', failsAs: 'forbidden' },
  { layer: 'ai_retrieval', control: 'Retrieval runs through a search scope plus a consented-source allowlist; returns provenance; withdrawn consent removes a source immediately', enforcedIn: 'packages/platform/src/isolation/layers.ts', failsAs: 'no passages' },
];

/* ── database ─────────────────────────────────────────────────────────── */

export interface TenantRow {
  id: string;
  tenantId: string;
}

/**
 * The repository contract: every method takes a `TenantScope`. A Postgres
 * implementation sets `app.tenant_id` for the transaction and relies on RLS
 * *and* includes the predicate in the SQL — belt and braces, because the day
 * RLS is bypassed by a service role is the day the predicate matters.
 */
export interface TenantRepository<T extends TenantRow> {
  get(scope: TenantScope, id: string): Promise<T | undefined>;
  list(scope: TenantScope): Promise<T[]>;
  insert(scope: TenantScope, row: T): Promise<void>;
  update(scope: TenantScope, id: string, patch: Partial<Omit<T, 'id' | 'tenantId'>>): Promise<T>;
  delete(scope: TenantScope, id: string): Promise<boolean>;
}

export class MemoryTenantRepository<T extends TenantRow> implements TenantRepository<T> {
  private rows = new Map<string, T>();
  private readonly key = (tenantId: string, id: string) => JSON.stringify([tenantId, id]);

  async get(scope: TenantScope, id: string): Promise<T | undefined> {
    const r = this.rows.get(this.key(scope.tenantId, id));
    return r ? structuredClone(r) : undefined;
  }

  async list(scope: TenantScope): Promise<T[]> {
    return [...this.rows.values()].filter((r) => r.tenantId === scope.tenantId).map((r) => structuredClone(r));
  }

  async insert(scope: TenantScope, row: T): Promise<void> {
    if (row.tenantId !== scope.tenantId) throw new PlatformError('tenant_mismatch', 'A row for another school was refused.');
    const k = this.key(scope.tenantId, row.id);
    if (this.rows.has(k)) throw new PlatformError('conflict', 'That already exists.');
    this.rows.set(k, structuredClone(row));
  }

  async update(scope: TenantScope, id: string, patch: Partial<Omit<T, 'id' | 'tenantId'>>): Promise<T> {
    const k = this.key(scope.tenantId, id);
    const cur = this.rows.get(k);
    if (!cur) throw new PlatformError('not_found', 'We could not find that.');
    // tenantId and id are not patchable, whatever the patch says.
    const next = { ...cur, ...patch, id: cur.id, tenantId: cur.tenantId } as T;
    this.rows.set(k, next);
    return structuredClone(next);
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    return this.rows.delete(this.key(scope.tenantId, id));
  }

  snapshot(): Map<string, T> {
    return structuredClone(this.rows);
  }

  restore(s: unknown): void {
    this.rows = s as Map<string, T>;
  }
}

/* ── cache ────────────────────────────────────────────────────────────── */

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function cacheKey(scope: TenantScope, namespace: string, key: string): string {
  // `:` is the separator, so it cannot appear in a segment: `a:b` + `c` must never equal `a` + `b:c`.
  if (!SEGMENT.test(namespace) || !SEGMENT.test(key)) throw new PlatformError('invalid_request', 'Invalid cache key.');
  return `c:${scope.tenantId}:${namespace}:${key}`;
}

export interface TenantCache {
  get(scope: TenantScope, namespace: string, key: string): Promise<string | undefined>;
  set(scope: TenantScope, namespace: string, key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(scope: TenantScope, namespace: string, key: string): Promise<void>;
  /** Drop everything for one tenant: offboarding, a key rotation, a suspected leak. */
  flushTenant(scope: TenantScope): Promise<number>;
}

export class MemoryTenantCache implements TenantCache {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();
  private readonly clock: Clock;
  constructor(clock: Clock) {
    this.clock = clock;
  }

  async get(scope: TenantScope, namespace: string, key: string): Promise<string | undefined> {
    const k = cacheKey(scope, namespace, key);
    const e = this.entries.get(k);
    if (!e) return undefined;
    if (e.expiresAt <= this.clock.now().getTime()) {
      this.entries.delete(k);
      return undefined;
    }
    return e.value;
  }

  async set(scope: TenantScope, namespace: string, key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!(ttlSeconds > 0)) throw new PlatformError('invalid_request', 'A cache entry needs a lifetime.');
    this.entries.set(cacheKey(scope, namespace, key), { value, expiresAt: this.clock.now().getTime() + ttlSeconds * 1000 });
  }

  async delete(scope: TenantScope, namespace: string, key: string): Promise<void> {
    this.entries.delete(cacheKey(scope, namespace, key));
  }

  async flushTenant(scope: TenantScope): Promise<number> {
    const prefix = `c:${scope.tenantId}:`;
    let n = 0;
    for (const k of [...this.entries.keys()]) if (k.startsWith(prefix)) (this.entries.delete(k), n++);
    return n;
  }
}

/* ── queue ────────────────────────────────────────────────────────────── */

export interface TenantQueue {
  enqueue(scope: TenantScope, event: SemesterEvent): Promise<void>;
  /** Hand over up to `max` messages for this tenant's partition. */
  receive(scope: TenantScope, max: number): Promise<SemesterEvent[]>;
  deadLetter(scope: TenantScope, event: SemesterEvent, reason: string): Promise<void>;
  deadLetters(scope: TenantScope): Promise<{ event: SemesterEvent; reason: string }[]>;
}

export class MemoryTenantQueue implements TenantQueue {
  private readonly parts = new Map<string, SemesterEvent[]>();
  private readonly dead = new Map<string, { event: SemesterEvent; reason: string }[]>();

  async enqueue(scope: TenantScope, event: SemesterEvent): Promise<void> {
    // Producing into the wrong partition is refused at the source: a message in the wrong lane is the bug.
    if (event.tenantId !== scope.tenantId) throw new PlatformError('tenant_mismatch', 'An event for another school was refused.');
    this.parts.set(scope.tenantId, [...(this.parts.get(scope.tenantId) ?? []), event]);
  }

  async receive(scope: TenantScope, max: number): Promise<SemesterEvent[]> {
    const part = this.parts.get(scope.tenantId) ?? [];
    const out = part.slice(0, max);
    this.parts.set(scope.tenantId, part.slice(out.length));
    return out;
  }

  async deadLetter(scope: TenantScope, event: SemesterEvent, reason: string): Promise<void> {
    this.dead.set(scope.tenantId, [...(this.dead.get(scope.tenantId) ?? []), { event, reason }]);
  }

  async deadLetters(scope: TenantScope): Promise<{ event: SemesterEvent; reason: string }[]> {
    return [...(this.dead.get(scope.tenantId) ?? [])];
  }

  /** For the conformance suite only: simulate a mis-routed message landing in a partition from outside. */
  injectUnchecked(partitionTenantId: string, event: SemesterEvent): void {
    this.parts.set(partitionTenantId, [...(this.parts.get(partitionTenantId) ?? []), event]);
  }
}

/**
 * Drain one tenant's partition through a consumer. A message whose tenant is
 * not the partition's is dead-lettered with the reason and never handled.
 */
export async function drainPartition(
  queue: TenantQueue,
  ledger: ReceiptLedger,
  consumer: string,
  scope: TenantScope,
  handle: (e: SemesterEvent) => Promise<void>,
  max = 100,
): Promise<{ processed: number; deadLettered: number }> {
  let processed = 0;
  let deadLettered = 0;
  for (const raw of await queue.receive(scope, max)) {
    const r = await consumeForTenant(ledger, consumer, scope.tenantId, raw, handle);
    if (r.outcome === 'processed') processed++;
    else if (r.outcome === 'wrong_tenant' || r.outcome === 'refused') {
      await queue.deadLetter(scope, raw, r.outcome === 'wrong_tenant' ? 'wrong_tenant' : r.reason);
      deadLettered++;
    }
  }
  return { processed, deadLettered };
}

export const newLedger = (): ReceiptLedger => new MemoryReceiptLedger();

/* ── analytics ────────────────────────────────────────────────────────── */

export interface AnalyticsEvent {
  tenantId: string;
  name: string;
  /** HMAC of the person id under the tenant's own secret: same person, same tenant → same id; never joinable across tenants. */
  subject: string;
  at: string;
  properties: Record<string, unknown>;
}

export interface TenantAnalytics {
  track(ctx: RequestContext, name: string, properties: Record<string, unknown>): Promise<void>;
  read(scope: TenantScope, name?: string): Promise<AnalyticsEvent[]>;
}

export async function pseudonymize(tenantSecret: Uint8Array, personId: string): Promise<string> {
  return toHex(await hmacSha256(tenantSecret, utf8(personId))).slice(0, 32);
}

export class MemoryTenantAnalytics implements TenantAnalytics {
  private readonly events: AnalyticsEvent[] = [];
  private readonly secrets: (tenantId: string) => Uint8Array;
  private readonly clock: Clock;

  constructor(secrets: (tenantId: string) => Uint8Array, clock: Clock) {
    this.secrets = secrets;
    this.clock = clock;
  }

  async track(ctx: RequestContext, name: string, properties: Record<string, unknown>): Promise<void> {
    this.events.push({
      tenantId: ctx.tenantId,
      name,
      subject: await pseudonymize(this.secrets(ctx.tenantId), ctx.actor.personId),
      at: this.clock.now().toISOString(),
      properties: redact(properties) as Record<string, unknown>,
    });
  }

  async read(scope: TenantScope, name?: string): Promise<AnalyticsEvent[]> {
    return this.events.filter((e) => e.tenantId === scope.tenantId && (name === undefined || e.name === name)).map((e) => structuredClone(e));
  }
}

/* ── support tools ────────────────────────────────────────────────────── */

export interface SupportRead {
  ticketId: string;
  scope: string;
  resource: { type: string; id: string };
}

/**
 * A support agent reads a student's data. Nothing about the agent's *employer*
 * grants it: "platform admin" is not a student-record entitlement. What does is
 * a consent the student (or their institution, under its own policy) gave for
 * `support_access`, bound to one **ticket**, limited to named **scopes**, in
 * **this tenant**, unexpired and unwithdrawn. Every read — allowed or refused —
 * writes an audit row, because "who looked at my data" is a question a student
 * is entitled to have answered.
 */
export async function supportRead<T>(
  deps: { audit: AuditLog; clock: Clock },
  ctx: RequestContext,
  consents: readonly ConsentRecord[],
  read: SupportRead,
  fetcher: (scope: TenantScope) => Promise<T>,
): Promise<T> {
  const now = deps.clock.now().getTime();
  const grant = consents.find(
    (c) =>
      c.tenantId === ctx.tenantId &&
      c.purpose === 'support_access' &&
      c.granteePersonId === ctx.actor.personId &&
      c.ticketId === read.ticketId &&
      c.scopes.includes(read.scope) &&
      c.resourceIds.includes(read.resource.id) &&
      consentIsLive(c, now),
  );
  const resource = { type: read.resource.type, id: read.resource.id };
  if (!grant) {
    await deps.audit.append(ctx, { action: 'support.context_read', resource, decision: 'denied', reasonCode: 'no_live_support_consent', detail: { ticketId: read.ticketId } });
    throw new PlatformError('forbidden', 'You do not have access to that.');
  }
  const out = await fetcher(scopeOf(ctx));
  await deps.audit.append(ctx, { action: 'support.context_read', resource, decision: 'allowed', reasonCode: 'support_consent', detail: { ticketId: read.ticketId, consentId: grant.id, scope: read.scope } });
  return out;
}

/* ── AI retrieval ─────────────────────────────────────────────────────── */

export interface RetrievedPassage extends SearchHit {
  /** Provenance, so an answer can cite and a student can inspect what was used. */
  provenance: { sourceId: string; kind: string };
}

/**
 * Retrieve grounding passages for an AI request.
 *
 * It is a search, with two more constraints. The search scope never includes
 * education records unless the caller says so *and* the source is on the
 * allowlist of ids the student has a live `ai_context` consent for — "the AI
 * may use my notes for this course" is per source, and withdrawing it removes
 * the source from the next retrieval, not the next re-index. Whatever comes
 * back carries provenance, which is what lets the answer cite and the student
 * see what was read.
 */
export async function retrieveForAi(
  index: SearchIndex,
  ctx: RequestContext,
  acl: readonly string[],
  consents: readonly ConsentRecord[],
  clock: Clock,
  query: string,
  limit = 5,
): Promise<RetrievedPassage[]> {
  const now = clock.now().getTime();
  const allowed = new Set(
    consents
      .filter((c) => c.tenantId === ctx.tenantId && c.purpose === 'ai_context' && c.granteePersonId === ctx.actor.personId && consentIsLive(c, now))
      .flatMap((c) => c.resourceIds),
  );
  const hits = await index.query(scopeFor(ctx, acl, { includeRecords: true }), query, 50);
  // The index returns what the caller may *see*; AI may *use* only what is on the allowlist.
  return hits
    .filter((h) => allowed.has(h.id))
    .slice(0, limit)
    .map((h) => ({ ...h, provenance: { sourceId: h.id, kind: h.kind } }));
}
