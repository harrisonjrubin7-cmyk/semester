/**
 * Privacy by module: what each new module holds by default, when staff may
 * see any of it, what they never receive, the role matrix, the conditions
 * under which a student-specific view is ever shown, the share screen, the
 * authority boundaries, the data-processing register, the risk controls, the
 * launch gates, the governance council and the decision-rights rule — from a
 * document of 28 September 2026, held to the tree.
 *
 * One rule runs through all of it: **discover privately; share deliberately;
 * act through the accountable office.** Semester can make help easier to find
 * and coordinate, but it minimizes sensitive data, keeps staff access
 * purpose-bound, and never converts a student's request for help into a
 * hidden risk score.
 *
 * `docs/MODULE-PRIVACY-MODEL.md` is rendered from this file by
 * `module-privacy.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## What is held to what
 *
 * - Every role the matrix names is a row of `rolelaunch.ts`, which is itself
 *   held to `app_roles`; a role the document names that the database does not
 *   have says so (`role: null`) rather than borrowing the nearest one.
 * - Every launch gate cites the kind of file its status claims, under the
 *   expansion register's rule.
 * - Every cited path exists. The supplied PDFs are never evidence.
 *
 * Under FERPA an institution may disclose education-record information to
 * school officials with a defined legitimate educational interest, but access
 * is not automatic or unlimited: written criteria, use limited to the stated
 * purpose, and contractors under the institution's direct control. This file
 * is a product and governance blueprint, not legal advice.
 */

import type { SourceLabel } from '../source';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Privacy-by-Module-and-Liability-Controls.pdf',
    title: 'How do these modules protect student privacy; what data do they share with staff; how does the system handle liability',
    what: 'Privacy by module, the staff views, the role matrix, the share screen, the liability controls, the risk table and the launch gates.',
  },
  {
    path: 'docs/expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf',
    title: 'What governance do institutions need for this',
    what: 'The governance council, the required controls and the decision-rights rule.',
  },
];

export const RULE = 'Discover privately; share deliberately; act through the accountable office.';

// ── 1. Privacy by module ─────────────────────────────────────────────────────

export interface DataRow {
  module: 'Transfer Transition Hub' | 'Career and workforce' | 'Basic-Needs Navigator';
  data: string;
  default: string;
  /** When staff can access it (transfer, career) or what staff see (basic needs). */
  staff: string;
  /** What staff should not receive (transfer), prohibited sharing (career), or the minimum data practice (basic needs). */
  never: string;
}

