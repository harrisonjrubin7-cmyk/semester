import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_SUBMISSION,
  ASSESSMENT_SUBMISSION_STATES,
  DATA_DELETION,
  DATA_DELETION_STATES,
  GRADE_PASSBACK,
  GRADE_PASSBACK_STATES,
  ORGANIZATION_RECOGNITION,
  ORGANIZATION_RECOGNITION_STATES,
  SUPPORT_ACCESS,
  SUPPORT_ACCESS_STATES,
  WORKFLOWS,
  transition,
  walk,
  type WorkflowDefinition,
} from './workflow.ts';

/**
 * Every machine is checked the same three ways: its declared state list and
 * its transition table agree; every state is reachable from the initial one
 * and every non-terminal state can reach a terminal one; and — the part a
 * happy-path test never does — every pair of states not in the table is
 * refused. The last is the guard the specification's examples turn on: a
 * submitted assessment cannot go back to in_progress, and a grade cannot be
 * reconciled without an acknowledgement.
 */

const machines: Array<[WorkflowDefinition, readonly string[]]> = [
  [ASSESSMENT_SUBMISSION, ASSESSMENT_SUBMISSION_STATES],
  [SUPPORT_ACCESS, SUPPORT_ACCESS_STATES],
  [DATA_DELETION, DATA_DELETION_STATES],
  [ORGANIZATION_RECOGNITION, ORGANIZATION_RECOGNITION_STATES],
  [GRADE_PASSBACK, GRADE_PASSBACK_STATES],
];

