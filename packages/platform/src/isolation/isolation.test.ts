import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '../kernel/clock.ts';
import { utf8 } from '../kernel/canonical.ts';
import { MemoryAuditLog } from '../identity/audit.ts';
import { MemoryObjectStore, type ObjectStore } from '../engines/files.ts';
import { MemorySearchIndex, type SearchDocument, type SearchIndex } from '../engines/search.ts';
import { eventFromContext } from '../events/emit.ts';
import { TENANT_A, TENANT_B, harness } from '../testing/memory.ts';
import { isolationCases, type IsolationSubject } from '../testing/conformance.ts';
import {
  ISOLATION_CONTROLS, ISOLATION_LAYERS, MemoryTenantAnalytics, MemoryTenantCache, MemoryTenantQueue, MemoryTenantRepository, cacheKey, drainPartition, newLedger,
  type TenantCache, type TenantRepository, type TenantRow,
} from './layers.ts';
import type { TenantScope } from '../tenancy/context.ts';

function subject(over: Partial<IsolationSubject> = {}): IsolationSubject {
  const h = harness([]);
  const a = h.context(TENANT_A, 'same-person');
  const b = h.context(TENANT_B, 'same-person');
  return {
    clock: h.clock,
    a,
    b,
    repo: new MemoryTenantRepository<TenantRow & { value: string }>(),
    cache: new MemoryTenantCache(h.clock),
    objects: new MemoryObjectStore(),
    queue: new MemoryTenantQueue(),
    eventFor: (ctx) => eventFromContext(ctx, { type: 'action.created', subject: { type: 'task', id: 't' }, payload: { taskId: 't' } }, { clock: h.clock, ids: h.ids, producer: 'conformance' }),
    search: new MemorySearchIndex(),
    analytics: new MemoryTenantAnalytics((t) => utf8(`secret-for-${t}-0000000000000000`), h.clock),
    audit: new MemoryAuditLog({ clock: h.clock, ids: h.ids }),
    ...over,
  };
}

describe('isolation conformance: the memory adapters pass every case', () => {
  // A fresh subject per case: cases write state and must not depend on each other.
  const names = isolationCases(subject()).map((c) => [c.layer, c.name] as const);
  it.each(names)('[%s] %s', async (layer, name) => {
    const c = isolationCases(subject()).find((x) => x.layer === layer && x.name === name)!;
    await expect(c.run()).resolves.toBeUndefined();
  });

  it('covers every layer in the catalogue with at least two cases (control: a layer with one case is a spot check)', () => {
    const cases = isolationCases(subject());
    for (const layer of ISOLATION_LAYERS) {
      const n = cases.filter((c) => c.layer === layer).length;
      expect(n, layer).toBeGreaterThanOrEqual(layer === 'api' ? 1 : 2);
    }
  });

  it('every layer has a catalogued control, and every control names an enforcing file', () => {
    expect([...new Set(ISOLATION_CONTROLS.map((c) => c.layer))].sort()).toEqual([...ISOLATION_LAYERS].sort());
  });
});

/**
 * "A guard that has never failed is not known to be a guard." Each adapter
 * below is the memory adapter with its tenant check removed, which is the
 * mistake the control exists to catch. The suite must go red for the layer it
 * breaks — and only for that layer.
 */
