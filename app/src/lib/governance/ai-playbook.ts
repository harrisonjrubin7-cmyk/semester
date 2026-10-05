/**
 * The 2026 AI integration playbook — ten agentic workflows, the human-
 * confirmation matrix, the data classes, the AI vendor scorecard, the student
 * onboarding journey, the ROI scorecards and the definition of done — held to
 * the tree the way D-111 held the AI assurance matrix.
 *
 * Three documents of 29 September 2026 ask for it. They overlap heavily with
 * what is already in code: `ai-lifecycle.ts` owns the six gates, the release
 * gate and the ten intake refusals; `ai-assurance.ts` owns the NIST matrix,
 * the evaluation tiers and the 800-1 checklist; `toolkit/classification.ts`
 * owns the seven data tiers and the gate that says what may reach an AI path.
 * Nothing here replaces any of them. So:
 *
 * - every workflow's prohibited decision names the intake refusal that
 *   refuses it;
 * - every playbook data class names the `classification.ts` tiers it covers,
 *   and the test asks `gate()` whether each tier may reach AI — a class whose
 *   rule says "exclude" is only true if the gate really excludes it;
 * - every definition-of-done line names the `AI_RELEASE_GATE` item that
 *   carries it, or says none does;
 * - the vendor scorecard is executable (`scoreVendor`), and every AI party in
 *   `trust/subprocessors.ts` is on it, scored from the provider's own public
 *   documentation with a citation per score. Model quality stays unscored
 *   until the model-quality set is run and filed, so no provider is
 *   approvable yet.
 *
 * ## What a status may claim
 *
 * The four statuses of `ai-assurance.ts`, under its rule: `designed` cites a
 * document, `building` cites code, `tested` cites a test that runs on every
 * change, `not-started` cites at most a document. The supplied PDFs are never
 * evidence. Statuses were read at `origin/main` `beaa839` on 29 September 2026.
 *
 * ## One arithmetic correction
 *
 * The supplied scorecard's twelve weights summed to 95%, not 100%. The owner
 * asked for them to sum to 100, and the missing five points go to security
 * posture (10% → 15%): it is one of the three floors no weighted total can
 * offset, and the playbook's headline risks — prompt injection and excessive
 * agency — are security risks. The test holds the sum to 100.
 *
 * `docs/operating-model/AI-INTEGRATION-PLAYBOOK.md` is rendered from this file
 * by `ai-playbook.test.ts`; edit the data, then `npm run registers` from app/.
 */

import { AI_RELEASE_GATE, type ProhibitedScope } from './ai-lifecycle';
import type { Assessed, Status } from './ai-assurance';
import type { Tier } from '../toolkit/classification';

export { STATUSES, type Status } from './ai-assurance';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/AI-Integration-Playbook-2026.pdf',
    title: 'Semester 2026 AI integration playbook',
    what: 'The executive model and ten rules, the workflow card and action tiers A–E, the ten workflows, the mapping method, data classes and safeguards, the provider requirements, the vendor scorecard, onboarding, ROI, the build plan and the definition of done.',
  },
  {
    path: 'docs/expansion/AI-Integration-Playbook-Ten-Workflows-Summary.pdf',
    title: 'Build a 2026 AI integration playbook: map 10 agentic workflows across HR, engineering and sales with data security and ROI scorecards',
    what: 'The summary: which five workflows to build first, and the OWASP framing (prompt injection, excessive agency).',
  },
  {
    path: 'docs/expansion/Semester-Intelligence-Further-Integration.pdf',
    title: 'Any other ways to further integrate and implement and expand the capabilities and use of AI',
    what: 'Semester Intelligence as one layer: capabilities by domain, the action composer, the orchestrator, student-controlled memory, multimodal inputs, the confirmation matrix, measurement and a four-phase build order.',
  },
];

type Ev = [path: string, shows: string][];
const ev = (e: Ev) => e.map(([path, shows]) => ({ path, shows }));

// ── 1. The ten rules ─────────────────────────────────────────────────────────

export const RULES: readonly string[] = [
  'AI never decides authorization or bypasses database policy.',
  'AI receives only the minimum data required for the current request.',
  'AI may explain, draft and prepare; it may not silently send, share, schedule, enroll, pay, delete or change records.',
  'Every consequential action requires an exact preview and explicit user confirmation.',
  'Institutional data is processed only under the institution’s approved purpose, agreement, data scope, policy and retention rule.',
  'AI outputs based on institutional or course materials show source anchors or disclose missing sources.',
  'Uploaded material is untrusted data, never executable instruction.',
  'AI respects academic-integrity policy at institution, course and assignment levels.',
  'Students can see, correct, delete and control eligible AI history and memory.',
  'Every agentic workflow has an owner, an evaluation set, audit events, abuse controls, a kill switch and a rollback plan.',
];

// ── 2. Action-risk tiers ─────────────────────────────────────────────────────

export const ACTION_TIERS = ['A', 'B', 'C', 'D', 'E'] as const;
export type ActionTier = (typeof ACTION_TIERS)[number];

export const ACTION_TIER_ROWS: readonly { tier: ActionTier; name: string; example: string; control: string }[] = [
  { tier: 'A', name: 'Read-only explanation', example: 'Summarize a selected syllabus', control: 'Source check and output validation' },
  { tier: 'B', name: 'Draft creation', example: 'Draft an advisor agenda or study plan', control: 'User review before saving or sharing' },
  { tier: 'C', name: 'Internal state preparation', example: 'Propose an Action Center action or plan draft', control: 'Explicit user approval before persistence' },
  { tier: 'D', name: 'External or reversible action', example: 'Create a calendar draft, export a document', control: 'Exact preview and confirmation' },
  { tier: 'E', name: 'High-impact or regulated action', example: 'Send a message, share records, payment handoff, enrollment action', control: 'Fresh authentication, exact confirmation, audit; often an official handoff only' },
];

// ── 3. The ten workflows ─────────────────────────────────────────────────────

export type Audience = 'student' | 'institution' | 'internal';

export interface Workflow extends Assessed {
  /** `WF-nn`, stable, in the playbook's order. */
  id: string;
  name: string;
  audience: Audience;
  job: string;
  /** The highest action tier the workflow may reach, and only through its control. */
  reaches: ActionTier;
  prohibited: string;
  /** Intake refusals in `ai-lifecycle.ts` that already refuse part of `prohibited`. */
  refusedBy: readonly ProhibitedScope[];
  roi: { leading: string; outcome: string; guardrail: string };
  /** One of the five the summary says to build first. */
  first: boolean;
}

