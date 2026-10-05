/**
 * The AI Model Training and Data Use policy: a draft policy section from a
 * document of 28 September 2026, and the implementation requirements that
 * make a policy credible — each held to the tree.
 *
 * The most important policy choice: **Semester does not use student,
 * institutional or customer production content to train general-purpose AI
 * models by default.** Any deviation requires a separately negotiated
 * agreement, a documented legal basis, informed authorization where required,
 * technical segregation and an explicit opt-in workflow. The stance is easier
 * to explain, safer for institutional procurement, and aligned with the
 * sensitivity of academic, support and basic-needs data.
 *
 * The privacy page (`lib/privacy.ts`) already says "Nothing is used to train
 * anything", the privacy policy draft says the same twice, and the DPA
 * checklist carries the no-training clause unchecked because provider terms
 * are not yet on file. This file says the policy in full and holds each
 * implementation requirement to what exists.
 *
 * `docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md` is rendered from this
 * file by `ai-training-policy.test.ts`; edit the data, then
 * `npm run registers` from app/. A draft for counsel, not a policy in force.
 */

export const SOURCE = {
  path: 'docs/expansion/FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf',
  title: 'Draft the institutional policy section on AI model training',
  what: 'The default rule, the permitted uses, the prohibited data, the optional programme, the provider controls, transparency, governance and the implementation requirements.',
};

export const DEFAULT_RULE =
  'Semester does not use student, institutional, or customer production content to train general-purpose AI models by default.';

export const SCOPE =
  'This policy governs how Semester uses data in connection with artificial-intelligence features, including model training, fine-tuning, evaluation, retrieval, safety monitoring, quality assurance and service improvement. It applies to student, faculty, staff, institutional, customer, applicant, partner and other user data processed through Semester.';

export const DEFAULT_RULE_IN_FULL: readonly string[] = [
  'Semester does not use Customer Data, Student Content, institutional records, private communications, uploaded course materials, support requests, basic-needs activity, mentorship content, accessibility information or AI conversations to train or fine-tune general-purpose artificial-intelligence models by default.',
  'Semester does not permit AI providers to use such data for their own model training unless an institution has separately authorized that use in writing and the applicable technical, contractual and legal controls are in place.',
];

/** Subject to applicable agreements and documented controls, the minimum information necessary to: */
export const PERMITTED_USES: readonly string[] = [
  'Provide a user-requested AI feature.',
  'Retrieve authorized sources for a grounded answer.',
  'Detect abuse, fraud, security threats or policy violations.',
  'Maintain reliability, diagnose errors and provide support.',
  'Evaluate safety, accuracy, accessibility and quality.',
  'Generate de-identified, aggregated service metrics.',
  'Comply with legal obligations.',
];

/** Never used for general-purpose model training, behavioural advertising, student ranking or undisclosed profiling. */
export const PROHIBITED_DATA: readonly string[] = [
  'Education-record PII.',
  'Grades, transcripts, course performance, attendance or disciplinary data.',
  'Accommodation, disability, health, counseling or basic-needs information.',
  'Financial-aid, payment, housing, immigration or legal information.',
  'Private mentoring, club, peer-circle or support conversations.',
  'Private AI conversation content.',
  'Institution-provided confidential information.',
  'Sensitive personal data or inferred sensitive characteristics.',
  'Content from one tenant to answer another tenant’s request.',
];

/** Any optional programme involving customer production data meets all of these. */
export const PROGRAMME_CONDITIONS: readonly string[] = [
  'Separate written agreement and tenant-level authorization.',
  'Specific purpose, data categories, model or provider, and duration.',
  'No enrolment by default.',
  'Data-minimization and de-identification assessment.',
  'No use of restricted or highly sensitive data categories.',
  'Strict tenant segregation.',
  'Security, privacy, accessibility and AI-risk review.',
  'Human oversight and a documented evaluation plan.',
  'Withdrawal process and future-use stop mechanism.',
  'Clear retention and deletion rules.',
  'No onward sharing without documented authorization.',
  'Transparent student and faculty notices where required.',
];

/** The AI provider and model inventory records, per provider and model: */
export const PROVIDER_INVENTORY: readonly string[] = [
  'Provider and model or version.',
  'Processing location and residency.',
  'Input and output retention.',
  'Training and secondary-use terms.',
  'Security commitments.',
  'Subprocessors.',
  'Data deletion mechanism.',
  'Available safety controls.',
  'Incident notification obligations.',
  'Change-notice commitments.',
];

export const PROVIDER_RULE =
  'No provider may be enabled for production student or customer content until security, privacy, legal, accessibility, procurement and AI-governance approval is documented.';

/** When AI is used, Semester provides, where appropriate: */
export const TRANSPARENCY: readonly string[] = [
  'Notice that AI was used.',
  'Source, scope and status labels.',
  'Applicable course or institutional policy.',
  'Relevant limitations and human-review guidance.',
  'A way to report incorrect, harmful, inaccessible or policy-inappropriate output.',
  'Controls for eligible AI history, sharing and deletion.',
];

