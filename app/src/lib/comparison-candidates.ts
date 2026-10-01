import type { AssumptionAdapter } from './assumptions';
import type { ComparisonCandidate } from './comparison-actions';
import type { CatalogCourse } from './registration';
import { meetingLine } from './course-detail';
/** Select serializable metadata and the applied value, never functions or draft state. */
export const appliedAssumptions = (items: AssumptionAdapter[]) => items.map(({ id, label, value, owner, source }) => `Assumption ${id} · ${label}: ${value || 'Not supplied'} (${owner}); source: ${source}`);
export function courseCandidate(c: CatalogCourse, importedAt: string | null = null): ComparisonCandidate {
  const facts = [
    `Source: imported catalog; imported at: ${importedAt || 'Unknown'}`,
    `Course: ${c.code} · ${c.section} · ${c.title}; term: ${c.term}; credits: ${c.credits}`,
    `Meetings: ${meetingLine(c)}; location: ${c.location || 'Unknown'}; instructor: ${c.instructor || 'Unknown'}`,
    `Prerequisites: ${c.prerequisites || 'None listed; confirm with the institution'}`,
    `Seats from file: ${c.seats === null ? 'Unknown' : c.seats}; live availability and eligibility: Unknown`,
    `Official next step: confirm with your advisor and registrar before registering.`,
  ];
  return { id: c.id, label: `${c.code} · ${c.section}`, context: facts, advisorContext: facts };
}