export const DATA: readonly DataRow[] = [
  { module: 'Transfer Transition Hub', data: 'Transfer timeline, actions, goals', default: 'Private to student', staff: 'Student explicitly shares, or an approved advising workflow requires a selected item', never: 'Private notes, unrelated plans, AI conversations' },
  { module: 'Transfer Transition Hub', data: 'Prior-course list and unofficial transcript', default: 'Private, encrypted', staff: 'Student submits or shares to the designated transfer evaluator or advisor', never: 'Broad access by faculty, clubs, employers or unrelated offices' },
  { module: 'Transfer Transition Hub', data: 'Syllabi and course documents', default: 'Student-controlled', staff: 'Only a named official reviewer or authorized support role, if shared', never: 'Reuse for model training, unrelated student comparisons' },
  { module: 'Transfer Transition Hub', data: 'Credit-comparison estimate', default: 'Private planning result', staff: 'Shared only as part of a review packet', never: 'Presentation as an official transfer-credit decision' },
  { module: 'Transfer Transition Hub', data: 'Official credit-evaluation result', default: 'Institution-controlled record', staff: 'Authorized records and advising roles under institutional policy', never: 'Modification by Semester, or by staff outside defined roles' },
  { module: 'Transfer Transition Hub', data: 'Peer-mentor participation', default: 'Private by default', staff: 'The program coordinator sees minimum operational status', never: 'Transcript, grades, aid status, accommodation details' },
  { module: 'Career and workforce', data: 'Goals, target roles, skill reflections', default: 'Private', staff: 'Student-selected advisor or mentor view', never: 'Employers by default; hidden profiling' },
  { module: 'Career and workforce', data: 'Portfolio artifacts', default: 'Private', staff: 'Student selects item, audience, duration and permission', never: 'Automatic publication or employer access' },
  { module: 'Career and workforce', data: 'Resume and application drafts', default: 'Private', staff: 'Student explicitly requests career-center or mentor feedback', never: 'Employer access without submission' },
  { module: 'Career and workforce', data: 'Opportunity saves and applications', default: 'Private', staff: 'Aggregate institutional reporting only, unless the student requests assistance', never: 'Sale to recruiters; academic surveillance' },
  { module: 'Career and workforce', data: 'Verified credentials', default: 'Student-controlled', staff: 'Export or share through student action', never: 'Revoke or alter verified records without the issuer process' },
  { module: 'Career and workforce', data: 'Academic records', default: 'Not required by default', staff: 'Only through a separately authorized, clearly explained workflow', never: 'Employer discovery, talent ranking, advertising' },
  { module: 'Basic-Needs Navigator', data: 'Browse a resource', default: 'Private', staff: 'None by default', never: 'Do not create a staff-visible case or alert' },
  { module: 'Basic-Needs Navigator', data: 'Save a private checklist', default: 'Private', staff: 'None', never: 'Store only in the student workspace; permit deletion' },
  { module: 'Basic-Needs Navigator', data: 'Ask an informational question', default: 'Private', staff: 'No case unless the student requests a referral', never: 'Provide a source-labelled answer and the official route' },
  { module: 'Basic-Needs Navigator', data: 'Request an appointment or referral', default: 'Consented', staff: 'Only the named receiving office or case manager', never: 'Collect minimum required fields and explicit consent' },
  { module: 'Basic-Needs Navigator', data: 'Complete official intake', default: 'Institution-managed', staff: 'Managed by the official service system where possible', never: 'Semester stores referral status, not sensitive intake detail' },
  { module: 'Basic-Needs Navigator', data: 'Use the emergency or campus-safety route', default: 'Institution policy', staff: 'Follow the institution-approved emergency policy', never: 'Do not market this as crisis monitoring or emergency response' },
];

/** The AI assistant is context-limited and privacy-preserving by default. */
export const AI_MODES: readonly { mode: string; rule: string }[] = [
  { mode: 'Private AI mode', rule: 'The student’s interaction is private and not visible to staff.' },
  { mode: 'Course AI mode', rule: 'Use only the course’s approved sources and policy; do not expose conversation content to instructors unless the student intentionally shares an artifact.' },
  { mode: 'Institutional navigator mode', rule: 'Use official, curated resource information; do not send the student’s question to an office unless they explicitly request a referral or handoff.' },
  { mode: 'Support mode', rule: 'Share only the minimum information needed to resolve the requested support issue, with a named support role, purpose and time-limited access.' },
];

export const AI_NEVER_INFERS: readonly string[] = ['mental-health status', 'financial distress', 'disability', 'academic risk', 'immigration status', 'misconduct risk'];

// ── 2. What staff can see ────────────────────────────────────────────────────

/** For many offices the appropriate view is operational and aggregate. */
export const DEFAULT_DASHBOARD: readonly string[] = [
  'Resource page ownership and freshness',
  'Broken links and content issues',
  'Aggregate searches with small-cell suppression',
  'Aggregate referral volume',
  'Appointment demand',
  'Referral completion status, if needed operationally',
  'Anonymized feedback themes',
  'Accessibility issues reported',
  'Service-level performance',
];

/** Student-specific data appears only when all of these are true. */
export const CONDITIONS: readonly string[] = [
  'The office has a defined institutional function.',
  'The person has a role that needs the data.',
  'The data is necessary for the specific work.',
  'The student has explicitly initiated or shared the workflow, or another documented institutional or legal basis applies.',
  'The screen limits data to the relevant case or referral.',
  'The access is logged, reviewable and time-bounded where appropriate.',
];

