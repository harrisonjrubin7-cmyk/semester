import { HUMANITIES_BUSINESS } from './subjects-humanities-business';
import { PROFESSIONAL } from './subjects-professional';
import { STEM } from './subjects-stem';
import { t, type Subject, type Tool } from './tools';

export { BOUNDARIES, type Boundary, type Family, type Subject, type Tool, type ToolState } from './tools';

/**
 * The subject workbench catalog: which tools a course's subject brings, what
 * state each of those tools is really in (see `tools.ts`), and which
 * capabilities no configuration can switch on.
 *
 * ## Subjects come from the course code
 *
 * A course has no "department" field; it has a code, `PSCI 1104`. The prefix
 * is explicit data the student imported from their syllabus, which is the
 * kind of signal the brief allows a recommendation to use. A course whose
 * prefix is not recognised gets no subject — the student picks one — rather
 * than a guess.
 */

/** Tools any subject can use. Every department inherits these. */
export const UNIVERSAL: readonly Tool[] = [
  t('research-studio', 'Research Studio', 'Question, search plan, screening, evidence matrix, citation audit', 'guided', { opens: 'research' }),
  t('data-studio', 'Data Studio', 'Dictionary, cleaning log, describe, chart with a table alternative, bounded conclusions', 'guided', { opens: 'data' }),
  t('assignment-workspace', 'Assignment workspace', 'Stages, deliverables, rubric self-check and submission checklist', 'guided', { opens: 'assignment' }),
  t('rubric-interpreter', 'Rubric self-check', 'A rubric criterion turned into a checklist — never a grade prediction', 'guided', { opens: 'rubric' }),
  t('ai-disclosure', 'AI-use declaration', 'What you used, for what, and what you checked', 'guided', { opens: 'disclosure' }),
  t('study-guide', 'Study guide from sources', 'Guides built only from material you select, with quotations matched', 'native', { screen: 'study' }),
  t('practice-paper', 'Practice paper', 'A timed paper marked against a key', 'native', { screen: 'exam' }),
  t('sources', 'Sources', 'Your readings with what each is for, out as BibTeX', 'native', { screen: 'sources' }),
  t('write', 'Write a document', 'Memo, report or handout out as a Word file', 'native', { screen: 'write' }),
  t('proof', 'Check the writing', 'Grammar read back, quotations checked against the reading', 'native', { screen: 'proof' }),
  t('deck', 'Make a deck', 'A real PowerPoint file', 'native', { screen: 'deck' }),
  t('groupwork', 'Group work', 'Who has which part, and whether it lands', 'native', { screen: 'groupwork' }),
];

/** Every subject the catalog knows, one list per group of departments. */
export const SUBJECTS: readonly Subject[] = [...STEM, ...HUMANITIES_BUSINESS, ...PROFESSIONAL];

/** The subject a course code belongs to, or undefined when the prefix is not known. */
export function subjectOf(code: string): Subject | undefined {
  const prefix = /^\s*([A-Za-z]+)/.exec(code)?.[1]?.toUpperCase();
  if (!prefix) return undefined;
  return SUBJECTS.find((s) => s.prefixes.includes(prefix));
}

/**
 * Capabilities no configuration can switch on. They are not tools in the
 * catalog and `entitle` refuses any tool that claims one, whatever a tenant
 * approval says — so a mistaken approval list cannot enable them either.
 */
export const NEVER = [
  ['pathogen-design', 'Pathogen enhancement or optimization, or other high-risk biological design'],
  ['wet-lab-protocols', 'Hazardous wet-lab protocol optimization'],
  ['clinical-decisions', 'Diagnosis, treatment plans or clinical decision support'],
  ['phi', 'Patient records or protected health information'],
  ['legal-advice', 'Legal advice about a real matter'],
  ['financial-advice', 'Individualized financial or investment advice'],
  ['engineering-signoff', 'Professional engineering certification or safety sign-off'],
  ['offensive-security', 'Offensive intrusion, credential collection, malware or bypassing school systems'],
  ['exact-location', 'Publishing exact locations of students, field sites or data'],
  ['voice-cloning', 'Cloning the voice of a faculty member or student'],
] as const;

const NEVER_IDS: ReadonlySet<string> = new Set(NEVER.map(([id]) => id));

export interface Entitlement {
  available: boolean;
  label: 'Opens in Semester' | 'In the toolkit' | 'Needs review before use' | 'Not built yet' | 'Not permitted';
  reason: string;
}

/**
 * Whether one tool can be opened, and why not when it cannot.
 *
 * `approved` is the reviewed approval list for restricted tools — empty
 * unless a human review has named a tool. `workbenchesOn` is the feature flag.
 */
export function entitle(tool: Tool, approved: ReadonlySet<string>, workbenchesOn: boolean): Entitlement {
  if (NEVER_IDS.has(tool.id))
    return { available: false, label: 'Not permitted', reason: 'Semester does not provide this capability under any configuration.' };
  if (tool.state === 'planned') return { available: false, label: 'Not built yet', reason: 'Listed so you can see it is planned. It does not exist yet.' };
  if (tool.state === 'restricted') {
    if (workbenchesOn && approved.has(tool.id))
      return { available: false, label: 'Needs review before use', reason: 'Approved for review, but no implementation has passed it yet.' };
    return { available: false, label: 'Needs review before use', reason: 'High-risk tools stay off until a human review and feature-flag approval.' };
  }
  if (tool.state === 'native') return { available: true, label: 'Opens in Semester', reason: 'An existing Semester screen.' };
  return { available: true, label: 'In the toolkit', reason: 'A guided workflow in this toolkit.' };
}

/** Every distinct tool a set of subjects brings, universal ones last, no duplicates. */
export function toolsFor(subjects: readonly Subject[]): Tool[] {
  const seen = new Map<string, Tool>();
  for (const s of subjects) for (const tool of s.tools) if (!seen.has(tool.id)) seen.set(tool.id, tool);
  for (const tool of UNIVERSAL) if (!seen.has(tool.id)) seen.set(tool.id, tool);
  return [...seen.values()];
}
