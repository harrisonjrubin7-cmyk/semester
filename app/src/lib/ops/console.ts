/**
 * The operations console's controls, as data, before there is a console.
 *
 * ## Why now
 *
 * There is no operations console and no `/admin` (SEMESTER-OPERATING-SYSTEM.md,
 * "Operations Console map"). What exists is a prototype that showed the right
 * workflows — tiered roles, a sensitive-action dialog, an append-only audit
 * chain, a launch war room — on illustrative data in a browser. The review of
 * that prototype said what has to be true before anyone runs a customer tenant
 * from it, and most of that is *policy*: who may approve what, which records
 * carry which classification, what every page must show, and what happens
 * when evidence goes stale. Policy written into a screen is policy that gets
 * re-decided by whoever builds the next screen, so it is written here first,
 * where a test can hold it and the page that will be built has to read it.
 *
 * ## What is here
 *
 * - **Segregation of duties.** For each high-risk action, who asks, who
 *   approves, whether two approvers are needed and what evidence is attached.
 *   `console.test.ts` refuses a requester who is also an approver, an
 *   approver list of one for a two-person action, a party that is neither a
 *   council seat nor a role in `public.app_roles`, and a register row that
 *   does not exist.
 * - **Data classification.** Six classes, the controls each imposes on
 *   search, export, AI retrieval and support access, and the record kinds
 *   the platform already holds, each tied to the file that defines it.
 * - **The production context bar and the access basis.** What every console
 *   page shows an operator, and what every sensitive record tells them
 *   about why they can see it.
 * - **Customer impact.** The questions every operational failure answers
 *   before its technical diagnosis.
 * - **Evidence freshness.** The escalation ladder for an expiring proof, and
 *   what happens to a public claim when the evidence behind it lapses.
 * - **Production rules.** The lines the prototype could not hold — an audit
 *   log in browser memory is not immutable — and what holds each now.
 * - **The conversion.** The five steps from prototype to control plane, each
 *   tied to the master-register rows it would move.
 *
 * `ops/operations-console/README.md` is rendered from this file by
 * `console.test.ts`; edit the data, then `npm run registers` from app/.
 */

import type { Seat } from '../launchreadiness';

// ── parties ────────────────────────────────────────────────────────────────

/**
 * Who may ask or approve: a council seat (an accountability), a role of
 * `public.app_roles` (a grant a person holds), or the student whose data it
 * is. The test checks each against `SEATS` and `ROLES`.
 */
export type Party = Seat | `role:${string}` | 'student';

export const PARTY_MEANING = {
  seat: 'A council seat: the accountability, held by whoever accepted it in writing',
  role: 'A row of public.app_roles, granted through the role-grant workflow and audited',
  student: 'The student whose record it is; their consent is the approval',
} as const;

// ── segregation of duties ──────────────────────────────────────────────────

export interface Duty {
  id: string;
  /** The high-risk action, as the console will name it. */
  action: string;
  requester: Party;
  /** Any one of these may approve; all of them when `twoPerson`. */
  approvers: readonly Party[];
  /** Two distinct approvers, neither the requester. */
  twoPerson: boolean;
  /** What must be attached before the action runs. */
  evidence: string;
  /** Master-register rows the action touches. */
  rows: readonly string[];
  note?: string;
}

