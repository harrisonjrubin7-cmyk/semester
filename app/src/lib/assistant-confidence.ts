import type { SourceLabel } from './source';

/** Decision readiness, never model certainty and never a score about a student. */
export const CONFIDENCE_LEVELS = [
  'institution_verified',
  'confirmed_context',
  'planning_estimate',
  'needs_review',
  'cannot_safely_assist',
] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type SourceAuthority = 'official' | 'approved' | 'student' | 'public' | 'ai';

export interface ConfidenceInput {
  sourceAuthority: SourceAuthority;
  sourceFresh: boolean;
  requiredFieldsComplete: boolean;
  sourceConflict: boolean;
  permissionAllowed: boolean;
  policyAllowed: boolean;
  actionRisk: 'low' | 'moderate' | 'high';
}

export const CONFIDENCE_TEXT: Record<ConfidenceLevel, string> = {
  institution_verified: 'Institution verified',
  confirmed_context: 'Confirmed context',
  planning_estimate: 'Planning estimate',
  needs_review: 'Needs review',
  cannot_safely_assist: 'Cannot safely assist',
};

/**
 * A fail-closed readiness decision.
 *
 * High-risk work requires an official source even when every other check
 * passes. Missing permission or a policy refusal stops before source quality
 * is considered. The function returns words, not a percentage, so the UI
 * cannot mistake it for precision the inputs do not support.
 */
export function decideConfidence(input: ConfidenceInput): ConfidenceLevel {
  if (!input.permissionAllowed || !input.policyAllowed) return 'cannot_safely_assist';
  if (!input.sourceFresh || !input.requiredFieldsComplete || input.sourceConflict) return 'needs_review';
  if (input.actionRisk === 'high' && input.sourceAuthority !== 'official') return 'needs_review';
  if (input.sourceAuthority === 'official') return 'institution_verified';
  if (input.sourceAuthority === 'approved' || input.sourceAuthority === 'student') return 'confirmed_context';
  if (input.sourceAuthority === 'public' || input.sourceAuthority === 'ai') return 'planning_estimate';
  return 'cannot_safely_assist';
}

/** The existing source vocabulary expressed as decision readiness. */
export function confidenceFromSource(label: SourceLabel): ConfidenceLevel {
  if (label === 'institution_verified') return 'institution_verified';
  if (label === 'imported' || label === 'student_entered') return 'confirmed_context';
  if (label === 'estimated') return 'planning_estimate';
  return 'needs_review';
}
