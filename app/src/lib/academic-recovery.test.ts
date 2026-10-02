import { describe, expect, it } from 'vitest';
import { RECOVERY_PLANS, nextRecoveryStage, recoveryPlan } from './academic-recovery';

describe('academic recovery', () => {
  it('moves only through the explicit review path', () => {
    expect(nextRecoveryStage('identify', 'choose_change')).toBe('assess');
    expect(nextRecoveryStage('assess', 'review_impact')).toBe('offer');
    expect(nextRecoveryStage('offer', 'choose_option')).toBe('continue');
    expect(nextRecoveryStage('identify', 'choose_option')).toBeNull();
  });

  it('keeps every disruption to three relevant options and a preserved state', () => {
    expect(RECOVERY_PLANS.every((plan) => plan.options.length > 0 && plan.options.length <= 3)).toBe(true);
    expect(RECOVERY_PLANS.every((plan) => plan.preserved.length > 0)).toBe(true);
    expect(new Set(RECOVERY_PLANS.map((plan) => plan.category))).toEqual(
      new Set(['protect', 'start', 'clarify', 'decide', 'waiting', 'ask', 'reduce']),
    );
  });

  it('fails uncertain source changes into review rather than official certainty', () => {
    expect(recoveryPlan('source_unavailable').confidence).toBe('needs_review');
    expect(recoveryPlan('course_changed').confidence).toBe('needs_review');
  });

  it('covers overload, unclear work, waiting, short windows, and human help without automatic action', () => {
    for (const kind of ['urgent_overload', 'task_unclear', 'waiting_on', 'time_constrained', 'need_help'] as const) {
      const plan = recoveryPlan(kind);
      expect(plan.options).toHaveLength(3);
      expect(plan.options.every((option) => option.reason.length > 20)).toBe(true);
    }
    expect(recoveryPlan('waiting_on').options.some((option) => /nothing is sent automatically/i.test(option.reason))).toBe(true);
    expect(recoveryPlan('need_help').preserved.join(' ')).toMatch(/private plan/i);
  });

  it('does not offer faculty recovery routes that role gating redirects away from', () => {
    for (const kind of ['missed_action', 'urgent_overload', 'time_constrained'] as const) {
      const plan = recoveryPlan(kind, 'faculty');
      expect(plan.options.length).toBeGreaterThan(0);
      expect(plan.options.some((option) => option.screen === 'behind')).toBe(false);
    }
  });
});
