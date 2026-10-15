/**
 * An in-memory stand-in for the tables, for the worker's and the scheduler's
 * tests. It implements the query shapes they use and one constraint that
 * matters — the unique (connection, idempotency key) on webhook events — so a
 * duplicate delivery is refused the way Postgres would refuse it. The SQL
 * suites prove the constraints themselves.
 *
 * Put a table name in `tables.__fail` to make its upserts fail.
 */
import { intervalMinutes } from '../../src/lib/integration/freshness.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

export function fakeDb(tables: Tables) {
  let seq = 0;
  const from = (name: string) => {
    tables[name] ??= [];
    const rows = tables[name];
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    let payload: Row[] = [];
    let patch: Row = {};
    let onConflict: string[] = [];
    let single: 'none' | 'maybe' | 'one' = 'none';
    let limit = Infinity;
    let offset = 0;
    const failing = (tables.__fail as unknown as string[] | undefined) ?? [];
    const orders: { key: string; ascending: boolean; nullsFirst: boolean }[] = [];

    const run = () => {
      if (op === 'insert') {
        for (const p of payload) {
          if (name === 'integration_webhook_events'
              && rows.some((r) => r.connection_id === p.connection_id && r.idempotency_key === p.idempotency_key)) {
            return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
          }
        }
        const made = payload.map((p) => ({ id: `id-${++seq}`, ...p }));
        rows.push(...made);
        return { data: single !== 'none' ? made[0] : made, error: null };
      }
      if (op === 'delete') {
        const keep = rows.filter((r) => !filters.every((f) => f(r)));
        rows.splice(0, rows.length, ...keep);
        return { data: null, error: null };
      }
      if (op === 'upsert') {
        if (failing.includes(name)) return { data: null, error: { message: 'connection reset by peer' } };
        for (const p of payload) {
          const hit = rows.find((r) => onConflict.every((k) => r[k] === p[k]));
          if (hit) Object.assign(hit, p); else rows.push({ id: `id-${++seq}`, ...p });
        }
        return { data: null, error: null };
      }
      const matched = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        for (const r of matched) Object.assign(r, patch);
        return { data: null, error: null };
      }
      // Nulls sort as the largest value, as Postgres sorts them by default.
      // `nullsFirst` overrides that, as PostgREST's does.
      const cmp = (a: unknown, b: unknown) => (a === b ? 0 : String(a) < String(b) ? -1 : 1);
      for (const o of [...orders].reverse()) {
        matched.sort((x, y) => {
          const a = x[o.key] ?? null, b = y[o.key] ?? null;
          if (a === null || b === null) return a === b ? 0 : (a === null) === o.nullsFirst ? -1 : 1;
          return (o.ascending ? 1 : -1) * cmp(a, b);
        });
      }
      const out = matched.slice(offset, offset + limit);
      if (single === 'maybe') return { data: out[0] ?? null, error: null };
      if (single === 'one') return out[0] ? { data: out[0], error: null } : { data: null, error: { message: 'no row' } };
      return { data: out, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
      in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return q; },
      is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return q; },
      limit: (n: number) => { limit = n; return q; },
      range: (from: number, to: number) => { offset = from; limit = to - from + 1; return q; },
      not: (k: string, operator: string, v: unknown) => {
        if (operator !== 'is') throw new Error(`fakeDb: not.${operator} is not implemented`);
        filters.push((r) => (r[k] ?? null) !== v);
        return q;
      },
      order: (k: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) => {
        const ascending = o.ascending ?? true;
        orders.push({ key: k, ascending, nullsFirst: o.nullsFirst ?? !ascending });
        return q;
      },
      maybeSingle: () => { single = 'maybe'; return q; },
      single: () => { single = 'one'; return q; },
      insert: (p: Row | Row[]) => { op = 'insert'; payload = Array.isArray(p) ? p : [p]; return q; },
      upsert: (p: Row[], o: { onConflict: string }) => { op = 'upsert'; payload = p; onConflict = o.onConflict.split(','); return q; },
      update: (p: Row) => { op = 'update'; patch = p; return q; },
      delete: () => { op = 'delete'; return q; },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return q;
  };
  const rpc = async (name: string, args: Row) => {
    const failing = (tables.__fail as unknown as string[] | undefined) ?? [];
    if (failing.includes(name)) return { data: null, error: { message: 'connection reset by peer' } };
    let count = 0;
    for (const row of tables.canonical_entity_references ?? []) {
      if (row.tenant_id !== args.want_tenant || row.connection_id !== args.want_connection
        || row.source_system !== args.want_source || row.external_deleted_at != null) continue;
      const display = row.display as Row;
      if (name === 'integration_refresh_governance') {
        const hit = (args.want_records as Row[]).find((x) => x.entity === row.canonical_entity_type
          && x.id === row.source_record_id && x.timestamp === row.source_timestamp);
        if (!hit) continue;
        let prior;
        try { prior = typeof display._governance === 'string' ? JSON.parse(display._governance) : null; } catch { continue; }
        if (!prior || !Number.isFinite(Date.parse(prior.retrievedAt))
          || !Number.isFinite(Date.parse(prior.expiresAt)) || Date.parse(prior.expiresAt) <= Date.parse(prior.retrievedAt)) continue;
        const connection = (tables.integration_connections ?? []).find((c) => c.id === args.want_connection
          && c.tenant_id === args.want_tenant);
        const override = intervalMinutes(String(connection?.freshness_target ?? ''));
        row.display = { ...display, _governance: prior ? JSON.stringify({ ...prior,
          retrievedAt: args.want_at,
          expiresAt: new Date(Date.parse(String(args.want_at))
            + (override !== null ? override * 60_000
              : Date.parse(prior.expiresAt) - Date.parse(prior.retrievedAt))).toISOString(),
        }) : hit.governance };
        row.freshness_status = 'live';
      } else if (name === 'integration_tombstone_references') {
        if (row.canonical_entity_type !== args.want_entity || !(args.want_ids as string[]).includes(String(row.source_record_id))) continue;
        row.display = typeof display._governance === 'string' ? { _governance: display._governance } : {};
        row.external_deleted_at = args.want_at;
        row.freshness_status = 'unavailable';
      } else throw new Error(`fakeDb: unknown rpc ${name}`);
      row.updated_at = args.want_at;
      count++;
    }
    return { data: count, error: null };
  };
  return { from, rpc } as unknown as SupabaseClient;
}
