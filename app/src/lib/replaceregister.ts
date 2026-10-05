/**
 * Replace by domain: the four briefs of 29 September 2026 that say Semester is
 * meant to replace the fragmented university stack, not sit beside it — held
 * to what the tree has for each domain, each requirement and each capability.
 *
 * The first brief gives the end state and the ladder: connect first, replace
 * by domain, operate as one system — fourteen domains, each with the role
 * Semester plays at first and the native replacement it grows into, six
 * phases, the shared core every module must use, and the areas that stay
 * bounded however far replacement goes. The second gives the architecture
 * principle for today: which system is authoritative for what, the SIS
 * minimum fields, the seven source states, the sync pipeline, holds, advisor
 * sharing, support routing and FERPA control. The third lists seventeen
 * expansions across registration, the LMS and university services. The
 * fourth asks what must exist before an institution can retire a system and
 * run that domain through Semester: the replaceability bar, the Migration
 * Center, parallel run, the financial and academic-record ledgers, the
 * service desk, knowledge, communications, localization, analytics,
 * governance, the marketplace, the academy and continuity.
 *
 * `docs/DOMAIN-REPLACEMENT-REGISTER.md` is rendered from this file by
 * `replaceregister.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## The finding
 *
 * The end state the briefs describe was, until D-143, refused by the tree's
 * own architecture page: `docs/UNIVERSITY-OS-ARCHITECTURE.md` said Semester is
 * "never the system of record". The owner's note on the first brief reverses
 * that as a destination, and D-143 records it — while keeping the page's list
 * as today's boundary, because the fourth brief sets the bar a domain must
 * clear before it moves. That bar is computed here: a domain is replaceable
 * only when its native row and every replaceability requirement are held by a
 * test. Today none is, and the page says which requirement stops each one.
 *
 * ## What is held to what
 *
 * - The seven source states are held to `SOURCE_LABELS` in `lib/source.ts`
 *   (five, enforced by the database) and to the freshness vocabulary in
 *   `lib/integration/freshness.ts` (stale, unavailable).
 * - The best-next-modules list and the final expansion areas name rows on
 *   this page.
 * - Every row's status cites the kind of file it claims, and every cited path
 *   exists. A supplied PDF is never evidence.
 * - The architecture page carries D-143's reading, so the two pages cannot
 *   disagree about the destination without a test going red.
 */

import type { SourceLabel } from './source';
import type { Freshness } from './integration/catalog';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Replace-by-Domain-University-Operating-System.pdf',
    title: 'Those are also supposed to be replaced by Semester',
    what: 'The end state: connect first, replace by domain, operate as one system. The six-area operating-system tree, fourteen domains from initial role to native replacement, what replacement requires, six phases, the core platform and domain modules, the bounded areas, the public positioning and the four ways a domain runs behind Semester.',
  },
  {
    path: 'docs/expansion/Architecture-Principle-LMS-SIS-Holds-and-Advising.pdf',
    title: 'Architecture principle',
    what: 'Which system is authoritative today; the LMS plan in four stages; the SIS plan (minimum fields, fields avoided, the seven source states, the sync pipeline); the student portal; Advisor Meeting Mode; support routing; holds; FERPA and institutional control; the recommended build order and the final test.',
  },
  {
    path: 'docs/expansion/Registration-LMS-and-University-Services-Expansion.pdf',
    title: 'Anything else in terms of university services, course registration, LMS features',
    what: 'Seventeen expansions: Registration Day Mode, the scenario engine, course pages, transfer, Course Studio, syllabus intelligence, assignments, assessments, competencies, group projects, the services hub, the office action publisher, financial planning, the Accessibility Passport, campus life, standards and integration progression; the ten best next modules and the final product standard.',
  },
  {
    path: 'docs/expansion/Replaceability-Migration-Continuity-and-Confidence.pdf',
    title: 'Anything else in any area',
    what: 'The replaceability requirements; the Migration Center; parallel run; financial controls; financial-aid maturity; registrar-grade record integrity; the unified service desk; knowledge; communications; localization; privacy-safe analytics and data governance; the marketplace; the Implementation Academy; enterprise continuity; twelve final areas and the leadership standard.',
  },
];

export const STRATEGY = 'Connect first. Replace by domain. Operate as one system.';

export const END_STATE =
  'Semester is the system of engagement, system of action, system of learning, system of student success, system of services, and eventually the system of record for the domains an institution chooses to migrate.';

export const LEADERSHIP_STANDARD =
  'A university can run its academic journey, learning environment, student services, campus life, career ecosystem, communications, and institutional workflows from Semester — while maintaining control, security, accessibility, data portability, and continuity.';

/** Behind the scenes, each domain is run one of these four ways. */
export const HOW_A_DOMAIN_RUNS: readonly string[] = [
  'Semester natively runs the domain.',
  'Semester synchronizes and governs a transitional external domain.',
  'Semester uses a partner for regulated or specialized infrastructure.',
  'Semester provides an official handoff until native replacement is authorized.',
];

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_MEANING: Record<Status, string> = {
  tested: 'a test that runs on every change holds the best piece of it',
  building: 'code exists; nothing holds it yet, or the join is missing',
  designed: 'a document says how; no code does',
  'not-started': 'at most a document naming the gap',
};

