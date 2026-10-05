/**
 * The claims register: every capability the public site asserts, with the
 * status it may claim, the evidence behind it, and the pages it appears on.
 *
 * ## Why it exists
 *
 * A marketing page is where a product is most tempted to say more than it can
 * back up, and the failure is rarely a lie: it is "SAML SSO" on a page written
 * when SAML was a week from done, still there a year later with SAML switched
 * on for nobody. The master register (PRG-002) asks that every external claim
 * map to implemented evidence and approved scope; this is that map. A claim
 * here names the master-register rows it rests on, and `problems()` refuses a
 * claim whose status is above what those rows support, an "available" with no
 * test behind it, a page that does not print the wording, and a page that
 * prints a status label this register does not know.
 *
 * ## The statuses
 *
 * Six words the site prints beside a capability, and the register status each
 * needs. A claim may always understate — "in preparation" over a tested row is
 * a choice, not a fault — but it may not overstate, and the test is the one
 * that says so.
 *
 * ## What is not a claim
 *
 * Statements of what Semester will *not* do, and the numbers the tools print,
 * are held by their own tests (`site.test.tsx`, `plans.test.ts`). A claim here
 * is a capability a reader might buy on.
 *
 * `ops/claims/README.md` is rendered from this file by `claims.test.ts`; edit
 * the data, then `npm run registers` from app/.
 */

import type { Seat } from '../launchreadiness';
import type { Status as RegisterStatus } from '../masterregister';

export type ClaimStatus = 'available' | 'limited-beta' | 'institution-configured' | 'built-tested' | 'in-preparation' | 'planned';

export const CLAIM_STATUSES: readonly ClaimStatus[] = ['available', 'limited-beta', 'institution-configured', 'built-tested', 'in-preparation', 'planned'];

/** The words the site prints. */
export const STATUS_LABEL: Record<ClaimStatus, string> = {
  available: 'Available now',
  'limited-beta': 'Limited beta',
  'institution-configured': 'Institution-configured',
  'built-tested': 'Built and tested, not yet deployed',
  'in-preparation': 'In preparation',
  planned: 'Planned',
};

export const STATUS_MEANING: Record<ClaimStatus, string> = {
  available: 'Running for every student today, and a test exercises it on every change',
  'limited-beta': 'Running for named design partners; not yet for everyone',
  'institution-configured': 'Available once an institution turns it on and configures it',
  'built-tested': 'Code exists and its tests pass; no institution has it deployed',
  'in-preparation': 'Work is under way; the register row says how far',
  planned: 'Decided and scheduled; not built',
};

/**
 * The lowest master-register status a claim's rows may hold for each word. A
 * row below the floor makes the claim an overstatement.
 */
export const FLOOR: Record<ClaimStatus, RegisterStatus> = {
  available: 'tested',
  'limited-beta': 'implemented',
  'institution-configured': 'tested',
  'built-tested': 'tested',
  'in-preparation': 'building',
  planned: 'not-started',
};

/** The register's statuses in the order a row climbs them; `blocked` claims nothing. */
export const RANK: Record<RegisterStatus, number> = {
  blocked: 0,
  'not-started': 0,
  designed: 1,
  building: 2,
  implemented: 3,
  tested: 4,
  evidenced: 5,
  operational: 6,
  'launch-approved': 7,
};

/** Who the launch-readiness page answers, and the question each asks. */
export type Audience = 'students' | 'departments' | 'institutions' | 'reviewers';

export const AUDIENCES: readonly { id: Audience; title: string; question: string }[] = [
  { id: 'students', title: 'Students', question: 'Can I use Semester today?' },
  { id: 'departments', title: 'Advisors and departments', question: 'What does a launch for our students need?' },
  { id: 'institutions', title: 'Institutions', question: 'What is ready now, and what is built but not yet deployed?' },
  { id: 'reviewers', title: 'IT, security, privacy and accessibility reviewers', question: 'What evidence exists, and what is still planned?' },
];

export interface Evidence {
  /** Repository-relative; must exist. */
  path: string;
  shows: string;
}

export interface Claim {
  /** Stable canonical capabilities directly covered by this claim. */
  capabilityIds: readonly string[];
  /** A slug; also the `data-claim` attribute the site prints beside the wording. */
  id: string;
  /** The approved wording, exactly as the site prints it. */
  claim: string;
  /** What it covers, and what a reader might assume that it does not. */
  scope: string;
  status: ClaimStatus;
  owner: Seat;
  /** Site routes on which the wording and its status label appear. */
  pages: readonly string[];
  audiences: readonly Audience[];
  evidence: readonly Evidence[];
  /** Master-register rows the claim rests on. Required unless `available`. */
  rows: readonly string[];
  /** The proof-calendar item that would move it, for a claim not yet available. */
  proof?: string;
}

