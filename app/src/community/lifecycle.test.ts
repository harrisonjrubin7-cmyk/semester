import { describe, expect, it } from 'vitest';
import { ORGANIZATION_RECOGNITION, ORGANIZATION_RECOGNITION_STATES } from '../../../packages/institution/src/workflow';
import {
  APPEAL_ROUTE, NEEDS_FOLLOW_UP, OFFICER_TRANSITION, SEATS, STUDENT_VISIBLE, WHO_MAY, mayRotateAccess, nextTransitionStep, recordTransition,
  type Seat, type State,
} from './lifecycle';

/**
 * Every legal move in the machine has at least one seat that may make it and
 * every illegal one has none; every state has words a member can read; and a
 * record is refused without the things the blueprints say a transition
 * carries.
 */

const req = (from: State, to: State, seat: Seat, over: Partial<Parameters<typeof recordTransition>[0]> = {}) => ({
  organization: 'transfer-student-association', from, to, actor: { id: 'u1', seat },
  reason: 'The constitution review found the membership section complete.', effectiveDate: '2026-10-01', today: '2026-09-28', ...over,
});

describe('who may move an organization', () => {
  it('every legal move has a seat, and no illegal move has one', () => {
    for (const from of ORGANIZATION_RECOGNITION_STATES) {
      for (const to of ORGANIZATION_RECOGNITION_STATES) {
        const legal = ORGANIZATION_RECOGNITION.transitions[from].includes(to);
        const seats = WHO_MAY[`${from}->${to}`];
        if (legal) expect(seats?.length, `${from}->${to} is legal and nobody may make it`).toBeGreaterThan(0);
        else expect(seats, `${from}->${to} is illegal and a seat may make it`).toBeUndefined();
      }
    }
    for (const seats of Object.values(WHO_MAY)) for (const s of seats!) expect(SEATS).toContain(s);
  });

  it('recognition is the institution\'s; submission and dissolution are the president\'s', () => {
    expect(WHO_MAY['under_review->active']).toEqual(['campus_administrator']);
    expect(WHO_MAY['draft->submitted']).toEqual(['president']);
    expect(WHO_MAY['active->dissolved']).toContain('president');
    expect(WHO_MAY['active->dissolved']).not.toContain('officer');
    expect(WHO_MAY['active->dissolved']).not.toContain('advisor');
  });

  it('an advisor decides nothing but a return to draft', () => {
    const advisorMoves = Object.entries(WHO_MAY).filter(([, seats]) => seats!.includes('advisor')).map(([m]) => m);
    expect(advisorMoves).toEqual(['under_review->draft']);
  });

  it('every state has words for members', () => {
    for (const s of ORGANIZATION_RECOGNITION_STATES) expect(STUDENT_VISIBLE[s].length, s).toBeGreaterThan(10);
  });
});

describe('the record a move leaves', () => {
  it('carries approver, reason, effective date, follow-up, the student-visible status, the appeal route and an audit event', () => {
    const v = recordTransition(req('under_review', 'active', 'campus_administrator'));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.record.approver).toEqual({ id: 'u1', seat: 'campus_administrator' });
    expect(v.record.studentVisible).toBe(STUDENT_VISIBLE.active);
    expect(v.record.appealRoute).toBe(APPEAL_ROUTE);
    expect(v.record.followUp).toBeNull();
    expect(v.record.audit).toEqual({ event: 'organization_recognition_changed', at: '2026-09-28', from: 'under_review', to: 'active', actorId: 'u1', seat: 'campus_administrator', exceptional: false });
  });

  it('refuses an illegal move with the machine\'s own words', () => {
    const v = recordTransition(req('draft', 'active', 'campus_administrator'));
    expect(v).toEqual({ ok: false, reason: 'organization_recognition: "draft" cannot become "active"' });
  });

  it('refuses the wrong seat', () => {
    const v = recordTransition(req('under_review', 'active', 'president'));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/president cannot move/);
  });

  it('refuses no reason, a date in the past, and a conditions move with no follow-up', () => {
    expect(recordTransition(req('draft', 'submitted', 'president', { reason: 'ok' })).ok).toBe(false);
    expect(recordTransition(req('draft', 'submitted', 'president', { effectiveDate: '2026-09-27' })).ok).toBe(false);
    expect(recordTransition(req('draft', 'submitted', 'president', { effectiveDate: 'soon' })).ok).toBe(false);
    for (const move of NEEDS_FOLLOW_UP) {
      const [from, to] = move.split('->') as [State, State];
      const seat = WHO_MAY[move]![0];
      expect(recordTransition(req(from, to, seat)).ok, move).toBe(false);
      const with_ = recordTransition(req(from, to, seat, { followUp: 'Add the officer transition section by 15 October.' }));
      expect(with_.ok, move).toBe(true);
      if (with_.ok) expect(with_.record.audit.exceptional).toBe(true);
    }
  });
});

describe('the officer transition', () => {
  it('is the nine steps, in order, and access rotates only after the incoming officers are confirmed and own the workspace', () => {
    expect(OFFICER_TRANSITION).toHaveLength(9);
    expect(nextTransitionStep([])).toBe('confirm');
    expect(mayRotateAccess(['confirm'])).toBe(false);
    expect(mayRotateAccess(['transfer'])).toBe(false);
    expect(mayRotateAccess(['confirm', 'transfer'])).toBe(true);
    expect(nextTransitionStep(['confirm', 'transfer'])).toBe('rotate');
    expect(nextTransitionStep(OFFICER_TRANSITION.map((s) => s.id))).toBeNull();
  });
});
