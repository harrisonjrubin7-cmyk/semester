import type { Screen } from '../types';

/**
 * The subject workbench catalog: which tools a course's subject brings, what
 * state each of those tools is really in, and the boundary each one works
 * inside.
 *
 * ## A tool says what it is, not what it will be
 *
 * The brief lists a hundred-odd tools across every department. A few already
 * exist in Semester as screens of their own (Analyse data, Equations, Check
 * the writing …). Some are structured templates the toolkit itself provides.
 * Most — the simulators, the molecule builder, the circuit lab — do not exist.
 * A catalog that listed them all as if they worked would be the fabrication
 * the brief forbids everywhere else, so every entry carries a `state`:
 *
 * - `native`   — a Semester screen; opening it goes there.
 * - `guided`   — a toolkit workflow or checklist, built in this module set.
 * - `restricted` — defined, but high-risk: it stays unavailable until a
 *   reviewed approval names it (see `entitle`).
 * - `planned`  — named so the department can see it is on the list; not built.
 *
 * ## Subjects come from the course code
 *
 * A course has no "department" field; it has a code, `PSCI 1104`. The prefix
 * is explicit data the student imported from their syllabus, which is the
 * kind of signal the brief allows a recommendation to use. A course whose
 * prefix is not recognised gets no subject — the student picks one — rather
 * than a guess.
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

const t = (id: string, name: string, purpose: string, state: ToolState, more: Partial<Tool> = {}): Tool => ({
  id,
  name,
  purpose,
  state,
  ...more,
});

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

const analyse = t('analyse', 'Analyse data', 'Statistics computed in the app, then explained', 'native', { screen: 'analyse' });
const equations = t('equations', 'Equation workbench', 'Write a formula, evaluate it, graph it', 'native', { screen: 'equations' });
const solve = t('solve', 'Work the problem', 'The method on other numbers; your attempt checked', 'native', { screen: 'solve' });
const draw = t('draw', 'Diagram builder', 'Flows, timelines and matrices from a description', 'native', { screen: 'draw' });
const sheet = t('sheet', 'Spreadsheet', 'A grid out as Excel or CSV', 'native', { screen: 'sheet' });
const matrix = t('evidence-matrix', 'Evidence matrix', 'Study-by-study comparison with verification', 'guided', { opens: 'research' });
const caseAnalysis = t('case-analysis', 'Case analysis template', 'Facts, stakeholders, framework, alternatives, recommendation', 'guided', { opens: 'assignment' });
const policyMemo = t('policy-memo', 'Policy memo template', 'Problem, options, tradeoffs, recommendation, evidence', 'guided', { opens: 'assignment' });
const labReport = t('lab-report', 'Lab report template', 'Objective through limitations, one stage at a time', 'guided', { opens: 'assignment' });
const planned = (id: string, name: string, purpose: string, boundary?: Boundary) => t(id, name, purpose, 'planned', { boundary });
const restricted = (id: string, name: string, purpose: string, boundary: Boundary) => t(id, name, purpose, 'restricted', { boundary });

export type Family = 'STEM' | 'Humanities & languages' | 'Social sciences & business' | 'Health & clinical' | 'Arts & media' | 'Field & environment';

export interface Subject {
  id: string;
  name: string;
  family: Family;
  /** Course-code prefixes, upper case, as they appear before the number. */
  prefixes: readonly string[];
  tools: readonly Tool[];
}

