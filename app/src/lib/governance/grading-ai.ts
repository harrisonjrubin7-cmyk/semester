/**
 * AI in grading and integrity: what Gradescope, Turnitin and Copyleaks each
 * are, why no single accuracy or false-positive number compares them, the
 * institution-controlled evaluation that does, the procurement pass/fail
 * rules, the roles AI may hold in assessment and the human control each
 * requires, and the fairness controls a consequential grade needs — from four
 * documents of 28 September 2026, held to what the tree already has.
 *
 * `docs/operating-model/AI-GRADING-AND-INTEGRITY.md` is rendered from this
 * file by `grading-ai.test.ts`; edit the data, then `npm run registers` from
 * app/.
 *
 * ## The two findings
 *
 * There is no universal false-positive rate for Gradescope, Copyleaks,
 * Turnitin or any AI-grading tool. Results depend on the task, model and
 * version, language, rubric, source material, student population, threshold
 * and what the tool is detecting; and the three products address different
 * problems, so a single percentage would compare a grading-workflow product
 * to two integrity-signal products. The comparison that holds is a
 * controlled evaluation on permissioned, representative samples with several
 * trained human reviewers.
 *
 * AI can assist, and it must never silently become the grader. Every row of
 * the roles matrix ends in a human; the final grade and any misconduct
 * finding are never AI-only.
 *
 * ## What is held to what
 *
 * - Each AI role names the lifecycle gate in `ai-lifecycle.ts` that owns its
 *   function, and the test holds the gate to `GATES`.
 * - Each fairness control cites the kind of file its status claims, under
 *   the expansion register's rule, and every cited path exists.
 * - The "never" rules that already have code — no AI-only grade, no automatic
 *   misconduct finding — name the file that refuses them; the rest say none
 *   does.
 *
 * A supplied PDF is never evidence. `GRADESCOPE-TURNITIN.md` already settled
 * that Semester cannot submit into Gradescope and that Turnitin's API is a
 * partnership; this page is about governance, not integration.
 */

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Gradescope-Copyleaks-Turnitin-and-QTI-3-Migration.pdf',
    title: 'Gradescope vs Copyleaks vs Turnitin AI grading: accuracy, false-positive rates, and plagiarism integration compared side-by-side',
    what: 'The three-product comparison, the vendor test protocol and the deployment preconditions.',
  },
  {
    path: 'docs/expansion/LMS-Sortable-Matrix-and-AI-Grading-Comparison.pdf',
    title: 'Canvas vs Blackboard vs Moodle vs D2L (AI grading comparison)',
    what: 'The required vendor-evaluation test and the procurement pass/fail rules.',
  },
  {
    path: 'docs/expansion/Learning-Work-Completion-Assessment-and-Gradebook.pdf',
    title: 'Anything else that can be further improved (AI in assessment and grading)',
    what: 'The AI use-case matrix with the permitted role and required control for each, and the grading fairness controls.',
  },
  {
    path: 'docs/expansion/EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf',
    title: 'EdTech stack audit (AI guardrails for grading)',
    what: 'The guardrail table and the source-aware grading workflow.',
  },
];

export const NO_UNIVERSAL_RATE =
  'There is no single, universal false-positive rate for Gradescope, Copyleaks, Turnitin or AI grading tools. Results depend on the assignment type, model and version, language, rubric, source material, student population, threshold and what the tool is detecting. Do not compare vendors using an unsupported single percentage.';

export const PRODUCTS = ['gradescope', 'turnitin', 'copyleaks'] as const;
export type Product = (typeof PRODUCTS)[number];
export const PRODUCT_NAME: Record<Product, string> = { gradescope: 'Gradescope', turnitin: 'Turnitin', copyleaks: 'Copyleaks' };

export interface ComparisonRow {
  criterion: string;
  cells: Record<Product, string>;
  semester: string;
}

