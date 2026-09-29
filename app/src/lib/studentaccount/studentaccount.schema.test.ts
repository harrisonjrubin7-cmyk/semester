/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAG_KEYS } from '../flags';
import { CAPABILITIES } from './actions';
import { MODULE_FLAG } from './gate';
import { AWARD_KINDS, AWARD_STATUSES, ENTRY_KINDS, EVENT_KINDS, SAPS, VERIFICATIONS } from './ledger';
import { APPLY_OUTCOMES } from './payments';

/**
 * The pure rules and the migration say the same words.
 *
 * `actions.ts` and `20260929320000_student_accounts.sql` make the same
 * decisions twice, once for the tests and the screen and once for the
 * database, and the failure that invites is a kind or a status one side
 * knows and the other refuses. So each closed list is read out of the SQL
 * check constraint that holds it and compared, both ways.
 */

const SQL = readFileSync(join(import.meta.dirname, '../../../../supabase/migrations/20260929320000_student_accounts.sql'), 'utf8');

/** The quoted words in `<column> ... check (<column> in (...))`, for the first table declaring that column. */
function listed(column: string, after = ''): string[] {
  const from = after ? SQL.indexOf(after) : 0;
  expect(from, `${after} is in the migration`).toBeGreaterThanOrEqual(0);
  const m = new RegExp(`\\b${column}\\s+text[^\\n]*check \\(${column} in \\(([^)]*)\\)`, 'm').exec(SQL.slice(from));
  expect(m, `a check on ${column}`).not.toBeNull();
  return [...(m?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
}

/** The same, for a check that spans lines (the outcome list). */
function listedAcross(column: string): string[] {
  const m = new RegExp(`\\b${column}\\s+text[^;]*?check \\(${column} in \\(([\\s\\S]*?)\\)\\)`, 'm').exec(SQL);
  expect(m, `a check on ${column}`).not.toBeNull();
  return [...(m?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
}

const sorted = (xs: readonly string[]) => [...xs].sort();

describe('the student-account vocabulary, in TS and in SQL', () => {
  it('reads the lists it compares (the control)', () => {
    // A regex that stopped matching would compare two empty lists and pass.
    expect(listed('kind', 'create table if not exists public.student_ledger_entries').length).toBe(6);
    expect(listed('status', 'create table if not exists public.student_aid_awards').length).toBe(4);
  });

  it('agrees on entry kinds, sources and award vocabularies', () => {
    expect(listed('kind', 'create table if not exists public.student_ledger_entries')).toEqual(sorted(ENTRY_KINDS));
    expect(listed('source', 'create table if not exists public.student_ledger_entries'))
      .toEqual(['aid_adapter', 'aid_office', 'bursar', 'provider']);
    expect(listed('kind', 'create table if not exists public.student_aid_awards')).toEqual(sorted(AWARD_KINDS));
    expect(listed('status', 'create table if not exists public.student_aid_awards')).toEqual(sorted(AWARD_STATUSES));
    expect(listed('verification')).toEqual(sorted(VERIFICATIONS));
    expect(listed('sap')).toEqual(sorted(SAPS));
  });

  it('agrees on provider events and every outcome that is recorded', () => {
    expect(listed('kind', 'create table if not exists public.student_payment_events')).toEqual(sorted(EVENT_KINDS));
    const recorded = APPLY_OUTCOMES.filter((o) => o !== 'duplicate' && o !== 'replay_conflict');
    expect(listedAcross('outcome')).toEqual(sorted(recorded));
    // And the two that record nothing are the webhook function's own answers.
    expect(SQL).toContain("then 'duplicate' else 'replay_conflict' end");
  });

  it('names the same capabilities, and grants each to the office that needs it', () => {
    for (const cap of Object.values(CAPABILITIES)) expect(SQL, cap).toContain(`('${cap}',`);
    expect(SQL).toMatch(/\('student_accounts_officer', 'bursar:post'\)/);
    expect(SQL).toMatch(/\('financial_aid_officer',\s+'aid:manage'\)/);
    expect(SQL).toMatch(/\('registrar',\s+'hold:read'\)/);
  });

  it('gates on the registered module flag', () => {
    expect(FLAG_KEYS.has(MODULE_FLAG)).toBe(true);
    expect(SQL).toContain(`public.feature_state('${MODULE_FLAG}', want_school) <> 'off'`);
  });

  it('never lets a client call the adapter or the webhook', () => {
    for (const fn of ['sync_aid_award', 'apply_aid_disbursement', 'apply_student_payment_event']) {
      expect(SQL, fn).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`));
      expect(SQL, fn).not.toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to [^;]*authenticated`));
    }
  });
});
