import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUTIES } from './console';

/**
 * The `public.console_duty` seed in the control-plane migration, held to
 * `DUTIES` in console.ts.
 *
 * The console's duties matrix lives in TypeScript so a test can refuse a
 * requester who approves itself; the database enforces it, so the migration
 * seeds the same rows. Two copies of a matrix drift, and this test is what
 * stops them: for every duty it parses the seed's tuple and holds the
 * requester, the approvers and the two-person flag to the TypeScript, and
 * refuses a seed with a row the TypeScript does not have. The parser is
 * shown both array spellings and a mismatch before it is trusted.
 */

const root = join(import.meta.dirname, '../../../..');
const MIGRATION = 'supabase/migrations/20260929100000_console_control_plane.sql';

type Value = string | boolean | null | string[];

interface SeedRow {
  id: string;
  requester: string;
  approvers: string[];
  two_person: boolean;
}

/** Reads one SQL string literal starting at `text[i] === "'"`; returns the value and the index after it. */
function readString(text: string, i: number): [string, number] {
  let out = '';
  i += 1;
  for (;;) {
    const j = text.indexOf("'", i);
    if (j < 0) throw new Error('unterminated string literal');
    out += text.slice(i, j);
    if (text[j + 1] === "'") {
      out += "'";
      i = j + 2;
    } else return [out, j + 1];
  }
}

/** Reads the SQL values of one parenthesised tuple starting at `text[i] === "("`. */
function readTuple(text: string, i: number): [Value[], number] {
  const values: Value[] = [];
  i += 1;
  for (;;) {
    while (/\s/.test(text[i])) i += 1;
    const rest = text.slice(i);
    let v: Value;
    if (text[i] === "'") {
      let s: string;
      [s, i] = readString(text, i);
      // '{a,b}' or '{"a","b"}' is an array literal; a cast may follow.
      v = /^\{.*\}$/s.test(s) ? s.slice(1, -1).split(',').map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean) : s;
    } else if (/^array\s*\[/i.test(rest)) {
      i += rest.match(/^array\s*\[/i)![0].length;
      const items: string[] = [];
      for (;;) {
        while (/[\s,]/.test(text[i])) i += 1;
        if (text[i] === ']') {
          i += 1;
          break;
        }
        let s: string;
        [s, i] = readString(text, i);
        items.push(s);
      }
      v = items;
    } else if (/^true\b/i.test(rest)) {
      v = true;
      i += 4;
    } else if (/^false\b/i.test(rest)) {
      v = false;
      i += 5;
    } else if (/^null\b/i.test(rest)) {
      v = null;
      i += 4;
    } else throw new Error(`cannot read a value at: ${rest.slice(0, 40)}`);
    while (/\s/.test(text[i])) i += 1;
    while (text.startsWith('::', i)) {
      i += 2;
      while (/[\w[\]]/.test(text[i])) i += 1;
      while (/\s/.test(text[i])) i += 1;
    }
    values.push(v);
    if (text[i] === ',') i += 1;
    else if (text[i] === ')') return [values, i + 1];
    else throw new Error(`expected , or ) at: ${text.slice(i, i + 40)}`);
  }
}

/** Every row the migration seeds into public.console_duty, whatever the column order or array spelling. */
export function parseSeed(sql: string): SeedRow[] {
  const head = /insert\s+into\s+public\.console_duty\s*\(([^)]*)\)\s*values/i.exec(sql);
  if (!head) throw new Error('no insert into public.console_duty (...) values in the migration');
  const columns = head[1].split(',').map((c) => c.trim().toLowerCase());
  for (const c of ['id', 'requester', 'approvers', 'two_person']) if (!columns.includes(c)) throw new Error(`the seed has no ${c} column`);
  const rows: SeedRow[] = [];
  let i = head.index + head[0].length;
  for (;;) {
    while (/\s/.test(sql[i])) i += 1;
    if (sql[i] !== '(') break;
    let values: Value[];
    [values, i] = readTuple(sql, i);
    const at = (c: string) => values[columns.indexOf(c)];
    const approvers = at('approvers');
    rows.push({ id: String(at('id')), requester: String(at('requester')), approvers: Array.isArray(approvers) ? approvers : [String(approvers)], two_person: at('two_person') === true });
    while (/\s/.test(sql[i])) i += 1;
    if (sql[i] === ',') i += 1;
    else break;
  }
  return rows;
}

