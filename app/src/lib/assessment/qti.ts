/**
 * QTI 3 as the assessment content model: the design principles, the
 * interaction library with an accessible equivalent for every pattern, the
 * authoring flow, the item analytics and what they must never become, the AI
 * item-generation workflow with its provenance and controls, and the legacy
 * item-bank migration programme — from three documents of 28 September 2026,
 * held to what the tree already has for a question.
 *
 * `docs/QTI-3-ASSESSMENT-AND-MIGRATION.md` is rendered from this file by
 * `qti.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## What QTI 3 is, and is not
 *
 * QTI 3 is an interoperability specification for representing and exchanging
 * assessment items, tests, interactions, scoring, results, accessibility
 * features and metadata; the accommodations formerly in APIP were integrated
 * into it, and 1EdTech recommends QTI 3 over APIP for new work. It does not
 * generate questions: AI can draft an item, and QTI 3 can encode the reviewed,
 * approved item so it moves between authoring, delivery and reporting systems.
 *
 * ## What is held to what
 *
 * - Each interaction pattern names the question type the app already
 *   delivers, or says none does; the test holds every named type to the
 *   union `lib/quiz.ts` exports, so the page cannot claim a type the app has
 *   no renderer for.
 * - The item metadata the documents require is read field by field against
 *   the question type the app already has; a field marked carried names the
 *   property that carries it, and the test checks the property exists on the
 *   type.
 * - The migration phases run 0–9 with a deliverable and an exit gate each,
 *   and the acceptance thresholds are all-or-nothing by construction.
 *
 * A supplied PDF is never evidence. `docs/LMS-LEARNING-ROADMAP.md` already
 * records QTI import and question banks as missing; this page says what
 * "present" would have to mean.
 */

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf',
    title: 'EdTech stack audit (QTI 3 interactive assessment design)',
    what: 'The design principles, the interactive question library with accessible equivalents, the authoring flow and the item analytics.',
  },
  {
    path: 'docs/expansion/LMS-Sortable-Matrix-and-AI-Grading-Comparison.pdf',
    title: 'Canvas vs Blackboard vs Moodle vs D2L (QTI 3 and AI item generation)',
    what: 'The correct AI item-generation workflow, the required AI item metadata and the ten item-generation controls.',
  },
  {
    path: 'docs/expansion/Gradescope-Copyleaks-Turnitin-and-QTI-3-Migration.pdf',
    title: 'Gradescope vs Copyleaks vs Turnitin (QTI 3 legacy item-bank migration checklist)',
    what: 'The five-phase migration checklist, and its inventory, crosswalk, validation, accessibility and round-trip items.',
  },
  {
    path: 'docs/expansion/LMS-API-Comparison-Rate-Limits-Scopes-and-LTI-Endpoints.pdf',
    title: 'Sortable LMS API comparison (QTI 3 migration steps and tools)',
    what: 'The ten migration phases with their outputs and exit gates, the toolchain and the acceptance thresholds.',
  },
];

export const WHAT_QTI_IS =
  'QTI 3 does not generate AI questions by itself. It is an interoperability specification for representing and exchanging assessment items, tests, interactions, scoring, results, accessibility features and metadata. AI can draft an item; QTI 3 can encode the reviewed, approved item so it can move between authoring, delivery and reporting systems.';

/** One assessment object, in the documents' definition. */
export const ASSESSMENT_OBJECT: readonly string[] = [
  'item content',
  'response rules',
  'scoring logic',
  'metadata',
  'accessibility alternatives',
  'outcome mapping',
  'version history',
];

export const PRINCIPLES: readonly string[] = [
  'Do not bury accessibility in a separate accommodation afterthought.',
  'Do not create interactions that work only by drag, hover, colour, mouse or a single sensory mode.',
  'Do not make a question portable only in appearance: test import, delivery, response processing, scoring and the accessible alternatives.',
];

// ── The interaction library ──────────────────────────────────────────────────

