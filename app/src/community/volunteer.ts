/**
 * The volunteer moderator program — built, and switched off.
 *
 * Jodel showed volunteer review can work at scale: minimum karma plus
 * behaviour for eligibility, control tasks with known answers, the last
 * twenty control decisions worth 5% each, and reviewers who drift losing their
 * status. Semester keeps the calibration and drops the karma, because there is
 * no karma. Eligibility is verification, account age, a clean record,
 * training, a signed confidentiality agreement, a recusal process and a
 * passed calibration set.
 *
 * Volunteers only ever see P3 and a narrow set of clear P2 queues (see
 * moderation.ts `mayDecide`), in blind view, within hourly and daily caps.
 */

export interface VolunteerRecord {
  accountId: string;
  verified: boolean;
  accountCreatedAt: string;
  activeRestriction: boolean;
  trainingCompletedAt?: string;
  confidentialitySignedAt?: string;
  recusalAcknowledgedAt?: string;
  /** Results of the 20 onboarding calibration tasks. */
  calibration: boolean[];
  /** Most recent control-task results, newest last. */
  controls: boolean[];
  revokedAt?: string;
}

export const VOLUNTEER_RULES = {
  minAccountAgeDays: 30,
  calibrationTasks: 20,
  calibrationPass: 0.85,
  qualityWindow: 20,
  /** Each of the last 20 control decisions is worth 5%. */
  qualityStep: 5,
  activeAt: 85,
  pauseBelow: 75,
  perHour: 20,
  perDay: 100,
} as const;

export type VolunteerStatus = 'ineligible' | 'onboarding' | 'active' | 'probation' | 'paused' | 'revoked';

export function eligibility(v: VolunteerRecord, now: Date): { eligible: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!v.verified) missing.push('verification');
  const ageDays = (now.getTime() - new Date(v.accountCreatedAt).getTime()) / 86_400_000;
  if (ageDays < VOLUNTEER_RULES.minAccountAgeDays) missing.push('30-day account age');
  if (v.activeRestriction) missing.push('no active restrictions');
  if (!v.trainingCompletedAt) missing.push('training');
  if (!v.confidentialitySignedAt) missing.push('confidentiality agreement');
  if (!v.recusalAcknowledgedAt) missing.push('recusal process');
  return { eligible: missing.length === 0, missing };
}

export function calibrationPassed(v: VolunteerRecord): boolean {
  if (v.calibration.length < VOLUNTEER_RULES.calibrationTasks) return false;
  const right = v.calibration.slice(-VOLUNTEER_RULES.calibrationTasks).filter(Boolean).length;
  return right / VOLUNTEER_RULES.calibrationTasks >= VOLUNTEER_RULES.calibrationPass;
}

/** Rolling quality: the last 20 control tasks, 5 points each. Null until there are 20. */
export function quality(v: VolunteerRecord): number | null {
  if (v.controls.length < VOLUNTEER_RULES.qualityWindow) return null;
  return v.controls.slice(-VOLUNTEER_RULES.qualityWindow).filter(Boolean).length * VOLUNTEER_RULES.qualityStep;
}

export function status(v: VolunteerRecord, now: Date): VolunteerStatus {
  if (v.revokedAt) return 'revoked';
  if (!eligibility(v, now).eligible) return 'ineligible';
  if (!calibrationPassed(v)) return 'onboarding';
  const q = quality(v);
  if (q === null) return 'active';
  if (q >= VOLUNTEER_RULES.activeAt) return 'active';
  if (q < VOLUNTEER_RULES.pauseBelow) return 'paused';
  return 'probation';
}

/** Whether another review fits inside the hourly and daily caps. */
export function withinCaps(reviewTimes: string[], now: Date): boolean {
  const t = now.getTime();
  const lastHour = reviewTimes.filter((r) => t - new Date(r).getTime() < 3_600_000).length;
  const lastDay = reviewTimes.filter((r) => t - new Date(r).getTime() < 86_400_000).length;
  return lastHour < VOLUNTEER_RULES.perHour && lastDay < VOLUNTEER_RULES.perDay;
}

/**
 * Recusal: a volunteer never reviews content from a community they belong to
 * in a leadership role, from somebody they have blocked or been blocked by,
 * or anything they reported themselves.
 */
export function mustRecuse(args: {
  volunteerId: string;
  reporterIds: string[];
  ledCommunities: string[];
  caseCommunityId: string;
  blockedEitherWay: boolean;
}): boolean {
  return (
    args.reporterIds.includes(args.volunteerId) ||
    args.ledCommunities.includes(args.caseCommunityId) ||
    args.blockedEitherWay
  );
}