/** The mismatches between the seed and DUTIES, as sentences; empty when they agree. */
export function mismatches(seed: readonly SeedRow[]): string[] {
  const out: string[] = [];
  const byId = new Map(seed.map((r) => [r.id, r]));
  for (const d of DUTIES) {
    const r = byId.get(d.id);
    if (!r) {
      out.push(`${d.id} is not seeded.`);
      continue;
    }
    if (r.requester !== d.requester) out.push(`${d.id}: the seed's requester is ${r.requester}, console.ts says ${d.requester}.`);
    if (r.approvers.join(',') !== d.approvers.join(',')) out.push(`${d.id}: the seed's approvers are ${r.approvers.join(', ')}, console.ts says ${d.approvers.join(', ')}.`);
    if (r.two_person !== d.twoPerson) out.push(`${d.id}: the seed says two_person ${r.two_person}, console.ts says ${d.twoPerson}.`);
  }
  for (const r of seed) if (!DUTIES.some((d) => d.id === r.id)) out.push(`the seed has ${r.id}, which console.ts does not.`);
  return out;
}

const FIXTURE = `
-- the seed
insert into public.console_duty (id, action, requester, approvers, two_person, evidence) values
  ('break-glass', 'Break-glass access', 'engineering', array['security', 'founder'], true, 'A ticket'),
  ('role-grant', 'Grant or widen a privileged role', 'role:university_admin', '{security}'::text[], false, 'The request, naming the person''s role'),
  ('support-access', 'Read a student''s record', 'role:support_agent', ARRAY['student']::text[], FALSE, 'A ticket')
on conflict (id) do update set action = excluded.action;
`;

describe('the seed parser', () => {
  it('reads every row, either array spelling, a doubled quote and a cast', () => {
    const rows = parseSeed(FIXTURE);
    expect(rows.map((r) => r.id)).toEqual(['break-glass', 'role-grant', 'support-access']);
    expect(rows[0]).toEqual({ id: 'break-glass', requester: 'engineering', approvers: ['security', 'founder'], two_person: true });
    expect(rows[1]).toEqual({ id: 'role-grant', requester: 'role:university_admin', approvers: ['security'], two_person: false });
    expect(rows[2]).toEqual({ id: 'support-access', requester: 'role:support_agent', approvers: ['student'], two_person: false });
  });

  it('reads the columns by name, not by position', () => {
    const rows = parseSeed(`insert into public.console_duty (two_person, id, approvers, requester) values (true, 'x', array['a','b'], 'r');`);
    expect(rows).toEqual([{ id: 'x', requester: 'r', approvers: ['a', 'b'], two_person: true }]);
  });

  it('refuses a seed with no console_duty insert, or without the columns it holds', () => {
    expect(() => parseSeed('create table public.console_duty (id text);')).toThrow(/no insert/);
    expect(() => parseSeed(`insert into public.console_duty (id, action) values ('x', 'y');`)).toThrow(/no requester column/);
  });

  it('catches a wrong requester, a wrong approver, a wrong flag, a missing row and an extra one', () => {
    const rows = parseSeed(FIXTURE);
    expect(mismatches(rows)).toEqual(expect.arrayContaining(['tenant-suspension is not seeded.']));
    expect(mismatches(rows).filter((m) => m.startsWith('break-glass:'))).toEqual([]);
    const wrong = rows.map((r) => (r.id === 'break-glass' ? { ...r, requester: 'security', approvers: ['founder'], two_person: false } : r));
    expect(mismatches([...wrong, { id: 'refund-x', requester: 'a', approvers: ['b'], two_person: false }])).toEqual(
      expect.arrayContaining([
        'break-glass: the seed\'s requester is security, console.ts says engineering.',
        'break-glass: the seed\'s approvers are founder, console.ts says security, founder.',
        'break-glass: the seed says two_person false, console.ts says true.',
        'the seed has refund-x, which console.ts does not.',
      ]),
    );
  });
});

describe(`the seed in ${MIGRATION}`, () => {
  it('exists', () => {
    expect(existsSync(join(root, MIGRATION)), `${MIGRATION} is not in the tree`).toBe(true);
  });

  it('is the duties matrix, row for row', () => {
    const seed = parseSeed(readFileSync(join(root, MIGRATION), 'utf8'));
    expect(seed.length).toBe(DUTIES.length);
    expect(mismatches(seed)).toEqual([]);
  });
});