export interface Pattern {
  /** A slug, stable. */
  id: string;
  pattern: string;
  purpose: string;
  accessible: string;
  /**
   * The question type the app already delivers for this pattern, as
   * `lib/quiz.ts` names it — or null when the app has none.
   */
  deliveredAs: string | null;
  note: string;
}

// ── The authoring flow ───────────────────────────────────────────────────────

export const AUTHORING_FLOW: readonly string[] = [
  'A learning outcome is selected.',
  'An assessment blueprint is created.',
  'The item type is selected.',
  'The author writes the prompt and the response and scoring rules.',
  'The author adds the accessibility alternative and the media description.',
  'The author assigns metadata: topic, difficulty, outcome, cognitive level, source, rights, language, review date.',
  'The author previews the student, keyboard and screen-reader modes.',
  'A reviewer validates the content, the scoring and the accessibility.',
  'The item version is approved and added to the item bank.',
  'Assessment delivery uses the approved version.',
  'Item analytics inform future revision.',
];

// ── Item analytics: to improve questions, never to profile students ──────────

export const ITEM_ANALYTICS: readonly string[] = [
  'Difficulty',
  'Discrimination',
  'Distractor performance',
  'Time-to-complete distribution',
  'Technical error rate',
  'Accessibility issue reports',
  'Question skip and abandon rate',
  'Rubric consistency',
  'Outcome alignment',
  'Version comparison',
];

export const ANALYTICS_RULE =
  'Suppress small groups, and do not use item interaction behaviour to create individual student-risk labels. Item analytics drive review, not automatic deletion or student profiling.';

// ── AI item generation ───────────────────────────────────────────────────────

export const AI_ITEM_WORKFLOW: readonly string[] = [
  'The instructor selects the learning outcome, source material, cognitive level, item type, difficulty target, accessibility requirements and policy.',
  'AI drafts one or more candidate items.',
  'The system attaches provenance: model and version, prompt template, source set, date, editor.',
  'The instructor reviews factual correctness, alignment, bias, ambiguity, intellectual-property risk and accessibility.',
  'The reviewer modifies or approves the item.',
  'The system creates a versioned QTI 3 item.',
  'The accessibility alternative and the scoring logic are validated.',
  'The item enters the approved bank.',
  'The assessment uses the approved version.',
  'Results and item analytics inform later human review.',
];

export interface MetadataField {
  field: string;
  /** The property on the app's question type that carries it, or null when none does. */
  carriedBy: string | null;
  note: string;
}

export const AI_ITEM_CONTROLS: readonly string[] = [
  'AI cannot directly publish an item to a live assessment.',
  'Item generation is limited to authorized source material and rights-cleared inputs.',
  'Every AI-generated item has provenance and human approval.',
  'Each interactive question has a keyboard-operable accessible equivalent.',
  'Scoring and response processing are independently previewed and tested.',
  'Generated distractors are reviewed for plausibility, ambiguity, stereotype or bias, unintended clues and alignment to the learning outcome.',
  'Items are versioned; previously delivered items remain reproducible.',
  'Item analytics drive review, not automatic deletion or student profiling.',
  'Item banks are tenant- and course-scoped; no cross-institution content leakage.',
  'Assessment exposure and reuse controls protect item security.',
];

// ── Migration: a controlled content-conversion programme, not a file import ──

export interface Phase {
  n: number;
  name: string;
  activities: string;
  deliverables: string;
  exit: string;
}