type WfRow = [
  name: string, audience: Audience, job: string, reaches: ActionTier, prohibited: string, refusedBy: ProhibitedScope[],
  roi: [leading: string, outcome: string, guardrail: string], first: boolean,
  status: Status, evidence: Ev, gap: string,
];

const WF_ROWS: readonly WfRow[] = [
  ['Student Path and Registration Copilot', 'student', 'Explain requirements, compare courses, find conflicts, propose backups and draft advisor questions; never register',
    'C', 'Certify degree completion, guarantee eligibility or a seat, register, add, drop or withdraw', ['Autonomous registration', 'Official degree certification'],
    ['Plan drafts created', 'Conflicts resolved; backups saved', 'Incorrect-source reports'], true,
    'tested', [['app/src/lib/registration-actions.test.ts', 'proposes a backup per unbacked section, a conflict and each unticked checklist item; nothing outside Registration Day Mode'], ['app/src/components/RegistrationDayCard.test.tsx', '“Semester never registers you”; the official system opens only after a confirmation that starts on Cancel'], ['app/src/lib/degree.test.ts', 'met means finished; in progress is not done'], ['docs/REGISTRATION-DAY-MODE.md', 'the mode and its boundary']],
    'The proposals are rules, not a model: no AI explains a requirement or drafts advisor questions from the plan, and no incorrect-source report route exists.'],
  ['Syllabus-to-Study Studio Agent', 'student', 'Turn authorized course materials into source-linked study assets, reviews, practice and study plans',
    'C', 'Fabricate sources, process disallowed material, answer active prohibited assessment questions', [],
    ['Study assets created', 'Study sessions completed; helpfulness', 'Citation coverage; integrity blocks'], true,
    'tested', [['app/src/lib/studystudio.test.ts', 'rejects invented source ids, unverifiable quotations and unsourced sections; source text stays data'], ['app/src/components/StudyStudio.anchors.test.tsx', 'each PDF excerpt named by its page, and a citation opens there'], ['app/src/lib/import-review.test.ts', 'deadlines need explicit verification even when valid'], ['app/src/lib/extractaccuracy.test.ts', 'extraction fidelity over a labelled corpus']],
    'No malware scan of uploads; citation coverage and helpfulness are not measured in production.'],
  ['Academic Integrity Guardrail Agent', 'student', 'Give allowed learning help and a useful alternative where help with active graded work is restricted',
    'A', 'Complete active graded submissions, fabricate sources or data, assist plagiarism evasion', [],
    ['Safe alternatives offered', 'Integrity-policy compliance; faculty trust', 'False-block rate'], true,
    'tested', [['app/src/lib/toolkit/policy.test.ts', 'a course that allows AI still does not allow final answers; a course that bans it is offered only redirects that need no AI'], ['app/src/lib/coursestudio.test.ts', 'final answers never permitted without the instructor confirming by name'], ['app/src/intelligence/assemble.test.ts', 'integrity policy re-evaluated for every request; no request assembled when policy permits no mode'], ['app/src/ai/helpstate.test.tsx', 'planning help kept for a course that bans AI help']],
    'No false-block measurement and no feedback route for a wrong refusal; refusals are not audited as events.'],
  ['Advisor Meeting Preparation Agent', 'student', 'Draft a student-reviewed agenda and share only the scope the student selects',
    'E', 'Reveal private study, health, financial or non-shared data to an advisor', [],
    ['Agendas created', 'Advisor usefulness; follow-up completion', 'Oversharing incidents'], true,
    'tested', [['app/src/components/AdvisorMeeting.test.tsx', 'shows exactly what the advisor will see and sends only after confirming; revokes only after confirming'], ['app/src/lib/advisor-meeting.test.ts', 'carries only what the student ticked; no field for notes, history or grades'], ['app/src/lib/advisor-shares.test.ts', 'always an expiry, never past 120 days; revocation stops that share only'], ['supabase/advisor.check.sql', 'expiry and revocation stop reads under RLS']],
    'The agenda is assembled from ticks, not drafted by AI; no advisor-usefulness score is collected.'],
  ['Campus Support Navigator', 'student', 'Route to verified resources and prepare a safe official handoff',
    'E', 'Diagnosis, emergency-triage promises, legal, medical or financial determinations, disclosure of restricted data', ['Health decisions'],
    ['Search-to-action conversion', 'Successful resource handoffs', 'Stale-content reports'], true,
    'tested', [['app/src/components/GetHelp.test.tsx', 'wellbeing offers a crisis line and no way to send anything; a request sends only the ticked lines, after confirming'], ['app/src/lib/help-routes.test.ts', 'nothing ticked by default'], ['app/src/lib/basicneeds.test.ts', 'seventeen categories, each routing only to offices that exist'], ['docs/CRISIS-RESPONSE-RUNBOOK.md', 'escalation for student harm']],
    'Routing is a directory lookup; no AI reads a described problem and names the office, and no source-freshness alert exists for the directory.'],
  ['Career Evidence and Opportunity Agent', 'student', 'Turn confirmed work into portfolio evidence and prepare career actions',
    'D', 'Invent achievements, apply automatically, rank students for employers, infer protected traits', ['Opaque risk scoring', 'Ranking students for employers'],
    ['Skills confirmed', 'Portfolio or application milestone', 'Invented-claim corrections'], false,
    'tested', [['app/src/lib/career-evidence.test.ts', 'confirmed, renamed, rejected and undone; no word or number the student did not supply'], ['app/src/components/CareerEvidence.test.tsx', 'every suggested skill unconfirmed until the student decides; a résumé opens in Write only after its preview'], ['docs/CAREER-EVIDENCE.md', 'the design']],
    'No opportunity ranking, no job-description comparison and no match reasons.'],
  ['Institutional Content Governance Agent', 'institution', 'Keep campus resources, policies, events and opportunities accurate and accessible',
    'D', 'Auto-publish policy changes, override a content owner, alter an official record without approval', ['Auto-publishing institutional policy'],
    ['Stale items identified', 'Freshness improvement', 'Incorrect auto-draft rate'], false,
    'building', [['app/src/lib/launch/content.test.ts', 'each content row has a source, owner, review, visibility, expiry and correction; a stale review is refused'], ['app/src/components/institutional/CampaignManager.test.tsx', 'Approve shown only to the named approver; locked once out of draft'], ['app/src/lib/official-notices.ts', 'a stale emergency never says Required']],
    'There is no AI agent here: owner approval and staleness rules exist for content, and nothing drafts summaries, finds broken links or builds accessibility checklists.'],
  ['Engineering Reliability Triage Agent', 'internal', 'Summarize incidents, correlate errors, propose runbook steps and regression tests',
    'B', 'Deploy code, alter production data, rotate credentials, change the firewall, close incidents without approval', ['Unapproved production changes'],
    ['Incidents summarized', 'MTTR reduction; recurrence reduction', 'Secret or PII exposure incidents'], false,
    'building', [['app/src/lib/integration/redact.ts', 'tokens, keys and emails redacted from integration errors and logs'], ['app/server/institution/intelligence.test.ts', 'provider failure mapped without logging questions or protected source bodies'], ['app/src/lib/governance/incident-comms.ts', 'incident notices refuse placeholders and speculation']],
    'Log redaction exists; no AI triage agent, and no read-only connector to logs or the issue tracker.'],
  ['Institutional Sales and RFP Copilot', 'internal', 'Prepare accurate RFP answers, pilot scopes, security responses and implementation plans',
    'B', 'Unsupported compliance claims, unapproved pricing, signing contracts, disclosing protected customer data', [],
    ['Draft responses', 'Response cycle time; conversion', 'Unsupported-claim corrections'], false,
    'tested', [['app/src/lib/ops/claims.test.ts', 'catches a word above what the claims register supports, and a claim on expired evidence'], ['app/src/lib/gtm/rfp.test.ts', 'never claims something exists without citing it; “available now” only where every control is READY'], ['docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md', 'the approved answer library']],
    'The approved claims library and its guard exist; nothing drafts an answer with AI, so the guard has never checked a generated one.'],
  ['Talent and Hiring Operations Copilot', 'internal', 'Organize role requirements, interview logistics, onboarding material and candidate communications',
    'B', 'Automated hiring decisions, ranking on protected characteristics, inferring sensitive traits, sending offers without approval', ['Automated hiring decisions'],
    ['Interview kits generated', 'Prep-time reduction', 'Bias or quality issue reports'], false,
    'not-started', [],
    'Nothing in the tree. Semester has no hires, no ATS and no HRIS; this workflow waits on a team. An automated hiring decision is refused at intake.'],
];

