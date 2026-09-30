/**
 * AI assurance: the NIST AI RMF audit matrix, the NIST AI 800-1 misuse-risk
 * checklist, the evaluation risk tiers, the release gate, the artifact set, and
 * the safe-AI patterns three documents of 28 September 2026 ask for, held to
 * the tree.
 *
 * `ai-lifecycle.ts` already runs each AI capability through six gates owned by
 * the four functions of the framework — Govern, Map, Measure, Manage — and
 * refuses ten starting scopes at intake. The three documents do not replace
 * that; they ask what an *auditor* would want to see at each function, and
 * add the misuse lens of NIST AI 800-1 (Managing the Risk of Misuse for
 * Dual-Use Foundation Models, second public draft, 2025). So every matrix row
 * names the lifecycle gate it is evidenced at, every release-gate line names
 * the `AI_RELEASE_GATE` item that already carries it or says none does, every
 * prohibited mode names the refusal already in code or says none is, and a
 * risk tier that says "do not deploy" is held to `PROHIBITED_STARTING_SCOPE`.
 *
 * `docs/operating-model/AI-ASSURANCE.md` is rendered from this file by
 * `ai-assurance.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## What a status may claim
 *
 * The four lower statuses of the expansion register, under its rule:
 * `designed` cites a document, `building` cites code, `tested` cites a test
 * that runs on every change, `not-started` cites at most a document that names
 * the gap. The supplied PDFs are never cited as evidence: a design that arrived
 * this morning is not a design the repository had. Statuses were read at
 * `origin/main` `92952f0` on 28 September 2026.
 *
 * ## The status of NIST AI 800-1
 *
 * NIST lists AI 800-1 as a second public draft. It is a voluntary source of
 * controls here, never a certification or a finalized requirement, and nothing
 * in this file or the rendered page may cite it as one in a contract or a
 * public claim until its publication status changes. `STATUS_CAVEAT` is the
 * sentence the page prints, and the test holds the page to it.
 */

import { AI_RELEASE_GATE, GATE_IDS, PROHIBITED_STARTING_SCOPE, type GateId, type NistFunction, type ProhibitedScope } from './ai-lifecycle';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/NIST-AI-RMF-and-800-1-Audit-Matrix.pdf',
    title: 'NIST AI RMF vs NIST AI 800-1 compliance audit: dual-use controls under Govern, Map, Measure, Manage',
    what: 'The audit-ready control matrix, model evaluation inside Govern, the risk tiers, the 800-1 checklist, the artifact set and the release gate.',
  },
  {
    path: 'docs/expansion/FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf',
    title: 'Map NIST AI RMF and NIST AI 800-1 into an AI governance compliance checklist',
    what: 'The 800-1 applicability decision, governance and threat-modelling items, and the AI model-training policy (held in trust/ai-training-policy.ts).',
  },
  {
    path: 'docs/expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf',
    title: 'Show me the transfer transition hub details (with career, safe AI and basic needs)',
    what: 'Safe AI for students: the modes to build first, the modes to prohibit, the answer labels, the pipeline and the governance metrics.',
  },
];

export const STATUS_CAVEAT =
  'NIST AI 800-1 is a second public draft (2025): a voluntary source of controls, not a certification and not a finalized requirement, and it is not cited as either in any contract or public claim until its publication status changes.';

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Evidence {
  /** Repository-relative; the test fails if it does not exist. */
  path: string;
  shows: string;
}

export interface Assessed {
  status: Status;
  evidence: readonly Evidence[];
  /** What the tree lacks. Never empty: nothing here is above `tested`. */
  gap: string;
}

// ── 1. The four functions, as Semester uses them ─────────────────────────────

export interface FunctionRow {
  fn: NistFunction;
  purpose: string;
  question: string;
  result: string;
}

export const FUNCTIONS: readonly FunctionRow[] = [
  { fn: 'govern', purpose: 'Establish accountability, policies, oversight and evidence', question: 'Who owns this AI system, and what risk is acceptable?', result: 'A controlled AI lifecycle with clear decision rights' },
  { fn: 'map', purpose: 'Define context, affected people, data, dependencies and harm scenarios', question: 'What can go wrong, for whom, and through which pathway?', result: 'A use-case-specific risk register and boundary design' },
  { fn: 'measure', purpose: 'Test performance, safety, privacy, accessibility and misuse resilience', question: 'How do we know whether controls work?', result: 'Evidence-based release and monitoring decisions' },
  { fn: 'manage', purpose: 'Prioritize, treat, monitor, communicate and retire risks', question: 'What do we do about unacceptable or changing risk?', result: 'Documented mitigation, incident response and continuous improvement' },
];

// ── 2. The audit-ready control matrix ────────────────────────────────────────

export interface MatrixRow extends Assessed {
  /** `AM-nn`, stable. */
  id: string;
  fn: NistFunction;
  /** What AI 800-1 emphasises. */
  emphasis: string;
  /** Semester's control. */
  control: string;
  /** The artifact an auditor asks for. */
  artifact: string;
  /** What the auditor checks. */
  checkpoint: string;
  /** The lifecycle gate at which the artifact is evidenced. */
  gate: GateId;
}

type Row = [
  fn: NistFunction, emphasis: string, control: string, artifact: string, checkpoint: string, gate: GateId,
  status: Status, evidence: [path: string, shows: string][], gap: string,
];