export interface Held {
  /** A slug, stable. */
  id: string;
  what: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = Omit<Held, 'evidence'> & { evidence: readonly [path: string, shows: string][] };
const one = (r: Row): Held => ({ ...r, evidence: r.evidence.map(([path, shows]) => ({ path, shows })) });
const held = (rows: readonly Row[]): readonly Held[] => rows.map(one);

// ── The domain ladder ───────────────────────────────────────────────────────

export interface Domain {
  id: string;
  domain: string;
  /** The brief's initial Semester role. */
  initial: string;
  /** The brief's native replacement state. */
  native: string;
  connect: Held;
  replace: Held;
}

const domain = (id: string, name: string, initial: string, native: string, connect: Omit<Row, 'id' | 'what'>, replace: Omit<Row, 'id' | 'what'>): Domain => ({
  id,
  domain: name,
  initial,
  native,
  connect: one({ id: `${id}-connect`, what: `${name}: ${initial.toLowerCase()}`, ...connect }),
  replace: one({ id: `${id}-native`, what: `${name}: ${native.toLowerCase()}`, ...replace }),
});

const SANDBOX = 'Runs against the labelled sandbox only: no store, no real institution.';

export const DOMAINS: readonly Domain[] = [
  domain('identity', 'Identity', 'Connect to SSO and existing accounts', 'The identity experience with SSO, SCIM, MFA, access governance and tenant administration', {
    status: 'tested',
    evidence: [['app/server/institution/postgres-scim.test.ts', 'SCIM repository refusals'], ['supabase/scim-gateway.check.sql', 'SCIM writes audited once; no grant to authenticated'], ['supabase/tenant-sso-policy.check.sql', 'tenant SSO policy']],
    gap: 'SAML only, no OIDC; SCIM is off by default for every tenant; no acceptance run against a real identity provider.',
  }, {
    status: 'building',
    evidence: [['app/src/components/MfaStep.tsx', 'the second-factor step'], ['app/src/components/institutional/ControlPlane.tsx', 'the tenant control-plane tab'], ['supabase/console-control-plane.check.sql', 'a fresh second factor on operator actions']],
    gap: 'MFA covers operators only, tenant administration is a flagged preview tab, and there is no native directory or identity provider.',
  }),
  domain('portal', 'Student portal', 'Connect existing services', 'The default student portal and daily operating environment', {
    status: 'tested',
    evidence: [['app/src/lib/today-decision.test.ts', 'the Today decision logic'], ['app/src/components/ActionCenter.test.tsx', 'most important action, next actions, why, source']],
    gap: 'The Action Center defaults to production (`today_action_center`; an explicit `off` rolls it back); no student acceptance run.',
  }, {
    status: 'building',
    evidence: [['app/src/lib/tabbar.ts', 'Today, My Path, Search, Plan, Me, on by default through `journeyNavigation`'], ['app/src/lib/fivedestinations.test.ts', 'the five held to their screens']],
    gap: 'The five destinations are the default (`journeyNavigation` defaults to production) but Files, AI threads, Career and Pathway stay on the device, and there is no context bar on Today, Plan or Me; no student acceptance run.',
  }),
  domain('catalog', 'Course catalog', 'Import or sync official data', 'Catalog authoring, publishing, search and curriculum discovery', {
    status: 'tested',
    evidence: [['app/src/lib/registration.test.ts', 'catalog parse and time conflicts'], ['app/src/lib/course-detail.test.ts', 'fit, conflicts and source labels'], ['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'registrar-synced `catalog_sections` under `catalog:sync`']],
    gap: 'The catalog is a file the student imports; no live registrar feed.',
  }, {
    status: 'not-started',
    evidence: [['docs/UNIVERSITY-OS-ARCHITECTURE.md', 'today’s boundary: Semester is not the catalog of record']],
    gap: 'No catalog authoring, approval, publishing or catalog-year versioning.',
  }),
  domain('degree', 'Degree planning', 'Read-only requirements and student planning', 'Degree audit, pathway, scenario and graduation planning', {
    status: 'tested',
    evidence: [['app/src/lib/degree.test.ts', 'requirement arithmetic on student-entered requirements'], ['app/src/lib/graduation.test.ts', 'the projection, labelled an estimate']],
    gap: 'Students type their own requirements; no institutional audit source.',
  }, {
    status: 'not-started',
    evidence: [['docs/PRODUCT-ROADMAP.md', '“no official degree audit” in any phase of the current product plan'], ['docs/UNIVERSITY-OS-ARCHITECTURE.md', 'today’s boundary: the official degree audit is not replaced']],
    gap: 'No requirement rules of record, no audit engine and no certification by a registrar.',
  }),
  domain('registration', 'Registration', 'Plan and official handoff', 'The registration center: waitlist, enrollment, add/drop and approval workflow', {
    status: 'tested',
    evidence: [['app/src/lib/registration-day.test.ts', 'ranked backups and the checklist'], ['app/src/components/RegistrationDay.test.tsx', 'countdown and official handoff']],
    gap: 'No live seats. After the handoff the student can note where it stands (their own report, on their device, `handoff-status.ts`), but nothing reads the official system back.',
  }, {
    status: 'building',
    evidence: [['supabase/migrations/20260929300000_registration_transaction.sql', 'terms, sections, enrollments, holds, completions, overrides, requests and an audit event; prerequisites, clashes, credit ceiling, holds, waitlist promotion, idempotency, a per-school-term lock and a registrar override'], ['supabase/registration_transaction.check.sql', 'the transaction walked in a throwaway database'], ['app/src/lib/enrollment/enrollment.test.ts', 'the pure model'], ['app/server/institution/registration.test.ts', 'the sandbox flows']],
    gap: 'The native transaction exists in the database and is gated by `writeback.registration_submit` (off at every school); nothing feeds it from a student information system (no adapter, no importer) and nothing reads the official system back, so there is no seat inventory of record. The server module `app/server/institution/registration.ts` is a labelled sandbox demonstration.',
  }),
  domain('lms', 'LMS', 'LTI launch and selected context', 'Native Course Studio, learning platform, assignments, assessments and gradebook', {
    status: 'tested',
    evidence: [['supabase/functions/_shared/lti.ts', 'OIDC login and JWT launch validation'], ['app/src/lib/lti.test.ts', 'the positive and negative launch suite'], ['supabase/lti.check.sql', 'row-level security on registration and nonce tables']],
    gap: 'No launch from a real LMS yet; names and roles not requested; grade passback off by flag.',
  }, {
    status: 'building',
    evidence: [['app/src/components/CourseStudio.test.tsx', 'the faculty screens'], ['supabase/coursestudio.check.sql', 'faculty-grant publishing, immutable versions'], ['supabase/migrations/20260929310000_gradebook.sql', 'schemes, items, append-only grade entries, regrades and passbacks'], ['supabase/gradebook.check.sql', 'the gradebook walked in a throwaway database'], ['app/server/institution/sandbox.test.ts', 'release gating and appeal in the sandbox']],
    gap: 'Course Studio publishes rules, guidance and study packs only. A gradebook of record exists in the database and has instructor and student screens, gated by `writeback.lms_grade_passback` (off at every school); no `LmsAdapter` is implemented, and there is no course shell, roster, submissions, question banks or rubric levels in a screen.',
  }),
  domain('advising', 'Advising', 'Student-controlled agendas and plans', 'The full advising case, plan, appointment, notes and follow-up system', {
    status: 'tested',
    evidence: [['app/src/lib/advisor-meeting.test.ts', 'the agenda and what is shared'], ['supabase/advisor.check.sql', 'own-school advisors, 120-day expiry, reads logged']],
    gap: 'Behind `advisor_meeting_mode`; the advisor’s page is read-only with no reply.',
  }, {
    status: 'building',
    evidence: [['app/server/institution/advising.ts', 'slot booking'], ['app/server/institution/advising.test.ts', 'the sandbox flows']],
    gap: `${SANDBOX} No case model, caseloads, advisor notes or campaigns.`,
  }),
  domain('accounts', 'Student accounts', 'Show deadline and safe handoff', 'Billing, invoices, payment plans, hosted payment, refunds and financial communication', {
    status: 'tested',
    evidence: [['app/src/lib/bill.test.ts', 'the bill against aid, figures entered, never fetched'], ['app/src/lib/office-actions.test.ts', 'office deadlines into the Action Center']],
    gap: 'Figures are typed by the student unless the school keeps its accounts in Semester (the native row); no feed from another bursar system.',
  }, {
    status: 'building',
    evidence: [['supabase/student-accounts.check.sql', 'the student-account ledger (D-146): charges, payments, refunds, adjustments, reversals and aid credits, each approved by someone else'], ['app/src/lib/finance/accounts.ts', 'balance, aging, holds, statements, payment plans and receipts from the ledger'], ['app/src/components/institutional/StudentAccounts.test.tsx', 'the Student accounts tab'], ['app/src/components/MyStudentAccount.test.tsx', 'a linked student reads their posted account, receipts and statements on Bill, and asks for a payment plan'], ['supabase/student-payment-plans.check.sql', 'payment plans: the balance and schedule written by the database, decided by someone other than the asker']],
    gap: 'The ledger and its controls are built and held; nothing connects it to a payment provider, so payments are recorded by hand from the provider’s reference and settlements are read from a file. A student reads their account and asks for a plan, and is sent nothing: no statement, reminder or plan notice leaves Semester.',
  }),
  domain('aid', 'Financial aid', 'Checklist and official handoff', 'Aid workflow, documents, communication and packaging — only with legal and institutional capacity', {
    status: 'building',
    evidence: [['app/src/lib/help-routes.ts', 'financial aid routed to its office, nothing stored'], ['app/src/lib/help-routes.test.ts', 'aid is directory-only']],
    gap: 'No checklist built from an aid deadline or status.',
  }, {
    status: 'not-started',
    evidence: [['docs/UNIVERSITY-OS-ARCHITECTURE.md', 'today’s boundary: aid determination is not replaced'], ['docs/FINANCIAL-READINESS-WORKSPACE.md', 'Semester is not the aid package']],
    gap: 'No packaging, verification, disbursement or satisfactory-progress workflow; the brief itself says not to claim this until regulatory expertise exists.',
  }),
  domain('housing', 'Housing', 'Status and official handoff', 'Housing application, room selection, residence life, maintenance and communications', {
    status: 'tested',
    evidence: [['app/src/lib/housing.test.ts', 'move-out against exams, facts entered'], ['app/src/lib/campusdirectory.test.ts', 'the school-imported housing directory']],
    gap: 'Entered or imported only; no live housing feed.',
  }, {
    status: 'building',
    evidence: [['app/server/institution/housing.ts', 'applications, room spaces, contracts, cooling-off'], ['app/server/institution/housing.test.ts', 'the sandbox flows']],
    gap: `${SANDBOX} Nobody is housed through it; no maintenance or residence-life workflow.`,
  }),
  domain('dining', 'Dining', 'Hours and official handoff', 'Meal plan, dining locations, mobile ordering and campus card — where partner capacity exists', {
    status: 'tested',
    evidence: [['app/src/lib/meals.test.ts', 'swipe run-rate, entered never fetched'], ['app/src/lib/campusdirectory.ts', 'the dining directory kind']],
    gap: 'No campus-card or balance feed.',
  }, {
    status: 'building',
    evidence: [['supabase/migrations/20260929330000_dining.sql', 'locations, hours, menus, plans, orders, an append-only integer-cents ledger and a shared-swipe pool'], ['supabase/dining.check.sql', 'the dining store walked in a throwaway database'], ['app/src/lib/dining/client.test.ts', 'the client'], ['app/server/institution/housing.test.ts', 'the sandbox flows for meal-plan choice']],
    gap: 'A real store exists and is gated by `module.dining` (high-risk, off); no card-office partner is connected, so there is no point of sale or balance of record, and no staff screen is reachable from navigation.',
  }),
  domain('career', 'Career', 'Portfolio and opportunity layer', 'Career services, verified skills, employer, internship and alumni network', {
    status: 'tested',
    evidence: [['app/src/lib/career-evidence.test.ts', 'confirmed skills and artifacts'], ['app/src/lib/apply.test.ts', 'the application tracker']],
    gap: 'The skills graph is behind a preview flag, and the data is device-local.',
  }, {
    status: 'building',
    evidence: [['supabase/mentor-rosters.check.sql', 'alumni mentor consent on both sides'], ['supabase/expansion.check.sql', '`talent_profiles` opt-in and employer `talent:search`'], ['app/server/institution/career.test.ts', 'sandbox employers']],
    gap: 'No real employer, no career-services appointments or recruiting, and no credential an employer can verify.',
  }),
  domain('community', 'Campus community', 'Verified listings and events', 'Campus community, organizations, events, mentoring and opportunities', {
    status: 'tested',
    evidence: [['supabase/listings.check.sql', 'no self-publish, school-scoped visibility'], ['app/src/lib/listings.test.ts', 'eligibility as written, https only']],
    gap: 'No verified live event source; no event accessibility details.',
  }, {
    status: 'building',
    evidence: [['supabase/organizations.check.sql', 'membership decisions refused when attempted'], ['app/server/institution/clubs.test.ts', 'clubs in the sandbox'], ['packages/institution/src/workflow.ts', 'organization recognition as a state machine nothing wires in']],
    gap: 'Elections and spend exist only in the sandbox; recognition is not wired to anything.',
  }),
  domain('operations', 'Institution operations', 'Configuration and integration controls', 'The operational console for university workflow, services, content, analytics and governance', {
    status: 'tested',
    evidence: [['app/src/components/institutional/IntegrationDashboard.test.tsx', 'every domain with health; counts exported, never ids'], ['supabase/integration-control-plane.check.sql', 'row-level security and tenant kill switches']],
    gap: 'Behind `integrationDashboard`; only mock adapters exist.',
  }, {
    status: 'building',
    evidence: [['app/src/screens/Console.tsx', 'approvals, break-glass, audit, customers'], ['app/src/screens/console.test.tsx', 'gated by `console:operate`']],
    gap: 'This is the operators’ console for Semester the company; a university’s own staff have no operations console, and tenant configuration is still spread across University tabs.',
  }),
];

// ── What replacement requires ───────────────────────────────────────────────

/** The replaceability bar: every one must be held before any domain is retired into Semester. */
export const REQUIREMENTS: readonly Held[] = held([
  { id: 'r-record', what: 'Authoritative data ownership: the institution knows which system is the official record', status: 'tested', evidence: [['app/src/lib/governance/data-contracts.ts', 'owner, steward and source system per domain'], ['app/src/lib/governance/data-contracts.test.ts', 'every connector has a contract']], gap: 'Every domain names an external record-holder; no contract yet declares Semester authoritative for anything.' },
  { id: 'r-lifecycle', what: 'Complete lifecycle: create, edit, approve, archive, correct, reverse and retain', status: 'building', evidence: [['packages/institution/src/workflow.ts', 'five state machines'], ['supabase/officeactions.check.sql', 'draft → review → published with a second approver'], ['supabase/coursestudio.check.sql', 'immutable versions']], gap: 'The full cycle exists per domain (office actions, Course Studio, the record and student-account ledgers with reversal and refund, Configuration Studio and Workflow Builder versions, school offboarding steps); there is no generic correct or reverse, and no per-object retention.' },
  { id: 'r-roles', what: 'Role and permission model for students, faculty, advisors, staff, admins, auditors and support', status: 'tested', evidence: [['supabase/capabilities.check.sql', 'scoped capability grants and refusals'], ['app/src/lib/ops/consoleduties.test.ts', 'the duties matrix']], gap: 'No signed permission matrix per institution.' },
  { id: 'r-approvals', what: 'Approval engine with review, delegation and separation of duties', status: 'tested', evidence: [['supabase/console-approvals.check.sql', 'self-approval refused, two approvers where required']], gap: 'No delegation anywhere and no generic engine; second-person rules are enforced per domain (console operations, the record ledger, finance, configuration and workflow publish, migration cutover, module mode, offboarding, office actions).' },
  { id: 'r-audit', what: 'Audit history', status: 'tested', evidence: [['supabase/console-control-plane.check.sql', 'hash-chained audit; reads audited'], ['supabase/role-grant-audit.check.sql', 'grant changes audited']], gap: 'Several audit tables with no single schema or search.' },
  { id: 'r-migration', what: 'Data migration: historical records, attachments, statuses and relationships move safely', status: 'building', evidence: [['app/src/lib/migration/center.ts', 'the Migration Center: mapping, cleaning rules, preview, validation and reconciliation of an export'], ['supabase/migrations/20260929200000_migration_center.sql', 'the migration record and its stage gate'], ['docs/DATA-MIGRATION-PLAN.md', 'the plan']], gap: 'The path from inventory to cutover is built and gated, but nothing imports records into a Semester domain of record, because none exists yet; attachments and relationships are not mapped.' },
  { id: 'r-parallel', what: 'Parallel-run mode: compare Semester against the retiring system before cutover', status: 'tested', evidence: [['supabase/migration-center.check.sql', 'cutover refused until enough distinct periods pass, the latest passing'], ['app/src/lib/migration/center.test.ts', 'the comparison: missing, extra and differing records, by key']], gap: 'It compares exports the migration lead supplies, period by period; nothing yet runs a domain in shadow automatically.' },
  { id: 'r-reconcile', what: 'Reconciliation: differences between old and new are detected, investigated and resolved', status: 'tested', evidence: [['supabase/integration-quality.check.sql', 'reconciliation runs and discrepancies'], ['app/server/institution/gateway.test.ts', 'prepare, commit, reconcile']], gap: 'Never run against a live source; no financial reconciliation.' },
  { id: 'r-reporting', what: 'Reporting: operational, regulatory, academic and financial', status: 'tested', evidence: [['app/src/lib/institution-ops.test.ts', 'small-group suppression and export refusals']], gap: 'Runs on pasted data in a hidden tab; no regulatory or financial report.' },
  { id: 'r-export', what: 'Export and portability for institution and student data', status: 'tested', evidence: [['app/src/lib/export.test.ts', 'CSV, Markdown, ICS'], ['app/src/lib/erasure.test.ts', 'export and erasure on one data map']], gap: 'Student export only; no tenant bulk export and no OneRoster, Common Cartridge or QTI export.' },
  { id: 'r-a11y', what: 'Accessibility for every workflow and every user', status: 'tested', evidence: [['app/src/a11y/axe.test.tsx', 'axe on every route'], ['app/scripts/accessibility-smoke.mjs', 'keyboard and 320px on six journeys']], gap: 'No conformance report and no third-party audit.' },
  { id: 'r-recovery', what: 'Disaster recovery: data and workflows survive outages, bad releases and mistakes', status: 'tested', evidence: [['app/src/lib/rehearsal.test.ts', 'the restore rehearsal runs in CI'], ['supabase/restore.sh', 'the rehearsal']], gap: 'Production has never been restored; recovery time and point are unmeasured.' },
  { id: 'r-change', what: 'Change management: training, communications, support and adoption plans', status: 'designed', evidence: [['docs/INSTITUTIONAL-CHANGE-MANAGEMENT.md', 'the model'], ['docs/FACULTY-ENABLEMENT.md', 'faculty enablement']], gap: 'No training exists for any role.' },
  { id: 'r-contract', what: 'Contractual support: service levels, escalation, maintenance and incident obligations', status: 'building', evidence: [['app/src/lib/sla.ts', 'the service-level arithmetic'], ['app/src/lib/sla.test.ts', 'the arithmetic held'], ['docs/trust/SLA.md', 'the framework, not a commitment']], gap: 'No signed service level, no uptime number, no on-call rota.' },
  { id: 'r-exit', what: 'Exit plan: a responsible way for an institution to migrate away', status: 'building', evidence: [['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'the offboarding plan'], ['supabase/tenant-rollout.check.sql', 'archiving requires offboarding and a completion certificate'], ['supabase/school-offboarding.check.sql', 'offboarding cases and their steps'], ['docs/SCHOOL-OFFBOARDING.md', 'the eight-step runbook']], gap: 'Offboarding is built and has never been used: the export file is not generated, nothing is purged, there is no screen, and no school has been offboarded.' },
]);

/** A domain can be retired into Semester only when its native row and every requirement are held by a test. */
export function replaceable(d: Domain): boolean {
  return d.replace.status === 'tested' && REQUIREMENTS.every((r) => r.status === 'tested');
}

/** What stops a domain, in order: its own native row, then each requirement short of tested. */
export function blockers(d: Domain): readonly Held[] {
  return [d.replace, ...REQUIREMENTS].filter((h) => h.status !== 'tested');
}

// ── The six phases ──────────────────────────────────────────────────────────

export const PHASES: readonly { phase: number; name: string; covers: readonly string[] }[] = [
  { phase: 1, name: 'Own the student experience', covers: ['portal', 'degree', 'registration', 'advising', 'career', 'community'] },
  { phase: 2, name: 'Replace student-facing workflow modules', covers: ['portal', 'advising', 'career', 'community'] },
  { phase: 3, name: 'Replace learning delivery functions', covers: ['lms'] },
  { phase: 4, name: 'Replace academic administration functions', covers: ['catalog', 'degree', 'registration'] },
  { phase: 5, name: 'Replace student-service operations', covers: ['accounts', 'aid', 'housing', 'dining', 'advising', 'career'] },
  { phase: 6, name: 'Replace university operations and ERP workflows', covers: ['identity', 'operations'] },
];

/** What every module must share, as the first brief lists it. */
export const SHARED: readonly string[] = [
  'One identity', 'One profile', 'One permissions model', 'One source and trust model', 'One Action Center', 'One Search and knowledge graph',
  'One Workspace', 'One AI policy layer', 'One notification system', 'One audit trail', 'One data-retention model', 'One design system', 'One mobile and accessibility standard',
];

/** Areas that stay bounded however far replacement goes. */
export const BOUNDED: readonly { domain: string; eventually: string; nonNegotiable: string }[] = [
  { domain: 'Academic records', eventually: 'Transcript, degree audit, enrollment, credentials', nonNegotiable: 'Registrar governance, audit history, records retention, reporting, legal review' },
  { domain: 'Registration', eventually: 'Enrollments, waitlists, add/drop, approvals', nonNegotiable: 'Transaction integrity, concurrency, capacity rules, rollback, audit, financial dependency checks' },
  { domain: 'Gradebook', eventually: 'Official grades, submissions, assessments', nonNegotiable: 'Faculty workflow, grade release, accommodations, retention, integrity, export, appeals' },
  { domain: 'Financial aid', eventually: 'Workflow and aid operations', nonNegotiable: 'Regulatory expertise, eligibility rules, institutional authority, secure records, reporting' },
  { domain: 'Payments', eventually: 'Tuition, invoices, plans, refunds', nonNegotiable: 'Hosted payment provider, PCI scope management, ledger integrity, reconciliation, financial controls' },
  { domain: 'Housing', eventually: 'Contracts, assignments, payments', nonNegotiable: 'Housing policy, room inventory, privacy, legal contract management, support operations' },
  { domain: 'Health', eventually: 'Resource navigation and scheduling', nonNegotiable: 'Never a clinical record system without the regulation, governance and security it needs' },
  { domain: 'Emergency response', eventually: 'Institutional workflow support', nonNegotiable: 'Separate authorization, just-in-time access, legal review, complete audit, no ordinary admin access' },
];

// ── The architecture principle for today ────────────────────────────────────

export const PRINCIPLE: readonly Held[] = held([
  { id: 'p-boundary', what: 'Official-record boundary: the SIS and LMS stay authoritative for records, enrollment, holds and official grades unless Semester is deployed as that system', status: 'tested', evidence: [['app/src/lib/integration/adapter.ts', 'any non-read direction must sit behind a `writeback.*` flag'], ['app/src/lib/integration/mock-sis.test.ts', 'SIS and degree-audit adapters are read-only'], ['app/src/lib/ltigate.test.ts', 'the grade-passback gate']], gap: 'A gate, not a ban: when enabled, passback writes quiz scores to the LMS.' },
  { id: 'p-sis-fields', what: 'SIS gateway with the minimum fields: status, program, term, catalog, sections, enrollment, window, hold category, advisor', status: 'building', evidence: [['app/src/lib/integration/mock-sis.ts', 'the minimum field sets'], ['app/src/lib/integration/mock-sis.test.ts', 'read-only, consent-scoped mapping']], gap: 'Only mock adapters exist; no real SIS gateway.' },
  { id: 'p-avoid', what: 'Fields avoided by default: detailed grades, finances, health, conduct, accommodation diagnoses, counseling notes, payment credentials', status: 'tested', evidence: [['app/src/lib/integration/catalog.ts', '`NEVER_INGEST` and `NEVER_DISPLAY`'], ['supabase/canonical-display.check.sql', 'the database refuses those keys']], gap: 'Enforced by field name; a sensitive value under an innocent name relies on the mapping review.' },
  { id: 'p-states', what: 'Seven source states on every imported item, with system, last updated and an official fallback', status: 'building', evidence: [['app/src/lib/source.ts', 'the five labels the database enforces'], ['app/src/lib/source.test.ts', 'labels held to the check constraint'], ['app/src/lib/integration/freshness.ts', 'stale and unavailable, in a separate vocabulary']], gap: 'Two vocabularies, not one seven-state model carried with system and fallback on every item.' },
  { id: 'p-pipeline', what: 'Durable sync: signature and schema validation, inbox, idempotency and replay, mapping, precedence, domain event, audit, reconciliation, exception queue', status: 'building', evidence: [['app/src/lib/integration/pipeline.test.ts', 'idempotency, timestamp regression, retry, dead-letter'], ['app/server/integration/worker.test.ts', 'a duplicate is a duplicate; tenant from the connection']], gap: 'No inbound endpoint, so no signature check or durable inbox; reconciliation is never scheduled.' },
  { id: 'p-student-owned', what: 'Never overwrite student-created notes or plans with external data', status: 'tested', evidence: [['app/src/lib/changeset.test.ts', 'a moved deadline surfaces as a conflict, never replaced'], ['app/src/lib/merge.test.ts', 'both notes kept across devices']], gap: 'Holds because the stores are separate; no explicit rule forbids an institutional sync from touching student rows.' },
  { id: 'p-holds', what: 'Hold cards: neutral category, source and time, official resolution route, never marked resolved by the student, nothing sensitive in notifications', status: 'tested', evidence: [['app/src/lib/integration/school-records.ts', '“Action required before you can register — {office}”, never the reason'], ['app/src/lib/integration/school-records.test.ts', 'only office and link; “no hold” only with fresh data']], gap: 'No hold-category field, no “this looks wrong” route, and no notification-content rule for holds.' },
  { id: 'p-advisor', what: 'Advisor Meeting Mode: the student chooses what to share, can revoke it, and private notes, health, finances and AI history never go', status: 'tested', evidence: [['app/src/lib/advisor-meeting.test.ts', 'only what the student ticked'], ['app/src/lib/advisor-shares.test.ts', 'at most 120 days, revoke, read log'], ['app/src/components/AdvisorMeeting.test.tsx', 'the preview leaves private notes out']], gap: 'Behind a flag; the shared agenda carries no sources or freshness.' },
  { id: 'p-support', what: 'Support routing: verified offices and why, hours, preparation, student-approved follow-up; urgent needs only to official resources', status: 'tested', evidence: [['app/src/lib/nowrongdoor.test.ts', 'crisis wording routed first; nothing typed is stored'], ['app/src/lib/help-routes.test.ts', 'requests sent only on confirm']], gap: 'Offices are generic pointers, not institution-verified with hours.' },
  { id: 'p-ferpa', what: 'FERPA school-official control: agreement, authorized purpose, minimum fields, tenant isolation, no model training, retention, audit', status: 'building', evidence: [['app/src/lib/trust/ai-training-policy.test.ts', 'the no-training policy'], ['supabase/tenancy.check.sql', 'tenant isolation'], ['docs/trust/DPA-CHECKLIST.md', 'the agreement checklist']], gap: 'No signed data-processing agreement with any institution.' },
  { id: 'p-lti', what: 'LTI 1.3 launch with course context, deep links and assignment and grade services', status: 'tested', evidence: [['app/src/lib/lti.test.ts', 'launch and course context'], ['app/src/lib/ltideeplink.test.ts', 'deep linking'], ['app/src/lib/ltiags.test.ts', 'score post']], gap: 'The score write has no preview, reconciliation or exception queue; names and roles not requested.' },
  { id: 'p-oneroster', what: 'OneRoster roster, resource and gradebook exchange, adopted service by service', status: 'designed', evidence: [['docs/INTEROPERABILITY-ROADMAP.md', 'six OneRoster principles']], gap: 'No OneRoster code anywhere.' },
  { id: 'p-ai-policy', what: 'Course-level AI policy controls', status: 'tested', evidence: [['app/src/lib/courserules.test.ts', 'faculty-published, versioned rules shown before the assistant answers'], ['supabase/coursestudio.check.sql', 'who may publish']], gap: 'Course and tenant layers only; no assignment layer.' },
]);

/** The seven states, each held to the vocabulary that carries it. */
export const SOURCE_STATES: readonly { state: string; meaning: string; label: SourceLabel | null; freshness: Freshness | null }[] = [
  { state: 'Institution verified', meaning: 'Received from an approved, current institutional source', label: 'institution_verified', freshness: null },
  { state: 'Imported', meaning: 'Received from a connected non-authoritative or user-authorized source', label: 'imported', freshness: null },
  { state: 'Student entered', meaning: 'Entered or confirmed by the student', label: 'student_entered', freshness: null },
  { state: 'Estimated', meaning: 'Calculated by Semester; not official', label: 'estimated', freshness: null },
  { state: 'Needs review', meaning: 'Extracted or incomplete; requires confirmation', label: 'needs_review', freshness: null },
  { state: 'Stale', meaning: 'Source has not refreshed within the expected window', label: null, freshness: 'stale' },
  { state: 'Unavailable', meaning: 'Source could not be reached or data is not authorized', label: null, freshness: 'unavailable' },
];

export const HOLD_CATEGORIES: readonly { category: string; semester: string; official: string }[] = [
  { category: 'Advising', semester: 'Checklist, advisor questions, appointment handoff', official: 'PIN release, approval, official clearance' },
  { category: 'Financial', semester: 'High-level deadline, payment-plan link, aid-office questions', official: 'Balance ledger, payment, aid decision, release' },
  { category: 'Records', semester: 'Document checklist, registrar contact, official link', official: 'Record review and hold release' },
  { category: 'Immunization / health', semester: 'Neutral status and health-services handoff', official: 'Health data, documentation, clearance' },
  { category: 'Library', semester: 'Resource link and contact', official: 'Fine or account detail and release' },
  { category: 'International', semester: 'Compliance reminder, official adviser handoff', official: 'Visa and documentation record and decision' },
  { category: 'Conduct', semester: 'General official contact path only', official: 'Case information, adjudication, release' },
  { category: 'Unknown', semester: '“Contact the official office” fallback', official: 'Internal determination' },
];

// ── Registration, LMS and services expansion ───────────────────────────────

export const EXPANSION: readonly Held[] = held([
  { id: 'e-regday', what: 'Registration Day Mode: countdown, time ticket, ranked backups, seat watch, copyable CRNs, official handoff, what changed', status: 'tested', evidence: [['app/src/lib/registration-day.mode.test.ts', 'countdown, CRN list, never says Semester registers anyone'], ['app/src/components/RegistrationDay.mode.test.tsx', 'https-only handoff; no seat alerts without a live feed']], gap: 'No working seat watch and no “what changed” view; the time ticket is student-entered.' },
  { id: 'e-scenario', what: 'Academic scenario engine: what if I change majors, add a minor, study abroad, go part time', status: 'tested', evidence: [['app/src/lib/graduation.test.ts', 'term-by-term projection'], ['app/src/lib/scenario-compare.test.ts', 'side-by-side plans'], ['app/src/lib/abroad.test.ts', 'study-abroad planning']], gap: 'Credit and load arithmetic only; a change of major does not re-evaluate requirements.' },
  { id: 'e-course-page', what: 'Course intelligence pages: one detail page with fit, sections, schedule impact, outcomes, support and alternatives', status: 'tested', evidence: [['app/src/components/CourseDetailV2.test.tsx', 'every section with where it came from'], ['app/src/lib/course-detail.test.ts', 'plan impact, related courses']], gap: 'Behind `course_detail_v2`; no people or resources on the page.' },
  { id: 'e-transfer', what: 'Transfer and dual-enrollment center', status: 'building', evidence: [['app/src/lib/transferhub.ts', 'eight workflows'], ['supabase/expansion.check.sql', 'a student writes only estimated or submitted']], gap: 'No hub screen joins the workflows; dual enrollment is only a role.' },
  { id: 'e-studio', what: 'Native Course Studio: overview, syllabus, assignments, materials, study, office hours, projects, AI policy, official handoff', status: 'tested', evidence: [['app/src/lib/coursestudio.test.ts', 'AI rules and study packs checked before publishing'], ['supabase/coursestudio.check.sql', 'publish rights, append-only versions']], gap: 'Publishes AI rules and packs only; no module, page or assignment authoring.' },
  { id: 'e-syllabus', what: 'Syllabus intelligence with a review screen before anything reaches the plan or calendar', status: 'tested', evidence: [['app/src/lib/import-review.test.ts', 'only approved, valid dates become the calendar'], ['app/src/lib/generate.test.ts', 'dated items with verbatim quotes']], gap: 'Outcomes, office hours and AI policy are not extracted; no crunch-week view.' },
  { id: 'e-assignment', what: 'The assignment as a connected object: milestones, rubric checklist, sources, feedback into revision', status: 'tested', evidence: [['app/src/lib/assignment.test.ts', 'brief → outputs, rubric, dated steps'], ['app/src/lib/project.test.ts', 'milestones and runway']], gap: 'No submission or receipt; not linked to requirements or skills.' },
  { id: 'e-practice', what: 'Practice assessments, grade estimator and “what score do I need?”', status: 'tested', evidence: [['app/src/lib/examattempt.test.ts', 'practice paper with autosave and receipt'], ['app/src/lib/whatif.test.ts', 'what-if and what you then need']], gap: 'Estimates come from the student’s own records, not released grades.' },
  { id: 'e-faculty-assess', what: 'Faculty assessment: question banks, item versioning, rubric builder, grade release, regrade and moderation', status: 'building', evidence: [['app/src/lib/exam.ts', 'seeded draw over five item types'], ['app/server/institution/sandbox.test.ts', 'release gating and appeal in the sandbox']], gap: 'No question banks, rubric levels or live grade release.' },
  { id: 'e-competency', what: 'CASE-compatible competency and skills alignment from program outcome to career pathway', status: 'not-started', evidence: [['docs/INTEROPERABILITY-ROADMAP.md', 'CASE deferred until competency mapping is real']], gap: 'No CASE identifiers anywhere.' },
  { id: 'e-group', what: 'Group-project workspace: charter, roles, timeline, board, peer feedback, reflections, shared artifact on consent', status: 'tested', evidence: [['app/src/lib/groupwork.test.ts', 'shared parts and pace'], ['supabase/groups.check.sql', 'four-user row-level security walk']], gap: 'No peer-feedback workflow, instructor checkpoints or team portfolio artifact.' },
  { id: 'e-services-hub', what: 'Student Services Hub: each service a connected workflow, not a directory entry', status: 'building', evidence: [['app/src/screens/Support.tsx', 'office doors and checklists'], ['app/src/lib/campusdirectory.test.ts', 'school-imported offices']], gap: 'The pieces are tested; no single hub joins them.' },
  { id: 'e-office-actions', what: 'Office action publisher: authorized offices publish into the Action Center with source, population, dates and approval history', status: 'tested', evidence: [['app/src/lib/office-actions.test.ts', 'office, link, source, dates, draft → review → published'], ['supabase/officeactions.check.sql', 'publish roles and department scope']], gap: 'Behind `office_action_feed`; office actions do not reach search or the calendar.' },
  { id: 'e-life-planning', what: 'Financial and life planning: deadlines, scholarships, budget, work hours against credit load', status: 'tested', evidence: [['app/src/lib/cost-plan.test.ts', 'per-term cost lines with source labels'], ['app/src/lib/life-balance.test.ts', 'work, commute and class hours']], gap: 'No scholarship tracker; work hours are not traded against credits in one view.' },
  { id: 'e-access-passport', what: 'Accessibility Passport: functional summary, student-chosen recipient and duration, read log, revocable', status: 'building', evidence: [['supabase/expansion.check.sql', 'issued by disability services; shared, time-limited, revocable; reads audited'], ['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'the three passport tables']], gap: 'The database holds it; no screen issues, shares or shows it.' },
  { id: 'e-campus', what: 'Campus experience: verified events, clubs, accessible map, mentors, research and volunteer listings', status: 'tested', evidence: [['app/src/components/CampusEvents.test.tsx', 'school-supplied events'], ['app/src/components/MentorFinder.test.tsx', 'mentors with two-sided consent'], ['app/src/lib/maps.test.ts', 'the map']], gap: 'Directories are imported files; no content-governance workflow with owner and expiry.' },
  { id: 'e-standards', what: 'Standards: SAML/OIDC, SCIM, OAuth, iCal, Open Badges', status: 'building', evidence: [['app/src/lib/oauthscopes.test.ts', 'OAuth scopes pinned'], ['app/src/lib/ics.test.ts', 'iCal'], ['app/server/institution/postgres-scim.test.ts', 'SCIM']], gap: 'No OIDC sign-in; Open Badges not started.' },
]);

/** The third brief's ten best next modules, each a row on this page. */
export const BEST_NEXT: readonly string[] = ['e-regday', 'e-studio', 'e-assignment', 'p-advisor', 'e-services-hub', 'e-transfer', 'e-competency', 'e-group', 'e-access-passport', 'e-life-planning'];

// ── What an institution needs to retire a system ───────────────────────────

export const CONFIDENCE: readonly Held[] = held([
  { id: 'm-migration-center', what: 'Migration Center: inventory, classification, mapping, cleaning, preview, sample import, validation, reconciliation, parallel run, cutover, archive, monitoring', status: 'tested', evidence: [['app/src/lib/migration/center.test.ts', 'the twelve stages, their gates and the arithmetic, held to the migration'], ['supabase/migration-center.check.sql', 'every gate walked against the trigger, as the account that should be refused'], ['app/src/components/institutional/MigrationCenter.test.tsx', 'the University tab: what is owed, the preview, the reconciliation, approvals']], gap: 'Behind `migrationCenter`, off by default, and not yet run with a real institution. Counts are the lead’s attributed claim about a file read in their browser; the database cannot re-run them.' },
  { id: 'm-migration-record', what: 'A record per migration: source and version, owner, classification, retention, mapping, cutoff, rollback plan, approvers', status: 'tested', evidence: [['supabase/migrations/20260929200000_migration_center.sql', '`migration_projects`, `migration_field_maps`, `migration_runs`, `migration_approvals`'], ['supabase/migration-center.check.sql', 'who reads and writes each; evidence append-only; audited']], gap: 'Validation tests are the three built-in counts, not rules an institution writes; known exceptions are not a field of their own.' },
  { id: 'm-parallel', what: 'Parallel run: the retiring system stays official while Semester runs in shadow and reports differences', status: 'tested', evidence: [['app/src/lib/migration/center.test.ts', 'the comparison and the parallel-run gate'], ['supabase/migration-center.check.sql', 'a period that differs blocks cutover'], ['supabase/integration-quality.check.sql', 'discrepancy rows for integration syncs']], gap: 'Differences are counted from exports the lead supplies; nothing yet runs a domain in shadow on its own schedule.' },
  { id: 'm-ledger', what: 'Account ledger with immutable entries, and invoices', status: 'tested', evidence: [['supabase/student-accounts.check.sql', 'a student-account ledger: signed entries written only on another person’s approval, append-only for the owner too'], ['app/src/lib/finance/accounts.test.ts', 'a period’s statement, reproduced exactly from the ledger'], ['supabase/commercial.check.sql', 'Semester’s own invoices: payment events append-only']], gap: 'Single-entry, signed per student, not double-entry against general-ledger accounts; statements are derived and numbered, not issued or sent.' },
  { id: 'm-checkout', what: 'Hosted checkout through a PCI-compliant provider; no raw card data', status: 'tested', evidence: [['supabase/functions/_shared/billingcheckout.ts', 'Stripe Checkout with an idempotency key'], ['app/src/lib/billing/checkout.test.ts', 'the handler'], ['app/src/lib/billing/webhook.test.ts', 'the signed webhook']], gap: 'Off until keyed; nothing has been charged.' },
  { id: 'm-refunds', what: 'Refunds, adjustments and reversals with role separation and approval thresholds', status: 'tested', evidence: [['supabase/student-accounts.check.sql', 'a requester never approves; whoever put a payment on the ledger does not approve its refund; above the threshold only finance:approve_high; a refund never exceeds what is left; a reversal is whole and once'], ['app/src/lib/finance/accounts.test.ts', 'the same rules, checked before the database is asked']], gap: 'One threshold for every kind; no tiered limits or delegation, and Semester’s own subscription refunds still sit outside these controls.' },
  { id: 'm-reconcile-close', what: 'Provider, bank and ledger reconciliation, and monthly close', status: 'tested', evidence: [['supabase/student-accounts.check.sql', 'the ledger side computed by the database; a month closes only on a passing reconciliation recorded by someone else, with nothing waiting, and then takes nothing new'], ['app/src/lib/finance/accounts.test.ts', 'provider settlement against ledger: missing, extra and different by reference']], gap: 'Provider to ledger only: there is no bank-statement leg, the settlement file is read by hand, and Semester’s own Stripe billing is not reconciled here.' },
  { id: 'm-disputes', what: 'Failed-payment and dispute workflow', status: 'tested', evidence: [['supabase/commercial-automation.check.sql', 'dunning: reminder, final notice, restrict, recover'], ['app/src/lib/billing/webhook.test.ts', 'refunds and disputes recorded by kind']], gap: 'A chargeback is a ledger kind on student accounts, answering a payment and never exceeding it; there is still no evidence or outcome workflow for a dispute.' },
  { id: 'm-aid-boundary', what: 'Financial aid: no claim of replacement before regulatory expertise, agreements, controls and reporting exist', status: 'tested', evidence: [['app/server/institution/money.ts', 'aid as a labelled sandbox, applied by the institution'], ['app/server/institution/money.test.ts', 'accept, decline and refusals']], gap: 'The boundary holds against the sandbox; no claim rule in the site’s claims register.' },
  { id: 'm-record-history', what: 'Append-only academic record history: effective date, reason, approver, previous value, source, correction without deletion', status: 'tested', evidence: [['supabase/academic-record.check.sql', 'an entry exists only on another person’s approval, names what it replaced, and is never edited or deleted, by the owner either'], ['app/src/lib/record/ledger.test.ts', 'the record as of any date, the history, and the eight questions answered'], ['app/src/components/institutional/RecordLedger.test.tsx', 'the Academic record tab']], gap: 'Behind `recordLedger`, off by default, and no school keeps its record here yet; students have no screen to read their own, and no importer loads a school’s existing record.' },
  { id: 'm-override', what: 'Registrar override controls and separation of duties', status: 'tested', evidence: [['supabase/academic-record.check.sql', 'a proposer never decides; correcting a grade, standing or conferral needs record:override, decided by the database from the ledger'], ['supabase/migrations/20260929210000_academic_record_ledger.sql', 'record:propose, :approve, :override and :read']], gap: 'Two people is the only rule; there is no threshold, delegation or second approver for the gravest overrides such as rescinding a degree.' },
  { id: 'm-transcript', what: 'Transcript generation, credentials and degree conferral', status: 'building', evidence: [['app/src/lib/record/ledger.ts', 'the record as of a date, exported as CSV headed “Not an official transcript”; conferral is a ledger kind approved like any other'], ['docs/CREDENTIAL-WALLET.md', 'design only; not a transcript replacement']], gap: 'No official transcript is issued, signed or sent, no credential is issued, and conferral has no degree-audit check behind it.' },
  { id: 'm-legal-hold', what: 'Legal-hold support', status: 'tested', evidence: [['supabase/migrations/20260927200000_integration_hardening.sql', '`legal_hold` with a required reason'], ['supabase/integration-hardening.check.sql', 'nothing old on a held connection goes'], ['supabase/migrations/20260930140000_erase_respects_holds.sql', 'account erasure refuses under a hold'], ['supabase/legal-holds.check.sql', 'erasure and sweeps respect holds; a bypass fails the check']], gap: 'Integration tables, retention sweeps and account deletion are hold-gated in the database.' },
  { id: 'm-service-desk', what: 'Unified Service Desk: request, routing, case, staff queue, escalation, service level, resolution, satisfaction', status: 'building', evidence: [['supabase/migrations/20260928210000_support_tickets.sql', 'tickets, agent queue, first-response targets'], ['supabase/support-tickets.check.sql', 'every rule with two accounts and an agent'], ['supabase/help-requests.check.sql', 'the office help inbox']], gap: 'Two separate queues, not one desk; no routing rules, escalation or satisfaction.' },
  { id: 'm-knowledge', what: 'Governed knowledge base: article owner, source, audience, review date, expiry, AI-use status', status: 'building', evidence: [['app/src/lib/launch/content.ts', 'content kinds with owner, review interval and expiry'], ['app/src/lib/launch/content.test.ts', 'the kinds held']], gap: 'No article object; nothing carries an AI-use status.' },
  { id: 'm-comms', what: 'One communications engine: templates, segments, consent, quiet hours, caps, approval, delivery metrics', status: 'building', evidence: [['app/src/lib/journey.guards.test.ts', 'no source, no message; quiet hours'], ['app/src/lib/notify.test.ts', 'per-tier daily caps'], ['supabase/officeactions.check.sql', 'second-person approval for office notices']], gap: 'No templates, composer, email or SMS channel, or delivery metrics.' },
  { id: 'm-locale', what: 'Localization: languages, right-to-left, locale dates and zones, currencies, data residency', status: 'building', evidence: [['app/src/lib/locale.ts', 'locale formats, RTL and bidi isolation'], ['app/src/lib/locale.test.ts', 'formats and RTL locales held']], gap: 'No message catalogue, no multi-currency, one region.' },
  { id: 'm-analytics', what: 'Privacy-safe analytics: group-size floors, no individual risk scores', status: 'tested', evidence: [['app/src/lib/institution-ops.test.ts', 'suppression and forbidden per-student metrics'], ['app/src/lib/cohortfloor.test.ts', 'the app floor equals every SQL floor']], gap: 'No instructor course analytics.' },
  { id: 'm-governance', what: 'Data-governance workspace: catalog, owners, classification, retention, access review, consent, requests, deletion, audit search, PIA', status: 'building', evidence: [['supabase/governance.check.sql', 'governance registries'], ['app/src/lib/governance/pia.test.ts', 'the PIA register'], ['supabase/deletion.check.sql', 'deletion empties what it claims']], gap: 'No workspace joins them; no access review or audit-log search.' },
  { id: 'm-marketplace', what: 'Marketplace: developer registration, review, scopes, sandbox tenant, consent, revocation', status: 'designed', evidence: [['docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md', 'extension governance'], ['docs/SYNC-SIMULATION-SANDBOX.md', 'the sandbox design']], gap: 'Nothing for third parties exists.' },
  { id: 'm-academy', what: 'Implementation Academy: role paths, certification, partner and migration-specialist training', status: 'designed', evidence: [['docs/FACULTY-ENABLEMENT.md', 'the faculty plan'], ['docs/LAUNCH-CONTENT-AND-TRAINING.md', 'the training content plan']], gap: 'No curriculum, tracking or certification.' },
  { id: 'm-continuity', what: 'Enterprise continuity: export guarantee, exit help, escrow, continuity and recovery plans, tested restore, service level, insurance', status: 'tested', evidence: [['app/src/lib/rehearsal.test.ts', 'the restore rehearsal in CI'], ['app/src/lib/sla.test.ts', 'the service-level arithmetic'], ['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'the offboarding steps']], gap: 'Production never restored; no escrow, insurance certificate, exit terms or tenant-wide export.' },
]);

/** The fourth brief's twelve final areas, each held to the rows that carry it. */
export const FINAL_AREAS: readonly { area: string; rows: readonly string[] }[] = [
  { area: 'Migration Center', rows: ['m-migration-center', 'm-migration-record'] },
  { area: 'Authoritative academic-record ledger', rows: ['m-record-history', 'm-override', 'm-transcript'] },
  { area: 'Financial-control system', rows: ['m-ledger', 'm-checkout', 'm-refunds', 'm-reconcile-close', 'm-disputes'] },
  { area: 'Unified Service Desk', rows: ['m-service-desk'] },
  { area: 'Governed knowledge base', rows: ['m-knowledge'] },
  { area: 'Communications engine', rows: ['m-comms'] },
  { area: 'Localization and international architecture', rows: ['m-locale'] },
  { area: 'Privacy-safe analytics and data governance', rows: ['m-analytics', 'm-governance'] },
  { area: 'Semester Marketplace', rows: ['m-marketplace'] },
  { area: 'Implementation Academy', rows: ['m-academy'] },
  { area: 'Enterprise continuity package', rows: ['m-continuity'] },
  { area: 'Parallel-run and cutover architecture', rows: ['m-parallel', 'r-parallel'] },
];

export const ALL: readonly Held[] = [...DOMAINS.flatMap((d) => [d.connect, d.replace]), ...REQUIREMENTS, ...PRINCIPLE, ...EXPANSION, ...CONFIDENCE];

export function row(id: string): Held {
  const found = ALL.find((h) => h.id === id);
  if (!found) throw new Error(`No row ${id}`);
  return found;
}

const RANK: Record<Status, number> = { 'not-started': 0, designed: 1, building: 2, tested: 3 };
export function weakest(ids: readonly string[]): Status {
  if (ids.length === 0) throw new Error('No rows');
  return ids.map((id) => row(id).status).reduce((a, b) => (RANK[b] < RANK[a] ? b : a));
}

export function counts(rows: readonly Held[] = ALL): Record<Status, number> {
  const out = { 'not-started': 0, designed: 0, building: 0, tested: 0 } as Record<Status, number>;
  for (const r of rows) out[r.status] += 1;
  return out;
}
