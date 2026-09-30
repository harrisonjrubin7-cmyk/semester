/**
 * Whether student accounts are on for a school: off, until three things are true.
 *
 * 1. The school has turned `module.student_accounts` on — a row in
 *    `public.tenant_feature_policy`, the same row `lib/flags.ts` evaluates.
 *    Nothing defaults on.
 * 2. The school has named a finance owner: an account at that school holding
 *    `bursar:post`, recorded in `public.student_account_settings`. Money with
 *    nobody accountable for it is not a feature a school can switch on by
 *    ticking a box, so the database refuses every posting while the seat is
 *    empty (`private.student_accounts_on`), and this refuses the same. The
 *    database also asks, at every write, whether the named owner still has a
 *    profile at the school and a live `bursar:post` grant there — revoked or
 *    expired, the module is off. A client cannot read another person's
 *    grants, so that half is the database's alone.
 * 3. Semester's own council has somebody in its finance seat
 *    (`COUNCIL` in `lib/launchreadiness.ts`, D-118). The seat is vacant on
 *    this tree, which is why this module is off everywhere today and why the
 *    test that says so reads the real council rather than a copy.
 *
 * The first two are enforced by the database as well; the third is a launch
 * condition the database has no row for, and is held here.
 */

import type { FeatureState } from '../../intelligence/contracts';
import { COUNCIL } from '../launchreadiness';

export const MODULE_FLAG = 'module.student_accounts';

export interface GateInput {
  /** `feature_state('module.student_accounts', school)`. */
  moduleState: FeatureState;
  /** The institution's named finance owner, or null. */
  financeOwner: string | null;
  /**
   * Who holds Semester's council finance seat. Defaults to the real council;
   * a test passes a holder to reach the rest of the module.
   */
  councilFinanceHolder?: string | null;
}

export type GateCode = 'module_off' | 'no_finance_owner' | 'finance_seat_vacant';

export type GateDecision = { on: true; reason: string } | { on: false; code: GateCode; reason: string };

export function councilFinanceHolder(): string | null {
  return COUNCIL.find((s) => s.seat === 'finance')?.holder ?? null;
}

export function gate(input: GateInput): GateDecision {
  if (input.moduleState === 'off') {
    return { on: false, code: 'module_off', reason: `${MODULE_FLAG} is off for this school.` };
  }
  if (!input.financeOwner) {
    return { on: false, code: 'no_finance_owner', reason: 'This school has not named a finance owner for student accounts.' };
  }
  const holder = input.councilFinanceHolder === undefined ? councilFinanceHolder() : input.councilFinanceHolder;
  if (!holder) {
    return { on: false, code: 'finance_seat_vacant', reason: 'Semester’s council finance seat is vacant, so no school’s student accounts go live.' };
  }
  return { on: true, reason: `On, with a named finance owner, and ${holder} holding the council finance seat.` };
}
