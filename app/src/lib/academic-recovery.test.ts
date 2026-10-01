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
  });

  it('fails uncertain source changes into review rather than official certainty', () => {
    expect(recoveryPlan('source_unavailable').confidence).toBe('needs_review');
    expect(recoveryPlan('course_changed').confidence).toBe('needs_review');
  });
});
