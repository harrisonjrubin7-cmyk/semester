import { TRUST_TEXT, type TrustKind } from './source';

/**
 * Source for the four registration-readiness surfaces.
 *
 * A seeded fact is the semester the app ships with, or a grade that exists
 * only as fixture data. It is `sample`, even if a caller also claims the
 * figure was institutionally read. The only path to `institution_verified`
 * is a live read that is not seeded. Device arithmetic stays `estimated`.
 * Registration with no live read is `unavailable_stale`. An account's own
 * counts are `student_entered`.
 */
export type PilotSurface = 'today' | 'registration' | 'degree' | 'account';

export function surfaceSource(
  surface: PilotSurface,
  input: { seeded: boolean; institutional?: boolean },
): TrustKind {
  if (input.seeded) return 'sample';
  if (input.institutional) return 'institution_verified';
  if (surface === 'registration') return 'unavailable_stale';
  if (surface === 'account') return 'student_entered';
  return 'estimated';
}

/** A grade figure. Seeded wins over a claim that the figure is institutional. */
export function gradeSource(seeded: boolean, institutional = false): TrustKind {
  return surfaceSource('degree', { seeded, institutional });
}

/** What a student reads. Used by the screen test so a seeded grade cannot say the official word. */
export function gradeSourceText(seeded: boolean, institutional = false): string {
  return TRUST_TEXT[gradeSource(seeded, institutional)];
}
