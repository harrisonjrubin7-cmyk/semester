export const SOURCE_KIND_IDS = [
  'peer-reviewed',
  'preprint',
  'institutional-report',
  'book',
  'course-provided',
  'news',
  'commentary',
  'student-note',
  'ai-summary',
  'unverified',
] as const;

export type SourceKind = (typeof SOURCE_KIND_IDS)[number];

export const DESIGN_IDS = [
  'randomized',
  'quasi',
  'cohort',
  'case-control',
  'cross-sectional',
  'qualitative',
  'review',
  'theory',
  'other',
] as const;

export type Design = (typeof DESIGN_IDS)[number];