export const COMPARISON: readonly ComparisonRow[] = [
  {
    criterion: 'Primary use',
    cells: {
      gradescope: 'Assisted grading, answer grouping and rubric workflows, especially for structured, fixed-template work',
      turnitin: 'Similarity checking and AI-writing detection; assessment integrations vary by product and licence',
      copyleaks: 'AI-content detection, plagiarism and related integrity tooling',
    },
    semester: 'Source-aware rubric workflow, formative feedback, a grade ledger and human-controlled integrity review',
  },
  {
    criterion: 'Rubric-based scoring',
    cells: {
      gradescope: 'Strong rubric and grading-workflow orientation',
      turnitin: 'Not primarily a rubric-scoring system',
      copyleaks: 'Not primarily a rubric-scoring system',
    },
    semester: 'Structured rubric, criterion-level evidence, manual or AI-assisted feedback, reviewer sign-off',
  },
  {
    criterion: 'Automated action',
    cells: {
      gradescope: 'Assists answer grouping and grading; the instructor controls final grading',
      turnitin: 'Flags similarity and AI-writing concerns for trained human review only',
      copyleaks: 'Flags suspected AI or plagiarism concerns for trained human review only',
    },
    semester: 'AI may suggest evidence and feedback drafts; it cannot release a final grade or a misconduct finding',
  },
  {
    criterion: 'False-positive claim',
    cells: {
      gradescope: 'Not comparable as an AI-writing detector',
      turnitin: 'Require current, independent, scenario-specific evidence',
      copyleaks: 'Require current, independent, scenario-specific evidence',
    },
    semester: 'Do not accept a single vendor-wide accuracy number',
  },
  {
    criterion: 'Evidence available to the instructor',
    cells: {
      gradescope: 'Rubric and response-grouping context',
      turnitin: 'Similarity report and source matches; the AI signal depends on the product',
      copyleaks: 'Similarity or AI report, depending on the product',
    },
    semester: 'Rubric version, student work, source and citation context, AI-assist trace, reviewer decision',
  },
  {
    criterion: 'Student due process',
    cells: {
      gradescope: 'The institution must configure a review process',
      turnitin: 'The institution must provide human review and a response process',
      copyleaks: 'The institution must provide human review and a response process',
    },
    semester: 'The student sees the policy basis, can respond, request review and appeal; the decision is audited',
  },
  {
    criterion: 'Data governance question',
    cells: {
      gradescope: 'Retention, storage, integrations, training and data-use terms',
      turnitin: 'Repository, retention, similarity corpus, AI-detection handling',
      copyleaks: 'Retention, repositories, model and data-use terms',
    },
    semester: 'No vendor training on student work by default; tenant approval required',
  },
  {
    criterion: 'Major risk',
    cells: {
      gradescope: 'Over-reliance on automation and grouping without review',
      turnitin: 'False accusations or overconfident AI-detection conclusions',
      copyleaks: 'The same: false positives, unequal impacts, opaque thresholds',
    },
    semester: 'Human review, student explanation, audit trail, transparent limitation labels, no automatic penalty',
  },
];

// ── The evaluation that does compare them ────────────────────────────────────

export const VENDOR_TEST: readonly { measure: string; how: string }[] = [
  { measure: 'Rubric agreement', how: 'Compare the tool suggestion with multiple trained human graders.' },
  { measure: 'Inter-rater reliability', how: 'Measure human-to-human agreement first; do not treat humans as a perfect ground truth.' },
  { measure: 'False positives', how: 'How often the tool flags compliant, authentic work as suspect.' },
  { measure: 'False negatives', how: 'How often it misses work the institution independently determines needs review.' },
  { measure: 'Calibration', how: 'How results vary by discipline, assignment type, language background, disability and accessibility use, length, format and population.' },
  { measure: 'Explainability', how: 'Whether an instructor can see why a score or flag appeared and what evidence supports it.' },
  { measure: 'Appeal', how: 'Whether a student can see enough basis to respond, correct or challenge the result.' },
  { measure: 'Data governance', how: 'What student work is stored, for how long, in which region, by which subprocessors, and whether it may be used for training.' },
  { measure: 'Operational quality', how: 'How outages, model changes, threshold changes and disputed cases are handled.' },
];

