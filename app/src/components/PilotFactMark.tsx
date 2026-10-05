import { SourceBadge } from './SourceBadge';
import { gradeSource, surfaceSource, type PilotSurface } from '../lib/pilotfacts';

/**
 * Source, and the freshness the badge can say, for one registration-readiness fact.
 *
 * Authority is the badge's meaning sentence: sample and estimated both say
 * the figure was not checked with the institution. A live read is the only
 * one that says institution verified, and `gradeSource` refuses that word
 * for a seeded grade.
 */
export function PilotFactMark({
  surface,
  seeded,
  institutional = false,
  at = null,
}: {
  surface: PilotSurface;
  seeded: boolean;
  institutional?: boolean;
  at?: number | null;
}) {
  return <SourceBadge label={surfaceSource(surface, { seeded, institutional })} at={at} unknownAge={at == null} />;
}

/** The grade figure itself. Seeded data renders as sample. */
export function GradeFactMark({ seeded, at = null }: { seeded: boolean; at?: number | null }) {
  return <SourceBadge label={gradeSource(seeded, false)} at={at} unknownAge={at == null} />;
}