export const CLAIMS: readonly Claim[] = [
  // ── the product ──
  {
    id: 'source-labels',
    capabilityIds: ['CAP-020', 'CAP-022', 'CAP-024', 'CAP-038'],
    claim: 'Every fact carries its source',
    scope: 'Institution verified, Imported, Student entered, Estimated or Needs review, on every fact the app shows. A label does not make an estimate official.',
    status: 'built-tested',
    owner: 'product',
    pages: ['/'],
    audiences: ['students', 'departments'],
    evidence: [{ path: 'app/src/lib/source.test.ts', shows: 'The five labels, what each means and the line a fact prints' }],
    rows: ['TRUST-001'],
  },
  {
    id: 'local-first',
    capabilityIds: ['CAP-010', 'CAP-014'],
    claim: 'Your working copy lives on your device. An account is optional.',
    scope: 'Signed out, everything is in the browser’s own storage and nothing leaves it. With an account it is also kept in your account. Clearing the browser clears the copy.',
    status: 'in-preparation',
    owner: 'engineering',
    pages: ['/security/'],
    audiences: ['students'],
    evidence: [
      { path: 'app/src/lib/inventory.test.ts', shows: 'Every key the app writes to the browser is counted by the Data screen' },
      { path: 'RETENTION.md', shows: 'The inventory of every store and the clock that runs on it' },
    ],
    rows: ['IAM-001'],
  },
  {
    id: 'export-delete',
    capabilityIds: ['CAP-015', 'CAP-016'],
    claim: 'You can export everything, and delete your account, at any time, on any plan.',
    scope: 'Your account and what is in it. It does not delete what your institution holds about you in its own systems.',
    status: 'in-preparation',
    owner: 'privacy',
    pages: ['/privacy/'],
    audiences: ['students'],
    evidence: [
      { path: 'app/src/lib/plans.test.ts', shows: 'Export, deletion and saved plans are on every plan, including Free' },
      { path: 'supabase/deletion.check.sql', shows: 'Deleting the account removes its rows from every table' },
    ],
    rows: ['STU-011'],
  },
  // ── security ──
  {
    id: 'rls',
    capabilityIds: ['CAP-010', 'CAP-011', 'CAP-014', 'CAP-040'],
    claim: 'With an account, access to every table is enforced by the database itself, and tested as a second account in every build.',
    scope: 'Row-level security on every table, exercised by the policy suites CI runs against a fresh database. No exported policy listing for reviewers yet.',
    status: 'in-preparation',
    owner: 'security',
    pages: ['/security/'],
    audiences: ['reviewers'],
    evidence: [
      { path: 'supabase/check.sh', shows: 'Applies every migration to a throwaway database and runs every policy suite, on every change' },
      { path: 'supabase/access.check.sql', shows: 'One of the suites: what a second account can and cannot read' },
    ],
    rows: ['IAM-008'],
  },
  {
    id: 'secrets',
    capabilityIds: ['CAP-010', 'CAP-013', 'CAP-027'],
    claim: 'No secret keys are shipped to the browser, and every change is scanned for leaked credentials.',
    scope: 'The browser bundle, the public folder and the entry page; and the history of every change.',
    status: 'planned',
    owner: 'security',
    pages: ['/security/'],
    audiences: ['reviewers'],
    evidence: [
      { path: 'app/src/lib/ops/boundaries.test.ts', shows: 'No service-role credential, and no build variable that would carry one, in anything a browser loads' },
      { path: '.github/workflows/ci.yml', shows: 'gitleaks over every change' },
    ],
    rows: ['SEC-004'],
  },
  {
    id: 'no-payment-data',
    capabilityIds: ['CAP-010', 'CAP-046'],
    claim: 'Semester never stores payment cards, bank details or university passwords.',
    scope: 'Plus checkout (D-128) sends the person to Stripe’s own page, so the card never reaches Semester. Sign-in to an institution is by its identity provider, so its password never reaches Semester.',
    status: 'in-preparation',
    owner: 'privacy',
    pages: ['/security/'],
    audiences: ['students'],
    evidence: [
      { path: 'app/src/lib/plans.test.ts', shows: 'Nothing on the site or in the app collects a card; checkout hands off to Stripe' },
      { path: 'app/src/lib/ops/boundaries.test.ts', shows: 'No database driver or connection string to any institution’s system' },
    ],
    rows: ['IAM-001'],
  },
  {
    id: 'incident-notice',
    capabilityIds: ['CAP-015', 'CAP-014'],
    claim: 'Notice within 72 hours of a confirmed exposure of your data',
    scope: 'The commitment is written. The process behind it has not been exercised, even as a tabletop.',
    status: 'in-preparation',
    owner: 'security',
    pages: ['/security/'],
    audiences: ['students', 'reviewers'],
    evidence: [{ path: 'SECURITY.md', shows: 'The 72-hour commitment and what is read to honour it' }],
    rows: ['SEC-007'],
    proof: 'tabletop',
  },
  {
    id: 'audit-log',
    capabilityIds: ['CAP-010', 'CAP-014', 'CAP-041'],
    claim: 'A tamper-evident record of every privileged action',
    scope: 'Role grants, moderation, support reads and gateway actions are audited today. A unified event schema, and an export a reviewer can verify, are not.',
    status: 'in-preparation',
    owner: 'security',
    pages: ['/security/'],
    audiences: ['reviewers'],
    evidence: [{ path: 'supabase/role-grant-audit.check.sql', shows: 'The role-grant audit cannot be updated or deleted' }],
    rows: ['SEC-006'],
  },
  {
    id: 'restore-drill',
    capabilityIds: ['CAP-014', 'CAP-016'],
    claim: 'A rehearsed restore from backup',
    scope: 'A restore rehearsal passes on every change in CI. Production has never been restored, and the recovery time is unmeasured.',
    status: 'in-preparation',
    owner: 'engineering',
    pages: ['/security/'],
    audiences: ['reviewers'],
    evidence: [{ path: 'RESTORE.md', shows: 'The procedure' }],
    rows: ['SRE-005'],
    proof: 'restore-drill',
  },
  {
    id: 'mfa',
    capabilityIds: ['CAP-010'],
    claim: 'Multi-factor sign-in',
    scope: 'For privileged roles first, then as a student opt-in.',
    status: 'planned',
    owner: 'security',
    pages: ['/security/'],
    audiences: ['reviewers'],
    evidence: [],
    rows: ['IAM-005'],
  },
  {
    id: 'pen-test',
    capabilityIds: ['CAP-010', 'CAP-013', 'CAP-015', 'CAP-041'],
    claim: 'An independent penetration test',
    scope: 'No firm engaged and no test environment built. The plan says how one is scoped and how findings are registered.',
    status: 'planned',
    owner: 'security',
    pages: ['/security/'],
    audiences: ['reviewers'],
    evidence: [{ path: 'docs/trust/PENETRATION-TEST-PLAN.md', shows: 'Scope, firm selection, findings register' }],
    rows: ['SEC-005'],
  },
  {
    id: 'soc2',
    capabilityIds: ['CAP-010', 'CAP-013', 'CAP-015', 'CAP-041'],
    claim: 'An independent audit or certification such as SOC 2',
    scope: 'Controls are mapped. None is operated over a period or evidenced, and no auditor is engaged.',
    status: 'planned',
    owner: 'security',
    pages: ['/security/'],
    audiences: ['reviewers'],
    evidence: [{ path: 'docs/trust/SOC2-READINESS.md', shows: 'The control mapping and its scoring' }],
    rows: ['SEC-012'],
  },
  // ── accessibility ──
  {
    id: 'a11y-site',
    capabilityIds: ['CAP-019'],
    claim: 'Every page of this site has one main region, a skip link, a declared language and one heading, checked on every change.',
    scope: 'Structure and links, by test. Not a human review, and not the app.',
    status: 'in-preparation',
    owner: 'accessibility',
    pages: ['/accessibility/'],
    audiences: ['students', 'reviewers'],
    evidence: [{ path: 'app/src/site/site.test.tsx', shows: 'One h1, one main, a skip link and a language on every prerendered page' }],
    rows: ['A11Y-003'],
  },
  {
    id: 'a11y-app',
    capabilityIds: ['CAP-001', 'CAP-017', 'CAP-020', 'CAP-021', 'CAP-025', 'CAP-031'],
    claim: 'The main student screens are scanned for serious and critical accessibility violations on every change.',
    scope: 'axe-core in a simulated browser over twelve screens at desktop width and three at phone width, in CI. It cannot check colour contrast or layout, and automated checks find a minority of barriers; the rest need a person.',
    status: 'in-preparation',
    owner: 'accessibility',
    pages: ['/accessibility/'],
    audiences: ['students', 'departments', 'reviewers'],
    evidence: [{ path: 'app/src/a11y/axe.test.tsx', shows: 'No serious or critical violation on the twelve desktop and three phone screens it lists, and the probe is shown a planted one first' }],
    rows: ['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005'],
  },
  {
    id: 'a11y-human',
    capabilityIds: ['CAP-001', 'CAP-020', 'CAP-021', 'CAP-025'],
    claim: 'A review of the main student journey by a person, with a screen reader, keyboard only, at 320px and at 200% zoom',
    scope: 'Month 1 of the proof calendar. Each failure is filed against the WCAG scorecard.',
    status: 'in-preparation',
    owner: 'accessibility',
    pages: ['/accessibility/'],
    audiences: ['reviewers'],
    evidence: [{ path: 'docs/WCAG-UI-AUDIT-SCORECARD.md', shows: 'The per-component scorecard the review files against' }],
    rows: ['A11Y-001'],
    proof: 'a11y-baseline',
  },
  {
    id: 'vpat',
    capabilityIds: ['CAP-001', 'CAP-020', 'CAP-025'],
    claim: 'A conformance report (VPAT/ACR) by a qualified evaluator',
    scope: 'Over the piloted screens, before institutional general availability. Code cannot produce it.',
    status: 'planned',
    owner: 'accessibility',
    pages: ['/accessibility/'],
    audiences: ['institutions', 'reviewers'],
    evidence: [{ path: 'docs/trust/HECVAT-VPAT-PLAN.md', shows: 'The plan for both documents' }],
    rows: ['A11Y-007'],
    proof: 'vpat',
  },
  {
    id: 'a11y-lms',
    capabilityIds: ['CAP-020', 'CAP-030'],
    claim: 'Accessibility of course authoring and assessments',
    scope: 'Course Studio and assessments are not released. Their keyboard, timing and accommodation behaviour is designed, not tested.',
    status: 'planned',
    owner: 'accessibility',
    pages: ['/accessibility/'],
    audiences: ['institutions'],
    evidence: [],
    rows: ['A11Y-006'],
  },
  // ── institutions ──
  {
    id: 'sso',
    capabilityIds: ['CAP-010'],
    claim: 'Sign-in through your institution’s identity provider (SAML)',
    scope: 'SAML is configured for no tenant, OIDC is not offered, and nothing has been tested against a real identity provider.',
    status: 'in-preparation',
    owner: 'security',
    pages: ['/institutions/', '/platform/availability/', '/platform/integrations/'],
    audiences: ['institutions', 'reviewers'],
    evidence: [],
    rows: ['IAM-003'],
    proof: 'sso-integration',
  },
  {
    id: 'scim',
    capabilityIds: ['CAP-010', 'CAP-011'],
    claim: 'Automatic account provisioning (SCIM)',
    scope: 'Reachable, off by default, enabled for no tenant, and not yet run against an identity provider.',
    status: 'in-preparation',
    owner: 'security',
    pages: ['/institutions/', '/platform/integrations/'],
    audiences: ['institutions'],
    evidence: [{ path: 'supabase/scim-gateway.check.sql', shows: 'The gateway’s policies' }],
    rows: ['IAM-004'],
  },
  {
    id: 'lti',
    capabilityIds: ['CAP-013', 'CAP-020'],
    claim: 'Launch from your learning system (LTI 1.3)',
    scope: 'Tested against a test platform. No launch from a real institution’s learning system yet, and no 1EdTech certification.',
    status: 'planned',
    owner: 'data',
    pages: ['/institutions/', '/platform/integrations/'],
    audiences: ['institutions'],
    evidence: [
      { path: 'app/src/lib/lti.test.ts', shows: 'The launch, its validation and the membership it is scoped by' },
      { path: 'supabase/lti.check.sql', shows: 'The launch tables’ policies' },
    ],
    rows: ['INT-002'],
  },
  {
    id: 'sis',
    capabilityIds: ['CAP-013', 'CAP-050'],
    claim: 'Read-only connections to registration and student systems',
    scope: 'The framework is tested with mock adapters. No real adapter exists, nothing has been reconciled against a live source, and no institution has connected one.',
    status: 'planned',
    owner: 'data',
    pages: ['/institutions/', '/platform/integrations/'],
    audiences: ['institutions'],
    evidence: [{ path: 'app/src/lib/integration/pipeline.test.ts', shows: 'The sync pipeline, against the mock adapters' }],
    rows: ['INT-001', 'INT-009'],
    proof: 'sso-integration',
  },
  {
    id: 'connector-health',
    capabilityIds: ['CAP-013', 'CAP-014'],
    claim: 'Freshness and health of every connection, visible to your staff',
    scope: 'Behind an off-by-default flag. No alerting, and no proven fallback per connector.',
    status: 'planned',
    owner: 'data',
    pages: ['/institutions/'],
    audiences: ['departments', 'institutions'],
    evidence: [],
    rows: ['INT-014'],
  },
  {
    id: 'support-access',
    capabilityIds: ['CAP-010', 'CAP-015'],
    claim: 'Support staff see a student’s data only under a time-limited grant the student can see',
    scope: 'Grants carry a reason and an expiry and are audited. They are not yet tied to a ticket, and the workflow has had no acceptance test with an institution.',
    status: 'in-preparation',
    owner: 'trust',
    pages: ['/institutions/'],
    audiences: ['students', 'departments', 'institutions'],
    evidence: [{ path: 'supabase/support-access.check.sql', shows: 'A read needs a live grant, and the grant expires' }],
    rows: ['IAM-010'],
  },
  {
    id: 'hecvat',
    capabilityIds: ['CAP-010', 'CAP-015'],
    claim: 'A completed HECVAT',
    scope: 'The readiness register answers each question with what exists. The workbook itself is not filled in or reviewed.',
    status: 'planned',
    owner: 'security',
    pages: ['/institutions/'],
    audiences: ['reviewers'],
    evidence: [{ path: 'docs/market-readiness/HECVAT_READINESS.md', shows: 'Each question, against the tree' }],
    rows: ['SEC-011'],
    proof: 'hecvat',
  },
  // ── the public integration registry (/platform/integrations/, lib/interop.ts) ──
  {
    id: 'lti-advantage',
    capabilityIds: ['CAP-013', 'CAP-020'],
    claim: 'Deep linking and grade services from your learning system (LTI Advantage)',
    scope: 'Deep linking is tested against a test platform; grade passback is gated per registration and still being built; roster membership (NRPS) is deliberately not requested. No real learning system has launched it.',
    status: 'planned',
    owner: 'data',
    pages: ['/platform/integrations/'],
    audiences: ['institutions', 'reviewers'],
    evidence: [{ path: 'app/src/lib/ltideeplink.test.ts', shows: 'Deep-link placements' }, { path: 'supabase/ltiags.check.sql', shows: 'Grade services gated per registration' }],
    rows: ['INT-004', 'INT-005'],
  },
  {
    id: 'oneroster',
    capabilityIds: ['CAP-013', 'CAP-020'],
    claim: 'Roster and enrollment exchange (OneRoster 1.2)',
    scope: 'Not started. The first pilot runs without rosters by design; when built, it is an authorised feed under a data contract, never an open source.',
    status: 'planned',
    owner: 'data',
    pages: ['/platform/integrations/'],
    audiences: ['institutions'],
    evidence: [{ path: 'docs/FERPA-COPPA-1EDTECH-READINESS.md', shows: 'EDT-6: OneRoster not started, not planned for a first pilot' }],
    rows: ['INT-006'],
  },
  {
    id: 'data-contracts',
    capabilityIds: ['CAP-013', 'CAP-014'],
    claim: 'Documented APIs, webhooks and versioned data contracts',
    scope: 'The contract shape and the stewardship roles exist; webhooks and files are being built; no partner has integrated against them.',
    status: 'planned',
    owner: 'data',
    pages: ['/platform/integrations/'],
    audiences: ['institutions', 'reviewers'],
    evidence: [{ path: 'app/src/lib/governance/data-contracts.ts', shows: 'A contract names its domain, owner, steward and fields' }, { path: 'docs/data-contract.md', shows: 'The published contract' }],
    rows: ['INT-013', 'INT-012'],
  },
  {
    id: 'caliper',
    capabilityIds: ['CAP-013', 'CAP-009'],
    claim: 'Learning-event interoperability (Caliper Analytics)',
    scope: 'No Caliper event is emitted. The aggregation and suppression rules any event would live under exist, and no event will ever become a risk score.',
    status: 'planned',
    owner: 'privacy',
    pages: ['/platform/integrations/'],
    audiences: ['institutions', 'reviewers'],
    evidence: [{ path: 'app/src/lib/institution-ops.ts', shows: 'Aggregates only, at n ≥ 10; forbidden measures refused' }],
    rows: ['UOS-008'],
  },
  {
    id: 'qti',
    capabilityIds: ['CAP-020', 'CAP-030'],
    claim: 'Portable assessments and competency frameworks (QTI, CASE)',
    scope: 'Designed, not built. Waits for assessment content and competency mapping to be real.',
    status: 'planned',
    owner: 'product',
    pages: ['/platform/integrations/'],
    audiences: ['institutions'],
    evidence: [{ path: 'docs/LMS-LEARNING-ROADMAP.md', shows: 'QTI and Common Cartridge listed as missing, with the phase that builds them' }],
    rows: ['INT-007', 'INT-008'],
  },
  {
    id: 'credentials',
    capabilityIds: ['CAP-013', 'CAP-054'],
    claim: 'Verifiable, learner-held credentials (Open Badges 3.0, CLR)',
    scope: 'Designed as the credential wallet, Tier 2, Phase 3. No badge is issued, and none will be until the achievement is real, evidence-backed, issuer-controlled and portable.',
    status: 'planned',
    owner: 'product',
    pages: ['/platform/integrations/'],
    audiences: ['institutions'],
    evidence: [{ path: 'docs/CREDENTIAL-WALLET.md', shows: 'The wallet’s design and where it sits in the plan' }],
    rows: ['UOS-004'],
  },
  // ── commercial and legal ──
  {
    id: 'no-sale',
    capabilityIds: ['CAP-010'],
    claim: 'Individual paid acquisition is held; Plus and Pro are planned, not on sale',
    scope: 'Checkout and cancellation are built, but new checkout is disabled while required approvals remain open. Existing subscribers keep cancellation and billing-history access. No live payment evidence authorizes broad acquisition, and the refund policy is still a proposal.',
    status: 'in-preparation',
    owner: 'founder',
    pages: ['/pricing/'],
    audiences: ['students'],
    evidence: [{ path: 'app/src/lib/plans.test.ts', shows: 'Every price matches the catalog, and no public page is a button that takes money' }],
    rows: ['LEG-003'],
  },
  {
    id: 'company-addresses',
    capabilityIds: ['CAP-019'],
    claim: 'Dedicated company addresses for support, security, privacy and accessibility',
    scope: 'They arrive with the company that owns the domain. Until then, one address read by a person, with each topic routed to a seat.',
    status: 'planned',
    owner: 'founder',
    pages: ['/contact/'],
    audiences: ['institutions', 'reviewers'],
    evidence: [],
    rows: ['LEG-001'],
  },
  {
    id: 'student-terms',
    capabilityIds: ['CAP-010', 'CAP-015'],
    claim: 'Terms of service and a privacy policy in force',
    scope: 'Drafts exist and are held to the subprocessor register by a test. Nothing is in force or reviewed by a lawyer, and there is no legal entity to be the party.',
    status: 'in-preparation',
    owner: 'privacy',
    pages: ['/legal/'],
    audiences: ['students', 'reviewers'],
    evidence: [
      { path: 'docs/legal/TERMS-OF-SERVICE-DRAFT.md', shows: 'The draft, its not-in-force banner intact' },
      { path: 'app/src/lib/trust/legal-drafts.test.ts', shows: 'Holds the banner, and every subprocessor named in the policy' },
    ],
    rows: ['LEG-003'],
  },
  {
    id: 'dpa',
    capabilityIds: ['CAP-010', 'CAP-015'],
    claim: 'A data processing agreement your counsel can sign',
    scope: 'A checklist for counsel exists. No agreement language does.',
    status: 'planned',
    owner: 'privacy',
    pages: ['/legal/'],
    audiences: ['institutions', 'reviewers'],
    evidence: [{ path: 'docs/trust/DPA-CHECKLIST.md', shows: 'What the agreement must settle' }],
    rows: ['LEG-002'],
    proof: 'dpa-trust',
  },
  // ── the availability matrix (/platform/availability/) ──
  // Each row of the matrix is a claim here; the page prints the wording and
  // the word, and its tier columns (who gets it) live in `site/platform.ts`.
  {
    id: 'personal-planning',
    // Personal planning explicitly excludes CAP-050's official enrollment operation.
    capabilityIds: ['CAP-001', 'CAP-003', 'CAP-025', 'CAP-044'],
    claim: 'Plan your term, your path and your week from what you add',
    scope: 'Today, My Path, the registration plan with backups, the calendar and the study tools, from what the student enters or imports. No account is needed, and nothing here is the registrar’s record.',
    status: 'in-preparation',
    owner: 'product',
    pages: ['/platform/availability/'],
    audiences: ['students', 'departments'],
    evidence: [
      { path: 'app/src/lib/registration.test.ts', shows: 'A plan with backups, checked for time conflicts' },
      { path: 'app/src/lib/source.test.ts', shows: 'Every fact carries its source' },
    ],
    rows: ['STU-001', 'STU-003', 'STU-005', 'STU-007', 'STU-010'],
  },
  {
    id: 'course-studio',
    capabilityIds: ['CAP-020', 'CAP-027'],
    claim: 'An instructor publishes the course’s rules and guidance beside the course',
    scope: 'Course Studio: what an instructor publishes appears beside the course for its students, including the course’s AI policy. Switched on per institution; no institution has it on.',
    status: 'in-preparation',
    owner: 'product',
    pages: ['/platform/availability/'],
    audiences: ['departments', 'institutions'],
    evidence: [{ path: 'supabase/coursestudio.check.sql', shows: 'Who may publish, who may read, and that a revoked grant is refused at the write' }],
    rows: ['LMS-002'],
  },
  {
    id: 'grade-passback',
    capabilityIds: ['CAP-013', 'CAP-020'],
    claim: 'Grades written back to the institution’s learning system',
    scope: 'A score written to the learning system needs that system’s approval and a write scope Semester does not hold. The read side of LTI is built; the write side is under way.',
    status: 'planned',
    owner: 'data',
    pages: ['/platform/availability/'],
    audiences: ['institutions'],
    evidence: [{ path: 'docs/LTI-1.3-LAUNCH-RUNBOOK.md', shows: 'The launch and grade-service design, and what is not yet built' }],
    rows: ['INT-005'],
  },
  {
    id: 'lms-migration',
    capabilityIds: ['CAP-013', 'CAP-020'],
    claim: 'Moving courses from an existing learning system',
    scope: 'Project work with the institution — mapping, a rehearsal run, the real run, verification — never a self-serve import. No migration has been run.',
    status: 'planned',
    owner: 'success',
    pages: ['/platform/availability/'],
    audiences: ['institutions'],
    evidence: [{ path: 'docs/market-readiness/MIGRATION_PLAYBOOK.md', shows: 'The playbook a migration would follow' }],
    rows: ['MIG-002', 'MIG-005'],
  },
  {
    id: 'ai-course-policy',
    capabilityIds: ['CAP-017', 'CAP-027'],
    claim: 'What the assistant may do, set by the student, the course and the institution',
    scope: 'A student always controls what the assistant may see. A course policy published in Course Studio is shown before the assistant answers; the institution and department layers of the policy engine are under way.',
    status: 'in-preparation',
    owner: 'product',
    pages: ['/platform/availability/'],
    audiences: ['students', 'departments', 'institutions'],
    evidence: [{ path: 'app/src/screens/settings/Assistant.tsx', shows: 'The student’s controls over what the assistant sees and does' }],
    rows: ['AI-006', 'AI-013'],
  },
  {
    id: 'status-page',
    capabilityIds: ['CAP-014'],
    claim: 'A status page that checks Semester from your own browser',
    scope: 'Up means this browser reached it just now. There is no uptime history.',
    status: 'in-preparation',
    owner: 'engineering',
    pages: ['/launch-readiness/'],
    audiences: ['students', 'departments', 'institutions'],
    evidence: [{ path: 'app/src/lib/statuspage.test.ts', shows: 'The page probes the same project the app is built against' }],
    rows: ['SRE-002'],
  },
];