export const TEST_DATASET: readonly string[] = [
  'Permissioned historical assignments or synthetic benchmark materials.',
  'Multiple disciplines and assignment types.',
  'Multiple language backgrounds and writing styles.',
  'Accessibility-tool outputs where relevant.',
  'Known original, cited or quoted, collaboratively authored, AI-assisted-permitted and policy-violating examples.',
  'A predefined ground-truth review process with multiple human reviewers.',
];

export const TEST_REPORTS: readonly string[] = [
  'True-positive, false-positive, true-negative and false-negative counts.',
  'Precision, recall, false-positive rate and confidence intervals.',
  'Results by discipline, text length, language and approved assistive-tool use.',
  'Consistency after vendor, model or threshold updates.',
  'Explanation quality and reviewer agreement.',
  'Time saved against additional review burden.',
  'Student appeal outcomes.',
];

/** Any one fails the procurement. */
export const PROCUREMENT_RULES: readonly string[] = [
  'No automatic grade release from AI output.',
  'No automatic academic-misconduct accusation, grade penalty or disciplinary referral.',
  'No unsupported “99% accurate” claim accepted without current, assignment-specific evidence.',
  'No use of student work for vendor model training by default.',
  'No tool deployed without a student notice, a human-review procedure and an appeal route.',
  'No integration that silently writes grades or sends flags to the official record.',
];

/** An integrity signal enters a consequential workflow only when all of these hold. */
export const DEPLOYMENT_PRECONDITIONS: readonly string[] = [
  'A trained human reviews it.',
  'The student has a way to respond.',
  'The instructor sees evidence, not only a percentage.',
  'The institution has an appeal and process policy.',
  'The tool’s data-retention and training terms are contractually acceptable.',
  'The institution has tested impacts on multilingual and disabled students.',
];

// ── The roles AI may hold, and the human control each requires ───────────────

export interface AiRole {
  /** A slug, stable. */
  id: string;
  useCase: string;
  permitted: string;
  control: string;
  /** The `ai-lifecycle.ts` gate that owns this function. */
  gate: string;
}

export const AI_ROLES: readonly AiRole[] = [
  { id: 'rubric', useCase: 'Rubric drafting', permitted: 'Suggest criteria and language', control: 'Instructor review before use', gate: 'G2' },
  { id: 'questions', useCase: 'Question generation', permitted: 'Draft questions from approved source material', control: 'Faculty review; accuracy, bias and accessibility checks', gate: 'G2' },
  { id: 'practice', useCase: 'Practice feedback', permitted: 'Give formative feedback, hints and explanations', control: 'Clearly labelled as AI; cites course sources; no official grade', gate: 'G3' },
  { id: 'writing', useCase: 'Writing feedback', permitted: 'Identify clarity, structure, citation and rubric gaps', control: 'Student review; course-policy compliance; no invisible rewriting', gate: 'G3' },
  { id: 'feedback-draft', useCase: 'Instructor feedback draft', permitted: 'Draft feedback from instructor rubric inputs', control: 'Instructor edits and approves before release', gate: 'G3' },
  { id: 'evidence', useCase: 'Grading assistance', permitted: 'Flag possible rubric evidence or calculate deterministic scores', control: 'Human validates; the decision and audit record are preserved', gate: 'G3' },
  { id: 'integrity', useCase: 'Integrity support', permitted: 'Highlight unusual patterns or citation concerns', control: 'No automatic misconduct determination; human investigation', gate: 'G3' },
  { id: 'accessibility', useCase: 'Accessibility support', permitted: 'Generate first-pass alt text, transcript aids and plain-language rewrites', control: 'Human validation; academic meaning preserved', gate: 'G3' },
  { id: 'final', useCase: 'Final grading', permitted: 'Not AI-only', control: 'An instructor or authorized human remains responsible', gate: 'G4' },
];