describe.each(machines)('$type', (def, states) => {
  it('declares every state it uses, and uses every state it declares', () => {
    expect(Object.keys(def.transitions).sort()).toEqual([...states].sort());
    for (const [from, targets] of Object.entries(def.transitions)) {
      for (const to of targets) expect(states, `${from} → ${to}`).toContain(to);
    }
    for (const t of def.terminal) expect(def.transitions[t]).toEqual([]);
    for (const [from, to] of def.exceptional) expect(def.transitions[from]).toContain(to);
  });

  it('reaches every state from the start, and an end from every state', () => {
    const reached = new Set<string>([def.initial]);
    const queue = [def.initial];
    while (queue.length) {
      for (const next of def.transitions[queue.shift()!]) {
        if (!reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
    expect([...reached].sort()).toEqual([...states].sort());

    const endsFrom = (s: string, seen = new Set<string>()): boolean => {
      if (def.terminal.includes(s)) return true;
      if (seen.has(s)) return false;
      seen.add(s);
      return def.transitions[s].some((n) => endsFrom(n, seen));
    };
    for (const s of states) expect(endsFrom(s), `${s} can end`).toBe(true);
  });

  it('refuses every move that is not in the table, and nothing that is', () => {
    let refusedCount = 0;
    let allowedCount = 0;
    for (const from of states) {
      for (const to of states) {
        const verdict = transition(def, from, to);
        const legal = def.transitions[from].includes(to);
        expect(verdict.ok, `${from} → ${to}`).toBe(legal);
        if (verdict.ok) allowedCount += 1;
        else refusedCount += 1;
      }
    }
    // The controls: a table that allowed nothing, or refused nothing, would
    // pass the loop above trivially.
    expect(allowedCount).toBeGreaterThan(0);
    expect(refusedCount).toBeGreaterThan(allowedCount);
  });

  it('refuses a state it does not have, in either position', () => {
    expect(transition(def, 'nowhere', def.initial).ok).toBe(false);
    expect(transition(def, def.initial, 'nowhere').ok).toBe(false);
    expect(transition(def, '__proto__', 'constructor').ok).toBe(false);
  });
});

describe('the moves the specification names as illegal', () => {
  it('a submitted assessment cannot be reopened, and an ambiguous one cannot be submitted again', () => {
    expect(transition(ASSESSMENT_SUBMISSION, 'finalized', 'in_progress').ok).toBe(false);
    expect(transition(ASSESSMENT_SUBMISSION, 'receipt_issued', 'in_progress').ok).toBe(false);
    expect(transition(ASSESSMENT_SUBMISSION, 'ambiguous', 'submission_requested').ok).toBe(false);
    expect(transition(ASSESSMENT_SUBMISSION, 'ambiguous', 'finalized').ok).toBe(false);
    expect(walk(ASSESSMENT_SUBMISSION, 'not_started', ['in_progress', 'autosaved', 'ready_to_submit', 'submission_requested', 'finalized', 'receipt_issued'])).toMatchObject({ ok: true, state: 'receipt_issued' });
    expect(walk(ASSESSMENT_SUBMISSION, 'in_progress', ['recovery_required', 'restored', 'in_progress'])).toMatchObject({ ok: true });
    expect(transition(ASSESSMENT_SUBMISSION, 'in_progress', 'recovery_required')).toMatchObject({ ok: true, exceptional: true });
    expect(transition(ASSESSMENT_SUBMISSION, 'in_progress', 'autosaved')).toMatchObject({ ok: true, exceptional: false });
  });

  it('a grade is not passed back before the gradebook acknowledged it', () => {
    expect(transition(GRADE_PASSBACK, 'sent', 'reconciled').ok).toBe(false);
    expect(transition(GRADE_PASSBACK, 'queued', 'reconciled').ok).toBe(false);
    expect(transition(GRADE_PASSBACK, 'ambiguous', 'sent').ok).toBe(false);
    expect(transition(GRADE_PASSBACK, 'ambiguous', 'queued').ok).toBe(false);
    expect(walk(GRADE_PASSBACK, 'draft', ['ready_for_validation', 'authorized', 'queued', 'retry', 'queued', 'sent', 'acknowledged', 'reconciled'])).toMatchObject({ ok: true, state: 'reconciled' });
  });

  it('nothing is deleted without the legal hold being checked', () => {
    expect(transition(DATA_DELETION, 'scope_confirmed', 'deletion_scheduled').ok).toBe(false);
    expect(transition(DATA_DELETION, 'received', 'deletion_completed').ok).toBe(false);
    expect(transition(DATA_DELETION, 'retained_with_explanation', 'deletion_scheduled').ok).toBe(false);
    expect(walk(DATA_DELETION, 'received', ['identity_verified', 'scope_confirmed', 'legal_hold_checked', 'deletion_scheduled', 'deletion_completed', 'certificate_available'])).toMatchObject({ ok: true });
  });

  it('a revoked or expired support grant does not come back', () => {
    expect(transition(SUPPORT_ACCESS, 'revoked', 'active').ok).toBe(false);
    expect(transition(SUPPORT_ACCESS, 'expired', 'active').ok).toBe(false);
    expect(transition(SUPPORT_ACCESS, 'declined', 'requested').ok).toBe(false);
  });

  it('recognition is given by the review, never taken by the organization', () => {
    expect(transition(ORGANIZATION_RECOGNITION, 'draft', 'active').ok).toBe(false);
    expect(transition(ORGANIZATION_RECOGNITION, 'submitted', 'active').ok).toBe(false);
    expect(transition(ORGANIZATION_RECOGNITION, 'under_review', 'active').ok).toBe(true);
    expect(transition(ORGANIZATION_RECOGNITION, 'inactive', 'active').ok).toBe(true);
    expect(transition(ORGANIZATION_RECOGNITION, 'dissolved', 'active').ok).toBe(false);
    expect(transition(ORGANIZATION_RECOGNITION, 'dissolved', 'draft').ok).toBe(false);
  });

  it('walk stops at the first refusal and says which', () => {
    const verdict = walk(GRADE_PASSBACK, 'draft', ['ready_for_validation', 'reconciled']);
    expect(verdict).toMatchObject({ ok: false, reason: 'grade_passback: "ready_for_validation" cannot become "reconciled"' });
  });

  it('the registry names each machine by its own type', () => {
    for (const [name, def] of Object.entries(WORKFLOWS)) expect(def.type).toBe(name);
  });
});