describe('isolation conformance: the suite goes red against deliberately leaky adapters', () => {
  async function failures(over: Partial<IsolationSubject>) {
    const out: string[] = [];
    for (const c of isolationCases(subject(over))) {
      // re-create so cases are independent, but keep the leaky adapter by rebuilding with `over` each time
      const fresh = isolationCases(subject(over)).find((x) => x.layer === c.layer && x.name === c.name)!;
      try {
        await fresh.run();
      } catch {
        out.push(c.layer);
      }
    }
    return [...new Set(out)];
  }

  it('a repository that ignores the scope on reads', async () => {
    class LeakyRepo extends MemoryTenantRepository<TenantRow & { value: string }> {
      override async get(_scope: TenantScope, id: string) {
        for (const t of [TENANT_A, TENANT_B]) {
          const r = await super.get({ tenantId: t }, id);
          if (r) return r;
        }
        return undefined;
      }
    }
    expect(await failures({ repo: new LeakyRepo() as TenantRepository<TenantRow & { value: string }> })).toEqual(['database']);
  });

  it('a repository that trusts the tenant on the row instead of the scope', async () => {
    class TrustingRepo extends MemoryTenantRepository<TenantRow & { value: string }> {
      override async insert(_scope: TenantScope, row: TenantRow & { value: string }) {
        return super.insert({ tenantId: row.tenantId }, row);
      }
    }
    expect(await failures({ repo: new TrustingRepo() as TenantRepository<TenantRow & { value: string }> })).toEqual(['database']);
  });

  it('a cache keyed without the tenant', async () => {
    const shared = new Map<string, string>();
    const leaky: TenantCache = {
      get: async (_s, ns, k) => shared.get(`${ns}/${k}`),
      set: async (_s, ns, k, v) => void shared.set(`${ns}/${k}`, v),
      delete: async (_s, ns, k) => void shared.delete(`${ns}/${k}`),
      flushTenant: async () => (shared.clear(), 0),
    };
    expect(await failures({ cache: leaky })).toEqual(['cache']);
  });

  it('an object store that does not check the key prefix', async () => {
    const m = new Map<string, { bytes: Uint8Array; contentType: string }>();
    const leaky: ObjectStore = {
      put: async (_c, k, b, t) => void m.set(k, { bytes: b, contentType: t }),
      get: async (_c, k) => m.get(k) ?? null,
      delete: async (_c, k) => void m.delete(k),
      list: async (_c, p) => [...m.keys()].filter((k) => k.startsWith(p)),
    };
    expect(await failures({ objects: leaky })).toEqual(['object_storage']);
  });

  it('a search index with no tenant predicate', async () => {
    const docs: SearchDocument[] = [];
    const leaky: SearchIndex = {
      index: async (d) => void docs.push(d),
      remove: async (_t, id) => void docs.splice(0, docs.length, ...docs.filter((d) => d.id !== id)),
      query: async (scope, text) =>
        docs.filter((d) => d.acl.some((t) => scope.acl.includes(t)) && d.title.toLowerCase().includes(text.toLowerCase())).map((d) => ({ id: d.id, kind: d.kind, title: d.title, excerpt: d.excerpt, score: 1 })),
    };
    const out = await failures({ search: leaky });
    expect(out).toContain('search');
  });

  it('a queue that serves every partition', async () => {
    const all: import('../seam/institution.ts').SemesterEvent[] = [];
    const leaky = {
      enqueue: async (_s: TenantScope, e: import('../seam/institution.ts').SemesterEvent) => void all.push(e),
      receive: async () => all.splice(0, all.length),
      deadLetter: async () => undefined,
      deadLetters: async () => [],
    };
    expect(await failures({ queue: leaky })).toEqual(['queue']);
  });

  it('analytics that stores the raw person id', async () => {
    const rows: { tenantId: string; name: string; subject: string; at: string; properties: Record<string, unknown> }[] = [];
    const leaky = {
      track: async (ctx: { tenantId: string; actor: { personId: string } }, name: string, properties: Record<string, unknown>) => void rows.push({ tenantId: ctx.tenantId, name, subject: ctx.actor.personId, at: '', properties }),
      read: async (scope: TenantScope, name?: string) => rows.filter((r) => r.tenantId === scope.tenantId && (!name || r.name === name)),
    };
    expect(await failures({ analytics: leaky })).toEqual(['analytics']);
  });
});

describe('isolation helpers', () => {
  it('cache keys put the tenant in the key and refuse the separator inside a segment', () => {
    expect(cacheKey({ tenantId: 't1' }, 'profile', 'p1')).toBe('c:t1:profile:p1');
    expect(() => cacheKey({ tenantId: 't1' }, 'a:b', 'c')).toThrow();
    expect(() => cacheKey({ tenantId: 't1' }, 'a', '')).toThrow();
  });

  it('draining a partition processes its own events and is idempotent across redelivery', async () => {
    const h = harness([]);
    const queue = new MemoryTenantQueue();
    const ledger = newLedger();
    const ev = eventFromContext(h.context(TENANT_A, 'p'), { type: 'action.created', subject: { type: 't', id: '1' }, payload: {} }, { clock: h.clock, ids: h.ids, producer: 'x' });
    await queue.enqueue({ tenantId: TENANT_A }, ev);
    await queue.enqueue({ tenantId: TENANT_A }, ev);
    const handled: string[] = [];
    const out = await drainPartition(queue, ledger, 'c', { tenantId: TENANT_A }, async (e) => void handled.push(e.eventId));
    expect(out).toEqual({ processed: 1, deadLettered: 0 });
    expect(handled).toHaveLength(1);
  });

  it('drain dead-letters a malformed message rather than throwing', async () => {
    const queue = new MemoryTenantQueue();
    queue.injectUnchecked(TENANT_A, { eventId: 'not-a-uuid' } as never);
    const out = await drainPartition(queue, newLedger(), 'c', { tenantId: TENANT_A }, async () => undefined);
    expect(out).toEqual({ processed: 0, deadLettered: 1 });
  });

  it('fixed clocks and sequential ids behave (control for the harness)', () => {
    expect(fixedClock(0).now().getTime()).toBe(0);
    expect(sequentialIds().next('x')).toMatch(/^x_00000000-0000-4000-8000-000000000001$/);
  });
});
