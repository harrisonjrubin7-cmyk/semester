import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCESS_REQUEST_ACTIONS, ACCESS_SAGA, ACCESS_SAGA_STATES } from './access-saga.ts';

const sql = readFileSync(new URL('../../../supabase/migrations/20261006170000_access_saga_store.sql', import.meta.url), 'utf8');

const quoted = (text: string): string[] => [...text.matchAll(/'([A-Za-z_.]+)'/g)].map((m) => m[1]);

/** The quoted list inside `<column> in (...)` of a check constraint. */
const listOf = (column: string): string[] => {
  const m = sql.match(new RegExp(`check \\(${column} in \\(([^)]*)\\)\\)`));
  if (!m) throw new Error(`no check list for ${column}`);
  return quoted(m[1]);
};

/** The text of one function's body, up to its closing `$$;`. */
const after = (marker: string): string => {
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  return sql.slice(start, sql.indexOf('$$;', start));
};

describe('the saga store migration and the access saga agree', () => {
  it('lists the same fifteen states', () => {
    expect([...listOf('state')].sort()).toEqual([...ACCESS_SAGA_STATES].sort());
  });

  it('allows exactly the edges ACCESS_SAGA allows', () => {
    const body = after('create or replace function private.access_saga_edge_ok');
    const edges = [...body.matchAll(/\('([A-Z_]+)', '([A-Z_]+)'\)/g)].map((m) => `${m[1]}>${m[2]}`).sort();
    const want = Object.entries(ACCESS_SAGA.transitions).flatMap(([from, tos]) => (tos as string[]).map((to) => `${from}>${to}`)).sort();
    expect(edges).toEqual(want);
  });

  it('accepts the same request actions the schema and the policy do', () => {
    expect(listOf('intent_action').sort()).toEqual([...ACCESS_REQUEST_ACTIONS].sort());
  });

  it('control: a state missing from the SQL would be seen', () => {
    const states = listOf('state').filter((s) => s !== 'ACTIVE');
    expect(states.sort()).not.toEqual([...ACCESS_SAGA_STATES].sort());
  });
});
