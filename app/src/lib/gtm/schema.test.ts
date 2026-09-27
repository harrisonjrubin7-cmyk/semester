/*
 * The database enforces the same rules as lib/gtm (supabase/migrations/
 * 20260928090000_gtm_foundation.sql, walked by supabase/gtm.check.sql). Two
 * copies of a list drift, so this reads the migration and holds every
 * vocabulary to the TypeScript one — the same arrangement the T0–T6 floor has
 * with integration/classification.ts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TARGETABLE_FIELDS, canMove, type CampaignStatus } from './campaign';
import { APPROVED_CATEGORIES, PROHIBITED_CATEGORIES, PROTECTED_SURFACES } from './sponsor';
import { COMMITTEE_ROLES } from './pilot';

const sql = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20260928090000_gtm_foundation.sql'), 'utf8');

/** The quoted words in the first `(...)` / `array[...]` after `anchor`. */
function listAfter(anchor: string, open: '(' | '[' = '('): string[] {
  const at = sql.indexOf(anchor);
  expect(at, anchor).toBeGreaterThan(-1);
  const start = sql.indexOf(open, at + anchor.length - 1);
  const end = sql.indexOf(open === '(' ? ')' : ']', start);
  return [...sql.slice(start, end).matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]);
}

const sorted = (xs: Iterable<string>) => [...xs].sort();

describe('lib/gtm and its migration say the same thing', () => {
  it('lets an audience name exactly the TypeScript allow-list', () => {
    const audience = listAfter("if not (c ->> 'field') = any (array", '[');
    expect(sorted(audience)).toEqual(sorted(Object.keys(TARGETABLE_FIELDS)));
  });

  it('gives a contact a column for each targetable field and nothing sensitive', () => {
    const table = sql.slice(sql.indexOf('create table if not exists public.gtm_prospects'), sql.indexOf('create index if not exists gtm_prospects_by_tenant_stage'));
    for (const field of Object.keys(TARGETABLE_FIELDS)) expect(table, field).toMatch(new RegExp(`\\n\\s+${field}\\s`));
    for (const banned of ['gpa', 'grade', 'aid', 'disability', 'health', 'race', 'ethnicity', 'conduct', 'religion', 'birth']) {
      expect(table, banned).not.toMatch(new RegExp(`\\n\\s+\\w*${banned}\\w*\\s+(text|smallint|int|boolean|date|jsonb|numeric)`));
    }
  });

  it('allows the same sponsor categories, and none the TypeScript prohibits', () => {
    const placement = listAfter('category         text        not null check (category in');
    const policy = listAfter("categories  text[]      not null default '{}' check (categories <@ array", '[');
    expect(sorted(placement)).toEqual(sorted(APPROVED_CATEGORIES));
    expect(sorted(policy)).toEqual(sorted(APPROVED_CATEGORIES));
    for (const p of PROHIBITED_CATEGORIES) expect(placement).not.toContain(p);
  });

  it('protects the same surfaces in the placement and in the school policy', () => {
    const placement = listAfter("and surface not in");
    const policy = listAfter('check (not (surfaces && array', '[');
    expect(sorted(placement)).toEqual(sorted(PROTECTED_SURFACES));
    expect(sorted(policy)).toEqual(sorted(PROTECTED_SURFACES));
  });

  it('knows the same buying-committee roles', () => {
    const stakeholders = listAfter('committee_role  text        not null check (committee_role in');
    const log = listAfter('committee_role   text        not null check (committee_role in');
    expect(sorted(stakeholders)).toEqual(sorted(COMMITTEE_ROLES));
    expect(sorted(log)).toEqual(sorted(COMMITTEE_ROLES));
  });

  it('asks a procurement-room requester for one of the same committee roles', () => {
    const room = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20260928100000_trust_room.sql'), 'utf8');
    const at = room.indexOf('requester_role   text        not null check (requester_role in');
    expect(at).toBeGreaterThan(-1);
    const list = room.slice(at, room.indexOf('))', at));
    expect(sorted([...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))).toEqual(sorted(COMMITTEE_ROLES));
  });

  it('has the same campaign statuses and the same moves', () => {
    const statuses: CampaignStatus[] = ['draft', 'in_review', 'approved', 'active', 'paused', 'completed', 'retired'];
    expect(sorted(listAfter("status                text        not null default 'draft' check (status in"))).toEqual(sorted(statuses));
    // Only the campaign guard: the pilot guard reuses the word 'active'.
    const guard = sql.slice(sql.indexOf('function private.gtm_campaign_guard()'), sql.indexOf('drop trigger if exists gtm_campaign_guard'));
    const moves = new Map<string, string[]>();
    for (const m of guard.matchAll(/\(old\.status = '(\w+)'\s+and new\.status (?:in \(([^)]*)\)|= '(\w+)')\)/g)) {
      moves.set(m[1], m[2] ? [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]) : [m[3]]);
    }
    expect(moves.size).toBe(6); // every status but retired has a way out
    // canMove leaves out approved → active, which goes through activationGate.
    const viaGate = (from: string, to: string) => from === 'approved' && to === 'active';
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canMove(from, to) || viaGate(from, to), `${from} → ${to}`).toBe((moves.get(from) ?? []).includes(to));
      }
    }
  });
});
