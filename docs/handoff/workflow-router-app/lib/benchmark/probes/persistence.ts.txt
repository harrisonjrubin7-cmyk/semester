import type { PersistenceMode } from '../benchmark.config';
export interface PersistenceObservation { tested: boolean; survivedReload: boolean | null; mode: PersistenceMode; evidence?: string }
/**
 * The highest persistence grade a run may receive. Local UI state never earns more than 2:
 * "do not award high persistence scores merely because a UI has local state."
 */
export function persistenceCeiling(o: PersistenceObservation, required: boolean): number {
  if (!o.tested) return required ? 0 : 5;
  if (!o.survivedReload) return 0;
  if (!o.evidence) return 1;
  switch (o.mode) {
    case 'none': case 'local-preview': return 1;
    case 'browser-local': case 'session': return 2;
    case 'database': case 'project-backed': return 5;
  }
}
export function clampPersistenceGrade(grade: number | null, o: PersistenceObservation, required: boolean): number | null {
  return grade === null ? null : Math.min(grade, persistenceCeiling(o, required));
}