export const GOVERNANCE =
  'Semester maintains an AI inventory, risk assessments, evaluation records, incident-response procedures, access controls, change management and periodic reviews. Material policy violations may result in feature restriction, suspension, customer notification where appropriate, provider escalation or other corrective action.';

// ── Implementation requirements: a policy is credible only if enforced in architecture ──

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Requirement {
  /** `TP-nn`, stable. */
  id: string;
  requirement: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = [requirement: string, status: Status, evidence: [path: string, shows: string][], gap: string];

const ROWS: readonly Row[] = [
  ['Tenant-scoped retrieval indexes', 'tested', [['packages/institution/src/policy.test.ts', 'ai.retrieve_source needs enrolment or an authorized share, with a field allowlist'], ['supabase/intelligence-policy.check.sql', 'another tenant cannot read or change policy or sources']], 'The gateway repository is tenant-level only (AI-004); the on-device assistant does no retrieval at all.'],
  ['No cross-tenant vector search', 'tested', [['supabase/intelligence-policy.check.sql', 'sources are approved per tenant and course'], ['supabase/governance.check.sql', 'tenant isolation walked account by account']], 'There is no vector index yet, so the rule is true by absence rather than by test.'],
  ['Provider contracts with no-training and no-retention terms where available', 'building', [['app/server/institution/providers/openai.test.ts', 'the institutional OpenAI call uses store: false and stateless responses'], ['docs/trust/DPA-CHECKLIST.md', 'the no-training clause, unchecked'], ['docs/trust/PROVIDER-TERMS.md', 'both providers’ published no-training and retention terms, verbatim']], 'store: false does not itself establish zero data retention (docs/market-readiness/AI_GOVERNANCE.md); the terms are recorded as published, and neither is accepted or signed by Semester.'],
  ['Prompt and output redaction and data-loss-prevention controls', 'building', [['app/src/lib/toolkit/classification.test.ts', 'unclassified material is an education record and stays away from AI; T4–T6 are hard-blocked']], 'A tier lookup keeps classes out; nothing redacts PII or secrets from a prompt that is sent.'],
  ['Separate environments for production, evaluation and synthetic test data', 'designed', [['STAGING.md', 'the staging environment'], ['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'evaluation suites planned against fixtures']], 'No evaluation environment; the one labelled corpus (extractaccuracy.test.ts) is a fixture in the test suite.'],
  ['Role-bound access to AI logs', 'tested', [['app/server/institution/postgres-journal.test.ts', 'the audit is written through a service-only RPC'], ['app/server/institution/journal.ts', 'intelligence_audit: tenant, actor, provider, model, tokens, cost and the policy decision']], 'Who may read the audit is not yet a granted capability; only the service role writes it.'],
  ['Retention limits for prompts, outputs and evaluation samples', 'tested', [['RETENTION.md', 'ai_usage rows swept after the tenant’s retention_days; no prompt, response or source text stored'], ['app/src/lib/retention.test.ts', 'held to the migrations and the scheduler']], 'Device threads are capped by count, not by age; evaluation samples have no retention rule because there are none.'],
  ['Configurable tenant-level AI enablement and policy controls', 'tested', [['supabase/intelligence-policy.check.sql', 'ai_policy per tenant: modes, providers, sources, retention, policy version'], ['app/src/lib/aikillswitch.test.ts', 'off globally or for one school, failing closed']], 'The claude edge function does not yet read ai_policy; the switch is the only tenant control it enforces.'],
  ['Provider and model change-approval workflow', 'building', [['app/src/lib/claudeclamp.test.ts', 'the shared key allows exactly the models the app offers'], ['supabase/migrations/20260923210000_intelligence_policy.sql', 'tenant_policy_audit_event records every policy change']], 'A model allowlist is a list, not an approval; no record says who approved adding a model (EC-AI-08: no pinned versions).'],
  ['Deletion propagation to retrieval indexes, caches and evaluation datasets', 'tested', [['app/src/lib/erasure.test.ts', 'export and erasure held to one data map'], ['supabase/deletion.check.sql', 'account deletion in SQL']], 'No retrieval index or evaluation dataset exists to propagate to; the map will need those tables when they do.'],
  ['Audit logs for AI feature use: model and version, source set, policy decision and safety outcome', 'tested', [['app/server/institution/intelligence.test.ts', 'journals metadata without protected source bodies'], ['app/server/institution/journal.ts', 'provider, model, policy decision, action and confirmation']], 'No source-set column and no safety outcome; the on-device assistant writes no audit row.'],
];

export const REQUIREMENTS: readonly Requirement[] = ROWS.map(([requirement, status, evidence, gap], i) => ({
  id: `TP-${String(i + 1).padStart(2, '0')}`,
  requirement, status,
  evidence: evidence.map(([path, shows]) => ({ path, shows })),
  gap,
}));

/** The words the privacy page already uses; the test holds them there so the policy and the page cannot drift apart. */
export const PRIVACY_PAGE_SAYS = 'Nothing is used to train anything.';
