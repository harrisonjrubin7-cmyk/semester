import { MIN_COHORT } from '../institution-ops';

/**
 * Comparing an outcome between groups without publishing a small group.
 *
 * This is the computation behind the `equity_gap` metric in `institution-ops`,
 * which is defined, marked sensitive and needs a named reviewer who is not its
 * author, and is computed nowhere. No demographic data reaches this code (the
 * owner says some is collected elsewhere, and this repository cannot confirm
 * what), so nothing calls this today: it is here so that data collected with
 * consent and under governance is not met by suppression rules written for the
 * first time on a sensitive figure.
 *
 * ## What it refuses to show
 *
 * A rate is `acted / eligible`, and a rate over a small group gives the counts
 * back: 3 of 8 is 37.5%, and anyone who knows 8 knows 3. So a group's rate is
 * shown only when *all three* of its counts clear the floor — the group, those
 * who acted, and those who did not — and the gap between groups is computed
 * only when *every* group is shown, because a gap against "everyone else"
 * minus a hidden group is the hidden group, recovered by subtraction.
 *
 * It describes a difference. It does not say the difference is unfair, that
 * it is significant, or what caused it, and it returns no per-student figure.
 */

export interface GroupOutcome {
  group: string;
  /** Students who could have acted. */
  eligible: number;
  /** Of those, how many did. */
  acted: number;
}

export interface GroupRate {
  group: string;
  rate: number | null;
  why?: 'small' | 'invalid';
}

export interface Comparison {
  rows: GroupRate[];
  gap: { highest: string; lowest: string; points: number; ratio: number } | null;
  note: string;
}

const count = (n: number) => Number.isInteger(n) && n >= 0;

export function compareOutcomes(groups: readonly GroupOutcome[], min = MIN_COHORT): Comparison {
  const rows: GroupRate[] = [...groups]
    .sort((a, b) => a.group.localeCompare(b.group))
    .map((g): GroupRate => {
      if (!count(g.eligible) || !count(g.acted) || g.acted > g.eligible) return { group: g.group, rate: null, why: 'invalid' };
      if (g.eligible < min || g.acted < min || g.eligible - g.acted < min) return { group: g.group, rate: null, why: 'small' };
      return { group: g.group, rate: g.acted / g.eligible };
    });
  const shown = rows.filter((r): r is GroupRate & { rate: number } => r.rate !== null);
  if (rows.length < 2) return { rows, gap: null, note: 'There is only one group, so there is nothing to compare.' };
  if (shown.length < rows.length) {
    return { rows, gap: null, note: 'At least one group is too small to show, so no comparison is made: a gap against a hidden group would give it back.' };
  }
  const hi = shown.reduce((a, b) => (b.rate > a.rate ? b : a));
  const lo = shown.reduce((a, b) => (b.rate < a.rate ? b : a));
  return {
    rows,
    gap: { highest: hi.group, lowest: lo.group, points: (hi.rate - lo.rate) * 100, ratio: lo.rate === 0 ? Infinity : hi.rate / lo.rate },
    note: 'A difference in rates, not a finding of unfairness: it says nothing about cause or significance.',
  };
}