const MATRIX_ROWS: readonly Row[] = [
  ['govern', 'Accountability for misuse risk', 'Assign an executive AI-risk owner and a system owner per feature and model', 'AI governance charter; RACI', 'Owner and escalation path approved', 'G0',
    'designed', [['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'the board, its membership and decision rules'], ['app/src/lib/governance/charters.ts', 'an owner per module flag']], 'The board has a charter and no members; no feature names an executive AI-risk owner by seat.'],
  ['govern', 'Capability and access governance', 'Risk-tier each model, tool, API, modality and agent', 'Model and system inventory', 'Inventory is current and reviewed quarterly', 'G0',
    'tested', [['app/src/lib/trust/subprocessors.ts', 'every AI provider the gateway can call, and what it sees'], ['app/src/lib/claudeclamp.test.ts', 'the shared key’s model allowlist equals the models the app offers']], 'Providers and model names are inventoried; versions, modalities and tools are not, and nothing carries a risk tier.'],
  ['govern', 'Supplier risk', 'Assess provider retention, training, safety, security, residency, incident notice and model-change terms', 'AI vendor assessment', 'No production use without approval', 'G0',
    'tested', [['app/src/lib/trust/vendorrisk.test.ts', 'the vendor risk register held to the subprocessor list'], ['docs/trust/VENDOR-RISK-REGISTER.md', 'Anthropic retention settings and attestations marked “to confirm”']], 'Provider training and retention terms are not recorded per provider; the register and the DPA checklist both say so.'],
  ['govern', 'Misuse policy', 'Define prohibited uses, tool permissions, user restrictions and enforcement', 'Acceptable-use policy; tenant policy configuration', 'Policy is visible and enforceable', 'G0',
    'tested', [['app/src/lib/governance/ai-lifecycle.ts', 'ten scopes refused at intake'], ['app/src/lib/governance/ai-lifecycle.test.ts', 'a prohibited scope is refused whatever evidence it carries'], ['supabase/migrations/20260923210000_intelligence_policy.sql', 'ai_policy and approved_source per tenant']], 'No student-facing acceptable-use page; the refusals are in code and a governance document, not where a student acts.'],
  ['govern', 'Evaluation accountability', 'Approve evaluation standards, launch thresholds, re-test triggers and independent review', 'Evaluation policy; evaluation plan', 'A feature cannot launch without evidence', 'G0',
    'designed', [['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'the suites and hard boundaries of the recommendation harness'], ['docs/operating-model/AI-LIFECYCLE-GATES.md', 'G3 needs an evaluation and a red-team']], 'No evaluation policy sets thresholds by risk tier, and no independent reviewer is named.'],
  ['map', 'Threat context', 'Identify users, affected parties, use context, high-risk groups and institutional authority boundaries', 'Use-case dossier', 'Context reviewed before build', 'G1',
    'designed', [['docs/operating-model/AI-LIFECYCLE-GATES.md', 'G0 and G1 evidence: user job, intended outcome, data flow, policy mapping']], 'No use-case dossier exists for any live AI feature; the gate is defined and has not been passed by anything.'],
  ['map', 'Misuse pathways', 'Model deliberate misuse: jailbreaks, prompt injection, exfiltration, fraud, malware, impersonation, dangerous instructions, abuse of tools', 'AI misuse threat model', 'Each risk has likelihood, impact, owner and mitigation', 'G2',
    'building', [['app/src/lib/governance/risk.ts', 'the risk register, with an AI-output risk and its controls']], 'One register row, not a threat model per misuse pathway; no likelihood per pathway.'],
  ['map', 'Tool and agent risk', 'Identify every external action, system permission, data source and write operation', 'Tool-permission map', 'No unapproved write or action path', 'G2',
    'tested', [['app/src/ai/prompt.test.ts', 'the assistant names only tools that exist, and a tool call is a proposal, not an act'], ['app/server/institution/intelligence.test.ts', 'gateway actions are server-issued, expiring and single-use, with the full reviewed effect']], 'The map is the prompt, the gateway and their tests; no document lists each tool with its permission and data source.'],
  ['map', 'Data risk', 'Classify prompts, sources, files, retrieval data, outputs, logs and evaluation datasets', 'AI data-flow diagram', 'Restricted data prohibited or controlled', 'G1',
    'designed', [['docs/operating-model/DATA-STEWARDSHIP.md', 'data classes per domain'], ['RETENTION.md', 'what is kept and for how long']], 'No data-flow diagram for the AI path from prompt to provider to log.'],
  ['map', 'Impact assessment', 'Identify student, staff, institutional, accessibility, privacy, academic-integrity and reputational harms', 'AI impact assessment', 'Unacceptable harms create a launch block', 'G1',
    'not-started', [], 'No impact assessment has been written for any AI feature.'],
  ['measure', 'Capability testing', 'Test what the selected model can generate or execute, including code, multimodal output and tool use', 'Capability assessment', 'Risk tier matches demonstrated capability', 'G3',
    'not-started', [], 'No capability assessment of any provider model; capability is taken from the provider’s description.'],
  ['measure', 'Misuse testing', 'Red-team for jailbreaks, prompt injection, dangerous content, data exfiltration, fraud, impersonation and tool misuse', 'Red-team report', 'High-severity failures remediated before launch', 'G3',
    'building', [['app/src/ai/injection.test.ts', 'the structural injection suite: twelve texts through every builder, inside the fence, instructions unchanged'], ['app/src/ai/injection.live.test.ts', 'the injection red-team against the real model: three canaries in seven builders, skipped without a key'], ['docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json', 'its first run, 29 September 2026: claude-opus-5 through the shared key’s proxy, 21 cases, none followed'], ['app/src/lib/quotes.adversarial.test.ts', 'quotations built to fool the citation checker']], 'The injection red-team has run once, on one model, and held (21 of 21); nothing yet runs against a live model for dangerous content, exfiltration, fraud, impersonation or tool misuse, so the red-team report this row asks for is one fifth of the way there.'],
  ['measure', 'Quality and grounding', 'Measure source fidelity, citation accuracy, hallucination rate, refusal behaviour and policy adherence', 'Evaluation dataset and results', 'Meets use-case thresholds', 'G3',
    'building', [['app/src/lib/extractaccuracy.test.ts', 'an extraction-accuracy gate over a labelled syllabus corpus'], ['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'suites for grounding and citations, planned']], 'One labelled corpus, for extraction; no measured rate for source fidelity, citation accuracy, hallucination, refusal or policy adherence.'],
  ['measure', 'Privacy and security', 'Test access control, tenant isolation, leakage, secret exposure, file handling and provider-boundary controls', 'Security and privacy test report', 'No unresolved critical finding', 'G3',
    'tested', [['packages/institution/src/policy.test.ts', 'ai.retrieve_source refuses revoked, quarantined or unshared sources and chunks above provider clearance'], ['app/server/institution/intelligence.test.ts', 'a request naming an unapproved source is refused before the provider sees the question'], ['supabase/intelligence-policy.check.sql', 'another tenant cannot read or change policy']], 'The gateway’s source repository is tenant-level only (AI-004); no test sends a file through the upload path and checks what the provider received.'],
  ['measure', 'Accessibility and fairness', 'Test screen-reader output, reading level, alternative formats, disparate error and refusal patterns, accommodation impact', 'Accessibility and fairness test report', 'Critical barriers fixed or the feature blocked', 'G3',
    'building', [['app/src/ai/Answer.tsx', 'the answer surface the axe suite covers']], 'No reading-level or disparate-refusal measurement; accessibility is the generic axe run, not an AI-specific one.'],
  ['manage', 'Control treatment', 'Apply gating, filters, rate limits, least privilege, sandboxing, confirmation, redaction and feature flags', 'Mitigation plan; configuration record', 'Controls active in production', 'G4',
    'tested', [['supabase/functions/_shared/killswitch.ts', 'the switch every generator reads'], ['app/src/lib/aikillswitch.test.ts', 'off globally, off per school, thrown when unreadable'], ['app/server/institution/rate-limit.test.ts', 'per-identity limits through an atomic RPC, failing closed'], ['app/src/lib/allowance.test.ts', 'the monthly cap the claude function counts before the call']], 'No redaction before provider calls and no output filter; the configuration record is the code, not a document.'],
  ['manage', 'Incident response', 'Detect, triage, contain, communicate and learn from misuse and safety incidents', 'AI incident runbook; incident log', 'A drill performed and lessons tracked', 'G4',
    'designed', [['docs/RUNBOOKS.md', 'the runbook library'], ['app/src/lib/governance/incident-comms.ts', 'an ai_quality audience whose notice names outputs to distrust, approved by the AI governance chair']], 'The notice exists; no AI incident runbook, no P0–P3 taxonomy (AI-014), no incident log, no drill.'],
  ['manage', 'Access response', 'Reduce or suspend access where abuse or a risk threshold is met', 'Enforcement and exception procedure', 'Actions are proportionate and appealable', 'G4',
    'building', [['app/src/lib/governance/risk.ts', 'reviewException(): no indefinite exception, 90 days at most']], 'Nothing suspends one account’s AI access short of the tenant switch, and no appeal route exists.'],
  ['manage', 'Change management', 'Re-evaluate on model, provider, prompt, policy, integration, modality or tool change', 'Change request; re-approval evidence', 'No material change bypasses review', 'G5',
    'building', [['supabase/migrations/20260923210000_intelligence_policy.sql', 'tenant_policy_audit_event records every change to ai_policy and approved_source'], ['app/src/lib/coursestudio.test.ts', 'course AI rules are versioned, newest shown'], ['app/src/lib/governance/edgecases.ts', 'EC-AI-08: no pinned model versions or evaluation baseline']], 'A policy change is logged; a model, provider or prompt change triggers no re-evaluation, and prompts are not versioned.'],
  ['manage', 'Transparency', 'Give users source, policy and limitation labels and an issue-report route', 'UI evidence; transparency page', 'User understanding tested', 'G4',
    'tested', [['app/src/lib/source.test.ts', 'the five source labels, held to the migration'], ['app/src/intelligence/Disclosure.test.tsx', 'each answer shows source locators, origin, mode and an AI-assisted badge'], ['app/src/ai/usingline.test.tsx', 'the Using line says what the answer drew on']], 'Ask chat answers carry no citations or per-answer limits (AI-005, AI-013); user understanding has never been measured; no transparency page summarises AI use.'],
  ['manage', 'Retirement', 'Disable or revoke models, delete or preserve records appropriately, migrate safely, notify tenants', 'Retirement plan', 'Exit and recovery drill completed', 'G5',
    'designed', [['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'offboarding a tenant'], ['docs/operating-model/AI-LIFECYCLE-GATES.md', 'G5: continue, improve, limit or remove']], 'No plan for retiring one model or provider while a tenant is live.'],
];

export const MATRIX: readonly MatrixRow[] = MATRIX_ROWS.map(([fn, emphasis, control, artifact, checkpoint, gate, status, evidence, gap], i) => ({
  id: `AM-${String(i + 1).padStart(2, '0')}`,
  fn, emphasis, control, artifact, checkpoint, gate, status,
  evidence: evidence.map(([path, shows]) => ({ path, shows })),
  gap,
}));

// ── 3. Model evaluation inside Govern ────────────────────────────────────────

/**
 * Model evaluation belongs in Govern, not only in Measure, because leadership
 * decides in advance what "good enough" means, which harms are unacceptable,
 * who can approve exceptions, and what evidence must exist before launch.
 */
export const EVALUATION_GOVERNANCE: readonly string[] = [
  'Maintain an AI Evaluation Policy approved by the AI Governance Council.',
  'Define risk tiers for every AI use case, model, modality, data class, tool integration and user population.',
  'Define the required evaluation categories for each risk tier.',
  'Establish release-blocking thresholds before model selection or development.',
  'Define who designs tests, who executes them, and who independently reviews them.',
  'Require test datasets that are synthetic, public, licensed or otherwise approved.',
  'Prohibit the use of production student records in evaluation unless explicitly authorized, minimized and subject to documented review.',
  'Set re-evaluation triggers: model version change, provider change, new tool or action, new modality, policy change, incident, material complaint, new data source, or expansion to a new tenant or use case.',
  'Define evidence-retention periods, sign-off requirements and audit access.',
  'Create a formal risk-acceptance process for residual risk; no informal exceptions.',
  'Require human review and student and institutional representative input for high-impact or sensitive workflows.',
  'Require independent security, privacy and accessibility review for high-risk releases.',
];

export interface RiskTier {
  tier: 0 | 1 | 2 | 3 | 4;
  example: string;
  evaluation: string;
  authority: string;
  /**
   * Tier 4 is not deployed for automated decision-making. Each domain it names
   * must be a scope `ai-lifecycle.ts` already refuses at intake, and the test
   * holds it there: a tier that says "do not deploy" is only true if the code
   * refuses it.
   */
  refuses?: readonly ProhibitedScope[];
}

export const RISK_TIERS: readonly RiskTier[] = [
  { tier: 0, example: 'Non-sensitive internal drafting with no external actions', evaluation: 'Basic quality and security review', authority: 'Product and engineering owner' },
  { tier: 1, example: 'Student study support using public or student-provided non-sensitive material', evaluation: 'Grounding, policy adherence, privacy, accessibility, misuse baseline', authority: 'Product, AI owner, privacy and security approval' },
  { tier: 2, example: 'Institution-approved course and material retrieval, career support, or resource navigation', evaluation: 'Full quality, source fidelity, tenant isolation, injection, accessibility, bias, abuse and human-handoff tests', authority: 'AI governance review' },
  { tier: 3, example: 'Tool-enabled workflows, advisor and staff support, sensitive support routing, or broad external API action', evaluation: 'Enhanced adversarial testing, permission simulation, incident drill, legal, privacy and accessibility approval, staged rollout', authority: 'Governance council or executive delegate' },
  {
    tier: 4,
    example: 'High-impact decisions or prohibited domains: admissions, aid, discipline, accommodation, health or crisis diagnosis, hidden student-risk scoring',
    evaluation: 'Do not deploy for automated decision-making',
    authority: 'Prohibited unless redesigned into non-decision support',
    refuses: ['Financial-aid decisions', 'Disciplinary judgments', 'Health decisions', 'Opaque risk scoring'],
  },
];

/** Tier-4 domains the intake refusal does not yet name, so the page can say so rather than imply they are refused. */
export const TIER4_NOT_YET_REFUSED: readonly string[] = ['Admissions decisions', 'Accommodation decisions'];

// ── 4. The NIST AI 800-1 misuse-risk checklist ──────────────────────────────

export interface ChecklistItem extends Assessed {
  /** `MR-nn`, stable. */
  id: string;
  section: string;
  item: string;
}

type CheckRow = [item: string, status: Status, evidence: [path: string, shows: string][], gap: string];

const CHECKLIST_SECTIONS: readonly { section: string; rows: readonly CheckRow[] }[] = [
  {
    section: 'Applicability and inventory',
    rows: [
      ['Identify whether Semester develops, fine-tunes, hosts or only accesses each foundation model', 'building', [['app/src/lib/trust/subprocessors.ts', 'Semester accesses provider models through its own key or the student’s; it trains none']], 'Stated by the register’s shape, not as a recorded applicability decision per model.'],
      ['Record provider, model and version, modality, deployment region, API and tool access, tenant availability and business owner', 'building', [['app/src/lib/trust/subprocessors.ts', 'provider and region'], ['supabase/migrations/20260924163000_intelligence_provider_runtime.sql', 'per-tenant provider runtime rows']], 'Model version, modality and business owner are not columns anywhere.'],
      ['Record user groups: student, faculty, staff, administrator, partner, public', 'tested', [['app/src/lib/rolelaunch.ts', 'every role the database can grant, by category'], ['app/src/lib/rolelaunch.test.ts', 'held to app_roles']], 'Roles are inventoried for the product, not per AI feature.'],
      ['Record data types processed: public, institution-approved, student-provided, education-record PII, sensitive or restricted, prohibited', 'building', [['app/src/lib/source.ts', 'five source labels on every fact'], ['app/src/lib/ops/console.ts', 'data classification and the controls each class imposes']], 'No AI feature records which classes reach the provider.'],
      ['Record external integrations, agentic capabilities and write permissions', 'tested', [['app/src/ai/prompt.test.ts', 'a tool call is a proposal; only existing tools are named']], 'No written map of tools to permissions.'],
      ['Identify whether any feature exposes broad public prompting, code generation or external actions', 'tested', [['app/src/lib/flags.ts', 'kill.code_execution as a distinct switch'], ['app/src/lib/aikillswitch.test.ts', 'a switch is only ever about its own capability']], 'Public prompting is not exposed and nothing records that finding.'],
      ['Assign a dual-use and misuse risk tier to each feature', 'not-started', [], 'No feature carries a tier.'],
      ['Reassess whenever capability, access, model, provider, tool or data changes', 'not-started', [], 'No reassessment trigger; see AM-19.'],
    ],
  },
  {
    section: 'Governance and accountability',
    rows: [
      ['Assign an executive AI-risk owner', 'designed', [['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'a chair the board has not yet seated']], 'No seat holds it.'],
      ['Assign a named technical owner for each deployed model and provider', 'not-started', [], 'None named.'],
      ['Create an AI risk committee with security, privacy, legal, accessibility, product, trust-and-safety and institutional representatives', 'designed', [['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'membership by seat']], 'No members.'],
      ['Define AI risk appetite and unacceptable-use categories', 'tested', [['app/src/lib/governance/risk.ts', 'appetite tiers'], ['app/src/lib/governance/ai-lifecycle.test.ts', 'the ten unacceptable starting scopes are refused']], 'Appetite is stated for the company, not per AI use case.'],
      ['Establish an escalation path for dual-use, abuse, security, safety, copyright, privacy and student-harm incidents', 'designed', [['docs/CRISIS-RESPONSE-RUNBOOK.md', 'escalation for student harm'], ['SECURITY.md', 'how a security report is handled']], 'No path names AI misuse or copyright.'],
      ['Require approval before enabling model tool use, code execution, external actions or elevated automation', 'tested', [['app/src/lib/flags.ts', 'kill.code_execution'], ['app/src/lib/governance/charters.test.ts', 'every flag has a charter with an owner']], 'A flag is not an approval record; nothing says who approved turning one on.'],
      ['Maintain evidence of training for operators, developers, moderators, support teams and customer administrators', 'not-started', [], 'No training record for anyone.'],
      ['Review provider terms, safety controls, security posture, retention, training, incident notice and deletion commitments', 'designed', [['docs/trust/DPA-CHECKLIST.md', 'the no-training clause, unchecked'], ['docs/trust/PROVIDER-TERMS.md', 'training, retention, breach-notice and deletion terms per provider, verbatim']], 'Published terms are recorded; none is accepted or signed, and no safety-control or security-posture review has run.'],
      ['Run periodic governance reviews and publish an appropriate transparency summary', 'designed', [['docs/operating-model/OPERATING-RHYTHM.md', 'the quarterly cadence']], 'No review has run and nothing is published.'],
    ],
  },
  {
    section: 'Misuse threat modelling',
    rows: [
      ['Identify intentional misuse by external attackers, students, staff, insiders, compromised accounts, malicious prompt authors, vendors and integrations', 'building', [['app/src/lib/governance/risk.ts', 'insider and account-compromise risks in the register']], 'Not modelled per AI feature.'],
      ['Model jailbreaks, direct and indirect prompt injection, context poisoning, exfiltration, credential theft, secret leakage, impersonation, social engineering, malware generation, fraud, harassment, nonconsensual imagery and dangerous instructions', 'building', [['app/src/ai/prompt.test.ts', 'the prompt names what it must not do or infer']], 'A prompt rule is not a threat model; no pathway has a likelihood or an owner.'],
      ['Identify harm pathways from generated content to real-world action', 'tested', [['app/src/ai/prompt.test.ts', 'calling a tool is a proposal, not an act']], 'The pathway is closed by design; it is not written down as a model.'],
      ['Identify risks created by multimodal inputs, files, voice, images, video, code execution, web retrieval, plugins and external actions', 'building', [['app/src/ai/usevoice.ts', 'voice input exists'], ['app/src/lib/flags.ts', 'kill.data_upload and kill.code_execution']], 'Voice and upload paths have switches and no threat model.'],
      ['Identify especially affected populations and institutional contexts', 'not-started', [], 'Nothing names them for AI.'],
      ['Record likelihood, impact, detectability, mitigation, residual risk and owner', 'building', [['app/src/lib/governance/risk.ts', 'likelihood, impact, controls, residual and owner seat per company risk']], 'Per company risk, not per misuse pathway.'],
      ['Define explicit stop and disable thresholds', 'not-started', [], 'The switch exists; no threshold says when to throw it.'],
    ],
  },
  {
    section: 'Capability and access controls',
    rows: [
      ['Test relevant harmful or dual-use capabilities before deployment', 'not-started', [], 'No capability test.'],
      ['Restrict access according to risk: public, authenticated, verified, institution-admin-approved or sandbox-only', 'tested', [['supabase/migrations/20260923210000_intelligence_policy.sql', 'ai_policy per tenant'], ['app/src/lib/aikillswitch.test.ts', 'a school can be switched off alone']], 'Two levels exist (tenant on, tenant off); no verified or sandbox level.'],
      ['Require stronger identity verification for privileged or tool-enabled access', 'not-started', [], 'No step-up for AI actions.'],
      ['Apply rate limits, quotas, concurrency caps, abuse thresholds and bot controls', 'tested', [['app/server/institution/rate-limit.test.ts', 'per-identity limits, failing closed when shared storage is down'], ['app/src/lib/allowance.test.ts', 'the monthly cap matches what the claude function enforces']], 'Limits and caps exist; no concurrency cap, no abuse threshold and no bot control (EC-AI-09).'],
      ['Limit model contexts, file types, tokens, attachments, output formats, retrieval sources and available tools by role and tenant', 'building', [['supabase/migrations/20260923210000_intelligence_policy.sql', 'approved_source per tenant']], 'Sources are limited per tenant; tokens, file types and tools are not limited by role.'],
      ['Use least privilege for every connected tool and API', 'tested', [['app/src/ai/prompt.test.ts', 'no tool that could act on the student’s behalf exists']], 'True because there are no acting tools; nothing enforces it if one is added.'],
      ['Require user confirmation for external writes, scheduling, messages, data sharing, financial actions, SIS or LMS writes and other consequential actions', 'tested', [['app/server/institution/intelligence.test.ts', 'no consequential action without fresh explicit confirmation; a receipt only after readback'], ['app/src/ai/prompt.test.ts', 'a tool call is a proposal the student confirms']], 'Holds for the gateway and the assistant; nothing yet writes to a SIS or LMS, so the rule has not met a real write.'],
      ['Remove, gate or sandbox capabilities whose residual misuse risk is unacceptable', 'tested', [['app/src/lib/governance/ai-lifecycle.test.ts', 'ten scopes refused at intake']], 'Refusal at intake, not a residual-risk decision per capability.'],
    ],
  },
  {
    section: 'Defence in depth',
    rows: [
      ['Enforce policy and authorization before calling the model', 'tested', [['supabase/functions/_shared/killswitch.ts', 'the switch is read before generation'], ['app/src/lib/aikillswitch.test.ts', 'and thrown when unreadable']], 'The switch is checked first; course policy is not enforced at the gateway.'],
      ['Use tenant-scoped, allowlisted retrieval sources', 'tested', [['packages/institution/src/policy.test.ts', 'ai.retrieve_source needs enrolment or an authorized share, with a field allowlist'], ['supabase/migrations/20260923210000_intelligence_policy.sql', 'approved_source rows per tenant']], 'The gateway repository is tenant-level only (AI-004); Ask Semester on the student’s device does no retrieval.'],
      ['Separate untrusted content from system and developer instructions', 'tested', [['app/server/institution/providers/openai.ts', 'instructions in the developer role, sources as JSON user content, output to a strict schema'], ['app/src/lib/studystudio.test.ts', 'an instruction inside a source stays data']], 'Held for the gateway and the Study Studio; the on-device assistant (app/src/ai/assemble.ts) has no such test.'],
      ['Detect and resist direct and indirect prompt injection', 'building', [['app/src/ai/injection.test.ts', 'twelve injection-shaped texts through every builder: inside a fence, instructions unchanged, closing tags disarmed'], ['app/src/ai/untrusted.ts', 'the fence and the rule every builder carries'], ['app/src/ai/injection.live.test.ts', 'the red-team against the real model: three canaries in seven builders, skipped without a key, never yet run'], ['app/src/lib/studystudio.test.ts', 'one injection-shaped source, kept as data']], 'The suite is structural — the material cannot reach the instructions — and says so; what a live model does with a fence is the red-team AI-010 still owes.'],
      ['Scan files for malware and unsafe content before ingestion', 'building', [['app/src/lib/mediascan.test.ts', 'community images: real type, metadata, perceptual hash, known-abuse hash'], ['app/src/lib/flags.ts', 'ops.data_upload rolls out only after malware scanning exists']], 'Images only, and the scanner is not yet a deployed function; no malware or antivirus scan of any upload.'],
      ['Redact secrets and unnecessary PII before model-provider calls', 'building', [['app/src/lib/toolkit/classification.test.ts', 'unclassified material counts as T3 and stays away from AI; T4–T6 are hard-blocked'], ['app/src/lib/integration/redact.ts', 'tokens, keys and emails redacted from integration errors and logs']], 'A tier lookup keeps classes out; nothing scrubs PII or secrets from a prompt that is sent.'],
      ['Apply input and output safety filters appropriate to the use case', 'building', [['app/src/lib/toolkit/safety.ts', 'a keyword notice naming the professional boundary a topic runs into — a notice, not a filter']], 'No classifier on input or output; a filter refusal cannot be told from an outage (EC-AI-04).'],
      ['Use sandboxed code execution with restricted network, filesystem, process, identity and secret access', 'tested', [['app/src/lib/toolkit/flags.test.ts', 'the codeExecution flag is pinned off'], ['app/src/lib/claudeclamp.test.ts', 'the shared key drops code_execution, web_fetch and mcp_toolset']], 'No sandbox exists; execution is off rather than contained (docs/ai-toolkit/CODE-STUDIO-AND-SANDBOX.md).'],
      ['Validate tool parameters against schemas and allowlists', 'tested', [['app/src/ai/prompt.test.ts', 'tools are named from a fixed list']], 'Parameters are not schema-validated.'],
      ['Generate action previews and require user confirmation', 'tested', [['app/src/ai/prompt.test.ts', 'a tool call comes back to the student as a proposal']], 'No screen test clicks the confirmation.'],
      ['Create feature flags, kill switches, provider and model rollback and tenant disable paths', 'tested', [['supabase/functions/_shared/killswitch.ts', 'global and per-school'], ['app/src/lib/aikillswitch.test.ts', 'held']], 'No provider or model rollback path.'],
      ['Keep a manual fallback for high-value workflows', 'tested', [['app/src/ai/localanswer.test.tsx', 'Ask Semester answers without a gateway, and says why when it cannot'], ['app/src/lib/offline-mode.test.ts', 'high-risk actions are refused offline, never queued']], 'The fallback is a local answer, not a person.'],
    ],
  },
  {
    section: 'Measure and monitor',
    rows: [
      ['Maintain representative, approved evaluation sets for each use case', 'building', [['app/src/lib/extractaccuracy.test.ts', 'a labelled syllabus corpus with an accuracy gate'], ['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'planned suites, none built']], 'One corpus, for extraction; none for any assistant use case.'],
      ['Test grounding, hallucination, citation validity, refusal quality, policy adherence, privacy leakage, safety, bias, accessibility and usability', 'not-started', [['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'the suites named']], 'None runs.'],
      ['Run adversarial testing for jailbreaks, injection, exfiltration, dangerous instructions, fraud, impersonation and tool misuse', 'building', [['app/src/lib/quotes.adversarial.test.ts', 'quotations built to fool the citation checker into a false confirm']], 'One checker is tested adversarially; jailbreak, exfiltration, fraud, impersonation and tool misuse are not.'],
      ['Test cross-tenant isolation and source authorization', 'tested', [['supabase/governance.check.sql', 'tenant isolation walked account by account']], 'At the database, not through the AI path.'],
      ['Test model and tool behaviour after model, provider, prompt, policy, integration or retrieval changes', 'not-started', [], 'No re-test trigger.'],
      ['Monitor blocked and allowed request patterns, abuse attempts, safety-report volume, override rate, false positives, false negatives, appeals, incidents, time-to-detection and time-to-resolution', 'building', [['app/server/institution/journal.ts', 'intelligence_audit records tenant, actor, provider, model, tokens, cost and the policy decision per call'], ['app/src/lib/spend.test.ts', 'cost per question on a student’s own key'], ['MONITORING.md', 'AI budget monitoring “partly”: the provider dashboard and health.sql']], 'The audit row exists; nothing aggregates blocked requests, abuse attempts, overrides or false positives from it.'],
      ['Detect model drift and provider behaviour changes', 'not-started', [], 'Nothing watches provider output over time.'],
      ['Review evaluation and production metrics at defined risk-tier intervals', 'not-started', [], 'No tiers, so no intervals.'],
    ],
  },
  {
    section: 'Response, accountability and transparency',
    rows: [
      ['Maintain AI incident categories, severity levels, owners and response timelines', 'tested', [['app/src/lib/governance/incident-comms.ts', 'an ai_quality incident kind, with what its notice must say'], ['app/src/lib/governance/incident-comms.test.ts', 'held']], 'One kind, no AI severity levels, owners or response timelines (AI-014).'],
      ['Preserve minimum necessary evidence under access, retention and legal-hold rules', 'tested', [['RETENTION.md', 'ai_usage rows swept after the tenant’s retention_days; no prompt or response text stored'], ['app/src/lib/retention.test.ts', 'held to the migrations'], ['app/src/lib/threads.test.ts', 'device threads capped by count and characters']], 'A legal hold exists (maturity RM-02): a platform-wide or school hold keeps the AI usage metadata of the held school, but no prompt or response text is stored to preserve.'],
      ['Contain harm through account restriction, capability disablement, model rollback, tenant disablement or provider escalation', 'tested', [['app/src/lib/aikillswitch.test.ts', 'capability and tenant disablement']], 'No account restriction or model rollback.'],
      ['Support user reporting of unsafe, harmful, inaccessible, inaccurate, biased, privacy-invasive or policy-violating output', 'building', [['app/src/lib/fixthis.ts', '“this answer is incorrect” under About this screen, opening a report'], ['app/src/ai/Turns.tsx', 'the answer feedback pair is local and says nothing is sent']], 'No report-an-answer control reaches anyone (AI-013).'],
      ['Give users understandable source, policy, limitation and escalation labels', 'tested', [['app/src/intelligence/Disclosure.test.tsx', 'source locators, origin, mode and the AI-assisted badge'], ['app/src/ai/helpstate.test.tsx', 'unavailable states named with actions']], 'No policy label per course on an answer, and no escalation label.'],
      ['Maintain an appeal and correction mechanism for consequential enforcement', 'not-started', [], 'No enforcement on a person exists, so no appeal does.'],
      ['Notify institutions, users, providers, insurers and regulators when required', 'tested', [['app/src/lib/governance/incident-comms.ts', 'who is told, by whom, how soon'], ['app/src/lib/governance/incident-comms.test.ts', 'held']], 'Regulators and insurers are not audiences.'],
      ['Conduct root-cause analysis and track corrective actions to closure', 'not-started', [], 'No corrective-action tracker.'],
      ['Reassess the risk register and evaluation plan after every material incident', 'not-started', [], 'No incident has been recorded and no rule says to.'],
      ['Publish appropriate aggregate transparency information without creating new abuse paths', 'not-started', [], 'Nothing published.'],
    ],
  },
];

export const CHECKLIST: readonly ChecklistItem[] = CHECKLIST_SECTIONS.flatMap((s) =>
  s.rows.map(([item, status, evidence, gap]) => ({ section: s.section, item, status, evidence: evidence.map(([path, shows]) => ({ path, shows })), gap })),
).map((c, i) => ({ id: `MR-${String(i + 1).padStart(2, '0')}`, ...c }));

export const CHECKLIST_SECTION_NAMES: readonly string[] = CHECKLIST_SECTIONS.map((s) => s.section);

// ── 5. The artifact set ──────────────────────────────────────────────────────

/** A control is not audit-ready until it produces evidence. Each artifact, and the file that is it — or `null`. */
export const ARTIFACTS: readonly { artifact: string; path: string | null; note: string }[] = [
  { artifact: 'AI Governance Charter and RACI', path: 'docs/operating-model/AI-GOVERNANCE-BOARD.md', note: 'Charter without members.' },
  { artifact: 'AI Acceptable Use Policy', path: null, note: 'The refusals are in ai-lifecycle.ts; no policy a student or administrator reads.' },
  { artifact: 'AI Model and System Inventory', path: 'docs/SUBPROCESSORS.md', note: 'Providers, not models or versions.' },
  { artifact: 'AI Vendor and Provider Assessment', path: 'docs/trust/VENDOR-RISK-REGISTER.md', note: 'Training and retention terms not yet recorded.' },
  { artifact: 'AI Use-Case Dossier', path: null, note: 'None written.' },
  { artifact: 'AI Data-Flow Diagram', path: null, note: 'None drawn.' },
  { artifact: 'AI Misuse Threat Model', path: null, note: 'One row of the risk register.' },
  { artifact: 'AI Impact Assessment', path: null, note: 'None written.' },
  { artifact: 'Risk-Tiering Decision', path: null, note: 'The tiers are defined here; no feature has been placed in one.' },
  { artifact: 'Evaluation Policy and Risk-Tier Test Standard', path: null, note: 'The twelve controls above are the outline.' },
  { artifact: 'Evaluation Plan, Datasets, Results and Sign-Offs', path: 'docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', note: 'A plan; no dataset, no results.' },
  { artifact: 'Red-Team and Adversarial Test Report', path: null, note: 'None.' },
  { artifact: 'Accessibility and Fairness Test Evidence', path: 'docs/WCAG-UI-AUDIT-SCORECARD.md', note: 'The product’s scorecard, not an AI-specific one.' },
  { artifact: 'Security, Privacy and Tenant-Isolation Test Report', path: 'supabase/governance.check.sql', note: 'The check, not a report of a run.' },
  { artifact: 'Tool and Agent Permission Map', path: null, note: 'The prompt test is the map.' },
  { artifact: 'Production Configuration and Feature-Flag Record', path: 'docs/FEATURE-FLAG-REGISTRY.md', note: 'Flags and switches; not provider configuration.' },
  { artifact: 'AI Incident Response Plan and Exercise Evidence', path: null, note: 'The general runbooks; no AI plan, no exercise.' },
  { artifact: 'Incident Register and Corrective-Action Tracker', path: null, note: 'None.' },
  { artifact: 'Model and Provider Change Log', path: null, note: 'Policy changes are audited; model changes are not logged.' },
  { artifact: 'User Transparency and Issue-Reporting Evidence', path: 'app/src/lib/source.ts', note: 'Labels in code; no measured understanding.' },
  { artifact: 'Risk Acceptance and Exception Register', path: 'docs/operating-model/RISK-GOVERNANCE.md', note: 'Exception rules exist; no exception has been approved.' },
  { artifact: 'Retirement and Offboarding Plan', path: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', note: 'Tenant offboarding; not model retirement.' },
];

// ── 6. The release gate, against the one in code ─────────────────────────────

export type ReleaseGateItem = (typeof AI_RELEASE_GATE)[number];

/** Each line of the audit's release gate, and the `AI_RELEASE_GATE` item that already carries it, or `null`. */
export const RELEASE_GATE: readonly { ask: string; carriedBy: ReleaseGateItem | null; note?: string }[] = [
  { ask: 'The intended use, prohibited use and authority boundary are documented', carriedBy: 'Intended purpose documented' },
  { ask: 'A named business owner, technical owner and escalation owner exist', carriedBy: null, note: 'G0 asks for one owner; three are asked for here.' },
  { ask: 'The risk tier and AI 800-1 applicability are recorded', carriedBy: null, note: 'New: no gate item records a tier.' },
  { ask: 'Data flows, retention, provider terms and tenant isolation are approved', carriedBy: 'Data flow approved' },
  { ask: 'Relevant misuse, privacy, security, accessibility, quality and grounding tests pass', carriedBy: 'Prompt-injection tests pass', note: 'The gate names injection and citations; the rest are G3 evidence.' },
  { ask: 'Launch-blocking thresholds are satisfied or a formally approved exception exists', carriedBy: null, note: 'New: no gate item names a threshold.' },
  { ask: 'User-facing source, policy, limitation and report controls are live', carriedBy: 'Output labelled as a generated draft where appropriate' },
  { ask: 'Tool permissions are least-privilege, previewable and confirmation-gated', carriedBy: 'No consequential write without exact review and confirmation' },
  { ask: 'Monitoring, incident response, kill switch and rollback have been tested', carriedBy: 'Monitoring, feedback and kill switch exist', note: 'Exist, not tested; and rollback is not named.' },
  { ask: 'Customer and institution configuration, contract commitments and support documentation are complete', carriedBy: null, note: 'G4 evidence, not the pilot gate.' },
  { ask: 'Required audit evidence is stored, versioned and retrievable', carriedBy: null, note: 'New: nothing under docs/evidence/ yet.' },
];

// ── 7. Safe AI for students (the second document) ────────────────────────────

export interface AiMode {
  mode: string;
  value: string;
  control: string;
}

/** Source-grounded, policy-aware, reversible and human-routed: the modes to build first. */
export const MODES_FIRST: readonly AiMode[] = [
  { mode: 'Explain a concept', value: 'Plain-language, adaptive explanation', control: 'Cite approved sources where available; disclose limits' },
  { mode: 'Study coach', value: 'Quiz, retrieval practice, teach-back, study plan', control: 'Do not imply mastery or diagnose learning ability' },
  { mode: 'Source-grounded summary', value: 'Summarize a syllabus, reading or authorized document', control: 'Show source anchors, page and section links, and a review prompt' },
  { mode: 'Planner', value: 'Turn student-provided goals into action and calendar suggestions', control: 'User preview and confirmation; never write externally by default' },
  { mode: 'Drafting partner', value: 'Outline, revise, clarify or format user text', control: 'Course-policy banner, attribution guidance, user review' },
  { mode: 'Navigator', value: 'Identify the correct office and prepare questions', control: 'Route to the institution-verified source; no official decisions' },
  { mode: 'Accessibility assistant', value: 'Reading support, plain-language restatement, alternative formats', control: 'Preserve meaning; disclose when a transformation might alter content' },
  { mode: 'Career preparation', value: 'Interview practice, application feedback, portfolio wording', control: 'No employability score, and no claim the student has not verified' },
];

/** The modes to prohibit or tightly restrict, each with the refusal the code already makes, or `null`. */
export const MODES_PROHIBITED: readonly { mode: string; refusedBy: ProhibitedScope | ReleaseGateItem | null; note?: string }[] = [
  { mode: 'Automated disciplinary recommendations', refusedBy: 'Disciplinary judgments' },
  { mode: 'Admissions, financial-aid, accommodation or immigration decisions', refusedBy: 'Financial-aid decisions', note: 'Aid is refused; admissions, accommodation and immigration are not named at intake.' },
  { mode: 'Mental-health diagnosis or crisis assessment', refusedBy: 'Health decisions' },
  { mode: 'Hidden student-risk scoring', refusedBy: 'Opaque risk scoring' },
  { mode: 'Automated grading without institution-approved human oversight', refusedBy: null, note: 'Not refused at intake; a Course Studio decision (D-100) keeps grading with the instructor.' },
  { mode: 'Generating answers to active graded work where course policy prohibits it', refusedBy: 'Course and institution policy enforced', note: 'A release-gate item, not an intake refusal.' },
  { mode: 'Using student data or content to train general models without documented authorization', refusedBy: null, note: 'The stance is trust/ai-training-policy.ts; nothing refuses it in the lifecycle.' },
  { mode: 'Cross-tenant retrieval or leakage of institution or course material', refusedBy: 'Authorized sources enforced' },
  { mode: 'Sending AI-generated actions to SIS, LMS, calendar or email without confirmation', refusedBy: 'No consequential write without exact review and confirmation' },
];

/** What every answer shows. The five labels, and what each says. */
export const ANSWER_LABELS: readonly { label: string; says: string }[] = [
  { label: 'Source', says: 'Institution verified, course-authorized, student-provided, or general model knowledge' },
  { label: 'Status', says: 'Grounded, generated, incomplete, may be outdated, or needs official confirmation' },
  { label: 'Policy', says: 'Allowed, limited, or not available under this course or institution policy' },
  { label: 'Limits', says: 'What this response can and cannot establish' },
  { label: 'Action', says: 'Open the source, revise the question, report an issue, save privately, or contact the correct human or office' },
];

/** The safety pipeline every request passes through, in order. */
export const PIPELINE: readonly string[] = [
  'User request',
  'Tenant, course and role context',
  'Policy and entitlement check',
  'Data-classification check',
  'Approved-source retrieval, when applicable',
  'Prompt-injection and unsafe-content defences',
  'Model call through an approved provider',
  'Output safety, citation, policy and accessibility checks',
  'User-visible source, status and limitation labels',
  'Feedback and report mechanism',
  'Minimal audit event and monitored quality metrics',
];

export const METRICS: readonly string[] = [
  'Source-grounded answer rate',
  'Citation and source-open rate',
  'Incorrect-answer reports',
  'Policy-block rate',
  'Human-handoff rate',
  'Prompt-injection detection rate',
  'Sensitive-data prevention rate',
  'Accessibility feedback',
  'Model, provider and version usage',
  'Cost per successful request',
  'False-positive and false-negative safety review',
];

/** Never a proxy for student success. */
export const NOT_METRICS: readonly string[] = ['Engagement duration', 'Number of prompts', 'Message sentiment'];

// ── helpers ──────────────────────────────────────────────────────────────────

export const ASSESSED: readonly (Assessed & { id: string })[] = [...MATRIX, ...CHECKLIST];

export const gatesInOrder = (): readonly GateId[] => GATE_IDS;

/** The intake refusals a tier-4 domain must be one of. Exported so the test can name the list it checks against. */
export const INTAKE_REFUSALS: readonly string[] = PROHIBITED_STARTING_SCOPE;
