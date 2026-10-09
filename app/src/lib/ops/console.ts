/**
 * The operations console's controls, as data, and the console that reads them.
 *
 * ## Why this is data
 *
 * What came first was a prototype that showed the right workflows — tiered
 * roles, a sensitive-action dialog, an append-only audit chain, a launch war
 * room — on illustrative data in a browser. The review of that prototype said
 * what has to be true before anyone runs a customer tenant from it, and most
 * of that is *policy*: who may approve what, which records carry which
 * classification, what every page must show, and what happens when evidence
 * goes stale. Policy written into a screen is policy that gets re-decided by
 * whoever builds the next screen, so it was written here first (D-110), where
 * a test holds it, and the console (`app/src/screens/Console.tsx`) reads it.
 * The fourteen things the prototype faked, and what replaced each — a
 * migration, a check suite, a screen and its test — are `CAPABILITIES` below,
 * and `console.test.ts` refuses a `done` row without a test among its holders
 * or with a holder that is not in the tree.
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
 *   tied to the master-register rows it would move, and what exists today.
 * - **The fourteen capabilities.** What the prototype faked, what production
 *   needed instead, and the files that hold each.
 * - **The views.** What the console shows, one line each, for the map.
 *
 * `ops/operations-console/README.md` and `docs/OPERATIONS-CONSOLE-MAP.md` are
 * rendered from this file by `console.test.ts`; edit the data, then `npm run
 * registers` from app/.
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
    note: 'Plus checkout exists (D-128) on Stripe test keys and has refunded nothing. The row is here so the matrix is complete before a live payment, not because there is anything to refund yet.',
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
    holders: [
      { path: 'supabase/console-approvals.check.sql', how: 'With the audit insert revoked inside a savepoint, console_act raises and leaves no grant, no action record and no status change; on the happy path the audit row’s seq precedes the effect' },
      { path: 'docs/operating-model/CHANGE-MANAGEMENT.md', how: 'The change policy the function implements' },
    ],
    status: 'held',
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
    holders: [
      { path: 'app/src/screens/console.test.tsx', how: 'Every customer record the console renders names its class from RECORD_KINDS and answers “Why can I see this?” with the ACCESS_BASIS fields' },
      { path: 'app/src/lib/integration/classification.ts', how: 'Field-level classes for integrated data; the console’s record classes are this page' },
    ],
    status: 'held',
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
  { step: 'Replace demo and browser-local state with authenticated backend data', today: 'The console is a screen (app/src/screens/Console.tsx) opened only with console:operate on a real account; saved views and the last tab live in operator_preference, owner-only under RLS, never in the browser', rows: ['IAM-001', 'PRG-006', 'PRG-008'] },
  { step: 'Server-side RBAC, RLS, support grants and real tenant context', today: 'Role grants, RLS on every table and support grants are tested, and the console reads them: the context bar shows the live grants, the open support windows, MFA freshness and the session’s expiry, from the server', rows: ['IAM-006', 'IAM-007', 'IAM-008', 'IAM-010'] },
  { step: 'Append-only server-side audit with integrity controls', today: 'private.console_audit_event is hash-chained and insert-only, written by a separate writer role, sealed nightly into a signed manifest and re-verified; every read of it is itself an audit event', rows: ['SEC-006'] },
  { step: 'Every dashboard value from evidence, monitoring, contracts, tickets and integrations', today: 'Registers are rendered from data and held to the tree; console_figures returns each figure with its source, window, owner, refresh, evidence and known limitation, and the billing figure says there is no billing (D-009)', rows: ['SRE-002', 'INT-014', 'PRG-002'] },
  { step: 'Approval, segregation of duties and environment safeguards on every high-risk write', today: 'approval_request and approval_decision enforce this matrix in the database: self-approval refused, two people where the row says so, fresh MFA, and console_act fails closed when its audit event cannot be written', rows: ['IAM-011', 'SRE-008'] },
];

// ── the fourteen capabilities ──────────────────────────────────────────────

export type CapabilityStatus = 'done' | 'partial' | 'planned' | 'not-started';

export interface Holder {
  /** Repository-relative; must exist. */
  path: string;
  how: string;
}

/**
 * One thing the prototype faked, and what replaced it. A row is `done` only
 * when at least one holder is a test (`.test.ts(x)` or `.check.sql`) and every
 * holder is in the tree; `partial` when something exists but no test holds it
 * all; `planned` when only a document does; `not-started` otherwise.
 */