export const PHASES: readonly Phase[] = [
  { n: 0, name: 'Govern', activities: 'Define scope, owners, source and destination systems, rights, security and acceptance criteria', deliverables: 'Migration charter, RACI, data-handling plan', exit: 'Stakeholders approve what “equivalent” means' },
  { n: 1, name: 'Preserve', activities: 'Export all originals, attachments, metadata, media, rubrics, score fixtures and usage history', deliverables: 'Immutable originals, checksums, source inventory', exit: 'Originals verified and access restricted' },
  { n: 2, name: 'Inventory', activities: 'Classify items by source format, interaction type, scoring complexity, accessibility, rights and risk', deliverables: 'Item inventory and migration ids', exit: 'Every object is categorized' },
  { n: 3, name: 'Crosswalk', activities: 'Map source semantics to QTI 3 constructs; define unsupported-feature treatment', deliverables: 'Versioned mapping specification', exit: 'Scoring and accessibility mapping approved' },
  { n: 4, name: 'Pilot convert', activities: 'Convert representative low-, medium- and high-complexity item samples', deliverables: 'Pilot packages, conversion diagnostics', exit: 'Pilot behaviour is accepted' },
  { n: 5, name: 'Bulk convert', activities: 'Convert at scale with logs, an exception queue and a repeatable pipeline', deliverables: 'QTI 3 packages and an exception register', exit: 'No unreviewed errors' },
  { n: 6, name: 'Validate', activities: 'Schema, package, scoring, rendering, asset, accessibility, security and metadata tests', deliverables: 'Automated test report', exit: 'Required pass rate met' },
  { n: 7, name: 'Destination test', activities: 'Import into the real destination sandbox, deliver sample attempts, score, export results', deliverables: 'Destination acceptance report', exit: 'Behaviour matches approved fixtures' },
  { n: 8, name: 'Round trip', activities: 'Export from the destination, validate again, compare original, migrated and re-exported state', deliverables: 'Round-trip evidence', exit: 'Portability demonstrated' },
  { n: 9, name: 'Release', activities: 'Approve banks, assign review dates, archive evidence, enable use', deliverables: 'Release record and support runbook', exit: 'Content owner signs off' },
];

/** Every source construct gets exactly one of these dispositions. */
export const DISPOSITIONS: readonly string[] = ['map exactly', 'transform with review', 'supported extension', 'manual rebuild', 'omit with warning', 'block migration'];

export const CHECKLIST: readonly { group: string; items: readonly string[] }[] = [
  {
    group: 'Source inventory',
    items: [
      'Identify the source format: QTI 1.2, QTI 2.1/2.2, proprietary XML or JSON, CSV, Word or PDF, SCORM package, LMS export or database extract.',
      'Assign a stable migration id to every bank, test, section, item, asset, rubric, outcome and external reference.',
      'Capture author, owner, rights and licence, review date, course and tenant scope, lifecycle state, language and use history.',
      'Identify shared stimuli, item dependencies, reusable feedback, question pools, randomization, branching, timing and attempts.',
      'Record current expected-score fixtures for representative student responses.',
      'Hash and package all source assets and preserve immutable originals.',
    ],
  },
  {
    group: 'Semantic and scoring crosswalk',
    items: [
      'Map identifiers and avoid collisions.',
      'Map response declarations, outcome declarations, response processing, template processing, feedback and scoring logic.',
      'Map partial credit, penalty scoring, negative marking, tolerance, units, rounding, randomized variables and adaptive branching.',
      'Map test parts, sections, ordering, selection, item pools, presentation rules, timing, attempt policies and delivery constraints.',
      'Map metadata: outcomes, topic, difficulty, cognitive level, language, author, rights, provenance, review date and accessibility status.',
      'Document every proprietary construct with one disposition.',
    ],
  },
  {
    group: 'Accessibility conversion',
    items: [
      'Preserve or add alt text, captions, transcripts and media descriptions.',
      'Verify language metadata and plain instructions.',
      'Ensure keyboard completion of every interaction.',
      'Provide equivalent alternatives for drag-and-drop, hotspot, graph, simulation, audio, video and colour-dependent questions.',
      'Validate accessible math input and rendering.',
      'Test screen-reader labels, focus order, state-change announcements, zoom and reflow, contrast and mobile rendering.',
      'Test timing, attempts and available accommodation configurations.',
      'Route inaccessible items to a manual-remediation queue.',
    ],
  },
  {
    group: 'Validation',
    items: [
      'Validate the QTI package manifest and the XML/schema structure.',
      'Validate the destination-supported QTI 3 profile.',
      'Import into a non-production destination bank.',
      'Test response capture, response processing, feedback, scoring, partial credit, randomization, timing, attempts and branching.',
      'Compare expected against actual outcomes using golden response fixtures.',
      'Test all media and assets; validate rights, rendering, fallback and inaccessible or expired external links.',
      'Test item metadata, outcome mapping, rubrics and grade and result reporting.',
      'Test student, instructor and administrator views.',
      'Test keyboard, screen reader, zoom and reflow, mobile and accommodation paths.',
      'Export the item from the destination and independently revalidate the package.',
      'Record the exact version of source, transformer, validator, destination and test fixture used.',
    ],
  },
];

