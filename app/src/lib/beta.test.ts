import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEEDBACK_KINDS, FEEDBACK_LABELS, cohortLabel, toIssue, toMembership } from './beta';

/**
 * The client half of the private beta, held to the migration it calls.
 *
 * The database is the authority on every rule — `supabase/beta.check.sql`
 * walks them with real accounts. What can drift on this side is vocabulary: a
 * feedback kind the check constraint refuses, a cohort kind the panel has no
 * words for, an RPC name that is not the function's. Each of those fails in
 * front of a member rather than in CI, so each is read out of the SQL here.
 */

const root = join(import.meta.dirname, '../../..');
const migration = readFileSync(join(root, 'supabase/migrations/20260928220000_private_beta.sql'), 'utf8');
const client = readFileSync(join(import.meta.dirname, 'beta.ts'), 'utf8');

/** The body of one `create table` in the migration. */
function table(name: string): string {
  const m = new RegExp(`create table if not exists public\\.${name} \\(([\\s\\S]*?)\\n\\);`).exec(migration);
  expect(m, `no create table for ${name}`).toBeTruthy();
  return m![1];
}

/** The quoted values of the `kind` check in one table. */
function kinds(name: string): string[] {
  const m = /kind\s+text\s+not null check \(kind in \(([\s\S]*?)\)\)/.exec(table(name));
  expect(m, `no kind check on ${name}`).toBeTruthy();
  return [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

describe('the beta client and its migration', () => {
  it('reads the checks it compares against, so the comparisons mean something', () => {
    // The control: two different tables, two different lists. A reader that
    // returned the same list for both would pass every test below.
    expect(kinds('beta_feedback')).toContain('accessibility');
    expect(kinds('beta_cohorts')).toContain('transfer_students');
    expect(kinds('beta_feedback')).not.toContain('transfer_students');
  });

  it('offers exactly the feedback kinds the database accepts', () => {
    expect([...FEEDBACK_KINDS].sort()).toEqual(kinds('beta_feedback').sort());
    for (const k of FEEDBACK_KINDS) expect(FEEDBACK_LABELS[k].length).toBeGreaterThan(0);
  });

  it('has words for every cohort kind, rather than showing a snake_case id', () => {
    const cohorts = kinds('beta_cohorts');
    expect(cohorts).toHaveLength(6);
    for (const k of cohorts) expect(cohortLabel(k), k).not.toBe(k);
  });

  it('calls only functions the migration defines and grants to a signed-in account', () => {
    const called = [...client.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(called.length).toBeGreaterThanOrEqual(5);
    const grants = readFileSync(join(root, 'supabase/grants.check.sql'), 'utf8');
    for (const name of called) {
      expect(migration, name).toContain(`create or replace function public.${name}(`);
      expect(grants, `${name} is not on the allowlist`).toContain(`'${name}(`);
    }
  });

  it('never reads or writes a beta table directly', () => {
    expect(client).not.toMatch(/\.from\('/);
  });
});

describe('reading rows', () => {
  const row = {
    program_id: 'fall-pilot', program_name: 'Fall pilot', cohort_kind: 'students', status: 'active',
    live: true, support_contact: 'beta@x.example', joined_at: '2026-09-27T00:00:00Z',
    flags: [{ key: 'module.source_freshness_cards', about: 'From your school on Today' }],
  };

  it('maps a membership', () => {
    expect(toMembership(row)).toMatchObject({ programName: 'Fall pilot', live: true, flags: [{ key: 'module.source_freshness_cards' }] });
  });

  it('reads live only from a literal true, so a missing column is paused rather than running', () => {
    for (const live of [undefined, null, 'true', 1]) {
      expect(toMembership({ ...row, live }).live, String(live)).toBe(false);
    }
  });

  it('treats an unknown issue status as open rather than resolved', () => {
    expect(toIssue({ id: '1', title: 't', status: 'mystery', updated_at: 'x' }).status).toBe('open');
    expect(toIssue({ id: '1', title: 't', status: 'fixed', updated_at: 'x' }).status).toBe('fixed');
  });
});