// ── The fairness controls a consequential grade needs ────────────────────────

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Control {
  /** `F01`…, stable. */
  id: string;
  control: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

const SANDBOX = 'app/server/institution/sandbox.ts';
const SANDBOX_TEST = 'app/server/institution/sandbox.test.ts';
const MASTER = 'docs/MASTER-LAUNCH-READINESS-REGISTER.md';

type Row = Omit<Control, 'id' | 'evidence'> & { evidence: readonly [path: string, shows: string][] };

const ROWS: readonly Row[] = [
  { control: 'Anonymous grading option', status: 'not-started', evidence: [[MASTER, 'LMS-012 grading workflow: designed; no anonymous grading']], gap: 'Nothing hides a student’s identity from a grader.' },
  { control: 'Randomized grading order', status: 'not-started', evidence: [[MASTER, 'LMS-012: designed']], gap: 'No grading queue exists to randomize.' },
  { control: 'Rubric-first scoring', status: 'tested', evidence: [[SANDBOX, 'Criterion {id, name, outOf, means}: per-criterion marks, the total their sum, the student-facing meaning published before work starts'], [SANDBOX_TEST, 'refuses a criterion mark the rubric cannot carry; will not accept a rubric with a box left empty'], ['app/src/lib/toolkit/rubric.ts', 'a rubric turned into a student checklist that never predicts a grade'], ['app/src/lib/toolkit/rubric.test.ts', 'the checklist and its disclaimer']], gap: 'Sandbox only (LMS-006 designed): no performance levels, outcome mapping, versions or calibration, and no rubric table.' },
  { control: 'Calibration sets for multiple graders', status: 'not-started', evidence: [[MASTER, 'LMS-012: designed']], gap: 'The only calibration in the tree is a student’s confidence against their marks.' },
  { control: 'Inter-rater agreement view', status: 'not-started', evidence: [[MASTER, 'LMS-012: designed']], gap: 'One grader per record in the sandbox; nothing compares two.' },
  { control: 'Blind double-marking, where configured', status: 'not-started', evidence: [[MASTER, 'LMS-012: designed']], gap: 'None.' },
  { control: 'Moderation or second-review workflow', status: 'tested', evidence: [['app/src/lib/gradebook/ledger.ts', '`moderate`: a second person holding grades:moderate, never the grader, checks a draft grade; `release` holds a draft the scheme says must be moderated'], ['app/src/lib/gradebook/gradebook.test.ts', 'is a second person: the grader cannot moderate their own grade; holds a draft the scheme says must be moderated, and releases the moderated one']], gap: 'The moderator is a second human checking a draft in the gradebook of record; nothing in it involves an AI, and there is no blind double-marking, calibration set or inter-rater view.' },
  { control: 'Grade-change reason and audit trail', status: 'tested', evidence: [[SANDBOX, 'an appeal keeps the original mark in `was`; every action lands in `history`'], [SANDBOX_TEST, 'refuses an appeal with no reason in it; says how an appeal came out']], gap: 'Sandbox only, and only through an appeal: no override with a reason outside one (LMS-013 designed).' },
  { control: 'Student-visible feedback timing', status: 'tested', evidence: [[SANDBOX, 'a mark is shown to nobody until it is released'], [SANDBOX_TEST, 'shows a mark to nobody until it is released; does not show a mark before one has been released']], gap: 'Release is a control; nothing measures turnaround time.' },
  { control: 'Appeal or regrade request workflow', status: 'tested', evidence: [[SANDBOX, 'appeal: open → upheld or amended, with a reason and an answer; no archive while one is open'], [SANDBOX_TEST, 'an appeal; will not let a record be archived while an appeal is open'], ['app/src/lib/returned.ts', 'the student-side regrade window counted from the day the work came back'], ['app/src/lib/returned.test.ts', 'calendar and business days; nothing to say without a recorded window']], gap: 'Sandbox and a window counter; no institutional grade-change request (AM-18: no appeal route).' },
  { control: 'Accommodation-aware assessment records', status: 'building', evidence: [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'accommodation_passports: a functional summary, never a diagnosis; shares with an expiry'], ['supabase/expansion.check.sql', 'the audited read of a shared accommodation']], gap: 'A passport is stored and shared; nothing applies it to an assessment’s timing or format (LMS-009).' },
  { control: 'No AI-only final grade for consequential work', status: 'building', evidence: [['app/src/lib/governance/ai-assurance.ts', 'MODES_PROHIBITED: automated grading without human oversight, refused by nothing at intake'], ['app/src/ai/prompt.ts', 'no tool changes a grade, a dropped score or the grading scale'], ['app/src/lib/toolkit/rubric.ts', 'DISCLAIMER: not a grade prediction and not feedback from your instructor'], ['app/src/lib/teachback.ts', 'no grade']], gap: 'Held by the absence of any grading tool and by a Course Studio decision (D-100), not by a rule; no intake refusal names automated grading.' },
];