export interface Tool {
  category: string;
  purpose: string;
  implementation: string;
}

export const TOOLCHAIN: readonly Tool[] = [
  { category: 'Source extractor', purpose: 'Pull item banks, assets and metadata from the source LMS', implementation: 'Versioned connector; read-only export; source checksums' },
  { category: 'Canonical inventory store', purpose: 'Maintain migration ids, metadata, mappings and exceptions', implementation: 'Tenant-scoped migration database with audit events' },
  { category: 'QTI transformer', purpose: 'Convert the source format to a QTI 3 package and manifest', implementation: 'Versioned transformation service; deterministic builds' },
  { category: 'QTI validator', purpose: 'Check schema, package and semantic-profile compliance', implementation: 'Automated validation in CI and the migration pipeline' },
  { category: 'Scoring test runner', purpose: 'Execute fixture responses and compare outcomes', implementation: 'Golden-response test suite' },
  { category: 'Rendering test harness', purpose: 'Render items in the target delivery environment', implementation: 'Screenshot, DOM and accessibility snapshot tests' },
  { category: 'Accessibility test suite', purpose: 'Keyboard, screen reader, contrast, text alternatives', implementation: 'Automated scans plus trained human testing' },
  { category: 'Asset processor', purpose: 'Package and rewrite media, equations, URLs and fonts', implementation: 'Rights, malware, broken-link and hash validation' },
  { category: 'Exception console', purpose: 'Assign, document, approve and close nonconforming items', implementation: 'Owner, severity, remediation, decision log' },
  { category: 'Acceptance dashboard', purpose: 'Report conversion health and sign-off status', implementation: 'Counts, defects, pass rate, unresolved blockers' },
];

/** Set before conversion begins. Every threshold is all or nothing. */
export const THRESHOLDS: readonly { of: string; must: string }[] = [
  { of: 'high-stakes items', must: '100% have human content and accessibility sign-off' },
  { of: 'scoring fixtures', must: '100% pass for released items' },
  { of: 'external assets', must: '100% are packaged, resolved, or intentionally removed' },
  { of: 'critical accessibility barriers', must: '0 unresolved' },
  { of: 'critical scoring deviations', must: '0 unresolved' },
  { of: 'exceptions', must: '100% have an owner and a disposition' },
  { of: 'released items', must: '100% have provenance and version metadata' },
  { of: 'final packages', must: '100% import into the target production-equivalent sandbox' },
];

// ── Held to the tree ─────────────────────────────────────────────────────────

/** The files the test reads for what a question is today. */
export const QUESTION_MODEL = {
  exam: 'app/src/lib/exam.ts',
  quiz: 'app/src/state/shape.ts',
} as const;

/**
 * The interaction library, each pattern at the question type the app already
 * delivers. Five kinds exist across the practice paper (`choice`, `short`,
 * `long`) and the quiz (`choice`, `truefalse`, `match`); every other pattern
 * has no renderer. Matching is already tap-to-join, and orderings elsewhere in
 * the app have arrow controls, so the accessible-equivalent rule is one the
 * tree already follows where it has the interaction at all.
 */
