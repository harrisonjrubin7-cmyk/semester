import { describe, expect, it } from 'vitest';
import { DOMAINS } from './domains';
import { MIN_CLEAN, WORKFLOWS, earliestExit, evaluateParallel, type Explained, type Observation } from './parallel';

const obs = (workflow: string, cycle: number, a: Record<string, number | string>, b = a, event?: Observation['event']): Observation => ({ workflow, cycle, observedAt: `2026-12-0${cycle}T00:00:00Z`, event, incumbent: a, semester: b });
const FIN = ['finance'] as const;

describe('the parallel run', () => {
  it('has a workflow for every domain, each naming the real event it must include', () => {
    expect(new Set(WORKFLOWS.map((w) => w.domain))).toEqual(new Set(DOMAINS.map((d) => d.id)));
    for (const w of WORKFLOWS) expect(w.outcomes.length).toBeGreaterThan(0);
  });

  it('accepts a high-stakes workflow only after enough clean cycles in a row, one of them the real event', () => {
    const clean = (n: number) => Array.from({ length: n }, (_, i) => obs('finance.billing', i + 1, { statement_total_cents: 1000 }, { statement_total_cents: 1000 }, i === 1 ? 'billing_cycle' : undefined));
    const input = { domains: FIN, explained: [], openIncidents: 0 };
    const two = evaluateParallel({ ...input, observations: [...clean(2), ...clean(2).map((o) => ({ ...o, workflow: 'finance.payments' }))] });
    expect(two.accepted).toBe(false);
    expect(two.reasons.join(' ')).toContain(`2 clean cycles in a row; ${MIN_CLEAN.high} needed`);
    const three = evaluateParallel({ ...input, observations: [...clean(3), ...clean(3).map((o) => ({ ...o, workflow: 'finance.payments', event: 'payment_posting' as const }))] });
    expect(three).toMatchObject({ accepted: true, reasons: [] });
  });

  it('does not count a month of ordinary days as proof of the day that matters', () => {
    const days = Array.from({ length: 5 }, (_, i) => obs('finance.billing', i + 1, { due_date: 'a' }));
    const v = evaluateParallel({ domains: FIN, observations: days, explained: [], openIncidents: 0 });
    expect(v.workflows.find((w) => w.workflow === 'finance.billing')).toMatchObject({ accepted: false, exercisedEvent: false });
    expect(v.reasons.join(' ')).toContain('no clean cycle exercised billing_cycle');
  });

  it('treats a single cent as a difference in a high-stakes domain and ignores rounding dust in a standard one', () => {
    const fin = [1, 2, 3].map((c) => obs('finance.billing', c, { statement_total_cents: 1000 }, { statement_total_cents: c === 3 ? 1001 : 1000 }, 'billing_cycle'));
    const f = evaluateParallel({ domains: FIN, observations: fin, explained: [], openIncidents: 0 });
    expect(f.workflows.find((w) => w.workflow === 'finance.billing')!.unexplained[0]).toMatchObject({ field: 'statement_total_cents', cycle: 3 });
    const std = [1, 2].map((c) => obs('courses.schedule', c, { capacity: 30 }, { capacity: 30.004 }, 'schedule_publication'));
    expect(evaluateParallel({ domains: ['courses'], observations: std, explained: [], openIncidents: 0 }).accepted).toBe(true);
  });

  it('lets a recorded explanation stand and refuses one without a name or a real reason', () => {
    const diff = [1, 2, 3].map((c) => obs('finance.billing', c, { late_fee_cents: 500 }, { late_fee_cents: 0 }, 'billing_cycle'));
    const other = (['finance.payments'] as const).flatMap((w) => [1, 2, 3].map((c) => obs(w, c, { receipt: 'r' }, { receipt: 'r' }, 'payment_posting')));
    const ok: Explained = { workflow: 'finance.billing', field: 'late_fee_cents', approvedBy: 'bursar', reason: 'The registrar waived late fees for the migration term.' };
    expect(evaluateParallel({ domains: FIN, observations: [...diff, ...other], explained: [ok], openIncidents: 0 }).accepted).toBe(true);
    expect(evaluateParallel({ domains: FIN, observations: [...diff, ...other], explained: [{ ...ok, reason: 'fine' }], openIncidents: 0 }).accepted).toBe(false);
    expect(evaluateParallel({ domains: FIN, observations: [...diff, ...other], explained: [{ ...ok, approvedBy: ' ' }], openIncidents: 0 }).accepted).toBe(false);
  });

  it('resets on a difference: earlier clean cycles do not carry over it', () => {
    const o = [obs('courses.schedule', 1, { capacity: 1 }), obs('courses.schedule', 2, { capacity: 1 }), obs('courses.schedule', 3, { capacity: 1 }, { capacity: 9 }, 'schedule_publication'), obs('courses.schedule', 4, { capacity: 1 })];
    const v = evaluateParallel({ domains: ['courses'], observations: o, explained: [], openIncidents: 0 });
    expect(v.workflows[0].cleanTail).toBe(1);
    expect(v.accepted).toBe(false);
  });

  it('refuses while a Sev-1 or Sev-2 incident is open, and a workflow with no observations', () => {
    expect(evaluateParallel({ domains: ['courses'], observations: [], explained: [], openIncidents: 0 }).reasons.join()).toContain('no observations');
    const good = [1, 2].map((c) => obs('courses.schedule', c, { capacity: 1 }, { capacity: 1 }, 'schedule_publication'));
    expect(evaluateParallel({ domains: ['courses'], observations: good, explained: [], openIncidents: 2 }).reasons.join()).toContain('2 Sev-1 or Sev-2 incidents are open');
  });
});

describe('when the parallel run can honestly end', () => {
  const calendar = { registration_window: ['2027-04-05'], add_drop_period: ['2027-04-20'], billing_cycle: ['2027-01-15'], payment_posting: ['2027-01-20'] };

  it('is not before the real event happens plus the cycles that must follow it', () => {
    // Enrollments: registration on 5 April and add/drop on 20 April, each needing three cycles a week apart.
    expect(earliestExit({ domains: ['finance', 'enrollments'], start: '2026-12-01', cycleDays: 7, calendar })).toEqual({ date: '2027-05-04', blockers: [] });
    expect(earliestExit({ domains: ['finance'], start: '2026-12-01', cycleDays: 7, calendar })).toEqual({ date: '2027-02-03', blockers: [] });
  });

  it('names the missing event instead of skipping the workflow', () => {
    const e = earliestExit({ domains: ['academic_records'], start: '2026-12-01', cycleDays: 7, calendar });
    expect(e.date).toBeNull();
    expect(e.blockers.join(' ')).toContain('academic_records.grade_posting: the calendar has no grade_submission on or after 2026-12-01');
  });

  it('ignores events already past', () => {
    const e = earliestExit({ domains: ['finance'], start: '2027-02-01', cycleDays: 7, calendar });
    expect(e.date).toBeNull();
  });
});