export const CONTROLS: readonly Control[] = ROWS.map((r, i) => ({
  ...r,
  id: `F${String(i + 1).padStart(2, '0')}`,
  evidence: r.evidence.map(([path, shows]) => ({ path, shows })),
}));

/**
 * The two rules the documents repeat most, at the code that refuses each — or
 * says none does. `refusedBy` names an entry of the AI intake's
 * `PROHIBITED_STARTING_SCOPE`, the one gate every AI use case passes; the
 * test imports that list and the prohibited modes, so a refusal added later
 * fails the page until it is re-read. Neither rule is held by a grading
 * workflow, because none exists: the analytics guard that refuses an
 * `integrity_flag` metric refuses a measure, not an action, and is not the
 * refusal.
 */
export const NEVER: readonly { rule: string; refusedBy: string | null; by: string; note: string }[] = [
  { rule: 'No automatic academic-misconduct accusation, grade penalty or disciplinary referral.', refusedBy: 'Disciplinary judgments', by: 'app/src/lib/governance/ai-lifecycle.ts', note: 'Refused at intake, for any AI use case. No grading workflow enforces it, because none exists; the analytics guard in institution-ops.ts refuses an integrity-flag metric, which is a measure, not an accusation.' },
  { rule: 'No AI-only final grade.', refusedBy: null, by: 'app/src/lib/governance/ai-assurance.ts', note: 'MODES_PROHIBITED lists automated grading without human oversight with nothing refusing it at intake; the instructor keeps grading by a Course Studio decision, not by a rule.' },
];

// ── The source-aware grading workflow ────────────────────────────────────────

export const GRADING_WORKFLOW: readonly string[] = [
  'Open the submission.',
  'View the assignment prompt and the rubric version alongside the work.',
  'See the relevant course-source references and the student’s citations.',
  'Select a criterion.',
  'Enter a score and an evidence-based comment.',
  'Optionally use AI to suggest possible rubric evidence or draft feedback.',
  'Review and edit every AI suggestion.',
  'Flag a missing source, an inaccessible file, a policy question or a suspected integrity issue.',
  'Submit the draft grade; calibrate or moderate if configured.',
  'Release the grade.',
];

/** What a released piece of feedback shows, criterion by criterion. */
export const FEEDBACK_FORMAT: readonly string[] = [
  'Criterion and score',
  'Rubric standard',
  'Observed in your submission',
  'Relevant source',
  'Suggested next action',
  'Feedback status: who authored it, and whether it is released',
];

/** What every grade change records. */
export const LEDGER: readonly string[] = [
  'Actor',
  'Role',
  'Timestamp',
  'Reason',
  'Prior value',
  'New value',
  'Rubric and version',
  'Approval, where required',
  'Sync status',
  'Audit correlation id',
];