export const DUTIES: readonly Duty[] = [
  {
    id: 'break-glass',
    action: 'Break-glass access to a production tenant',
    requester: 'engineering',
    approvers: ['security', 'founder'],
    twoPerson: true,
    evidence: 'An incident or change ticket, fresh MFA, an expiry no later than the incident’s close, and a post-use review booked',
    rows: ['IAM-006', 'IAM-011'],
    note: 'Break-glass widens who, never what: it still cannot exceed the incident’s scope.',
  },
  {
    id: 'role-grant',
    action: 'Grant or widen a privileged role',
    requester: 'role:university_admin',
    approvers: ['security'],
    twoPerson: false,
    evidence: 'The access request, naming the person, the role, the tenant and the reason',
    rows: ['IAM-006', 'IAM-011'],
    note: 'The role-grant audit (supabase/role-grant-audit.check.sql) records it; a grant with no request is a finding at the quarterly access review.',
  },
  {
    id: 'support-access',
    action: 'Read a student’s record for support',
    requester: 'role:support_agent',
    approvers: ['student'],
    twoPerson: false,
    evidence: 'A support ticket, the scope, a time limit, and the banner the student sees while the grant is open',
    rows: ['IAM-010'],
    note: 'No support role browses student records. The student’s grant is the approval, and it expires.',
  },
  {
    id: 'tenant-suspension',
    action: 'Suspend a production tenant',
    requester: 'role:platform_admin',
    approvers: ['founder', 'security'],
    twoPerson: true,
    evidence: 'A change ticket and the customer communication that goes with it',
    rows: ['IAM-006', 'SEC-007'],
  },
  {
    id: 'tenant-policy',
    action: 'Change a tenant’s policy or turn a feature on for it',
    requester: 'role:implementation_manager',
    approvers: ['engineering'],
    twoPerson: false,
    evidence: 'A change record naming the flag or policy, the tenant, the rollback and who at the institution asked',
    rows: ['PRG-007', 'PRG-003'],
    note: 'High-risk flags — anything that reaches student data or an official system — take the two-person path of `integration-config`.',
  },
  {
    id: 'integration-config',
    action: 'Configure, rotate or disable a connector to an official system',
    requester: 'role:integration_admin',
    approvers: ['data', 'security'],
    twoPerson: true,
    evidence: 'The institution’s written approval, the data scope, the fallback while it is off, and the credential’s expiry',
    rows: ['INT-001', 'INT-014'],
  },
  {
    id: 'release',
    action: 'Release to production, or roll it back',
    requester: 'engineering',
    approvers: ['product'],
    twoPerson: false,
    evidence: 'The release record: CI green on the commit, the golden path run, the rollback rehearsed',
    rows: ['SRE-008'],
    note: 'A rollback needs no second approval, because waiting for one costs more than the rollback can. It is audited the same.',
  },
  {
    id: 'data-deletion',
    action: 'Delete an institution’s data, or a student’s on their behalf',
    requester: 'role:data_steward',
    approvers: ['privacy'],
    twoPerson: false,
    evidence: 'The verified request, the retention class of each store touched, and the deletion certificate that will be issued',
    rows: ['LEG-004'],
    note: 'A student’s own deletion, from their own account, needs nobody’s approval; this row is for deletion done for them.',
  },
  {
    id: 'ai-provider',
    action: 'Change an AI provider, model or policy',
    requester: 'product',
    approvers: ['security', 'privacy'],
    twoPerson: true,
    evidence: 'The evaluation evidence from the G0–G5 gates, and the subprocessor register updated in the same change',
    rows: ['AI-001', 'AI-002'],
  },
  {
    id: 'evidence-release',
    action: 'Release controlled evidence to a reviewer',
    requester: 'success',
    approvers: ['security', 'privacy'],
    twoPerson: false,
    evidence: 'The signed NDA, the named reviewer, the commit the packet was generated from, and the expiring link',
    rows: ['SEC-013'],
  },
  {
    id: 'refund',
    action: 'Refund or credit above the threshold',
    requester: 'role:business_admin',
    approvers: ['founder'],
    twoPerson: false,
    evidence: 'The billing record and the reason',
    rows: ['LEG-003'],
    note: 'No billing exists (D-009). The row is here so the matrix is complete before it does, not because there is anything to refund.',
  },
];

// ── data classification ────────────────────────────────────────────────────

export type Classification = 'public' | 'internal' | 'student-private' | 'education-record' | 'restricted' | 'credential';

export const CLASSIFICATIONS: readonly Classification[] = ['public', 'internal', 'student-private', 'education-record', 'restricted', 'credential'];

export const CLASSIFICATION_MEANING: Record<Classification, string> = {
  public: 'Published on purpose; anyone may read it',
  internal: 'Company operations; staff with a reason',
  'student-private': 'What a student entered or built; theirs, shown to staff only under a grant',
  'education-record': 'What an institution holds about a student; FERPA applies, and the institution decides',
  restricted: 'Accommodations, safety, audit and anything whose disclosure harms a person; named grant, logged read',
  credential: 'Keys, secrets and tokens; never displayed, only rotated',
};

export interface Controls {
  search: 'indexed' | 'staff' | 'never';
  export: 'self-service' | 'approved' | 'never';
  ai: 'allowed' | 'tenant-approved' | 'never';
  support: 'open' | 'grant' | 'named-grant' | 'never';
}

export const CONTROL_MEANING: Record<keyof Controls, string> = {
  search: 'Whether a console or site search may index it: for anyone, for staff with the capability, or not at all',
  export: 'Who may export it: the owner themselves, an approved request, or nobody',
  ai: 'Whether an AI feature may retrieve it: freely, only where the tenant approved that use, or never',
  support: 'What a support reader needs: nothing, the student’s grant, a named restricted grant, or no path exists',
};

export const CONTROLS: Record<Classification, Controls> = {
  public: { search: 'indexed', export: 'self-service', ai: 'allowed', support: 'open' },
  internal: { search: 'staff', export: 'approved', ai: 'tenant-approved', support: 'open' },
  'student-private': { search: 'never', export: 'self-service', ai: 'tenant-approved', support: 'grant' },
  'education-record': { search: 'never', export: 'approved', ai: 'tenant-approved', support: 'grant' },
  restricted: { search: 'never', export: 'approved', ai: 'never', support: 'named-grant' },
  credential: { search: 'never', export: 'never', ai: 'never', support: 'never' },
};

