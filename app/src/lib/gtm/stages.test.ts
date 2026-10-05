import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_STATUSES, ACCOUNT_STATUS_OF, SALES_EXIT, SALES_STAGES, salesMoveProblems } from './stages';

const root = join(import.meta.dirname, '../../../..');

describe('sales stages', () => {
  it('lets an opportunity step forward and close from anywhere — the control', () => {
    expect(salesMoveProblems('target_account', 'discovery')).toEqual([]);
    expect(salesMoveProblems('proposal', 'closed_lost')).toEqual([]);
  });

  it('refuses a skip over a gated stage, and names the gate', () => {
    const skip = salesMoveProblems('discovery', 'proposal');
    expect(skip.some((p) => p.startsWith('Skips qualified'))).toBe(true);
    expect(skip.some((p) => p.startsWith('Skips outcome_workshop'))).toBe(true);
  });

  it('never goes live without passing the contract and the council', () => {
    expect(salesMoveProblems('proposal', 'live').map((p) => p.split(':')[0])).toEqual([
      'Skips pilot_or_implementation_SOW', 'Skips contracted', 'Enters live without',
    ]);
  });

  it('holds the stage being entered to its own gate', () => {
    // contracted → live skips nothing gated, and still needs the launch council.
    expect(salesMoveProblems('contracted', 'live')).toEqual([`Enters live without: ${SALES_EXIT.live}`]);
    expect(salesMoveProblems('contracted', 'live', new Set(['live']))).toEqual([]);
    expect(salesMoveProblems('target_account', 'qualified')[0]).toMatch(/^Enters qualified without/);
    // An ungated stage needs nothing.
    expect(salesMoveProblems('renewal', 'expansion')).toEqual([]);
  });

  it('does not move backwards or reopen a lost deal', () => {
    expect(salesMoveProblems('proposal', 'discovery')[0]).toMatch(/comes before/);
    expect(salesMoveProblems('closed_lost', 'discovery')[0]).toMatch(/new target account/);
  });
});

describe('the mapping onto #817’s account status', () => {
  it('gives every stage a status, and never moves an account backwards as the stage advances', () => {
    const order = ACCOUNT_STATUSES.filter((s) => s !== 'paused' && s !== 'closed_lost');
    let last = -1;
    for (const stage of SALES_STAGES.filter((s) => s !== 'closed_lost')) {
      const at = order.indexOf(ACCOUNT_STATUS_OF[stage] as (typeof order)[number]);
      expect(at, stage).toBeGreaterThanOrEqual(last);
      last = at;
    }
    expect(ACCOUNT_STATUS_OF.closed_lost).toBe('closed_lost');
  });

  /*
   * Forward-compatible. Until #817 is on main there is no migration to read,
   * and the test says so rather than passing silently on nothing: the first
   * assertion is that the probe either found the table or found no migration
   * that creates it.
   */
  it('matches gtm_accounts.status in the migration, once that migration exists', () => {
    const dir = join(root, 'supabase/migrations');
    const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    const table = /create table if not exists public\.gtm_accounts \(([\s\S]*?)\n\);/.exec(sql)?.[1];
    if (!table) {
      expect(sql).not.toMatch(/gtm_accounts/);
      return;
    }
    const check = /status\s+text[\s\S]*?check \(status in \(([\s\S]*?)\)\)/.exec(table)?.[1] ?? '';
    const values = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(values.length).toBeGreaterThan(0);
    expect([...ACCOUNT_STATUSES].sort()).toEqual(values.sort());
    expect(existsSync(join(root, 'app/src/lib/gtm/pilot.ts'))).toBe(true);
  });
});