export const PATTERNS: readonly Pattern[] = [
  { id: 'multiple-choice', pattern: 'Multiple choice', purpose: 'Recognize the one correct concept among plausible distractors', accessible: 'Keyboard-operable radio group with clear feedback', deliveredAs: 'choice', note: 'Four options, an index answer and a `why`; the quiz kind of the same name draws from cards.' },
  { id: 'multiple-response', pattern: 'Multiple response', purpose: 'Distinguish several correct concepts', accessible: 'Keyboard-operable checkbox group with clear feedback', deliveredAs: null, note: 'Every choice question has exactly one right option.' },
  { id: 'true-false', pattern: 'True or false', purpose: 'Test a claim against the material', accessible: 'Two keyboard-operable options; the claim read in full', deliveredAs: 'truefalse', note: 'The quiz kind; the `claim` the statement proposes may not be the right one.' },
  { id: 'matching', pattern: 'Matching', purpose: 'Connect concepts, definitions or examples', accessible: 'Select-based pairing alternative; no drag-only requirement', deliveredAs: 'match', note: 'Already tap-to-join: a term to a definition in two taps, never a drag.' },
  { id: 'ordering', pattern: 'Ordering', purpose: 'Sequence a process, logic or chronology', accessible: 'Number or select order interface with keyboard controls', deliveredAs: null, note: 'No ordering question. Orderings elsewhere in the app (Reorder) have arrow controls, which is the rule this pattern would follow.' },
  { id: 'fill-in', pattern: 'Fill in the blank', purpose: 'Recall a term or value in context', accessible: 'A labelled text input per blank, with the sentence read whole', deliveredAs: null, note: 'No cloze question.' },
  { id: 'short-answer', pattern: 'Short answer', purpose: 'Explain reasoning briefly', accessible: 'Accessible editor, word guidance, autosave', deliveredAs: 'short', note: 'Self-marked against a model answer; never auto-scored.' },
  { id: 'essay', pattern: 'Essay', purpose: 'Synthesize evidence at length', accessible: 'Rubric, word limit, format guidance, accessible editor and autosave', deliveredAs: 'long', note: 'Self-marked against a model answer; the practice paper is kept on the device for seven days.' },
  { id: 'numeric', pattern: 'Numeric or formula response', purpose: 'Practice quantitative reasoning', accessible: 'Accessible math input, unit checks, visible notation guidance', deliveredAs: null, note: 'No numeric response, tolerance or unit check.' },
  { id: 'hotspot', pattern: 'Hotspot or image label', purpose: 'Identify visual features', accessible: 'Textual description, labelled list, or selectable-region alternative', deliveredAs: null, note: 'No hotspot interaction exists, so nothing is drag- or mouse-only.' },
  { id: 'graph', pattern: 'Graph or data interpretation', purpose: 'Read data and make an evidence-based conclusion', accessible: 'Data table, text summary, labelled axes, accessible formula and values', deliveredAs: null, note: 'No data-interpretation item.' },
  { id: 'simulation', pattern: 'Simulation or case', purpose: 'Apply decisions to a realistic context', accessible: 'Keyboard-operable scenario controls and a text equivalent', deliveredAs: null, note: 'No scenario item.' },
  { id: 'audio-video', pattern: 'Audio or video response', purpose: 'Demonstrate oral communication or analysis', accessible: 'Captions and transcript; an alternative response format where policy permits', deliveredAs: null, note: 'Recording and transcription exist for notes, not for a response.' },
  { id: 'coding', pattern: 'Coding exercise', purpose: 'Apply programming concepts', accessible: 'Sandboxed editor, keyboard workflow, deterministic tests, accessible output logs', deliveredAs: null, note: 'No sandbox; the documents put this in the high-risk phase.' },
  { id: 'peer-review', pattern: 'Peer review', purpose: 'Practice evaluative judgment', accessible: 'Structured rubric; anonymity and accessibility controls', deliveredAs: null, note: 'No peer-review item.' },
  { id: 'portfolio', pattern: 'Portfolio', purpose: 'Demonstrate longitudinal work', accessible: 'Artifact alternatives, ownership and consent, a rubric and reviewer workflow', deliveredAs: null, note: 'The career evidence workspace holds artifacts; nothing assesses a portfolio.' },
];

/**
 * The metadata every AI-assisted item carries, read against the practice
 * paper's `Question` type. Two of fifteen fields have a property; the rest
 * is the gap, and the largest part of it is provenance: no item records the
 * model, the prompt template, the source set or an editor.
 */