export interface RecordKind {
  kind: string;
  classification: Classification;
  /** The file that defines or governs the record; it must exist. */
  source: string;
  note?: string;
}

export const RECORD_KINDS: readonly RecordKind[] = [
  { kind: 'Public site pages and the status page', classification: 'public', source: 'app/src/site/render.tsx' },
  { kind: 'Customer commitment', classification: 'internal', source: 'app/src/lib/ops/commitments.ts' },
  { kind: 'Support ticket', classification: 'internal', source: 'supabase/support-tickets.check.sql', note: 'An attachment from a student takes its own class, student-private at least; the ticket does not launder it.' },
  { kind: 'Support access grant', classification: 'internal', source: 'supabase/support-access.check.sql' },
  { kind: 'Role grant and its audit row', classification: 'internal', source: 'supabase/role-grant-audit.check.sql' },
  { kind: 'A student’s plan, deadlines, notes and study material', classification: 'student-private', source: 'RETENTION.md' },
  { kind: 'Enrolment, grades and requirements an institution verified', classification: 'education-record', source: 'docs/FERPA-COPPA-1EDTECH-READINESS.md' },
  { kind: 'Accommodation and anything shared for support', classification: 'restricted', source: 'supabase/supportshares.check.sql' },
  { kind: 'Audit event', classification: 'restricted', source: 'RETENTION.md', note: 'Its own retention class: three years for role-grant, moderation and support reads (SEC-006). Reading the audit is itself audited.' },
  { kind: 'Connector credentials, the LTI private key, function secrets', classification: 'credential', source: 'SECURITY.md' },
];

// ── what every page shows ──────────────────────────────────────────────────

export interface Field {
  field: string;
  /** What it shows, and where it comes from. */
  shows: string;
}

/** The context bar at the top of every console page. Never colour alone: the environment is a word. */
export const CONTEXT_BAR: readonly Field[] = [
  { field: 'Environment', shows: '“Production”, “Staging” or “Demo”, as a word and a shape, read from the deployment, never from a setting the operator can change' },
  { field: 'Scope', shows: 'The tenant or customer the page is about, or “All”, and nothing outside it is rendered' },
  { field: 'Operator', shows: 'The signed-in person’s real identity. There is no preview-as, and no impersonation' },
  { field: 'Role', shows: 'The roles and capabilities in force for this session, from the role grants, not from a selector' },
  { field: 'MFA', shows: 'Fresh, or how long ago; a sensitive action asks again' },
  { field: 'Session', shows: 'When it expires' },
  { field: 'Support access', shows: '“None”, or the open grant: which student, which ticket, when it ends' },
];

/** The line under a production write. */
export const PRODUCTION_WRITE_NOTICE = 'Production change. This will affect a live customer.';

/** What a sensitive record tells the operator about why they can see it. */
export const ACCESS_BASIS: readonly Field[] = [
  { field: 'Basis', shows: 'The capability, from which role' },
  { field: 'Tenant', shows: 'Whose data this is' },
  { field: 'Scope', shows: 'The connector, cohort, ticket or object the grant covers' },
  { field: 'Purpose', shows: 'The ticket, incident or change the read is for' },
  { field: 'Expires', shows: 'When the basis ends' },
];

/** What every operational failure answers before its technical diagnosis. */
export const CUSTOMER_IMPACT: readonly string[] = [
  'Who is affected, and at which tenant?',
  'Which workflow, and how many students or staff?',
  'What will they see, and does the official system still answer?',
  'Does the customer need telling, and has the status page said it?',
  'Is there a support article, and who owns the update?',
];

/** Every figure a console health panel shows carries these, or it is a string in a file. */
export const FIGURE_PROVENANCE: readonly string[] = ['Source', 'Time window', 'Environment', 'Owner', 'Last refresh', 'Evidence', 'Known limitation'];

// ── evidence freshness ─────────────────────────────────────────────────────

export interface Escalation {
  /** Days before expiry at which this step fires; `0` is expiry itself. */
  daysLeft: number;
  action: string;
}

export const ESCALATION: readonly Escalation[] = [
  { daysLeft: 30, action: 'The owning seat is notified, with the artifact and the claims that rest on it' },
  { daysLeft: 7, action: 'A compliance alert to the security and privacy seats; the item is on the weekly operations review' },
  { daysLeft: 0, action: 'The artifact is marked superseded, leaves the procurement pack, and every public claim resting on it is flagged for the founder, product and privacy seats to reword or remove' },
];