export const SUBJECTS: readonly Subject[] = [
  { id: 'math', name: 'Mathematics', family: 'STEM', prefixes: ['MATH'], tools: [equations, solve, planned('proof-templates', 'Proof templates', 'Structure a proof and its logic'), planned('calculus-visualizer', 'Calculus visualizer', 'Limits, derivatives and integrals drawn')] },
  { id: 'stats', name: 'Statistics', family: 'STEM', prefixes: ['STAT', 'BIOS'], tools: [analyse, sheet, equations, planned('probability-simulator', 'Probability simulator', 'Sampling and distributions by simulation')] },
  { id: 'bio', name: 'Biology', family: 'STEM', prefixes: ['BSCI', 'BIOL', 'MBIO'], tools: [labReport, analyse, draw, restricted('dna-lab', 'DNA Learning Lab', 'Transcription, translation, mutation and gel-band exercises on instructor-provided sequences', 'science')] },
  { id: 'chem', name: 'Chemistry', family: 'STEM', prefixes: ['CHEM'], tools: [labReport, equations, planned('reaction-balancer', 'Reaction balancer', 'Balance equations and check stoichiometry', 'science')] },
  { id: 'physics', name: 'Physics', family: 'STEM', prefixes: ['PHYS', 'ASTR'], tools: [labReport, equations, analyse, planned('circuit-sim', 'Mechanics and circuit simulators', 'Forces, circuits and waves by simulation', 'science')] },
  { id: 'cs', name: 'Computer science', family: 'STEM', prefixes: ['CS', 'CSE', 'COMP'], tools: [draw, planned('code-studio', 'Code Studio', 'Write and test your own code — needs a reviewed sandbox before it can run anything'), restricted('security-sandbox', 'Defensive security sandbox', 'Isolated defensive exercises', 'cyber')] },
  { id: 'data-science', name: 'Data science', family: 'STEM', prefixes: ['DS', 'DSCI'], tools: [analyse, sheet, matrix] },
  { id: 'engineering', name: 'Engineering', family: 'STEM', prefixes: ['ENGR', 'ME', 'EECE', 'CE', 'BME', 'CHBE', 'ES'], tools: [equations, labReport, planned('assumption-checklist', 'Units and assumptions checklist', 'Units, assumptions and safety factors written down', 'engineering')] },
  { id: 'english', name: 'English and writing', family: 'Humanities & languages', prefixes: ['ENGL', 'WRIT'], tools: [t('essay-workflow', 'Essay workflow', 'Claim, evidence plan, outline, draft, revision', 'guided', { opens: 'assignment' }), matrix] },
  { id: 'history', name: 'History', family: 'Humanities & languages', prefixes: ['HIST'], tools: [matrix, draw, planned('primary-source', 'Primary-source analyzer', 'Author, audience, purpose and context of a source')] },
  { id: 'philosophy', name: 'Philosophy', family: 'Humanities & languages', prefixes: ['PHIL'], tools: [draw, planned('argument-map', 'Argument reconstruction', 'Premises, conclusion and the gaps between')] },
  { id: 'languages', name: 'Languages', family: 'Humanities & languages', prefixes: ['SPAN', 'FREN', 'GER', 'ITA', 'CHIN', 'JAPN', 'ARA', 'RUSS', 'PORT', 'LAT'], tools: [planned('translation-compare', 'Translation comparison', 'Alternatives explained, not one "correct" answer')] },
  { id: 'religion', name: 'Religious studies', family: 'Humanities & languages', prefixes: ['RLST', 'JS'], tools: [matrix, draw] },
  { id: 'psychology', name: 'Psychology', family: 'Social sciences & business', prefixes: ['PSY', 'PSYC'], tools: [analyse, matrix, labReport] },
  { id: 'sociology', name: 'Sociology', family: 'Social sciences & business', prefixes: ['SOC'], tools: [analyse, matrix, planned('qual-coding', 'Qualitative coding lab', 'Codebook, segments and memos with a rationale for each code')] },
  { id: 'poli-sci', name: 'Political science', family: 'Social sciences & business', prefixes: ['PSCI', 'POLS'], tools: [policyMemo, matrix, draw] },
  { id: 'economics', name: 'Economics', family: 'Social sciences & business', prefixes: ['ECON'], tools: [analyse, equations, sheet, policyMemo, planned('supply-demand', 'Supply and demand simulator', 'Shift curves and read the new equilibrium')] },
  { id: 'anthropology', name: 'Anthropology', family: 'Social sciences & business', prefixes: ['ANTH'], tools: [matrix, planned('field-notes', 'Field-note organizer', 'Notes, consent status and coding', 'location')] },
  { id: 'business', name: 'Business and management', family: 'Social sciences & business', prefixes: ['MGT', 'BUS', 'BUSA', 'OWEN', 'MKTG'], tools: [caseAnalysis, sheet, draw] },
  { id: 'finance', name: 'Finance and accounting', family: 'Social sciences & business', prefixes: ['FIN', 'ACCT'], tools: [sheet, t('finance-models', 'Time value and ratio models', 'Worked finance formulas on example figures', 'native', { screen: 'equations', boundary: 'finance' })] },
  { id: 'education', name: 'Education', family: 'Social sciences & business', prefixes: ['EDUC', 'HOD', 'SPED'], tools: [planned('lesson-designer', 'Lesson designer', 'Objectives, activities and a UDL check')] },
  { id: 'communication', name: 'Communication', family: 'Social sciences & business', prefixes: ['CMST', 'COMM'], tools: [t('presentation-workflow', 'Presentation workflow', 'Audience, thesis, slides, notes, rehearsal, timing', 'guided', { opens: 'assignment' })] },
  { id: 'public-policy', name: 'Public policy', family: 'Social sciences & business', prefixes: ['PPS', 'PUBP', 'MPP'], tools: [policyMemo, analyse, matrix] },
  { id: 'law', name: 'Legal studies', family: 'Social sciences & business', prefixes: ['LAW', 'LGST'], tools: [t('case-brief', 'Case brief template', 'Facts, issue, holding, reasoning', 'guided', { opens: 'assignment', boundary: 'legal' })] },
  { id: 'criminal-justice', name: 'Criminal justice', family: 'Social sciences & business', prefixes: ['CRJ', 'CJ'], tools: [caseAnalysis, matrix] },
  { id: 'nursing', name: 'Nursing', family: 'Health & clinical', prefixes: ['NURS'], tools: [t('med-math', 'Medication-math practice', 'Dosage calculations on invented practice cases', 'native', { screen: 'solve', boundary: 'clinical' }), restricted('clinical-cases', 'Clinical-reasoning cases', 'Invented educational cases only', 'clinical')] },
  { id: 'public-health', name: 'Public health', family: 'Health & clinical', prefixes: ['PH', 'MHS', 'GH'], tools: [analyse, matrix, policyMemo] },
  { id: 'kinesiology', name: 'Kinesiology and nutrition', family: 'Health & clinical', prefixes: ['KIN', 'NUTR', 'EXSC'], tools: [analyse, planned('guideline-compare', 'Guideline comparison', 'Compare published guidelines — not a meal or treatment plan', 'clinical')] },
  { id: 'art', name: 'Art and design', family: 'Arts & media', prefixes: ['ARTS', 'HART', 'ARCH'], tools: [planned('critique-board', 'Critique and iteration board', 'References, critique and each iteration', 'copyright')] },
  { id: 'music', name: 'Music', family: 'Arts & media', prefixes: ['MUSC', 'MUSL', 'MUTH'], tools: [planned('ear-training', 'Ear training and rhythm', 'Intervals, chords and rhythm drills', 'copyright')] },
  { id: 'theatre-film', name: 'Theatre, film and media', family: 'Arts & media', prefixes: ['THTR', 'FILM', 'CMA'], tools: [draw, planned('storyboard', 'Storyboard and shot list', 'Scenes, shots and a call sheet', 'copyright')] },
  { id: 'environment', name: 'Environmental and earth science', family: 'Field & environment', prefixes: ['EES', 'ENVS', 'GEOL'], tools: [analyse, labReport, planned('gis-basics', 'GIS learning lab', 'Layers and maps with coarse locations only', 'location')] },
];

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