export function claim(id: string): Claim {
  const found = CLAIMS.find((c) => c.id === id);
  if (!found) throw new Error(`No claim ${id}`);
  return found;
}

// ── the policies ──────────────────────────────────────────────────────────

export type PolicyStatus = 'not-started' | 'outline' | 'draft' | 'in-force';

export const POLICY_MEANING: Record<PolicyStatus, string> = {
  'not-started': 'Nothing is written',
  outline: 'Notes for counsel on what the document must settle; not the document',
  draft: 'The document, written; not reviewed by a lawyer and not in force',
  'in-force': 'Reviewed, versioned, effective from a date, with the previous versions kept',
};

export interface Policy {
  id: string;
  policy: string;
  status: PolicyStatus;
  /** Repository-relative; required unless `not-started`. */
  path: string | null;
  /** `0` until in force. */
  version: string;
  /** ISO date, only when in force. */
  effective: string | null;
  owner: Seat;
  rows: readonly string[];
  note?: string;
}

/** Every policy the site will one day version at /legal/, and where each stands. */
export const POLICIES: readonly Policy[] = [
  { id: 'terms', policy: 'Terms of Service', status: 'draft', path: 'docs/legal/TERMS-OF-SERVICE-DRAFT.md', version: '0', effective: null, owner: 'privacy', rows: ['LEG-003'] },
  { id: 'privacy', policy: 'Privacy Policy', status: 'draft', path: 'docs/legal/PRIVACY-POLICY-DRAFT.md', version: '0', effective: null, owner: 'privacy', rows: ['LEG-003'] },
  { id: 'aup', policy: 'Acceptable Use Policy', status: 'draft', path: 'docs/legal/ACCEPTABLE-USE-POLICY-DRAFT.md', version: '0', effective: null, owner: 'privacy', rows: ['LEG-003'], note: 'Its own document, expanding section 5 of the terms draft.' },
  { id: 'community', policy: 'Community Guidelines', status: 'draft', path: 'docs/legal/COMMUNITY-GUIDELINES-DRAFT.md', version: '0', effective: null, owner: 'trust', rows: ['LEG-003'], note: 'The student-facing side of the moderation SOP; published only when a school turns Community on.' },
  { id: 'copyright', policy: 'Copyright and takedown policy', status: 'draft', path: 'docs/legal/COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md', version: '0', effective: null, owner: 'founder', rows: ['LEG-003'], note: 'No designated agent is registered, so no DMCA safe harbour may be claimed yet.' },
  { id: 'retention', policy: 'Data retention and deletion policy', status: 'draft', path: 'docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md', version: '0', effective: null, owner: 'privacy', rows: ['LEG-003'], note: 'The public summary of RETENTION.md, which prevails.' },
  { id: 'support', policy: 'Support policy', status: 'draft', path: 'docs/legal/SUPPORT-POLICY-DRAFT.md', version: '0', effective: null, owner: 'success', rows: ['LEG-003'], note: 'No response time is promised until support is staffed.' },
  { id: 'incident-summary', policy: 'Incident response summary', status: 'draft', path: 'docs/legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md', version: '0', effective: null, owner: 'security', rows: ['LEG-003'], note: 'The procedure is written and has not been exercised.' },
  { id: 'advertising', policy: 'Advertising and sponsorship policy', status: 'draft', path: 'docs/legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md', version: '0', effective: null, owner: 'founder', rows: ['LEG-003'], note: 'No advertising; the sponsorship rules apply only if a school turns the module on.' },
  { id: 'ai-use', policy: 'AI Use Policy', status: 'draft', path: 'docs/legal/AI-USE-POLICY-DRAFT.md', version: '0', effective: null, owner: 'product', rows: ['AI-001'], note: 'The plain-language companion to the AI model-training and data-use policy, which prevails.' },
  { id: 'cookies', policy: 'Cookie notice', status: 'draft', path: 'docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md', version: '0', effective: null, owner: 'privacy', rows: ['LEG-003'], note: 'No cookie is set anywhere; the notice says what browser storage holds instead, and the company site now says the same.' },
  { id: 'dpa', policy: 'Data Processing Agreement', status: 'outline', path: 'docs/trust/DPA-CHECKLIST.md', version: '0', effective: null, owner: 'privacy', rows: ['LEG-002'] },
  { id: 'student-data', policy: 'Student data addendum', status: 'not-started', path: null, version: '0', effective: null, owner: 'privacy', rows: ['LEG-002', 'SEC-009'] },
  { id: 'sla', policy: 'Service Level Agreement', status: 'outline', path: 'docs/trust/SLA.md', version: '0', effective: null, owner: 'engineering', rows: ['SRE-001'] },
  { id: 'refunds', policy: 'Refund and cancellation policy', status: 'draft', path: 'docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md', version: '0', effective: null, owner: 'founder', rows: ['LEG-003'], note: 'Owed before a live payment: checkout exists since D-128, and the terms on the pricing page are still proposed; the policy is drafted, not in force.' },
  { id: 'a11y-statement', policy: 'Accessibility statement', status: 'draft', path: 'docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md', version: '0', effective: null, owner: 'accessibility', rows: ['A11Y-007'], note: 'Claims no conformance: no manual assistive-technology review has been done.' },
  { id: 'subprocessors', policy: 'Subprocessor list', status: 'draft', path: 'docs/SUBPROCESSORS.md', version: '0', effective: null, owner: 'privacy', rows: ['SEC-010'], note: 'Held to the code by a test; public once counsel has read it.' },
];