export interface RoleRow {
  /** The role as the document names it. */
  label: string;
  /** The `app_roles` row that carries it, or null when the database has none. */
  role: string | null;
  canSee: string;
  cannotSee: string;
  note?: string;
}

export const ROLE_MATRIX: readonly RoleRow[] = [
  { label: 'Transfer advisor', role: 'academic_advisor', canSee: 'Student-shared agenda, selected documents, unresolved questions, official evaluation status if authorized', cannotSee: 'Private plans, unrelated community activity, basic-needs browsing, private AI history' },
  { label: 'Registrar or credit evaluator', role: 'registrar', canSee: 'The official evaluation packet and required documents', cannotSee: 'Career goals, mentoring conversations, private notes' },
  { label: 'Career counselor', role: 'career_coach', canSee: 'Student-shared resume, portfolio, career goals, selected applications', cannotSee: 'Grades, aid details, basic-needs activity, private academic AI chats' },
  { label: 'Basic-needs case manager', role: null, canSee: 'Minimum referral information and case-specific intake through the authorized system', cannotSee: 'Full transcript, club membership, mentor conversations, unrelated transfer documents', note: 'No such role exists; counseling_liaison publishes resources only, and a help request to an office reaches an inbox, not a case.' },
  { label: 'Faculty member', role: 'faculty', canSee: 'Course-authorized material and explicitly shared academic work', cannotSee: 'Basic-needs requests, career records, accommodation diagnosis, private account activity' },
  { label: 'Club officer', role: 'organization_officer', canSee: 'Membership and event-related information required for the organization', cannotSee: 'Academic record, aid status, mentoring cases, safety case details' },
  { label: 'Moderator', role: 'moderator', canSee: 'Only content and evidence attached to assigned cases', cannotSee: 'Broad private-message browsing, academic record, transfer or aid history' },
  { label: 'Platform support', role: 'support_agent', canSee: 'Time-limited, approved technical context', cannotSee: 'Unrestricted content access, case details outside the support request' },
];

/** What the student sees before a share. The full consent workflow is `trust/ferpa-consent.ts`. */
export const SHARE_SCREEN: readonly { line: string; example: string }[] = [
  { line: 'You are sharing', example: 'Transfer-credit question list and two course syllabi' },
  { line: 'With', example: 'A named transfer credit evaluator, Registrar’s Office' },
  { line: 'Purpose', example: 'Review your official transfer-credit evaluation' },
  { line: 'Access', example: 'View-only' },
  { line: 'Expires', example: 'A date within the term' },
  { line: 'Not included', example: 'Private notes, other uploaded documents, AI conversations, career workspace, club memberships, basic-needs activity' },
  { line: 'You can', example: 'Cancel before submission; edit the selection; revoke future access where permitted' },
];

// ── 3. Liability and risk controls ───────────────────────────────────────────

/** Every relevant interface states which of these the information is. Each names the source label of `lib/source.ts` that carries it, or null. */
export const INFORMATION_STATES: readonly { state: string; carriedBy: SourceLabel | null }[] = [
  { state: 'Institution verified', carriedBy: 'institution_verified' },
  { state: 'Published policy', carriedBy: null },
  { state: 'Student provided', carriedBy: 'student_entered' },
  { state: 'Semester estimate', carriedBy: 'estimated' },
  { state: 'AI generated', carriedBy: null },
  { state: 'Needs official review', carriedBy: 'needs_review' },
  { state: 'Emergency information', carriedBy: null },
];

/** Conspicuous boundaries for high-risk domains. */
export const BOUNDARIES: readonly { domain: string; says: string }[] = [
  { domain: 'Transfer credit', says: 'Semester organizes information and helps prepare questions. Only the authorized institution can determine official transfer credit.' },
  { domain: 'Financial aid', says: 'Semester is not a financial-aid determination system. Confirm eligibility, awards and deadlines with the official financial-aid office.' },
  { domain: 'Career', says: 'Semester helps you prepare and organize opportunities. It does not guarantee employment or share your information with employers without your direction.' },
  { domain: 'Basic needs', says: 'Semester can help you find resources. It is not an emergency, medical, mental-health, legal or crisis-response service.' },
  { domain: 'AI', says: 'AI can help explain and organize information. Verify important decisions with official sources or qualified people.' },
];