/** The escalation step that applies with `daysLeft` days to expiry, or `null` while none does. */
export function escalation(daysLeft: number): Escalation | null {
  return [...ESCALATION].sort((a, b) => a.daysLeft - b.daysLeft).find((e) => daysLeft <= e.daysLeft) ?? null;
}

// ── production rules ───────────────────────────────────────────────────────

export interface Rule {
  id: string;
  rule: string;
  /** What in the tree holds it today, or what will; every path must exist. */
  holders: readonly { path: string; how: string }[];
  /** `held` when a test or check fails the build; `stated` when only this page does. */
  status: 'held' | 'stated';
}

export const PRODUCTION_RULES: readonly Rule[] = [
  {
    id: 'audit-server-side',
    rule: 'Audit events are written by the server, insert-only, by a writer separate from the application’s; nothing in a browser can add, edit or delete one.',
    holders: [
      { path: 'supabase/role-grant-audit.check.sql', how: 'The role-grant audit refuses update and delete to every role' },
      { path: 'app/src/lib/ops/boundaries.test.ts', how: 'No service-role credential reaches anything a browser loads' },
    ],
    status: 'held',
  },
  {
    id: 'fail-closed',
    rule: 'A high-risk action fails closed when its audit event cannot be written.',
    holders: [{ path: 'docs/operating-model/CHANGE-MANAGEMENT.md', how: 'The change policy the console will implement; no code holds this yet' }],
    status: 'stated',
  },
  {
    id: 'no-impersonation',
    rule: 'Production access uses the operator’s own identity and grants. Role preview exists only in a sandbox with synthetic data. There is no “view as student”.',
    holders: [
      { path: 'app/src/lib/ops/boundaries.ts', how: 'No fake production data, and no browser service-role credential — the two things impersonation would need' },
      { path: 'supabase/support-access.check.sql', how: 'A support read needs a grant with a scope and an expiry, not a role' },
    ],
    status: 'held',
  },
  {
    id: 'no-fiction-in-production',
    rule: 'Illustrative institutions live in a demo tenant. A production console shows real customers to authorised staff, or “No production customers yet”.',
    holders: [{ path: 'app/src/lib/pagesdemo.test.ts', how: 'The deployed site is the product; the demo is beside it and cannot be it again (TRUST-005)' }],
    status: 'held',
  },
  {
    id: 'figures-from-evidence',
    rule: 'Every health and status figure is read from a control, a CI result, the database or a deployment, with its source, window, environment, owner, refresh, evidence and known limitation shown. A figure typed into a file is a claim, not a measurement.',
    holders: [
      { path: 'app/src/lib/masterregister.test.ts', how: 'Every register status cites the file that shows it, and the test refuses a status above what that kind of file can show' },
      { path: 'app/src/lib/ops/claims.test.ts', how: 'Every public claim names the rows and tests behind it, and the test refuses a word above theirs' },
    ],
    status: 'held',
  },
  {
    id: 'classification-everywhere',
    rule: 'Every record view names its classification, and search, export, AI retrieval and support access obey it.',
    holders: [{ path: 'app/src/lib/integration/classification.ts', how: 'Field-level classes for integrated data; the console’s record classes are this page' }],
    status: 'stated',
  },
];

// ── the conversion ─────────────────────────────────────────────────────────

export interface Step {
  step: string;
  /** What exists now, in one clause. */
  today: string;
  /** Master-register rows that would move. */
  rows: readonly string[];
}

export const CONVERSION: readonly Step[] = [
  { step: 'Replace demo and browser-local state with authenticated backend data', today: 'Supabase Auth and the invite-only beta exist; staff surfaces are tabs of the University screen behind build-time flags', rows: ['IAM-001', 'PRG-006', 'PRG-008'] },
  { step: 'Server-side RBAC, RLS, support grants and real tenant context', today: 'Role grants, RLS on every table and support grants are tested; no console reads them', rows: ['IAM-006', 'IAM-007', 'IAM-008', 'IAM-010'] },
  { step: 'Append-only server-side audit with integrity controls', today: 'Grants, moderation, support reads and gateway actions are audited; there is no unified event schema or tamper-evident export', rows: ['SEC-006'] },
  { step: 'Every dashboard value from evidence, monitoring, contracts, tickets and integrations', today: 'Registers are rendered from data and held to the tree; monitoring and connector health are behind flags', rows: ['SRE-002', 'INT-014', 'PRG-002'] },
  { step: 'Approval, segregation of duties and environment safeguards on every high-risk write', today: 'This page, and the change-management policy; nothing enforces the matrix yet', rows: ['IAM-011', 'SRE-008'] },
];