// ── the customer proof policy ─────────────────────────────────────────────

/** How Semester will show proof, written before there is any to show. */
export const PROOF_RULES: readonly string[] = [
  'No invented metrics. A number appears only with the measurement behind it.',
  'No logo without the institution’s written permission.',
  'No anonymous “a leading university” without the context that makes it checkable.',
  'No causal claim without the method, the cohort and the limitation.',
  'Every outcome report states its scope, cohort, method, limitation and date.',
  'No testimonial until there is a pilot report for it to describe.',
];

// ── the checks ────────────────────────────────────────────────────────────

/** What the checks need to know about the tree. Passed in, so a test can hand them a fixture. */
export interface Facts {
  /** Build-time capability registry lookup; injected so live claim surfaces do not load the governance catalog. */
  capabilityExists: (id: string) => boolean;
  rowStatus: (id: string) => RegisterStatus | undefined;
  exists: (path: string) => boolean;
  proofExists: (id: string) => boolean;
  routes: readonly string[];
  /** The rendered HTML of a route, or `undefined` when there is none. */
  page: (route: string) => string | undefined;
  /** The evidence records under a claim that have expired (`expiredUnder` in evidence.ts); absent when the caller holds no register. */
  expiredEvidence?: (claimId: string) => readonly string[];
  claimProjection?: (claim: Claim) => { permitted: boolean; reason: string };
}