export const WORKFLOWS: readonly Workflow[] = WF_ROWS.map(([name, audience, job, reaches, prohibited, refusedBy, [leading, outcome, guardrail], first, status, evidence, gap], i) => ({
  id: `WF-${String(i + 1).padStart(2, '0')}`,
  name, audience, job, reaches, prohibited, refusedBy, roi: { leading, outcome, guardrail }, first, status, evidence: ev(evidence), gap,
}));

// ── 4. The human-confirmation matrix ─────────────────────────────────────────

export interface Confirmation extends Assessed {
  /** `HC-nn`, stable. */
  id: string;
  action: string;
  automatic: boolean;
  control: string;
  tier: ActionTier;
}

type HcRow = [action: string, automatic: boolean, control: string, tier: ActionTier, status: Status, evidence: Ev, gap: string];

const HC_ROWS: readonly HcRow[] = [
  ['Summarize selected course material', true, 'After a source-access check: cite the source and allow correction', 'A',
    'tested', [['app/src/lib/studystudio.test.ts', 'unsourced sections and unverifiable quotations rejected'], ['app/src/components/StudyStudio.anchors.test.tsx', 'a citation opens at its page']], 'No correction route from a summary back to its source.'],
  ['Generate flashcards and practice', true, 'After a source-access check: label as generated; allow editing and deletion', 'B',
    'tested', [['app/src/lib/studystudio.test.ts', 'generated study assets held to their sources']], 'No test holds a “generated” label on each asset.'],
  ['Draft an advisor agenda', true, 'Student review before sharing', 'B',
    'tested', [['app/src/components/AdvisorMeeting.test.tsx', 'shows exactly what the advisor will see before anything is sent']], 'The agenda is assembled from the student’s ticks, not drafted by a model.'],
  ['Suggest a study block', true, 'Student approves before the calendar write', 'B',
    'tested', [['app/src/components/LifeBalance.test.tsx', 'a suggested study block is added only after a preview, with focus on Cancel']], 'Holds for Life Balance; the assistant does not propose study blocks.'],
  ['Create an internal Action Center draft', true, 'Student can edit and approve', 'C',
    'tested', [['app/src/ai/prompt.test.ts', 'calling a tool is a proposal, not an act'], ['app/src/ai/Actions.tsx', '“Nothing here has happened”: each proposal is a button the student has not pressed']], 'A proposal cannot be edited before it is approved, only taken or left.'],
  ['Save a plan change', false, 'Exact preview and confirmation', 'C',
    'tested', [['app/src/lib/registration-actions.test.ts', 'a backup or conflict is proposed, never applied'], ['app/src/ai/Actions.tsx', 'each proposal labelled with the change it will make']], 'No screen test clicks a plan-change confirmation from the assistant.'],
  ['Send an email or message', false, 'Exact draft, recipient and confirmation', 'E',
    'tested', [['app/src/components/GetHelp.test.tsx', 'sends only the question and the ticked lines, after the student confirms'], ['app/src/components/AdvisorMeeting.test.tsx', 'sends only after confirming']], 'No email leaves Semester; the rule is proved for in-app requests, not for mail.'],
  ['Create a calendar event', false, 'Exact preview and confirmation', 'D',
    'building', [['app/src/components/LifeBalance.tsx', 'a suggested study block reaches the plan only through its preview']], 'No external calendar write exists; the rule has not met one.'],
  ['Share a plan', false, 'Scope, recipient, expiry and confirmation', 'E',
    'tested', [['app/src/lib/advisor-shares.test.ts', 'always an expiry, never past 120 days; revocation by share'], ['supabase/advisor.check.sql', 'an expired or revoked share stops reads under RLS']], 'Advisor shares only; no other recipient kind exists.'],
  ['Export a document', false, 'Preview, destination and confirmation', 'D',
    'tested', [['app/src/components/AdvisorMeeting.test.tsx', 'exports only after a preview that leaves out private notes']], 'One export path is held; others are not audited against the rule.'],
  ['Register or change enrollment', false, 'Official handoff only unless institutionally authorized', 'E',
    'tested', [['app/src/components/RegistrationDayCard.test.tsx', 'the official system opens only after a confirmation that starts on Cancel; Semester registers nobody'], ['app/src/lib/governance/ai-lifecycle.test.ts', 'autonomous registration refused at intake']], 'None: the handoff is the whole of it, which is what the playbook asks.'],
  ['Make a payment', false, 'Provider-hosted flow and explicit confirmation', 'E',
    'tested', [['app/src/lib/billing/checkout.test.ts', 'explicit consent to a named wording first, then a hosted page; nothing charged on provider failure']], 'No AI path reaches billing; the rule is proved for the student’s own checkout.'],
  ['Delete data', false, 'Explicit confirmation, retention policy, audit event', 'E',
    'tested', [['app/src/components/TrustCenter.test.tsx', 'saved conversations deleted only after a confirmation, archive included and nothing else']], 'No audit event is written for a student’s own deletion.'],
];

