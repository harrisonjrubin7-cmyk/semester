/**
 * The integrated control register: what protects a student's educational life
 * and an institution's operations, which product domains each control covers,
 * and — separately for every control — whether anything in the tree fails when
 * the control is removed.
 *
 * The register exists because the trust documents under `docs/trust/` describe
 * controls in prose, and the enforcement lives in `supabase/*.check.sql`, in
 * CI, in gateway tests and in a handful of drills. Nothing joined them, so a
 * reader could not ask "which of the things we say we do would a bad change
 * break the build for?" This answers it.
 *
 * Four states, and they are about the repository, not production:
 *
 *   enforced    a test, a database check or a workflow fails without it.
 *   partial     enforced for part of the surface, or enforced in the tree and
 *               not switched on where it matters; `gap` says which.
 *   documented  written down; nothing fails if it is ignored.
 *   absent      neither.
 *
 * There is no fifth state for "operating in production". The master register
 * lets no row past `tested` without a file under `docs/evidence/`, and this
 * register follows it: `enforced` is a claim about CI.
 */

import type { Seat } from '../launchreadiness';

export const FAMILIES = ['security', 'privacy', 'accessibility', 'reliability', 'support', 'incident', 'ai', 'safety'] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_TITLE: Record<Family, string> = {
  security: 'Security',
  privacy: 'Privacy and data lifecycle',
  accessibility: 'Accessibility',
  reliability: 'Reliability',
  support: 'Support access',
  incident: 'Incident response',
  ai: 'AI governance',
  safety: 'Trust and safety',
};

/** The prefix a control id in each family carries: `TC-SEC-01`. */
export const FAMILY_PREFIX: Record<Family, string> = {
  security: 'SEC',
  privacy: 'PRV',
  accessibility: 'A11',
  reliability: 'REL',
  support: 'SUP',
  incident: 'INC',
  ai: 'AI',
  safety: 'TSF',
};

export const STATES = ['enforced', 'partial', 'documented', 'absent'] as const;
export type State = (typeof STATES)[number];

export const MECHANISMS = ['database-check', 'ci', 'code-test', 'process', 'document'] as const;
export type Mechanism = (typeof MECHANISMS)[number];

/** The mechanisms that can fail a build. A control that claims `enforced` must use one. */
export const FAILS_A_BUILD: readonly Mechanism[] = ['database-check', 'ci', 'code-test'];

/** What a proof path must look like for an `enforced` or `partial` control. */
export const PROOF_SHAPE = /(\.test\.tsx?$|\.check\.sql$|^\.github\/workflows\/[\w.-]+\.yml$|^supabase\/[\w.-]+\.sh$)/;

/** The thirteen product domains the audit names, in the order it names them. */
export const DOMAINS = [
  'identity',
  'academic',
  'learning',
  'productivity',
  'ai',
  'campus',
  'family',
  'finance',
  'career',
  'marketplace',
  'administration',
  'safety-support',
  'mobile-offline',
] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_TITLE: Record<Domain, string> = {
  identity: 'Identity and tenancy',
  academic: 'Academic core and records',
  learning: 'Learning and assessment',
  productivity: 'Productivity and documents',
  ai: 'AI assistant, tutor and advisor',
  campus: 'Campus life and community',
  family: 'Family and guardian',
  finance: 'Finance and payments',
  career: 'Career and alumni',
  marketplace: 'Marketplace and partners',
  administration: 'Institution console and support',
  'safety-support': 'Trust, safety and support',
  'mobile-offline': 'Mobile and offline',
};

export interface Control {
  id: string;
  family: Family;
  /** What the control does, in one sentence a procurement reader can quote. */
  does: string;
  domains: readonly Domain[] | 'all';
  mechanism: Mechanism;
  state: State;
  /** Tests, checks and workflows that fail without it. Required for `enforced` and `partial`. */
  proof: readonly string[];
  /** Where the control is described or planned, for `documented` and `absent`. */
  described?: readonly string[];
  /** What is missing. Required for every state but `enforced`; optional there for a limit worth stating. */
  gap?: string;
  owner: Seat;
}

const ALL = 'all' as const;