/** For each feature, a data-processing register carries these. If a field does not support a defined purpose, do not collect it. */
export const PROCESSING_REGISTER: readonly string[] = [
  'Feature', 'Business owner', 'Student purpose', 'Institutional purpose', 'Data fields', 'Sensitive-data category', 'Legal or contractual basis',
  'Who can access', 'Retention period', 'Deletion and export process', 'Subprocessors', 'Cross-border and residency location', 'Security controls', 'Risk rating', 'Approval date',
];

export const CONSENT_NOTE =
  'Use consent for optional student-controlled sharing, optional mentoring, optional employer visibility and optional communication preferences. Do not use “consent” as a substitute for institutional obligations or legal requirements; for institution-provided data, use the appropriate contractual and institutional authorization model.';

export const RISK_CONTROLS: readonly { risk: string; control: string }[] = [
  { risk: 'Incorrect transfer guidance', control: 'Official-source labels, freshness dates, uncertainty display, human evaluator handoff, no official-decision claims' },
  { risk: 'Misleading AI output', control: 'Source grounding, limitations, policy checks, report path, evaluation, human escalation' },
  { risk: 'Student distress or emergency', control: 'Emergency notice, approved official routes, no promise of emergency monitoring, trained escalation policy' },
  { risk: 'Sensitive basic-needs disclosure', control: 'Private browsing, minimum intake, named recipient, consented referral, restricted case access' },
  { risk: 'Employer misuse', control: 'Student opt-in, artifact-level sharing, no academic or behavioural data access, anti-spam rules, audit logs' },
  { risk: 'Discrimination and bias', control: 'Accessibility testing, bias evaluation, human review, appeal and correction route, aggregate monitoring' },
  { risk: 'Harassment and community harm', control: 'Block, mute, report; moderator training; case controls; evidence and appeal process' },
  { risk: 'Data breach', control: 'Encryption, MFA, least privilege, detection, response plan, notification procedure, tested recovery' },
  { risk: 'Service failure or outage', control: 'Status page, redundancy, backups, manual fallback, incident communications, SLA and SLO controls' },
  { risk: 'Staff misuse', control: 'Role separation, least privilege, access logs, periodic review, anomaly alerts, sanctions and training' },
];

/** For basic needs, mentorship, community and AI interactions. */
export const SAFETY_BOUNDARIES: readonly string[] = [
  'Show emergency guidance prominently when relevant.',
  'Use institution-configured official emergency contacts and service routes.',
  'Train moderators, support staff, mentors and operators in boundaries and escalation.',
  'Do not require a student to explain sensitive circumstances to access general resources.',
  'Do not imply active monitoring of private activity.',
  'Do not promise response times or intervention capabilities you cannot meet.',
  'Preserve evidence only when necessary and according to retention and legal-hold policy.',
];

export const CONTRACT_TERMS: readonly string[] = [
  'Roles: the institution as education-record owner or controller where applicable; Semester as service provider or processor as applicable.',
  'Permitted data use and prohibited secondary use.',
  'Security controls, subprocessor management and breach notice.',
  'Support and incident-response responsibilities.',
  'Accessibility commitments and remediation process.',
  'AI providers, training and data-use rules, and policy configuration.',
  'Data export, deletion, retention, legal holds and offboarding.',
  'Indemnity, liability caps, exclusions and insurance requirements.',
  'Content ownership, intellectual property, and copyright and takedown process.',
  'Institution responsibilities for source accuracy, policy configuration, moderation ownership and emergency routing.',
];

