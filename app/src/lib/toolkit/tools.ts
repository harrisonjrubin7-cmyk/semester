import type { Screen } from '../types';

/**
 * What a toolkit tool is, and the boundaries some of them work inside.
 *
 * ## A tool says what it is, not what it will be
 *
 * The brief lists a hundred-odd tools across every department. A few already
 * exist in Semester as screens of their own (Analyse data, Equations, Check
 * the writing …). Some are structured templates the toolkit itself provides.
 * Most — the simulators, the molecule builder, the circuit lab — do not exist.
 * A catalog that listed them all as if they worked would be the fabrication
 * the brief forbids everywhere else, so every tool carries a `state`:
 *
 * - `native`   — a Semester screen; opening it goes there.
 * - `guided`   — a toolkit workflow or checklist.
 * - `restricted` — defined, but high-risk: it stays unavailable until a
 *   reviewed approval names it (see `entitle` in `catalog.ts`).
 * - `planned`  — named so the department can see it is on the list; not built.
 *
 * The subject lists live in `subjects-*.ts`, one file per group of
 * departments, and `catalog.ts` puts them together.
 */

export type ToolState = 'native' | 'guided' | 'restricted' | 'planned';

export type Boundary = 'science' | 'clinical' | 'legal' | 'finance' | 'engineering' | 'cyber' | 'location' | 'copyright';

export const BOUNDARIES: Record<Boundary, string> = {
  science:
    'Education only: visualization, simulation, and hypothetical or instructor-provided data. No pathogen work, hazardous wet-lab protocols or biological design.',
  clinical:
    'Educational simulation only. Not diagnosis, treatment, patient records or clinical decision support, and never a place for patient information.',
  legal: 'Educational practice only. This is not legal advice about any real matter.',
  finance: 'Educational models only. This is not individualized financial or investment advice.',
  engineering: 'Educational reasoning only. Nothing here is professional certification, structural approval or a safety sign-off.',
  cyber: 'Defensive learning only. No live targets, credential collection, malware or bypassing of school systems.',
  location: 'Coarse, private locations only. Nothing publishes an exact location for you, a field site or your data.',
  copyright: 'Use only media you have the rights to. No voice cloning of faculty or students.',
};

export interface Tool {
  id: string;
  name: string;
  purpose: string;
  state: ToolState;
  /** Where a native tool lives. */
  screen?: Screen;
  /** A guided tool's section inside the toolkit. */
  opens?: 'research' | 'data' | 'assignment' | 'policy' | 'disclosure' | 'rubric';
  boundary?: Boundary;
}

export const t = (id: string, name: string, purpose: string, state: ToolState, more: Partial<Tool> = {}): Tool => ({
  id,
  name,
  purpose,
  state,
  ...more,
});

export const planned = (id: string, name: string, purpose: string, boundary?: Boundary) => t(id, name, purpose, 'planned', { boundary });
export const restricted = (id: string, name: string, purpose: string, boundary: Boundary) => t(id, name, purpose, 'restricted', { boundary });

/* Tools several subjects share, defined once so a subject list reads as a list. */
export const analyse = t('analyse', 'Analyse data', 'Statistics computed in the app, then explained', 'native', { screen: 'analyse' });
export const equations = t('equations', 'Equation workbench', 'Write a formula, evaluate it, graph it', 'native', { screen: 'equations' });
export const solve = t('solve', 'Work the problem', 'The method on other numbers; your attempt checked', 'native', { screen: 'solve' });
export const draw = t('draw', 'Diagram builder', 'Flows, timelines and matrices from a description', 'native', { screen: 'draw' });
export const sheet = t('sheet', 'Spreadsheet', 'A grid out as Excel or CSV', 'native', { screen: 'sheet' });
export const matrix = t('evidence-matrix', 'Evidence matrix', 'Study-by-study comparison with verification', 'guided', { opens: 'research' });
export const labReport = t('lab-report', 'Lab report template', 'Objective through limitations, one stage at a time', 'guided', { opens: 'assignment' });
export const caseAnalysis = t('case-analysis', 'Case analysis template', 'Facts, stakeholders, framework, alternatives, recommendation', 'guided', { opens: 'assignment' });
export const policyMemo = t('policy-memo', 'Policy memo template', 'Problem, options, tradeoffs, recommendation, evidence', 'guided', { opens: 'assignment' });

export type Family = 'STEM' | 'Humanities & languages' | 'Social sciences & business' | 'Health & clinical' | 'Arts & media' | 'Field & environment';

export interface Subject {
  id: string;
  name: string;
  family: Family;
  /** Course-code prefixes, upper case, as they appear before the number. */
  prefixes: readonly string[];
  tools: readonly Tool[];
}