export interface Capability {
  id: string;
  capability: string;
  /** What the prototype did instead. */
  prototype: string;
  /** What production needs, and now has. */
  replacement: string;
  status: CapabilityStatus;
  holders: readonly Holder[];
  note?: string;
}

const MIGRATION_A = 'supabase/migrations/20260929100000_console_control_plane.sql';
const MIGRATION_B = 'supabase/migrations/20260929110000_console_approvals_and_break_glass.sql';
const MIGRATION_C = 'supabase/migrations/20260930173030_console_command_center.sql';
const CHECK_A = 'supabase/console-control-plane.check.sql';
const CHECK_B = 'supabase/console-approvals.check.sql';
const CHECK_C = 'supabase/console-command-center.check.sql';
const SCREEN = 'app/src/screens/Console.tsx';
const SCREEN_TEST = 'app/src/screens/console.test.tsx';
const CLIENT = 'app/src/lib/console/client.ts';
const CLIENT_TEST = 'app/src/lib/console/client.test.ts';

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'saved-views',
    capability: 'Saved table views, nav state',
    prototype: 'Table views and the active tab kept in browser memory, lost on reload and belonging to nobody',
    replacement: 'Per-user preferences stored server-side: public.operator_preference, owner-only under RLS, read and written through PostgREST as the operator',
    status: 'done',
    holders: [
      { path: MIGRATION_A, how: 'The operator_preference table, keyed by subject and key, with owner-only policies on every verb' },
      { path: CHECK_A, how: 'A second account cannot read or write another operator’s preference' },
      { path: CLIENT, how: 'loadPreferences and savePreference' },
      { path: SCREEN, how: 'The Views tab and the last tab, persisted through operator_preference, never localStorage' },
      { path: SCREEN_TEST, how: 'A saved view round-trips through the mocked table and nothing is written to the browser' },
    ],
  },
  {
    id: 'operator-identity',
    capability: 'Operator identity',
    prototype: 'A name typed into a header and a role picked from a menu',
    replacement: 'Supabase Auth with the account’s real identity; a privileged action needs fresh MFA (aal2 within fifteen minutes), asserted by private.assert_fresh_mfa on the server',
    status: 'done',
    holders: [
      { path: MIGRATION_A, how: 'private.mfa_fresh reads aal and amr from the JWT; private.assert_fresh_mfa raises “Fresh MFA required”' },
      { path: CHECK_A, how: 'Both branches: a claim set with a fresh totp entry passes, one without aal2 or with a stale timestamp raises' },
      { path: 'app/src/components/MfaStep.tsx', how: 'Enrol TOTP and challenge/verify before a privileged action' },
      { path: 'app/src/components/MfaStep.test.tsx', how: 'The step is shown when the assurance level is not aal2, and clears when verification succeeds' },
      { path: CLIENT, how: 'mfaLevel, mfaFactors, enrollTotp, challengeMfa, verifyMfa, privilegedMfaRequired, watchMfaSession and sessionExpiry' },
      { path: CLIENT_TEST, how: 'Each wrapper calls the supabase-js auth.mfa method it names' },
    ],
    note: 'SSO for operators is the institution SSO row (IAM-003); the console does not add a second sign-in.',
  },
  {
    id: 'roles',
    capability: 'Roles and capabilities',
    prototype: 'A role switcher in the header that changed what the page showed',
    replacement: 'Scoped role_grants with capability, scope and expiry, checked server-side; console:operate, approval:decide and breakglass:request are capabilities of public.app_capabilities. There is no role switching in production',
    status: 'done',
    holders: [
      { path: MIGRATION_A, how: 'The three capabilities and their role_capabilities rows; audit:read at platform scope for platform_admin' },
      { path: CHECK_A, how: 'Each console capability is held by the roles the contract names and by nobody else' },
      { path: 'supabase/rolegrants.check.sql', how: 'A grant has a scope, an expiry and an audited grantor' },
      { path: 'supabase/my-capabilities.check.sql', how: 'my_capabilities returns the live grants and only those' },
      { path: SCREEN, how: 'The Role field is the live grants from my_capabilities; there is no selector' },
      { path: SCREEN_TEST, how: 'The screen renders the granted roles and offers no way to change them' },
    ],
  },
  {
    id: 'authorization',
    capability: 'Authorization',
    prototype: 'The page hid buttons the chosen role should not see; the data was already in the browser',
    replacement: 'Server-side authorization, RLS and object rules on every request; the UI gate is a courtesy and never the authorization',
    status: 'done',
    holders: [
      { path: 'supabase/rls-coverage.check.sql', how: 'Every table in public has RLS on and at least one policy' },
      { path: 'supabase/grants.check.sql', how: 'Every public function is on the allowlist, and anon holds nothing it should not' },
      { path: MIGRATION_A, how: 'Every console function checks private.has_capability itself; definer functions pin search_path' },
      { path: CHECK_A, how: 'A session without console:operate is refused by the function, not by the screen' },
      { path: SCREEN_TEST, how: 'Without the capability the screen is a Notice, never a demo' },
    ],
  },
  {
    id: 'audit-log',
    capability: 'Audit log',
    prototype: 'An array in browser memory called an append-only chain',
    replacement: 'private.console_audit_event: server-written, insert-only, hash-chained, written only by the semester_audit_writer role, sealed nightly into a signed manifest, re-verified nightly, outside the retention sweep, and every read of it logged',
    status: 'done',
    holders: [
      { path: MIGRATION_A, how: 'The table, its triggers, the writer role, console_audit_write, the key, the manifest, seal and verify, and console_audit_read' },
      { path: CHECK_A, how: 'Update and delete raise; the service role cannot insert directly; a plain session cannot call the writer; the sweep leaves the rows; a read writes audit.read first' },
      { path: 'supabase/scheduler.sql', how: 'The console-audit-integrity job at 03:23 seals yesterday and verifies the chain' },
      { path: CLIENT, how: 'loadAudit and auditStatus' },
      { path: SCREEN, how: 'The Audit view shows the chain status and says that every read is itself logged' },
    ],
  },
  {
    id: 'fail-closed',
    capability: 'High-risk writes',
    prototype: 'A confirmation dialog, then the write; the audit entry came after, if at all',
    replacement: 'public.console_act writes the audit event first and performs the effect in the same function body; if the event cannot be written the call fails and nothing else happens',
    status: 'done',
    holders: [
      { path: MIGRATION_B, how: 'console_act: audit through private.console_audit_write, then the duty’s effect, then the request is executed' },
      { path: CHECK_B, how: 'With the audit insert revoked inside a savepoint the call raises and leaves no grant, no action record and no status change; on the happy path the audit seq precedes the effect' },
    ],
  },
  {
    id: 'two-person',
    capability: 'Two-person approvals',
    prototype: 'A second click by the same person',
    replacement: 'public.approval_request and approval_decision: a request routed to a different person’s session, self-approval refused on the server, two distinct approvers where the duty says so, fresh MFA on every decision',
    status: 'done',
    holders: [
      { path: MIGRATION_B, how: 'request_approval, decide_approval and the party check against private.party_held' },
      { path: CHECK_B, how: 'Self-approval raises; a second decision by the same approver is refused by the key; a two-person duty stays pending after one approve' },
      { path: SCREEN, how: 'The Approvals view: request, decide, act, with PRODUCTION_WRITE_NOTICE under every production write and the duty’s evidence requirement shown' },
      { path: SCREEN_TEST, how: 'The notice and the evidence requirement are rendered for each duty' },
    ],
  },
  {
    id: 'commercial-core',
    capability: 'Tenant, customer, commitment, contract data',
    prototype: 'Illustrative customers in a JavaScript array',
    replacement: 'public.customer, customer_commitment and customer_contract, tenant-scoped under RLS, written only through operations and read by console_customers',
    status: 'done',
    holders: [
      { path: MIGRATION_B, how: 'The three tables, their policies and console_customers' },
      { path: CHECK_B, how: 'A tenant:configure holder reads only their tenant; a browser session cannot write; a demo tenant is absent from the default read' },
      { path: CLIENT, how: 'loadCustomers' },
      { path: SCREEN, how: 'The Customers view: each record names its class per RECORD_KINDS and answers “Why can I see this?” per ACCESS_BASIS' },
      { path: SCREEN_TEST, how: 'Every rendered record carries its classification and the five access-basis fields' },
    ],
  },
  {
    id: 'figures',
    capability: 'Billing and reliability metrics',
    prototype: 'Numbers typed into a file and styled as a dashboard',
    replacement: 'public.console_figures: each figure from a real query with the seven provenance fields; the billing figure says “not applicable” with its source (D-009), never a number',
    status: 'done',
    holders: [
      { path: MIGRATION_A, how: 'console_figures with the rows the control plane can read: audit, verification, grants, seats, support windows, schools, gateway health, billing' },
      { path: MIGRATION_B, how: 'console_figures replaced with the approvals, break-glass, customer and contract rows added' },
      { path: CHECK_A, how: 'Every row carries a source, a window, an owner seat and a refresh; billing is not applicable and cites D-009' },
      { path: CHECK_B, how: 'The replaced function keeps every row of the first' },
      { path: SCREEN, how: 'The Figures view shows all seven FIGURE_PROVENANCE fields for each figure' },
      { path: SCREEN_TEST, how: 'No figure renders without its seven fields' },
    ],
  },
  {
    id: 'support-access',
    capability: 'Support access',
    prototype: 'A support role that could open any student’s record',
    replacement: 'Student-approved, case-scoped, time-bound grants with the session banner and a per-read audit; the console shows the open grant in its context bar',
    status: 'done',
    holders: [
      { path: 'supabase/support-access.check.sql', how: 'A support read needs a grant with a scope and an expiry, and each read is logged' },
      { path: CLIENT, how: 'openSupportGrants over the support_access_windows RPC' },
      { path: SCREEN, how: 'The Support access field: “None”, or the student, the ticket and when it ends' },
      { path: SCREEN_TEST, how: 'The bar reads None with no grant and the grant’s scope with one' },
    ],
  },
  {
    id: 'break-glass',
    capability: 'Break-glass',
    prototype: 'A checkbox that widened the role for the session',
    replacement: 'public.break_glass_grant opened only by console_act on an approved two-person request, with a ticket, fresh MFA, an expiry no later than four hours, a review due after it, and a post-use review by someone else',
    status: 'done',
    holders: [
      { path: MIGRATION_B, how: 'The grant table, break_glass_active, close_break_glass and review_break_glass, each audited first' },
      { path: CHECK_B, how: 'An expiry past four hours is refused; the subject cannot review their own grant; an unreviewed grant past its review blocks the next request' },
      { path: SCREEN, how: 'The Break-glass view: open grants, close, review' },
      { path: SCREEN_TEST, how: 'A grant renders with its expiry and review due, and the review control is not offered to its subject' },
    ],
  },
  {
    id: 'evidence',
    capability: 'Evidence and claims',
    prototype: 'A list of documents marked “current”',
    replacement: 'Evidence records with a produced date and a validity, whose state drives the claims register and the procurement pack: a claim resting on an expired record cannot stay “available”',
    status: 'done',
    holders: [
      { path: 'app/src/lib/ops/evidence.ts', how: 'EVIDENCE and evidenceState, using the escalation ladder above' },
      { path: 'app/src/lib/ops/evidence.test.ts', how: 'Every record cites a file that states its date; the state is shown each side of each step; the real date leaves no expired record under an available claim' },
      { path: 'app/src/lib/ops/claims.test.ts', how: 'problems() names a claim that rests on an expired record' },
      { path: 'docs/EVIDENCE-REGISTER.md', how: 'The rendered register' },
      { path: SCREEN, how: 'The Evidence view, from EVIDENCE and evidenceState' },
    ],
  },
  {
    id: 'command-center',
    capability: 'Live operational command center',
    prototype: 'A synthetic action queue whose fictional tenants, integrations, launch verdict and health cards could look production-ready',
    replacement: 'public.console_command_center: a fail-closed exception queue over current release evidence, approvals, break-glass, integrations, support and tenant rollout; an empty scoped queue is the only green state',
    status: 'done',
    holders: [
      { path: MIGRATION_C, how: 'The evidence-backed release gates, demo-aware operational unions and server-side console:operate refusal' },
      { path: CHECK_C, how: 'A non-operator is refused, missing proof stays red, live exceptions appear, and demo tenants stay out by default' },
      { path: CLIENT, how: 'loadCommandCenter maps the RPC without caching or browser storage' },
      { path: CLIENT_TEST, how: 'The RPC name, demo switch and evidence boundary round-trip' },
      { path: 'app/src/components/console/CommandCenter.tsx', how: 'The queue, severity counts, source, limitation and next safe step; GREEN only for zero rows' },
      { path: SCREEN_TEST, how: 'A missing restore proof renders NOT GO and no evidence; an empty live response alone renders GREEN' },
    ],
  },
  {
    id: 'environment',
    capability: 'Environment separation',
    prototype: 'The word “Production” in the header of a page full of invented records',
    replacement: 'A separate demo tenant (schools.is_demo) with synthetic data, excluded from every console read unless asked for; the environment word comes from the deployment, and production never shows an illustrative record',
    status: 'done',
    holders: [
      { path: MIGRATION_A, how: 'schools.is_demo, and include_demo defaulting to false on every reader' },
      { path: CHECK_A, how: 'A demo school’s rows are absent from the default read' },
      { path: 'app/src/lib/environment.ts', how: 'environment() from the deployment’s variables, never from a setting; ENVIRONMENT_SHAPE is a word and a shape' },
      { path: 'app/src/lib/environment.test.ts', how: 'Demo, Staging and Production from each variable, and never from anything an operator can change' },
      { path: 'app/src/lib/pagesdemo.test.ts', how: 'The deployed site is the product; the demo is beside it (TRUST-005)' },
      { path: 'app/src/lib/demosplit.test.ts', how: 'Demo data does not reach the production bundle' },
      { path: 'app/src/lib/ops/boundaries.test.ts', how: 'No fake production data and no browser service-role credential' },
      { path: SCREEN, how: 'The Environment field, as a word and a shape' },
    ],
  },
];