export const CONFIRMATIONS: readonly Confirmation[] = HC_ROWS.map(([action, automatic, control, tier, status, evidence, gap], i) => ({
  id: `HC-${String(i + 1).padStart(2, '0')}`,
  action, automatic, control, tier, status, evidence: ev(evidence), gap,
}));

// ── 5. Data classes, crosswalked to the classification gate ──────────────────

export interface DataClass {
  name: string;
  examples: string;
  rule: string;
  /** The `classification.ts` tiers this class covers. Empty: the gate has no tier for it. */
  tiers: readonly Tier[];
  /** What the rule says about sending it to AI for the student's own task, where the course allows AI. */
  reachesAi: boolean;
  note: string;
}

export const DATA_CLASSES: readonly DataClass[] = [
  { name: 'Public', examples: 'Published catalog, public event, public policy', rule: 'May be used in approved retrieval with source citation', tiers: ['T0'], reachesAi: true, note: 'T0 in the gate.' },
  { name: 'Internal', examples: 'Institution operations documentation', rule: 'Use only with tenant authorization and need-to-know access', tiers: [], reachesAi: false, note: 'The student-side gate has no tier for institution operations material; the gateway’s approved_source rows are the control, per tenant.' },
  { name: 'Student private', examples: 'Student plan, goals, drafts, study activity, portfolio', rule: 'Use only for the student’s selected purpose; never expose to staff by default', tiers: ['T2'], reachesAi: true, note: 'T2 (your own academic work) in the gate; staff exposure is governed by the share tables, not the gate.' },
  { name: 'Restricted', examples: 'Education records, financial details, accommodations, health, conduct, authentication secrets', rule: 'Exclude by default; require a narrow approved workflow, explicit authority, strict logs, and often no AI processing', tiers: ['T3', 'T4', 'T5', 'T6'], reachesAi: false, note: 'T3–T6 in the gate; unclassified material is treated as T3 and blocked.' },
];

/** Tiers no playbook class covers; the test holds the classes and this list to every tier the gate has. */
export const TIERS_WITHOUT_A_CLASS: readonly Tier[] = ['T1'];

// ── 6. What must never be sent casually to AI ────────────────────────────────

export interface NeverSend extends Assessed {
  /** `NS-nn`, stable. */
  id: string;
  item: string;
}

type NsRow = [item: string, status: Status, evidence: Ev, gap: string];

const NS_ROWS: readonly NsRow[] = [
  ['Raw passwords, secrets, API keys, session tokens or credentials', 'building', [['app/src/lib/integration/redact.ts', 'tokens, keys and secrets redacted from integration errors and logs']], 'Redaction runs on integration logs; nothing scrubs a prompt before it is sent (AI assurance MR row on redaction).'],
  ['Unnecessary full student records', 'tested', [['app/src/lib/toolkit/classification.test.ts', 'unclassified material counts as an education record and stays away from AI'], ['app/src/lib/integration/classification.test.ts', 'T3 and above never go to a consumer model']], 'The gate refuses what is classified; it cannot see an unclassified record pasted into chat.'],
  ['Health, diagnosis, disability, conduct, disciplinary or emergency details', 'tested', [['app/src/lib/toolkit/classification.test.ts', 'T4–T6 hard-blocked from every action']], 'As above: a lookup, not a scan of free text.'],
  ['Detailed financial-aid records, payment credentials, bank data or ledger detail', 'tested', [['app/src/lib/integration/classification.test.ts', 'T4–T6 hard-blocked from AI']], 'Payment details never pass through Semester (Stripe’s hosted page); aid records are T4 by lookup only.'],
  ['Private advisor notes or counseling information', 'tested', [['app/src/lib/advisor-meeting.test.ts', 'the meeting pack has no field for notes, history or grades']], 'Held for the advisor pack; the assistant has no rule naming advisor notes.'],
  ['Full class rosters where aggregate or de-identified data will work', 'building', [['app/src/lib/toolkit/classification.ts', 'rosters named as T3, blocked from AI']], 'No aggregate or de-identification path exists to prefer.'],
  ['Hiring decisions or protected-trait data', 'building', [['app/src/ai/prompt.ts', 'the assistant is told what it must not infer about the student']], 'No hiring data exists; the no-inference rule is a prompt line, not a filter.'],
  ['Anything the user has not authorized for the active request', 'tested', [['packages/institution/src/policy.test.ts', 'ai.retrieve_source refuses revoked, quarantined or unshared sources'], ['app/src/lib/help-routes.test.ts', 'nothing ticked by default, so the question goes alone']], 'Holds at the gateway and in help requests; the on-device assistant sends its own context.'],
];

export const NEVER_SEND: readonly NeverSend[] = NS_ROWS.map(([item, status, evidence, gap], i) => ({
  id: `NS-${String(i + 1).padStart(2, '0')}`, item, status, evidence: ev(evidence), gap,
}));

// ── 7. The AI vendor scorecard ───────────────────────────────────────────────

