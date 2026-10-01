import { describe, expect, it } from 'vitest';
import { confidenceFromSource, decideConfidence } from './assistant-confidence';

const ready = {
  sourceAuthority: 'official' as const,
  sourceFresh: true,
  requiredFieldsComplete: true,
  sourceConflict: false,
  permissionAllowed: true,
  policyAllowed: true,
  actionRisk: 'low' as const,
};

describe('assistant confidence', () => {
  it('fails closed on permission and policy before considering the source', () => {
    expect(decideConfidence({ ...ready, permissionAllowed: false })).toBe('cannot_safely_assist');
    expect(decideConfidence({ ...ready, policyAllowed: false })).toBe('cannot_safely_assist');
  });

  it('requires review for stale, incomplete or conflicting context', () => {
    expect(decideConfidence({ ...ready, sourceFresh: false })).toBe('needs_review');
    expect(decideConfidence({ ...ready, requiredFieldsComplete: false })).toBe('needs_review');
    expect(decideConfidence({ ...ready, sourceConflict: true })).toBe('needs_review');
  });

  it('requires an official source for high-risk guidance', () => {
    expect(decideConfidence({ ...ready, sourceAuthority: 'student', actionRisk: 'high' })).toBe('needs_review');
    expect(decideConfidence({ ...ready, actionRisk: 'high' })).toBe('institution_verified');
  });

  it('maps the app source vocabulary without inventing a trust percentage', () => {
    expect(confidenceFromSource('institution_verified')).toBe('institution_verified');
    expect(confidenceFromSource('imported')).toBe('confirmed_context');
    expect(confidenceFromSource('student_entered')).toBe('confirmed_context');
    expect(confidenceFromSource('estimated')).toBe('planning_estimate');
    expect(confidenceFromSource('needs_review')).toBe('needs_review');
  });
});