// ── the views ──────────────────────────────────────────────────────────────

export interface View {
  id: string;
  view: string;
  /** What it shows, and what it reads, in one line. */
  shows: string;
  detail?: {
    capability: string;
    status: 'done';
    replacement: string;
    holders: readonly { path: string; how: string }[];
  };
}

/** The console's views, in the order the screen offers them. */
export const VIEWS: readonly View[] = [
  { id: 'command', view: 'Command center', shows: 'Live release-gate and operational exceptions from production tables; green only when the scoped queue is empty, with every blocker naming its source, evidence boundary and next safe step' },
  { id: 'approvals', view: 'Approvals', shows: 'Requests against the duties matrix: raise one, decide one as a different person, and act on an approved one — the fail-closed write — with the production notice and the duty’s evidence requirement' },
  { id: 'break-glass', view: 'Break-glass', shows: 'Open grants with their ticket, expiry and review due; close one as its subject, review one as somebody else' },
  { id: 'audit', view: 'Audit', shows: 'The chain’s status (rows, head hash, last seal, last verification) and recent events; every read is itself an audit event, and the view says so' },
  {
    id: 'tenant-operations',
    view: 'Tenant operations',
    shows: 'Metadata-only rollout, configuration, integration, support-access and operational facts for exact schools covered by live tenant implementation grants; no student records or illustrative production data',
    detail: {
      capability: 'Tenant operations',
      status: 'done',
      replacement: 'a server-derived, exact-school operational summary available only when the operator has both the platform console shell and a live `tenant:implement` grant. Production excludes demo tenants and the browser supplies no tenant identifier',
      holders: [
        { path: 'supabase/migrations/20261005121000_console_tenant_operations.sql', how: 'Metadata-only fact union, server-derived exact-school scope, demo separation and restricted provenance fields' },
        { path: 'supabase/console-tenant-operations.check.sql', how: 'Shell-plus-domain authorization, wrong-tenant and expired-grant denial, demo separation and metadata-only response checks' },
        { path: 'app/src/lib/console/client.ts', how: 'loadTenantOperations calls the scoped RPC without accepting a tenant identifier or caching rows' },
        { path: 'app/src/components/console/TenantOperations.tsx', how: 'Grouped facts with provenance, classification, owner, freshness, visibility reason and limitation' },
        { path: 'app/src/components/console/TenantOperations.test.tsx', how: 'Loading, denial, empty, stale, future-date, scope and filter behavior' },
      ],
    },
  },
  {
    id: 'privacy',
    view: 'Privacy requests',
    shows: 'An identity-minimized, exact-school queue for access, export, correction, restriction and erasure; detail reads and lifecycle writes are separate, fresh-MFA, audited actions',
    detail: {
      capability: 'Privacy and data-rights operations',
      status: 'done',
      replacement: 'an identity-minimized queue over `public.data_subject_request`, available only when the operator has both the platform console shell and a live `data_request:handle` grant for an exact school. Sensitive detail is never loaded with the queue',
      holders: [
        { path: 'supabase/migrations/20261005123000_privacy_case_workspace.sql', how: 'Metadata-only queue, exact-school authorization, demo separation, assignment fields, legal-hold state and deletion-approval state' },
        { path: 'supabase/migrations/20261005124000_privacy_case_actions.sql', how: 'Fresh-MFA claim, audited detail read, identity verification, resolution, live-hold and exact executed-approval enforcement, and immutable completion certificates' },
        { path: 'supabase/privacy-case-workspace.check.sql', how: 'Wrong-role, expired-grant, wrong-tenant, demo, assignment and identity-minimization checks' },
        { path: 'supabase/privacy-case-actions.check.sql', how: 'Stale-MFA, ownership, failed-audit, live-hold, approval, certificate and audit-first paths' },
        { path: 'app/src/components/console/PrivacyRequests.tsx', how: 'Metadata queue, explicit claim/detail/verification/approval/resolution controls, overdue and hold states, and fail-closed loading, denial and error behavior' },
        { path: 'app/src/components/console/PrivacyRequests.test.tsx', how: 'Metadata-only rendering, overdue routing, denial, claim, detail, verification, deletion approval, held refusal, completed erasure and terminal read-only states' },
        { path: 'docs/DATA-RIGHTS-REQUEST-RUNBOOK.md', how: 'The operated procedure and quarterly rehearsal boundary' },
      ],
    },
  },
  {
    id: 'integration-health',
    view: 'Integration health',
    shows: 'Credential-free configuration, freshness, run, reconciliation, exception, ownership and customer-impact summaries for exact-school integration grants; configuration changes are request-only approvals',
    detail: {
      capability: 'Integration health operations',
      status: 'done',
      replacement: 'a credential-free summary over connector configuration, sync freshness, data quality, failures, ownership and customer impact, available only with both the platform console shell and a live `integration:view` grant for an exact school. The browser cannot submit a tenant id to the reader',
      holders: [
        { path: 'supabase/migrations/20261005125000_console_integration_health.sql', how: 'Server-derived tenant scope, explicit demo gate, allowlisted fields, computed five-state health and exact configuration-approval status' },
        { path: 'supabase/console-integration-health.check.sql', how: 'Exact-school, demo, shell/domain denial, five-state, pending-approval and planted-secret redaction checks' },
        { path: 'app/src/components/console/IntegrationHealth.tsx', how: 'Health evidence, cautious impact, next safe action and a structured request-only `integration-config` approval; no configuration mutation or credential field' },
        { path: 'app/src/components/console/IntegrationHealth.test.tsx', how: 'Healthy, degraded, stale, failed, unconfigured, denial, demo and exact approval-request coverage' },
        { path: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md', how: 'Actual monitoring, approval, verification and rollback procedure' },
      ],
    },
  },
  {
    id: 'release-incidents',
    view: 'Release & incidents',
    shows: 'Evidence-derived release, deployment-verification and incident lifecycle states with customer impact, communication cadence, rollback status and request-only approvals; never a self-certified GO decision',
    detail: {
      capability: 'Release and incident operations',
      status: 'done',
      replacement: 'a platform-scoped, restricted summary over current release evidence, exact deployment and verification commits, incident impact and communication cadence. It requires both the console shell and `incident:communicate` at platform scope, and exposes approval requests rather than deployment or rollback execution',
      holders: [
        { path: 'supabase/migrations/20261005126000_console_release_incidents.sql', how: 'Conservative seven-gate release state, exact-commit deployment verification, service-recorded incidents, server-derived scope and allowlisted metadata' },
        { path: 'supabase/console-release-incidents.check.sql', how: 'Missing and mismatched evidence, release candidate, deployment, verification, incident, rollback, recovery, demo, role and planted-notice redaction checks' },
        { path: 'app/src/components/console/ReleaseIncidents.tsx', how: 'Six required lifecycle states plus verified evidence, customer impact, communication cadence and structured request-only release or rollback approvals' },
        { path: 'app/src/components/console/ReleaseIncidents.test.tsx', how: 'Lifecycle, denial, empty, demo, no-direct-execution and exact approval-request coverage' },
        { path: 'docs/RELEASE-INCIDENT-OPERATOR-RUNBOOK.md', how: 'Evidence capture, approval, external execution, exact-commit verification, incident communication, rollback and recovery procedure' },
        { path: 'docs/operating-model/INCIDENT-COMMUNICATIONS.md', how: 'Audience, cadence and message-quality requirements; notice bodies remain outside the console summary' },
      ],
    },
  },
  { id: 'customers', view: 'Customers', shows: 'Tenants, commitments and contracts, each record with its classification and why the operator can see it' },
  { id: 'figures', view: 'Figures', shows: 'Every figure with its source, time window, environment, owner, last refresh, evidence and known limitation; billing says there is no billing' },
  { id: 'evidence', view: 'Evidence', shows: 'Every evidence record with its expiry, its escalation step and the claims resting on it' },
  { id: 'views', view: 'Views', shows: 'Saved table views and the last tab, stored per operator in operator_preference' },
];