export const DIMENSIONS = [
  'data-use', 'privacy-retention', 'security', 'education-fit', 'citations', 'tool-safety',
  'injection', 'model-quality', 'accessibility', 'reliability', 'cost', 'portability',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_ROWS: readonly { id: Dimension; name: string; weight: number; five: string }[] = [
  { id: 'data-use', name: 'Data-use restrictions', weight: 15, five: 'Contractually no training or secondary use without explicit authorization' },
  { id: 'privacy-retention', name: 'Privacy and retention controls', weight: 10, five: 'Configurable retention, deletion, access controls, clear subprocessors' },
  { id: 'security', name: 'Security posture', weight: 15, five: 'Strong documented security, encryption, auditability, incident process' },
  { id: 'education-fit', name: 'Education-policy fit', weight: 8, five: 'Supports source grounding, academic-integrity controls, policy routing' },
  { id: 'citations', name: 'Source and citation support', weight: 8, five: 'Structured retrieval, stable citations, provenance support' },
  { id: 'tool-safety', name: 'Tool-use safety', weight: 8, five: 'Narrow tools, confirmation controls, guardrails against excessive agency' },
  { id: 'injection', name: 'Prompt-injection resilience', weight: 8, five: 'Tested mitigations and safe context and tool boundaries' },
  { id: 'model-quality', name: 'Model quality', weight: 8, five: 'Reliable performance on Semester evaluation sets' },
  { id: 'accessibility', name: 'Accessibility capability', weight: 5, five: 'Supports captions, structured output, multilingual and plain-language use' },
  { id: 'reliability', name: 'Reliability and latency', weight: 5, five: 'SLOs, fallbacks, regional availability, predictable performance' },
  { id: 'cost', name: 'Cost transparency', weight: 5, five: 'Clear pricing, quotas, monitoring, controllable unit economics' },
  { id: 'portability', name: 'Portability', weight: 5, five: 'Provider-agnostic architecture, exportable prompts and evaluations, low lock-in' },
];

/** 100: the supplied weights, with security posture raised from 10 to 15. See the file comment. */
export const WEIGHT_SUM = DIMENSION_ROWS.reduce((s, d) => s + d.weight, 0);

export const OVERALL_MINIMUM = 4.0;
/** Floors no weighted total can offset. `tool-safety` binds only for agentic workflows. */
export const FLOORS: readonly { id: Dimension; min: number; agenticOnly?: true }[] = [
  { id: 'data-use', min: 4.0 },
  { id: 'privacy-retention', min: 4.0 },
  { id: 'security', min: 4.0 },
  { id: 'tool-safety', min: 4.0, agenticOnly: true },
];

export type Scores = Partial<Record<Dimension, number>>;

export interface VendorVerdict {
  verdict: 'approve' | 'refuse' | 'unscored';
  /** Weighted mean over the supplied weights, 0–5; null until every dimension is scored. */
  weighted: number | null;
  reasons: readonly string[];
}

/**
 * The scorecard, executable. A provider is not approved on model quality: every
 * dimension must be scored, the weighted mean must reach 4.0, and no floor may
 * be missed however high the rest scores. `blocker` is a critical legal,
 * security or privacy finding, which refuses outright.
 */
export function scoreVendor(scores: Scores, opts: { agentic: boolean; blocker?: string }): VendorVerdict {
  for (const [k, v] of Object.entries(scores)) {
    if (!(DIMENSIONS as readonly string[]).includes(k)) throw new Error(`no such dimension: ${k}`);
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 5) throw new Error(`${k} must be scored 0–5, got ${v}`);
  }
  const missing = DIMENSIONS.filter((d) => scores[d] === undefined);
  const reasons: string[] = [];
  if (opts.blocker) reasons.push(`Critical blocker: ${opts.blocker}`);
  if (missing.length) {
    reasons.push(`Unscored: ${missing.map((d) => DIMENSION_ROWS.find((r) => r.id === d)!.name).join(', ')}`);
    return { verdict: opts.blocker ? 'refuse' : 'unscored', weighted: null, reasons };
  }
  // The threshold is compared with the unrounded mean: 3.996 must not round up into an approval.
  const raw = DIMENSION_ROWS.reduce((s, d) => s + d.weight * scores[d.id]!, 0) / WEIGHT_SUM;
  const weighted = Math.round(raw * 100) / 100;
  if (raw < OVERALL_MINIMUM) reasons.push(`Weighted ${raw.toFixed(3)} is below ${OVERALL_MINIMUM.toFixed(1)}`);
  for (const f of FLOORS) {
    if (f.agenticOnly && !opts.agentic) continue;
    if (scores[f.id]! < f.min) reasons.push(`${DIMENSION_ROWS.find((r) => r.id === f.id)!.name} ${scores[f.id]} is below its floor of ${f.min.toFixed(1)}`);
  }
  return { verdict: reasons.length ? 'refuse' : 'approve', weighted, reasons };
}

// ── 7a. The providers, scored from their own public documentation ───────────

/**
 * A score rests on one page the provider publishes, and says what that page
 * says. A dimension public documentation cannot answer stays unscored with its
 * reason — model quality above all, which the scorecard defines as performance
 * on Semester's own evaluation set: the set exists (`model-quality.ts`) and
 * has not been run, and no run is filed.
 *
 * These are desk scores from public documentation read on `CHECKED`, not
 * contract review: nothing here is a signed DPA, and a provider cannot be
 * approved until every dimension is scored.
 */
export const CHECKED = '2026-09-29';

export type Provider = 'Anthropic' | 'OpenAI';

export type Basis = { score: number; url: string; says: string } | { unscored: string };

/** Hosts a basis may cite: the provider's own. */
export const OFFICIAL_HOSTS: Record<Provider, readonly string[]> = {
  Anthropic: ['anthropic.com', 'claude.com'],
  OpenAI: ['openai.com'],
};

/** The file the model-quality set lives in; the test holds it to existing. */
export const EVAL_SET = 'app/src/lib/governance/model-quality.ts';

const NO_EVAL = `Scored against Semester’s own evaluation set (${EVAL_SET}, run by app/src/ai/modelquality.live.test.ts), which has not been run against this provider. A run filed under docs/evidence/ai/ is the only thing this score may cite.`;