/** Demonstrate — not merely claim — compliance. */
export const EVIDENCE_REGISTER: readonly string[] = [
  'Access-review reports', 'Penetration-test and vulnerability evidence', 'Backup and recovery tests', 'Incident exercises', 'AI evaluations and safety testing',
  'Accessibility test results and remediation', 'Subprocessor reviews', 'Data-deletion and export tests', 'Training completion', 'Moderation and escalation drills', 'Policy approvals and change history',
];

// ── 4. Launch gates: a module is not enabled for a tenant until it passes these ──

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Gate {
  /** `LG-nn`, stable. */
  id: string;
  gate: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = [gate: string, status: Status, evidence: [path: string, shows: string][], gap: string];

const GATE_ROWS: readonly Row[] = [
  ['Named institutional business owner', 'tested', [['app/src/lib/governance/data-contracts.test.ts', 'each data domain names the institutional role that owns it, and reports unstaffed until a person holds it'], ['supabase/migrations/20260927235000_governance_registries.sql', 'governance_steward_assignments: the named person per school']], 'Owners are named per data domain and per flag, not per module a tenant enables.'],
  ['Approved purpose, scope, audience and authority boundary', 'tested', [['app/src/lib/governance/charters.test.ts', 'every module flag has a charter with its problem, user and owners'], ['app/src/lib/governance/scorecard.ts', 'core, module, pilot, partner or decline']], 'A charter states purpose and user; the authority boundary is prose in the screen, not a field of the charter.'],
  ['Data map and retention schedule', 'tested', [['app/src/lib/retention.test.ts', 'every table the migrations create has a retention answer'], ['docs/operating-model/DATA-STEWARDSHIP.md', 'data classes per domain']], 'Retention is per table; no data map per module says which tables a module touches.'],
  ['Role and permission matrix tested', 'tested', [['app/src/lib/rolelaunch.test.ts', 'every role and capability held to app_roles and role_capabilities'], ['supabase/rolegrants.check.sql', 'grants carry scope, expiry and revocation']], 'Nothing assigns an app role yet, so every role is modeled and none provisionable.'],
  ['Privacy notice and student-facing disclosure reviewed', 'designed', [['docs/legal/PRIVACY-POLICY-DRAFT.md', 'the draft, not in force'], ['app/src/lib/trust/legal-drafts.test.ts', 'held to the subprocessor register; the banner stays until counsel reviews']], 'A draft for counsel; no review has happened.'],
  ['Accessibility acceptance tests passed', 'tested', [['app/src/a11y/axe.test.tsx', 'axe-core over the rendered app'], ['app/src/lib/governance/quality-gates.test.ts', 'accessibility criteria in the definition of ready and done']], 'Automated only; the manual assistive-technology pass has not been done (docs/accessibility/AT-PASS-PROTOCOL.md).'],
  ['Human handoff and emergency or escalation route configured', 'tested', [['app/src/lib/help-routes.test.ts', 'wellbeing is directory-only and names 988; nobody is referred automatically'], ['app/src/lib/escalationadapter.test.ts', 'the escalation payload and channel'], ['docs/CAMPUS-ESCALATION-POLICY.md', 'escalation off by default']], 'Routes exist in code; no tenant has configured its own emergency contacts.'],
  ['Content owner, source freshness and review date assigned', 'tested', [['app/src/lib/launch/content.test.ts', 'each content kind has an owner, a review interval and an expiry'], ['supabase/integration-quality.check.sql', 'an owner and a review cadence per connection']], 'Per content kind and per connection, not per resource.'],
  ['AI policy and provider settings approved, if AI is enabled', 'tested', [['supabase/intelligence-policy.check.sql', 'ai_policy per tenant: modes, providers, sources, retention'], ['app/src/lib/aikillswitch.test.ts', 'the switch fails closed']], 'The claude edge function does not yet enforce ai_policy; approval is a row, not a signed review.'],
  ['Support runbook, incident process and escalation contacts tested', 'designed', [['docs/RUNBOOKS.md', 'the runbook library'], ['docs/CRISIS-RESPONSE-RUNBOOK.md', 'P0 and P1 to professional Trust & Safety only']], 'No drill has run and no contact is named.'],
  ['Audit logging, export, deletion and revocation paths verified', 'tested', [['supabase/deletion.check.sql', 'account deletion'], ['app/src/lib/erasure.test.ts', 'export and erasure held to one data map'], ['supabase/supportshares.check.sql', 'every read logged; revocation stops reads']], 'Verified in test, not exercised on a tenant; no legal-hold object.'],
  ['Contract, DPA and security obligations mapped to implemented controls', 'designed', [['docs/trust/DPA-CHECKLIST.md', 'clauses mapped to what exists'], ['docs/trust/SOC2-READINESS.md', 'controls scored']], 'No contract is signed, so nothing is mapped to an obligation in force.'],
];

export const LAUNCH_GATES: readonly Gate[] = GATE_ROWS.map(([gate, status, evidence, gap], i) => ({
  id: `LG-${String(i + 1).padStart(2, '0')}`,
  gate, status,
  evidence: evidence.map(([path, shows]) => ({ path, shows })),
  gap,
}));

// ── 5. Governance ────────────────────────────────────────────────────────────

/** A Student Experience, Data and AI Governance Council with named authority and a written charter. */
export const COUNCIL: readonly { area: string; owner: string; participants: string }[] = [
  { area: 'Transfer hub', owner: 'Transfer or academic-success leader', participants: 'Admissions and records, articulation, advising, financial aid, student affairs, registrar, student representatives' },
  { area: 'Career and workforce', owner: 'Career-services leader', participants: 'Experiential learning, academic affairs, employer relations, legal and privacy, accessibility, students and alumni' },
  { area: 'Basic needs', owner: 'Basic-needs or student-affairs leader', participants: 'Financial aid, housing, food resources, health and wellness, public-benefits partners, privacy, students' },
  { area: 'AI', owner: 'CIO, provost delegate, or designated AI-governance executive', participants: 'Faculty, IT and security, privacy and legal, accessibility, library, student affairs, students' },
  { area: 'Accessibility', owner: 'Accessibility leader', participants: 'Disability services, IT, instructional design, procurement, students with disabilities' },
  { area: 'Community safety', owner: 'Student affairs or trust-and-safety owner', participants: 'Campus safety, legal, Title IX or equivalent office, privacy, mental health and wellness, student leaders' },
];

export const REQUIRED_CONTROLS: readonly string[] = [
  'Named business owner for every module and content type.',
  'Student advisory participation, including transfer, commuter, working, international, veteran, disabled and historically underserved students.',
  'Written purpose limitation for each data category.',
  'Data inventory, classification, retention, export, deletion and legal-hold rules.',
  'Role-based access and time-bound support access.',
  'Institution-specific content-ownership and freshness process.',
  'Source, scope and status labels in student-facing experiences.',
  'Accessibility acceptance criteria and release testing.',
  'AI-use inventory, provider and model approval, evaluation, monitoring, incident response and change-control process.',
  'Human escalation and “no wrong door” routing.',
  'Vendor and subprocessor due diligence and contract controls.',
  'Risk assessment before launching high-risk functions.',
  'Audit logs, periodic access review and evidence register.',
  'Appeal and correction route for harmful or incorrect outcomes.',
];

export const DECISION_RIGHTS: readonly { who: string; can: string }[] = [
  { who: 'Semester can', can: 'Organize, explain, prepare, remind, route, surface sources, support reflection, and facilitate authorized workflows.' },
  { who: 'Institutional offices can', can: 'Make official academic, financial, conduct, accommodation, admissions, credential and service-eligibility decisions.' },
  { who: 'Students can', can: 'Control their private planning, preferences, shares, artifacts, profile visibility, and eligible data export and deletion choices.' },
  { who: 'AI can', can: 'Assist within configured policy and clearly stated limitations.' },
  { who: 'AI cannot', can: 'Make high-impact decisions, conceal uncertainty, or override human and institutional authority.' },
];