export const METADATA: readonly MetadataField[] = [
  { field: 'Item id and version', carriedBy: 'id', note: 'An id, no version; a re-sat paper is reproduced from its seed, not from a versioned item.' },
  { field: 'Learning outcome or competency', carriedBy: null, note: 'No outcome authoring or mapping (LMS-015).' },
  { field: 'Course and tenant scope', carriedBy: null, note: '`from` names a unit or topic; nothing names a course or a tenant.' },
  { field: 'Author and reviewer', carriedBy: null, note: 'Items are drawn by the model for one student; nobody authors or reviews them.' },
  { field: 'AI-assisted status', carriedBy: null, note: 'Every model-drawn paper is AI-assisted; nothing marks it per item.' },
  { field: 'Model, provider and version', carriedBy: null, note: 'Recorded per call in the gateway’s intelligence audit, never on the item.' },
  { field: 'Prompt-template version', carriedBy: null, note: 'Prompts are not versioned (AM-19).' },
  { field: 'Source references and rights status', carriedBy: 'from', note: 'The unit or topic it came from, when known; no page anchor and no rights status.' },
  { field: 'Creation and approval time', carriedBy: null, note: 'The attempt records when it started; the item records nothing.' },
  { field: 'Accessibility review status', carriedBy: null, note: 'None.' },
  { field: 'Scoring rule and rubric version', carriedBy: null, note: '`points` is only the maximum mark; no property encodes the response-processing rule (index match for a choice, self-marking for a written answer) or a rubric version.' },
  { field: 'Difficulty and cognitive-level tags', carriedBy: null, note: 'None.' },
  { field: 'Known limitations', carriedBy: null, note: 'The paper carries the practice label; the item carries nothing.' },
  { field: 'Approval expiry and review date', carriedBy: null, note: 'None.' },
  { field: 'Usage history', carriedBy: null, note: 'One attempt slot at a time; no per-item exposure record.' },
];

/** What the tree already does that the documents ask for, cited. */
export const ALREADY: readonly { rule: string; path: string; shows: string }[] = [
  { rule: 'Practice is always labelled practice, never an official assessment.', path: 'app/src/lib/studystudio.ts', shows: 'STUDY_FORMATS: a paper is practice, never an official assessment' },
  { rule: 'A written answer is self-marked, never auto-scored.', path: 'app/src/lib/exam.test.ts', shows: 'short and long answers are marked by the student against a model answer' },
  { rule: 'Matching has no drag-only requirement.', path: 'app/src/screens/quizkinds.test.tsx', shows: 'joins a term to a definition in two taps' },
  { rule: 'An ordering has a keyboard alternative.', path: 'app/src/a11y/dragging.test.ts', shows: 'WCAG 2.5.7: every ordering has arrow controls' },
  { rule: 'The clock is the wall clock and never takes anything away.', path: 'app/src/lib/examattempt.test.ts', shows: 'time is up: nothing has been taken away' },
  { rule: 'A paper is kept on the device and can be resumed.', path: 'app/src/lib/examattempt.test.ts', shows: 'autosave, the seed, the clock and a receipt' },
  { rule: 'Item analytics never become a student-risk label.', path: 'app/src/lib/institution-ops.ts', shows: 'FORBIDDEN: individual student risk scores, attention inference' },
  { rule: 'Generated questions cite the material.', path: 'app/src/lib/studystudio.ts', shows: 'STUDY_SYSTEM: exact quotes per section; do not invent page numbers' },
];

export const NOT_YET: readonly string[] = [
  'No question bank, item versioning, tags, pools or instructor authoring (LMS-008).',
  'No QTI import or export, and no Common Cartridge (INT-007, INT-008).',
  'No item analytics: difficulty, discrimination, distractor performance, time-to-complete or skip rate (LMS-017).',
  'No accommodation applied to timing or format (LMS-009), and no enforced timing at all: the paper is a practice paper.',
  'No per-item provenance for an AI-drawn question.',
];
