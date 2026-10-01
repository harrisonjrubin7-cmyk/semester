/** Actual candidate contexts only. No ranking, transactions or implied approval. */
export const COMPARISON_SURFACES = {
  courses: 'Course shortlist',
  schedules: 'Potential schedules',
  backups: 'Registration backups',
  graduation: 'Degree, time and cost scenarios',
  programs: 'Program shortlist and costs',
  abroad: 'Study abroad programs',
  career: 'Career opportunities',
  productivity: 'Productivity decision',
} as const;
export type ComparisonSurface = keyof typeof COMPARISON_SURFACES;
export interface ComparisonCandidate {
  id: string;
  label: string;
  /** Explicit serializable facts, including source, unknowns and applied assumptions. */
  context: string[];
  /** Minimal facts for advisor draft; fuller planning context needs a separate opt-in. */
  advisorContext?: string[];
}
export interface SavedComparison {
  id: string;
  surface: ComparisonSurface;
  scope: string;
  title: string;
  at: string;
  chosen: string | null;
  options: ComparisonCandidate[];
}
export function validComparison(value: unknown): value is SavedComparison {
  const s = value as SavedComparison;
  return !!s && typeof s.id === 'string' && Object.hasOwn(COMPARISON_SURFACES, s.surface) &&
    typeof s.scope === 'string' && typeof s.title === 'string' && typeof s.at === 'string' &&
    Array.isArray(s.options) && s.options.length > 0 &&
    s.options.every(o => o && typeof o.id === 'string' && typeof o.label === 'string' && Array.isArray(o.context) && o.context.every(x => typeof x === 'string') && (o.advisorContext === undefined || (Array.isArray(o.advisorContext) && o.advisorContext.every(x => typeof x === 'string')))) &&
    new Set(s.options.map(o => o.id)).size === s.options.length &&
    (s.chosen === null || s.options.some(o => o.id === s.chosen));
}
export function comparisonDraft(title: string, options: ComparisonCandidate[]): string {
  return [title, 'Personal planning only. Confirm eligibility, availability and approvals with the official owner.',
    ...options.map(o => `\n${o.label}\n${o.context.join('\n')}`)].join('\n');
}