export const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /\.check\.sql$/.test(path);

/** React's escaping, so the wording can be looked for in the markup it becomes. */
export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/** Everything wrong with a set of claims, as sentences; empty when nothing is. */
export function problems(claims: readonly Claim[], facts: Facts): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of claims) {
    if (seen.has(c.id)) out.push(`${c.id} appears twice.`);
    seen.add(c.id);
    if (!c.capabilityIds.length) out.push(`${c.id} names no canonical capability.`);
    for (const id of c.capabilityIds) if (!facts.capabilityExists(id)) out.push(`${c.id} binds unknown capability ${id}.`);
    const projection = facts.claimProjection?.(c);
    if (projection && !projection.permitted) out.push(`${c.id} exceeds its capability projection: ${projection.reason}.`);
    if (!/^[a-z0-9-]+$/.test(c.id)) out.push(`${c.id} is not a slug.`);
    if (/["&<>]|'/.test(c.claim)) out.push(`${c.id}: the wording carries a character the page would escape; use ’ and “ ”.`);
    if (c.status === 'available' && !c.evidence.some((e) => isTest(e.path))) out.push(`${c.id} is available and cites no test.`);
    if (c.status === 'available') for (const e of facts.expiredEvidence?.(c.id) ?? []) out.push(`${c.id} is available and rests on ${e}, which has expired.`);
    if (c.status === 'built-tested' && !c.evidence.some((e) => isTest(e.path))) out.push(`${c.id} is built and tested and cites no test.`);
    if (c.status !== 'available' && c.rows.length === 0) out.push(`${c.id} is ${c.status} and names no register row that would move it.`);
    for (const e of c.evidence) if (!facts.exists(e.path)) out.push(`${c.id} cites ${e.path}, which does not exist.`);
    for (const r of c.rows) {
      const status = facts.rowStatus(r);
      if (!status) out.push(`${c.id} rests on ${r}, which is not in the master register.`);
      else if (RANK[status] < RANK[FLOOR[c.status]]) out.push(`${c.id} claims ${c.status}, but ${r} is ${status} (needs ${FLOOR[c.status]}).`);
    }
    if (c.proof && !facts.proofExists(c.proof)) out.push(`${c.id} names proof ${c.proof}, which is not on the calendar.`);
    if (c.pages.length === 0) out.push(`${c.id} appears on no page.`);
    for (const p of c.pages) {
      if (!facts.routes.includes(p)) out.push(`${c.id} names page ${p}, which is not a route.`);
      const html = facts.page(p);
      if (!html) continue;
      if (!html.includes(`data-claim="${c.id}"`)) out.push(`${p} prints no status for ${c.id}.`);
      if (!html.includes(escapeHtml(c.claim))) out.push(`${p} does not print the wording of ${c.id}.`);
    }
  }
  // The other direction: nothing on the site carries a label this register does not know.
  const ids = new Set(claims.map((c) => c.id));
  for (const route of facts.routes) {
    const html = facts.page(route);
    if (!html) continue;
    for (const m of html.matchAll(/data-claim="([^"]*)"/g)) {
      if (!ids.has(m[1])) out.push(`${route} prints a status for ${m[1]}, which is not registered.`);
    }
    for (const m of html.matchAll(/data-claim="([^"]*)"[^>]*>(?:(?!<\/li>|<\/tr>).)*?<span class="site-badge site-status[^"]*">([^<]*)<\/span>/gs)) {
      const c = claims.find((x) => x.id === m[1]);
      if (c && m[2] !== STATUS_LABEL[c.status]) out.push(`${route} labels ${m[1]} “${m[2]}”, but it is ${STATUS_LABEL[c.status]}.`);
    }
  }
  return out;
}

/** Everything wrong with the policies. */
export function policyProblems(policies: readonly Policy[], facts: Pick<Facts, 'exists' | 'rowStatus'>): string[] {
  const out: string[] = [];
  for (const p of policies) {
    if ((p.status === 'not-started') !== (p.path === null)) out.push(`${p.id}: a policy has a path exactly when something is written.`);
    if (p.path && !facts.exists(p.path)) out.push(`${p.id} cites ${p.path}, which does not exist.`);
    if (p.status === 'in-force' && (p.effective === null || p.version === '0')) out.push(`${p.id} is in force with no effective date or version.`);
    if (p.status !== 'in-force' && (p.effective !== null || p.version !== '0')) out.push(`${p.id} carries a version or effective date but is not in force.`);
    for (const r of p.rows) if (!facts.rowStatus(r)) out.push(`${p.id} rests on ${r}, which is not in the master register.`);
  }
  return out;
}
