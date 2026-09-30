import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOURCE_LABELS } from '../source';
import {
  IDEMPOTENCY_KEY, LEDGER_KEY, LEDGER_KINDS, LEDGER_REASONS, MAX_DONATION, MAX_ITEMS, ORDER_STATUSES,
  PARTNER_STATUSES, PAY_KINDS, POOL_CLAIMS_PER_WEEK, REFUSALS, SHARE_CONSENT_VERSION, TRANSITIONS,
} from './index';

/**
 * The database half and this half say the same things.
 *
 * The migration is read, not restated: a list typed out a second time here
 * would agree with `lib/dining` by construction and prove nothing. Each
 * extraction has a control — it must find something — so a regex that stops
 * matching fails here rather than passing on nothing.
 */
const FILE = '20260929330000_dining.sql';
const raw = readFileSync(new URL(`../../../../supabase/migrations/${FILE}`, import.meta.url), 'utf8');
const sql = raw.replace(/--[^\n]*/g, ' ');

/** The quoted values of the first `<column> … check (<column> in (…))` after `create table … <table>`. */
function checkList(table: string, column: string): string[] {
  const start = sql.search(new RegExp(`create table if not exists public\\.${table}\\b`));
  expect(start, table).toBeGreaterThan(-1);
  const body = sql.slice(start, sql.indexOf(');\n', start));
  const m = new RegExp(`\\b${column}\\s+in\\s*\\(([^)]*)\\)`).exec(body);
  expect(m, `${table}.${column}`).not.toBeNull();
  return [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

const functions = [...sql.matchAll(/create or replace function (public|private)\.([a-z_]+)\(([\s\S]*?)\$\$;/g)];

describe(`${FILE} and lib/dining`, () => {
  it('raises only refusals the service layer has a name for', () => {
    const raised = [...new Set([...sql.matchAll(/'dining: ([a-z_]+):/g)].map((m) => m[1]))].sort();
    // Control: the extraction finds the refusals, not nothing.
    expect(raised.length).toBeGreaterThanOrEqual(15);
    expect(raised.filter((c) => !(REFUSALS as readonly string[]).includes(c))).toEqual([]);
  });

  it('checks the same statuses, ways to pay, ledger kinds, reasons and connection states', () => {
    expect(checkList('dining_orders', 'status')).toEqual([...ORDER_STATUSES]);
    expect(checkList('dining_order_events', 'status')).toEqual([...ORDER_STATUSES]);
    expect(checkList('dining_orders', 'pay')).toEqual([...PAY_KINDS]);
    expect(checkList('dining_ledger', 'kind')).toEqual([...LEDGER_KINDS]);
    expect(checkList('dining_ledger', 'reason')).toEqual([...LEDGER_REASONS]);
    expect(checkList('dining_partner_connections', 'status')).toEqual([...PARTNER_STATUSES]);
  });

  it('labels every sourced row with the five source labels, and only those', () => {
    const lists = [...sql.matchAll(/source_label\s+in\s*\(([^)]*)\)/g)].map((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
    expect(lists.length).toBe(4);
    for (const l of lists) expect(l).toEqual([...SOURCE_LABELS]);
  });

  it('moves an order through the same steps as TRANSITIONS', () => {
    const m = /\(o\.status, want_status\) not in \(([^;]*?)\) then/.exec(sql);
    expect(m).not.toBeNull();
    const pairs = [...m![1].matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map((x) => `${x[1]}>${x[2]}`).sort();
    const forward = Object.entries(TRANSITIONS)
      .flatMap(([from, tos]) => tos.filter((to) => to !== 'cancelled').map((to) => `${from}>${to}`))
      .sort();
    expect(pairs).toEqual(forward);
  });

  it('holds the same keys, limits and consent wording version', () => {
    expect(sql).toContain(`'${IDEMPOTENCY_KEY.source}'`);
    expect(sql).toContain(`'${LEDGER_KEY.source}'`);
    expect(sql).toContain(`consent_version in ('${SHARE_CONSENT_VERSION}')`);
    expect(sql).toContain(`is distinct from '${SHARE_CONSENT_VERSION}'`);
    expect(sql).toContain(`swipes between 1 and ${MAX_DONATION}`);
    expect(sql).toContain(`cardinality(items) between 1 and ${MAX_ITEMS}`);
    expect(sql).toMatch(new RegExp(`interval '7 days'\\) >= ${POOL_CLAIMS_PER_WEEK} then`));
  });

  it('refunds with the debit’s applies_at, so a swipe goes back to its own week', () => {
    const cancel = functions.find((f) => f[2] === 'dining_cancel_order')?.[3] ?? '';
    expect(cancel).toMatch(/select d\.tenant_id, d\.student, d\.term, d\.kind, -d\.delta, d\.applies_at, 'refund'/);
  });

  it('turns row-level security on for every table it creates, and grants a client nothing but select', () => {
    const tables = [...sql.matchAll(/create table if not exists public\.([a-z_]+)/g)].map((m) => m[1]);
    expect(tables.length).toBe(10);
    for (const t of tables) expect(sql, t).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`));
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*\bto\s+(anon|authenticated|public)\b/i);
  });

  it('pins search_path on every function, and revokes every one from PUBLIC', () => {
    // Control: it finds the nine public and the six private functions.
    expect(functions.filter((f) => f[1] === 'public').length).toBe(9);
    expect(functions.filter((f) => f[1] === 'private').length).toBe(6);
    for (const [, schema, name, body] of functions) {
      expect(body, name).toContain("set search_path = ''");
      expect(sql, name).toMatch(new RegExp(`revoke all on function ${schema}\\.${name}\\([^)]*\\) from public, anon, authenticated`));
    }
  });

  it('takes the school from the caller’s profile in every public function, never from a parameter', () => {
    for (const [, schema, name, body] of functions) {
      if (schema !== 'public') continue;
      expect(body, name).toContain('private.dining_caller_school()');
      expect(body.split('\n')[0], name).not.toMatch(/school|tenant/);
    }
  });

  it('says on its face that it is not applied', () => {
    const header = raw.slice(0, raw.search(/\n(?!--)/));
    expect(header.trimEnd().split('\n').at(-1)).toBe('-- Additive. NOT APPLIED to production; applying it needs owner approval.');
  });
});