export const PROVIDER_BASIS: Record<Provider, Record<Dimension, Basis>> = {
  Anthropic: {
    'data-use': { score: 5, url: 'https://www.anthropic.com/legal/commercial-terms', says: 'Contractual: “Anthropic may not train models on Customer Content from Services”; the only use is feedback a user explicitly sends.' },
    'privacy-retention': { score: 4, url: 'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data', says: 'Inputs and outputs deleted within 30 days; flagged content kept up to 2 years; zero retention only by arrangement with sales, and not for every model; subprocessors published.' },
    security: { score: 5, url: 'https://www.anthropic.com/legal/data-processing-addendum', says: 'Breach notice “in any event within 48 hours”; AES-256 at rest, TLS 1.2+; SOC 2 Type II, ISO 27001 and ISO 42001 cover the API.' },
    'education-fit': { score: 3, url: 'https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors', says: 'Safeguards required for minors (age checks, AI disclosure, COPPA); no FERPA terms for the API — the K-12 DPA covers only Claude for Teachers.' },
    citations: { score: 5, url: 'https://platform.claude.com/docs/en/build-with-claude/citations', says: 'Citations “return the exact passages that support each claim”; generally available on all active models.' },
    'tool-safety': { score: 4, url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview', says: 'Client tools run in the application; strict schemas make tool calls match exactly; server tools exist and must be left off.' },
    injection: { score: 3, url: 'https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks', says: 'Documented guidance (screens, layered defences, monitoring); no tested mitigation evidence Semester can inspect.' },
    'model-quality': { unscored: NO_EVAL },
    accessibility: { score: 3, url: 'https://platform.claude.com/docs/en/build-with-claude/multilingual-support', says: 'Strong multilingual performance and strict structured output; no speech-to-text in the API.' },
    reliability: { score: 2, url: 'https://platform.claude.com/docs/en/api/service-tiers', says: 'Standard tier is “best-effort availability”; no SLA in the terms; 60 days’ notice before a model is retired.' },
    cost: { score: 5, url: 'https://platform.claude.com/docs/en/api/rate-limits', says: 'Published per-tier rate limits, customer-set spend limits per organisation or workspace, and a usage and cost API.' },
    portability: { score: 2, url: 'https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk', says: 'An OpenAI-compatible endpoint exists but is “not considered a long-term or production-ready solution”.' },
  },
  OpenAI: {
    'data-use': { score: 5, url: 'https://cdn.openai.com/osa/openai-services-agreement.pdf', says: 'Contractual: “OpenAI will not use Customer Content to develop or improve the Services, unless Customer explicitly agrees”.' },
    'privacy-retention': { score: 4, url: 'https://developers.openai.com/api/docs/guides/your-data', says: 'Abuse logs up to 30 days; zero retention by approval for eligible customers; some endpoints keep data until deleted; twelve storage regions.' },
    security: { score: 4, url: 'https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf', says: 'Breach notice “without undue delay”, with no fixed hours; the trust portal lists SOC 2, ISO 27001 and 42001 but describes itself as for ChatGPT, so API coverage is not confirmed on an official page.' },
    'education-fit': { score: 4, url: 'https://cdn.openai.com/osa/openai-sdpa.pdf', says: 'A Student Data Privacy Agreement names OpenAI a FERPA school official, but its text names ChatGPT Edu, so API coverage needs confirming; under-13 data requires zero retention.' },
    citations: { score: 4, url: 'https://developers.openai.com/api/docs/guides/tools-file-search', says: 'File search returns “file citations”; citations come through the hosted file tool, not arbitrary passages.' },
    'tool-safety': { score: 4, url: 'https://developers.openai.com/api/docs/guides/function-calling', says: 'Function calls run in the application; strict mode enforces the schema; hosted tools (web search, code execution, MCP) exist and must be left off.' },
    injection: { score: 3, url: 'https://developers.openai.com/api/docs/guides/safety-best-practices', says: 'Documented guidance and a free moderation endpoint; no tested mitigation evidence Semester can inspect.' },
    'model-quality': { unscored: NO_EVAL },
    accessibility: { score: 4, url: 'https://developers.openai.com/api/docs/guides/speech-to-text', says: 'Native transcription with timestamps and speaker labels, strict structured output; translation only into English.' },
    reliability: { score: 3, url: 'https://developers.openai.com/api/docs/deprecations', says: 'At least six months’ notice before a GA model is retired; no SLA in the services agreement.' },
    cost: { score: 5, url: 'https://developers.openai.com/api/docs/guides/spend-limits', says: 'Hard spend limits per organisation or project that return 429 when reached, and a usage and costs API.' },
    portability: { unscored: 'No official page speaks to portability or lock-in.' },
  },
};

export const scoresOf = (p: Provider): Scores =>
  Object.fromEntries(Object.entries(PROVIDER_BASIS[p]).flatMap(([d, b]) => ('score' in b ? [[d, b.score]] : []))) as Scores;

/**
 * What the scored dimensions already say, before the rest are scored: the
 * weighted mean over them, and any floor already missed. Never a verdict.
 */
export function provisional(scores: Scores, agentic: boolean): { weighted: number | null; scoredWeight: number; floorsMissed: readonly Dimension[] } {
  const scored = DIMENSION_ROWS.filter((d) => scores[d.id] !== undefined);
  const w = scored.reduce((s, d) => s + d.weight, 0);
  const weighted = w ? Math.round((scored.reduce((s, d) => s + d.weight * scores[d.id]!, 0) / w) * 100) / 100 : null;
  const floorsMissed = FLOORS.filter((f) => (!f.agenticOnly || agentic) && scores[f.id] !== undefined && scores[f.id]! < f.min).map((f) => f.id);
  return { weighted, scoredWeight: w, floorsMissed };
}

/**
 * Every AI party `trust/subprocessors.ts` names, on the scorecard, scored as
 * the provider it reaches. A student’s own key reaches the same provider under
 * the same API terms, so it carries the same scores.
 */
export const VENDORS: readonly { party: string; provider: Provider; agentic: boolean; scores: Scores; note: string }[] = [
  { party: 'Anthropic (Semester’s key)', provider: 'Anthropic', agentic: false, scores: scoresOf('Anthropic'), note: 'The shared key drops code execution, web fetch and MCP tools (claudeclamp.test.ts), so it is scored as non-agentic. Some newer models cannot run with zero retention.' },
  { party: 'OpenAI (institution-approved)', provider: 'OpenAI', agentic: true, scores: scoresOf('OpenAI'), note: 'Called with store: false. The gateway issues server-side, single-use actions, so it is scored as agentic and the tool-use floor binds. Security and education scores rest on coverage OpenAI should confirm in writing.' },
  { party: 'Anthropic (student’s own key)', provider: 'Anthropic', agentic: false, scores: scoresOf('Anthropic'), note: 'The student’s own contract with the provider; scored only to decide whether to offer the option.' },
  { party: 'OpenAI (student’s own key)', provider: 'OpenAI', agentic: false, scores: scoresOf('OpenAI'), note: 'As above.' },
];

export const PROVIDER_REQUIREMENTS: readonly { requirement: string; verification: string }[] = [
  { requirement: 'Contractual data-use restrictions', verification: 'Legal and security review' },
  { requirement: 'No unauthorized training on customer data', verification: 'Provider terms and configuration evidence' },
  { requirement: 'Encryption and access controls', verification: 'Security documentation' },
  { requirement: 'Regional and data-residency suitability where required', verification: 'Provider documentation' },
  { requirement: 'Retention controls', verification: 'Provider configuration and agreement' },
  { requirement: 'Subprocessor disclosure', verification: 'Vendor documentation' },
  { requirement: 'Incident notification obligations', verification: 'Contract and legal review' },
  { requirement: 'Logging and audit support', verification: 'Technical evaluation' },
  { requirement: 'Model and version change controls', verification: 'Provider change process' },
  { requirement: 'Reliability and fallback', verification: 'SLO evidence and routing plan' },
  { requirement: 'Cost controls', verification: 'Rate limits, quotas, usage reporting' },
  { requirement: 'Prompt-injection and tool-use protections', verification: 'Security test evidence' },
];

// ── 8. Student onboarding ────────────────────────────────────────────────────

export interface OnboardingStep extends Assessed {
  /** `OB-nn`, stable. */
  id: string;
  step: string;
  asks: string;
}

type ObRow = [step: string, asks: string, status: Status, evidence: Ev, gap: string];

const OB_ROWS: readonly ObRow[] = [
  ['Welcome and trust', 'Account or institutional sign-in; concise privacy, AI, accessibility and support links; institution-sponsored or personal account',
    'tested', [['app/src/data/onboarding.test.ts', 'asks for an account with the one form both places share'], ['app/src/screens/Onboarding.tsx', 'the adoption prompt and its steps']],
    'No step asks whether the account is institution-sponsored, and the four trust sentences (you control what you share; sources are visible; estimates are labelled; settings change any time) are not on the welcome.'],
  ['Choose a starting point', 'What would be most helpful today? Six choices, each routing to the smallest onboarding path',
    'tested', [['app/src/components/unity/unity.test.tsx', 'FirstGoal: choosing, landing and Change'], ['app/src/lib/unity.test.ts', 'every goal’s screen is a real destination'], ['docs/ONBOARDING-AND-CONTEXTUAL-HELP.md', '“What would help most today?” and its six goals']],
    'Five of the six choices have a goal; “Organize this week” has none, and FirstGoal carries “Prepare for registration”, which the playbook does not list.'],
  ['Build minimum context', 'School, program, current or target term, expected graduation, today’s goal; optional study times and constraints',
    'tested', [['app/src/data/onboarding.test.ts', 'asks which term it is, on the screen that asks where'], ['app/src/lib/source.test.ts', 'every source label named and explained']],
    'Program and expected graduation are not asked at onboarding; study-time preferences live in Life Balance, not here.'],
  ['Deliver the first useful result', 'The outcome each starting choice promises, within minutes',
    'tested', [['app/src/screens/onboardingcounts.test.tsx', 'counts what is the student’s own while the sample is loaded'], ['app/src/screens/firstrun.test.ts', 'an empty app says what to do next']],
    'The first result is deadlines from a syllabus; no measure says whether it arrived in five minutes.'],
  ['Explain the result', 'Why this appeared, data used, what is estimated or missing, what can change, what to do next',
    'tested', [['app/src/intelligence/Disclosure.test.tsx', 'each answer shows source locators, origin, mode and an AI-assisted badge'], ['app/src/lib/source.test.ts', 'only the institution’s own facts say “verified”']],
    'Answers name sources and origin; no recommendation carries a “why this appeared” line with the data used.'],
  ['Invite, do not demand, connections', 'Calendar, course materials, an advisor agenda, a study group, events, accessibility, AI source and history controls — each after value, with incremental consent',
    'tested', [['app/src/components/TrustCenter.test.tsx', 'says what is connected, what the labels mean and what AI may not use; deletes saved conversations only after a confirmation'], ['docs/ONBOARDING-AND-CONTEXTUAL-HELP.md', 'connections deferred until a workflow needs them']],
    'No AI-source selector (selected, course or institution sources) and no memory categories; AI history deletion is all-or-nothing.'],
];

export const ONBOARDING: readonly OnboardingStep[] = OB_ROWS.map(([step, asks, status, evidence, gap], i) => ({
  id: `OB-${String(i + 1).padStart(2, '0')}`, step, asks, status, evidence: ev(evidence), gap,
}));

export const FIRST_GOAL = 'I now know what I need to do next.';

/**
 * The six starting choices, each held to the `FirstGoal` choice in
 * `lib/goals.ts` that already carries it, or null where none does.
 */
export const STARTING_CHOICES: readonly { choice: string; outcome: string; goal: string | null }[] = [
  { choice: 'Plan my next term', outcome: 'Basic term plan and visible weekly schedule', goal: 'semester' },
  { choice: 'Understand my academic path', outcome: 'Path Snapshot with what is known, estimated, and needs review', goal: 'degree' },
  { choice: 'Organize this week', outcome: 'Today briefing and top three actions', goal: null },
  { choice: 'Get help with a course', outcome: 'Course workspace or study plan using selected materials', goal: 'study' },
  { choice: 'Find campus support', outcome: 'Verified resource recommendation and safe handoff', goal: 'support' },
  { choice: 'Explore career options', outcome: 'Starter goal, related skills, opportunity or portfolio checklist', goal: 'career' },
];

export const FIRST_WEEK: readonly { day: number; moment: string }[] = [
  { day: 0, moment: 'First clear action and saved plan or context' },
  { day: 1, moment: 'Today briefing and one useful prompt' },
  { day: 2, moment: 'Ask the student to review sources or add one deadline or course' },
  { day: 3, moment: 'Suggest an advisor agenda, study plan or campus resource if relevant' },
  { day: 5, moment: 'Gentle check-in: “Did this help you understand what to do next?”' },
  { day: 7, moment: 'Weekly reset: priorities, schedule, deadlines, study blocks, opportunities' },
];

// ── 9. Semester Intelligence: memory and multimodal inputs ───────────────────

export const LAYER: readonly { verb: string; does: string }[] = [
  { verb: 'Understand', does: 'Summarize, extract, classify, connect' },
  { verb: 'Explain', does: 'Teach, clarify, compare, translate, recommend' },
  { verb: 'Generate', does: 'Drafts, plans, study assets, outlines, agendas' },
  { verb: 'Prepare', does: 'Calendar drafts, advisor agendas, applications, follow-ups' },
  { verb: 'Verify', does: 'Sources, citations, freshness, policy, permissions' },
  { verb: 'Assist', does: 'Hand off to a human, office, tutor, advisor, mentor or support team' },
];

export interface Capability extends Assessed {
  /** `IN-nn`, stable. */
  id: string;
  input: string;
  capability: string;
}

type InRow = [input: string, capability: string, status: Status, evidence: Ev, gap: string];

const IN_ROWS: readonly InRow[] = [
  ['Syllabus PDF', 'Reviewable deadlines, policies, objectives, grading, office hours',
    'tested', [['app/src/lib/extractaccuracy.test.ts', 'extraction fidelity over a labelled syllabus corpus'], ['app/src/lib/import-review.test.ts', 'explicit verification before a calendar is activated']], 'Policies, objectives and office hours are not extracted as reviewable fields.'],
  ['Slides', 'Source-linked summary, glossary, practice, concept map',
    'tested', [['app/src/components/StudyStudio.anchors.test.tsx', 'excerpts named by page; citations open there']], 'No concept map or glossary output.'],
  ['Audio or lecture video', 'Transcript, timestamped review guide, captions, study prompts',
    'tested', [['app/src/lib/transcribe.test.ts', 'a stable hour-minute-second locator for cited transcript moments'], ['app/src/components/CourseCapture.test.tsx', 'explicit consent; audio, video, image and document files accepted']], 'No caption file is produced.'],
  ['Image of a flyer', 'Event, deadline, location, contact, action items',
    'not-started', [], 'Images are accepted by course capture; nothing extracts an event from one.'],
  ['Screenshot of a hold notice', 'Plain-language explanation, the official next step, a reviewable action',
    'not-started', [], 'Nothing reads a hold notice.'],
  ['Degree-audit screenshot', 'Possible requirements or open items marked Needs review',
    'not-started', [], 'Degree data is entered or imported, never read from a screenshot.'],
  ['Spreadsheet or CSV', 'Explain data, charts, missing values, a methods note',
    'tested', [['app/src/lib/extract.test.ts', 'reads markdown, CSV and a file the browser knows only by type']], 'Read as text for extraction; no data explanation or chart.'],
  ['Research article', 'Structured reading guide, evidence table, citation-aware outline',
    'designed', [['docs/ai-toolkit/LITERATURE-SYNTHESIS-AND-CITATION.md', 'the literature and citation design']], 'Designed in the toolkit; no reading guide is generated.'],
  ['Resume or portfolio', 'Student-confirmed skills, improved structure, a tailored draft',
    'building', [['app/src/lib/career-evidence.ts', 'skills proposed from the student’s own work, confirmed one by one']], 'Nothing extracts from an uploaded résumé.'],
  ['Voice note', 'A reviewed action, study note, meeting agenda or reflection',
    'tested', [['app/src/lib/voiceloop.test.ts', 'the microphone is shut the instant a question goes']], 'Voice is a way to ask; it does not become a note or an agenda.'],
];

export const INPUTS: readonly Capability[] = IN_ROWS.map(([input, capability, status, evidence, gap], i) => ({
  id: `IN-${String(i + 1).padStart(2, '0')}`, input, capability, status, evidence: ev(evidence), gap,
}));

export const MEMORY_RULES: readonly string[] = [
  'Visible to the student',
  'Editable',
  'Deletable',
  'Scoped by purpose',
  'Not visible to staff by default',
  'Not used to infer sensitive characteristics',
  'Not loaded into an AI prompt without permission controls',
];

// ── 10. The definition of done, against the release gate in code ─────────────

export type ReleaseGateItem = (typeof AI_RELEASE_GATE)[number];

export const DEFINITION_OF_DONE: readonly { ask: string; carriedBy: ReleaseGateItem | null; note?: string }[] = [
  { ask: 'A real user job and trigger are defined', carriedBy: 'Intended purpose documented' },
  { ask: 'The non-AI workflow is usable', carriedBy: null, note: 'No release-gate item asks for it; the local-answer fallback is the nearest control (ai/localanswer.test.tsx).' },
  { ask: 'Sources and data classification are defined', carriedBy: 'Data flow approved' },
  { ask: 'Authorization happens before retrieval', carriedBy: 'Authorized sources enforced' },
  { ask: 'Input and output schemas are validated', carriedBy: null, note: 'No release-gate item; the gateway validates to a strict schema, the on-device assistant does not.' },
  { ask: 'Citations or limitation notices are implemented', carriedBy: 'Citations tested' },
  { ask: 'Academic-integrity rules are enforced where relevant', carriedBy: 'Course and institution policy enforced' },
  { ask: 'Sensitive and restricted data is excluded or specially approved', carriedBy: 'High-risk requests safely redirected' },
  { ask: 'Human confirmation exists for consequential action', carriedBy: 'No consequential write without exact review and confirmation' },
  { ask: 'Prompt-injection and misuse tests pass', carriedBy: 'Prompt-injection tests pass' },
  { ask: 'Feature flag and kill switch exist', carriedBy: 'Monitoring, feedback and kill switch exist' },
  { ask: 'Audit events and user feedback exist', carriedBy: 'Monitoring, feedback and kill switch exist' },
  { ask: 'Accessibility acceptance criteria pass', carriedBy: null, note: 'No release-gate item; AM-15 in the assurance matrix records that the only accessibility run is the generic axe suite.' },
  { ask: 'Cost, latency, quality and safety metrics are monitored', carriedBy: null, note: 'No release-gate item names cost or latency; the monthly allowance is a cap, not a metric.' },
  { ask: 'A named product, security and operational owner approves launch', carriedBy: null, note: 'No release-gate item names an approver; the AI governance board has no seated members.' },
];

// ── 11. ROI and the roadmap ──────────────────────────────────────────────────

export const COST_COMPONENTS: readonly string[] = [
  'Model inference', 'Embeddings', 'Retrieval', 'Storage', 'Moderation', 'Support', 'Human review', 'Vendor fees', 'Engineering maintenance',
];

export const ROADMAP: readonly { phase: string; items: readonly string[] }[] = [
  { phase: 'Phase 1 — Safe foundations', items: ['AI provider registry and vendor scorecards', 'Workflow cards and risk classification', 'Central policy engine', 'Source access and retrieval controls', 'Citation and source-card components', 'AI audit event schema', 'Feature flags and kill switches', 'Feedback and report-issue workflow', 'Prompt-injection and tool-use test suite'] },
  { phase: 'Phase 2 — Student value', items: ['Ask Semester global search', 'Syllabus and material ingestion with review', 'Study assets and source-linked explanations', 'Advisor agenda drafting', 'Registration and Path explanations', 'Campus resource navigation', 'Career evidence drafting'] },
  { phase: 'Phase 3 — Controlled actions', items: ['AI Action Composer', 'Study block drafts', 'Calendar-event drafts', 'Portfolio and application drafts', 'Advisor-share drafts', 'Exact confirmation UI and audit binding'] },
  { phase: 'Phase 4 — Institution governance', items: ['Tenant AI policies', 'Faculty course policies', 'Approved source packs', 'Model routing configuration', 'AI quality and evaluation console', 'Usage and cost dashboards', 'Trust Center AI documentation', 'Institution-specific controls and retention settings'] },
];

export const ASSESSED: readonly (Assessed & { id: string })[] = [...WORKFLOWS, ...CONFIRMATIONS, ...NEVER_SEND, ...ONBOARDING, ...INPUTS];