export const CONTROLS: readonly Control[] = [
  // ── Security ──
  {
    id: 'TC-SEC-01',
    family: 'security',
    does: 'Every table has row-level security, every client-callable definer function pins its search path, and no anonymous role can execute one.',
    domains: ALL,
    mechanism: 'database-check',
    state: 'enforced',
    proof: ['supabase/rls-coverage.check.sql', 'supabase/definer-sweep.check.sql', 'supabase/grants.check.sql'],
    gap: 'No FORCE ROW LEVEL SECURITY declaration exists in the migrations; the suites run in CI on PostgreSQL 17 but could not be run on the last local validation host.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-02',
    family: 'security',
    does: 'A profile cannot move itself between tenants, and the integration tables are read through a four-account matrix.',
    domains: ['identity', 'administration'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/tenancy.check.sql', 'supabase/integration-rls-matrix.check.sql'],
    gap: 'Tenant scoping of classmates, rooms and groups is open (G-03 in SECURITY-THREAT-MODEL.md) and legacy-table coverage is incomplete; no cross-tenant test spans cache, search, queue and storage together.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-03',
    family: 'security',
    does: 'The institutional gateway checks origin, bearer token, membership on every request, body size and a per-user rate limit before it acts.',
    domains: ['identity', 'academic', 'finance', 'administration'],
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/server/institution/gateway.test.ts', 'app/server/institution/auth.test.ts', 'app/server/institution/membership.test.ts', 'app/server/institution/rate-limit.test.ts'],
    gap: 'The gateway is not deployed and the hourly production probe for it is unconfigured, so nothing shows it operating.',
    owner: 'engineering',
  },
  {
    id: 'TC-SEC-04',
    family: 'security',
    does: 'Every Edge Function is registered with a guard kind and the source must carry evidence for it.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/edgeguards.test.ts'],
    gap: 'Proves a guard is present, not that it is correct; all sixteen functions set verify_jwt = false and rely on their own checks.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-05',
    family: 'security',
    does: 'Secrets are scanned on the diff and the whole tree, and dependencies are audited, on every change.',
    domains: ALL,
    mechanism: 'ci',
    state: 'partial',
    proof: ['.github/workflows/ci.yml'],
    gap: 'The dependency audit step is continue-on-error, so a high-severity advisory does not fail the build.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-06',
    family: 'security',
    does: 'Static analysis of first-party code for injection, authorization and cryptography defects.',
    domains: ALL,
    mechanism: 'process',
    state: 'absent',
    proof: [],
    described: ['docs/trust/SECURITY-TESTING-PLAN.md'],
    gap: 'No CodeQL, Semgrep or equivalent runs in any workflow; Dependabot does not cover Deno imports.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-07',
    family: 'security',
    does: 'Authenticated dynamic scanning of the application, the database API, the Edge Functions and the gateway.',
    domains: ALL,
    mechanism: 'ci',
    state: 'partial',
    proof: ['.github/workflows/hawkscan.yml'],
    gap: 'The scan covers a static preview of the built app and a company-site fixture only; it is unauthenticated and does not touch Supabase, the functions or the gateway.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-08',
    family: 'security',
    does: 'High-impact console actions need two different approvers, and the audit row is written before the action and never swallowed.',
    domains: ['administration', 'safety-support'],
    mechanism: 'database-check',
    state: 'enforced',
    proof: ['supabase/console-approvals.check.sql', 'supabase/console-control-plane.check.sql'],
    owner: 'security',
  },
  {
    id: 'TC-SEC-09',
    family: 'security',
    does: 'Break-glass access is opened only from an approved two-person request, expires within four hours and must be reviewed by someone else.',
    domains: ['administration', 'safety-support'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/console-control-plane.check.sql'],
    gap: 'private.break_glass_active is defined and consumed by nothing, so a grant is an authorization record and review gate that widens no access; the security seat that must co-approve is vacant.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-10',
    family: 'security',
    does: 'Fresh multi-factor authentication (aal2, within fifteen minutes) is required for approvals, break-glass and support notifications.',
    domains: ['administration', 'safety-support'],
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/console/client.test.ts'],
    gap: 'Console only: has_capability checks no assurance level, and students have no multi-factor or passkey enrolment.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-11',
    family: 'security',
    does: 'Passkeys and multi-factor authentication for students and for platform staff roles outside the console.',
    domains: ['identity'],
    mechanism: 'process',
    state: 'absent',
    proof: [],
    described: ['docs/trust/PASSWORD-SESSION-AND-MFA-STANDARD.md'],
    gap: 'No enrolment screen, no aal2 requirement on platform_admin or support_agent, provider-console multi-factor is an owner attestation only.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-12',
    family: 'security',
    does: 'Academic and student-account ledgers are hash-chained and sealed daily, so an edit to history is detectable.',
    domains: ['academic', 'finance'],
    mechanism: 'database-check',
    state: 'enforced',
    proof: ['supabase/ledger-chains.check.sql', 'supabase/ledger-seals.check.sql'],
    gap: 'Anyone who can read the signing key can re-seal; the seal limit is stated in its own check.',
    owner: 'data',
  },
  {
    id: 'TC-SEC-13',
    family: 'security',
    does: 'Keys and secrets are inventoried, rotated on a schedule and the rotation recorded.',
    domains: ALL,
    mechanism: 'document',
    state: 'documented',
    proof: [],
    described: ['SECRETS.md', 'docs/trust/ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md'],
    gap: 'The rotation log is empty, and SEMESTER_JOURNAL_KEY and SEMESTER_AUTH_SERVICE_KEY are absent from the rotation table; the journal key has no identifier or re-encryption path.',
    owner: 'security',
  },
  {
    id: 'TC-SEC-14',
    family: 'security',
    does: 'Production serves HSTS, a content security policy, frame-ancestors and the other response headers.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/hostheaders.test.ts'],
    gap: 'The headers are specified for hosts that do not serve production; the app is served from GitHub Pages, which sends none of them.',
    owner: 'engineering',
  },
  {
    id: 'TC-SEC-15',
    family: 'security',
    does: 'Changes to main need a review, a code-owner review, and green build, secrets and account-sync checks.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/branchprotection.test.ts'],
    gap: 'The ruleset file is held to the job names but is not active until the owner applies it, and CODEOWNERS names one person, so a review by someone else is impossible today.',
    owner: 'engineering',
  },
  {
    id: 'TC-SEC-16',
    family: 'security',
    does: 'An independent penetration test of the application, database policies, functions and gateway, with findings tracked to closure.',
    domains: ALL,
    mechanism: 'process',
    state: 'absent',
    proof: [],
    described: ['docs/trust/PENETRATION-TEST-PLAN.md'],
    gap: 'Never performed: firm, authorization letter, environment and report are all not started.',
    owner: 'security',
  },

  // ── Privacy and data lifecycle ──
  {
    id: 'TC-PRV-01',
    family: 'privacy',
    does: 'Export and erasure walk a catalogue-derived map of every column that references an account, so a new table cannot be forgotten.',
    domains: ALL,
    mechanism: 'database-check',
    state: 'enforced',
    proof: ['supabase/deletion.check.sql'],
    gap: 'Device-only content is not covered, and the single full-account export file does not exist.',
    owner: 'data',
  },
  {
    id: 'TC-PRV-02',
    family: 'privacy',
    does: 'An account, tenant or platform legal hold blocks erasure and the retention sweeps, needs a reason and matter, and is released only by someone else.',
    domains: ALL,
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/legal-holds.check.sql', 'supabase/hold-aware-sweeps.check.sql', 'supabase/hold-gated-sweeps.check.sql'],
    gap: 'Nothing suspends provider backup expiry under a hold, financial purges are not stated as hold-gated, and device deletion is outside it.',
    owner: 'privacy',
  },
  {
    id: 'TC-PRV-03',
    family: 'privacy',
    does: 'Every table with a retention clock is listed, bidirectionally against the schema, with the period it runs on.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'enforced',
    proof: ['app/src/lib/retention.test.ts', 'supabase/retention-sweeps.check.sql'],
    gap: 'Several classes have no schedule yet (outbox events, closed support tickets, roster imports, student-account ledgers); the periods are not approved by counsel.',
    owner: 'privacy',
  },
  {
    id: 'TC-PRV-04',
    family: 'privacy',
    does: 'A person can raise an export, correction, restriction or erasure request, which is recorded against their account with a due date.',
    domains: ALL,
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/audit-and-subject-requests.check.sql'],
    gap: 'Nothing handles the request on the operator side: no identity verification step, no status transition, no overdue monitor, and the thirty-day due date is a placeholder awaiting counsel.',
    owner: 'privacy',
  },
  {
    id: 'TC-PRV-05',
    family: 'privacy',
    does: 'Advisor, supporter and family shares are expiring, revocable and logged with who read what and when.',
    domains: ['academic', 'family', 'safety-support'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/advisor.check.sql', 'supabase/supportshares.check.sql', 'supabase/support-access.check.sql'],
    gap: 'No purpose, legal basis or signature method is recorded, a revoked share can be deleted by the student, and reads log reader and time only.',
    owner: 'privacy',
  },
  {
    id: 'TC-PRV-06',
    family: 'privacy',
    does: 'Accounts under thirteen are refused, and minors are kept out of discovery, matching, mentoring and employer visibility.',
    domains: ['identity', 'family', 'campus', 'career'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/minimum-age.check.sql', 'supabase/k12-guardians.check.sql'],
    gap: 'Community join and post are not gated by minor status in SQL, the guardian portal is not built, and parental consent has not started counsel review.',
    owner: 'privacy',
  },
  {
    id: 'TC-PRV-07',
    family: 'privacy',
    does: 'A new surface that holds personal data has a privacy impact assessment answering eleven fixed questions, with evidence for each answer.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/governance/pia.test.ts'],
    gap: 'Seven surfaces are assessed and six are owed; the check does not require an assessment before a surface ships.',
    owner: 'privacy',
  },
  {
    id: 'TC-PRV-08',
    family: 'privacy',
    does: 'The subprocessor list matches the content security policy and the Edge Functions, so a new vendor cannot appear unlisted.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/trust/subprocessors.test.ts'],
    gap: 'The list is real; approval is not: no provider terms are signed, regions and transfers are not verified, and deletion propagation to providers has no evidence.',
    owner: 'privacy',
  },

  // ── Accessibility ──
  {
    id: 'TC-A11-01',
    family: 'accessibility',
    does: 'axe-core runs over the rendered app at desktop and phone width and fails on serious or critical violations.',
    domains: ['learning', 'productivity', 'campus', 'identity'],
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/a11y/axe.test.tsx'],
    gap: 'Fifteen render cases in jsdom: no layout, so colour contrast and target size are never judged; search, directory, mail, ask, help, calls, the console and every signed-in or error state are outside it.',
    owner: 'accessibility',
  },
  {
    id: 'TC-A11-02',
    family: 'accessibility',
    does: 'Seven critical journeys are driven in a real browser at 1280 and 320 pixels: one main landmark, named controls, valid references, no overflow, a working skip link.',
    domains: ['learning', 'academic', 'productivity', 'identity'],
    mechanism: 'ci',
    state: 'enforced',
    proof: ['.github/workflows/ci.yml'],
    gap: 'Hand-rolled checks, not axe; 375 pixels, tablet and real devices are not covered.',
    owner: 'accessibility',
  },
  {
    id: 'TC-A11-03',
    family: 'accessibility',
    does: 'Every accent-and-ground pairing in the palette meets contrast, for the full and the faded text strengths, against every surface it can sit on.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'enforced',
    proof: ['app/src/lib/contrast.test.ts'],
    gap: 'Compares tokens to tokens; what a browser composites is measured only by the nightly sweep.',
    owner: 'accessibility',
  },
  {
    id: 'TC-A11-04',
    family: 'accessibility',
    does: 'A nightly browser sweep measures painted contrast across thirteen grounds, two widths and hover and focus states.',
    domains: ALL,
    mechanism: 'ci',
    state: 'partial',
    proof: ['.github/workflows/contrast.yml', 'app/src/lib/workflowshell.test.ts'],
    gap: 'Opens five of sixty-three destinations by default and cannot measure 14,025 elements painted on gradients; until the Work empty-state text is fixed it fails every night.',
    owner: 'accessibility',
  },
  {
    id: 'TC-A11-05',
    family: 'accessibility',
    does: 'Labels, landmarks, focus rings, modal focus traps, reduced motion, drag alternatives and field errors each have a guard that fails on regression.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'enforced',
    proof: ['app/src/a11y/labels.test.ts', 'app/src/a11y/focus.test.ts', 'app/src/a11y/modal.test.ts', 'app/src/a11y/motion.test.ts'],
    owner: 'accessibility',
  },
  {
    id: 'TC-A11-06',
    family: 'accessibility',
    does: 'Screen readers, voice control, zoom, forced colours and switch access are used on the golden path and the results filed.',
    domains: ALL,
    mechanism: 'process',
    state: 'absent',
    proof: [],
    described: ['docs/accessibility/AT-PASS-PROTOCOL.md'],
    gap: 'No dated manual or assistive-technology result exists; nineteen of the fifty-five WCAG 2.2 A and AA criteria in the protocol have no automated evidence at all.',
    owner: 'accessibility',
  },
  {
    id: 'TC-A11-07',
    family: 'accessibility',
    does: 'Captions and transcripts for audio are generated from their source and fail the build if they drift.',
    domains: ['learning', 'productivity'],
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/webvtt.test.ts'],
    gap: 'Forty-eight caption files against fifty-two audio files; video has no captions or description; live call captions are untested.',
    owner: 'accessibility',
  },

  // ── Reliability ──
  {
    id: 'TC-REL-01',
    family: 'reliability',
    does: 'An hourly probe records the app, sign-in, database API, AI route and checkout route to a history, and a day nobody checked is never drawn as up.',
    domains: ['identity', 'productivity', 'finance'],
    mechanism: 'ci',
    state: 'partial',
    proof: ['.github/workflows/production-smoke.yml', 'app/src/lib/statushistory.test.ts'],
    gap: 'The AI and checkout probes are preflight requests that call no model and attempt no payment; the institutional job is unconfigured; many scheduled hours were skipped.',
    owner: 'operations',
  },
  {
    id: 'TC-REL-02',
    family: 'reliability',
    does: 'The error budget for each service-level objective is computed from eligible and failed events, with a release rule for each state.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/governance/error-budgets.test.ts'],
    gap: 'Nothing feeds it real events, so no objective has a measured value and no release has ever been frozen by it.',
    owner: 'operations',
  },
  {
    id: 'TC-REL-03',
    family: 'reliability',
    does: 'Seven database scenarios run under load in CI against p95 budgets, with a soak that catches drift and a planted leak.',
    domains: ['productivity', 'identity', 'academic'],
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/scripts/soak.test.ts', '.github/workflows/ci.yml'],
    gap: 'Database only: no browser soak, no large-tenant or many-small-tenants case, no upload or AI load, no run through the real auth and API stack; the plans scenario still intermittently misses its budget.',
    owner: 'engineering',
  },
  {
    id: 'TC-REL-04',
    family: 'reliability',
    does: 'A logical dump is restored into a disposable database on every change and fingerprints, row counts, row-level security and event triggers compared.',
    domains: ALL,
    mechanism: 'ci',
    state: 'partial',
    proof: ['supabase/restore.sh', '.github/workflows/ci.yml'],
    gap: 'Proves the dump format restores, not that the provider can: point-in-time recovery has never been restored, no recovery time or point objective is measured, and the gateway journal has no backup.',
    owner: 'operations',
  },
  {
    id: 'TC-REL-05',
    family: 'reliability',
    does: 'The AI generation kill switch fails closed when its state cannot be read, and its drill is scripted.',
    domains: ['ai'],
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/aikillswitch.test.ts', 'app/src/lib/killswitchdrill.test.ts'],
    gap: 'Drilled once on the deployed AI function; the other seven switches and read-only mode have never been engaged against production.',
    owner: 'operations',
  },
  {
    id: 'TC-REL-06',
    family: 'reliability',
    does: 'An alert reaches an assigned person within a stated time when a service-level objective burns, authentication fails or backups stop.',
    domains: ALL,
    mechanism: 'process',
    state: 'absent',
    proof: [],
    described: ['MONITORING.md', 'docs/trust/LOGGING-MONITORING-AND-ALERTING-STANDARD.md'],
    gap: 'The only alert is AI spend, provider-side; there is no error reporting in the client and no routing to a person other than the founder.',
    owner: 'operations',
  },
  {
    id: 'TC-REL-07',
    family: 'reliability',
    does: 'Bundle size per route and for first load is held to a budget on every change.',
    domains: ALL,
    mechanism: 'ci',
    state: 'enforced',
    proof: ['.github/workflows/ci.yml'],
    gap: 'Bundle size only: no field measurement of load, interaction or layout shift exists.',
    owner: 'engineering',
  },

  // ── Support access ──
  {
    id: 'TC-SUP-01',
    family: 'support',
    does: 'A supporter sees a student\'s learning signals only under a student-granted, expiring, reasoned grant that the student can see being used.',
    domains: ['safety-support', 'academic'],
    mechanism: 'database-check',
    state: 'enforced',
    proof: ['supabase/support-access.check.sql'],
    owner: 'privacy',
  },
  {
    id: 'TC-SUP-02',
    family: 'support',
    does: 'The support queue carries no identity by default, limits context to named keys that start unticked, and rate-limits tickets per account.',
    domains: ['safety-support'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/support-tickets.check.sql'],
    gap: 'Behind a flag that is off, with no named owner or hours, no first-response probe and no closed-ticket retention period.',
    owner: 'success',
  },
  {
    id: 'TC-SUP-03',
    family: 'support',
    does: 'Impersonation of a student by staff does not exist.',
    domains: ['administration', 'safety-support'],
    mechanism: 'document',
    state: 'documented',
    proof: [],
    described: ['docs/OPERATIONS-CONSOLE-MAP.md'],
    gap: 'True by absence; no test or check asserts it, so a future impersonation feature would break nothing.',
    owner: 'security',
  },

  // ── Incident response ──
  {
    id: 'TC-INC-01',
    family: 'incident',
    does: 'An incident message cannot be composed with a missing section, a placeholder, a hedge phrase or a missing required detail, and names its approvers and update interval.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/governance/incident-comms.test.ts'],
    gap: 'Composes text only: no subscriber list, no delivery, no evidence a message was ever sent.',
    owner: 'trust',
  },
  {
    id: 'TC-INC-02',
    family: 'incident',
    does: 'Incidents are posted from a validated file to a status page and a feed.',
    domains: ALL,
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/statuspage.test.ts', 'app/src/lib/statushistory.test.ts'],
    gap: 'Posting means editing JSON, merging and waiting for a deploy; no subscriber notification; no incident has ever been closed through it.',
    owner: 'operations',
  },
  {
    id: 'TC-INC-03',
    family: 'incident',
    does: 'A named, staffed incident commander and a backup can be reached outside business hours.',
    domains: ALL,
    mechanism: 'process',
    state: 'absent',
    proof: [],
    described: ['docs/engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md'],
    gap: 'One person holds every role and there is no rota; the backup, the second reviewer of the AI switch, customer contacts and counsel are all unassigned.',
    owner: 'founder',
  },
  {
    id: 'TC-INC-04',
    family: 'incident',
    does: 'Incident scenarios are rehearsed on a calendar, through the real contact tree, and each rehearsal files its findings.',
    domains: ALL,
    mechanism: 'document',
    state: 'documented',
    proof: [],
    described: ['docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md'],
    gap: 'One document walkthrough has been held; sixteen game days are planned and none held.',
    owner: 'operations',
  },

  // ── AI governance ──
  {
    id: 'TC-AI-01',
    family: 'ai',
    does: 'Requests to the AI function are clamped in size and model, and cost is capped per account per month.',
    domains: ['ai'],
    mechanism: 'code-test',
    state: 'partial',
    proof: ['app/src/lib/claudeclamp.test.ts'],
    gap: 'Metering counts calls, not cost, and the function does not read the tenant AI policy; the kill switch is its only tenant control.',
    owner: 'engineering',
  },
  {
    id: 'TC-AI-02',
    family: 'ai',
    does: 'Tenant AI use needs an approved provider and a budget, and spend is reserved before a call.',
    domains: ['ai', 'administration'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/intelligence-policy.check.sql'],
    gap: 'Applies to the institutional gateway path, which is not deployed.',
    owner: 'engineering',
  },
  {
    id: 'TC-AI-03',
    family: 'ai',
    does: 'Ten starting scopes — autonomous registration, grade or aid decisions, discipline, health, opaque scoring, hiring decisions and others — are refused at intake.',
    domains: ['ai', 'academic', 'finance', 'career'],
    mechanism: 'code-test',
    state: 'enforced',
    proof: ['app/src/lib/governance/ai-lifecycle.test.ts'],
    gap: 'Refuses a proposal at intake; it does not stop a route that was never proposed.',
    owner: 'trust',
  },
  {
    id: 'TC-AI-04',
    family: 'ai',
    does: 'A recorded adversarial run shows the assistant refusing planted instructions in on-screen content.',
    domains: ['ai'],
    mechanism: 'process',
    state: 'documented',
    proof: [],
    described: ['docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json'],
    gap: 'One run of twenty-one cases on one model through the shared-key route; not repeated on a model change, not part of any gate, and prompts are not redacted for personal data.',
    owner: 'trust',
  },

  // ── Trust and safety ──
  {
    id: 'TC-TSF-01',
    family: 'safety',
    does: 'Community posts are reported into severity-ranked cases, decided with a reason code, appealable by the author, and automation can only protect, never remove.',
    domains: ['campus', 'safety-support'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/community.check.sql'],
    gap: 'Held off in production; no assignee or response clock on a case, case events are mutable and deleted with the case, and nothing under docs/evidence/ shows it operating.',
    owner: 'trust',
  },
  {
    id: 'TC-TSF-02',
    family: 'safety',
    does: 'A reviewer cannot read who reported, and an alias is revealed only through a case, for four hours, decided by a different reviewer and logged.',
    domains: ['campus', 'safety-support'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/community.check.sql'],
    gap: 'Reveal and safety-read are logged; ordinary reads of the queue and of a case are not.',
    owner: 'trust',
  },
  {
    id: 'TC-TSF-03',
    family: 'safety',
    does: 'Uploaded images are scanned before they publish, with a hash blocklist so a removed image cannot return.',
    domains: ['campus'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/community.check.sql'],
    gap: 'The scanner function does not exist and no known-abuse hash provider is configured, so no image can publish; that is the safe failure, not a working control.',
    owner: 'trust',
  },
  {
    id: 'TC-TSF-04',
    family: 'safety',
    does: 'A P0 or P1 case can be escalated to an institution by two different professionals under a signed agreement, by a signed, retried webhook.',
    domains: ['campus', 'safety-support'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/community.check.sql'],
    described: ['docs/CAMPUS-ESCALATION-POLICY.md'],
    gap: 'The escalate Edge Function does not exist and its cron job is parked; no agreement is signed.',
    owner: 'trust',
  },
  {
    id: 'TC-TSF-05',
    family: 'safety',
    does: 'Known child sexual abuse material is preserved, reported to the required body and removed within the legal time.',
    domains: ['campus'],
    mechanism: 'document',
    state: 'absent',
    proof: [],
    described: ['docs/COMMUNITY-MEDIA-SAFETY.md'],
    gap: 'No reporting code, filer, preservation period, access role or takedown clock exists; counsel must confirm the section before image posts are switched on (requires qualified human counsel review).',
    owner: 'trust',
  },
  {
    id: 'TC-TSF-06',
    family: 'safety',
    does: 'A government or law-enforcement request for user data is authenticated, reviewed by counsel, scoped, logged and answered on a stated clock.',
    domains: ALL,
    mechanism: 'document',
    state: 'absent',
    proof: [],
    described: ['docs/legal-drafts/LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md'],
    gap: 'Draft with every field to be decided; nothing in code (requires qualified human counsel review).',
    owner: 'privacy',
  },
  {
    id: 'TC-TSF-07',
    family: 'safety',
    does: 'Moderation, escalation, takedown and appeal figures are published from a verified reporting process.',
    domains: ['campus', 'marketplace'],
    mechanism: 'process',
    state: 'absent',
    proof: [],
    gap: 'No transparency reporting exists and the draft procedure forbids publishing a statistic without a verified process.',
    owner: 'trust',
  },
  {
    id: 'TC-TSF-08',
    family: 'safety',
    does: 'Partner and opportunity listings are drafted by the publisher and published or removed only by a moderator, with https-only links.',
    domains: ['marketplace', 'career'],
    mechanism: 'database-check',
    state: 'partial',
    proof: ['supabase/listings.check.sql'],
    gap: 'This is the only marketplace-shaped code: there are no orders, payouts, seller verification, buyer-seller disputes or listing-level reports, and no compensation or supervisor fields.',
    owner: 'trust',
  },
];

/** Controls grouped by family, in the order of FAMILIES. */
export const byFamily = (family: Family): readonly Control[] => CONTROLS.filter((c) => c.family === family);

export const control = (id: string): Control | undefined => CONTROLS.find((c) => c.id === id);

export const coversDomain = (c: Control, d: Domain): boolean => c.domains === 'all' || c.domains.includes(d);

/** How many controls sit in each state for a domain. */
export function tally(domain: Domain): Record<State, number> {
  const out: Record<State, number> = { enforced: 0, partial: 0, documented: 0, absent: 0 };
  for (const c of CONTROLS) if (coversDomain(c, domain)) out[c.state] += 1;
  return out;
}
