/**
 * Market leadership, held to the tree.
 *
 * Three documents of 28 September 2026 say what would make universities want
 * Semester rather than tolerate it: a memo of fourteen plays and a benchmark
 * test; the whole-platform business model — "one identity, one calendar, one
 * source-of-truth pattern", the shared services no module may re-create, the
 * revenue lines and the lines the business will not cross; and the faculty
 * change-management playbook from the university audit. They are kept under
 * `docs/expansion/` as supplied.
 *
 * ## What this file is
 *
 * The documents' own structure, with each item pointed at what the repository
 * holds for it and a standing read off the tree — the way D-108 held the
 * modernization blueprint and D-111 the service layers. Nearly everything the
 * memo asks for is a master-register row, a boundary, a rule of
 * DO-NOT-BUILD, a ninety-day task or a first-year measure that already
 * exists; this file names which, so a reader of the memo can find where each
 * thing it names actually is, and so a claim that Semester "has" one of them
 * is held to a file.
 *
 * ## What a standing may claim
 *
 *   - `built` cites an automated test that runs on every change.
 *   - `partial` cites code. Something of the item exists; the gap says what
 *     does not.
 *   - `not-built` cites at most a document.
 *   - `held` cites a recorded decision the item conflicts with. The decision
 *     holds until the owner reopens it.
 *
 * Every master row, ninety-day task, first-year measure, help-route need and
 * boundary this file names is checked against the register that owns it by
 * `leadership.test.ts`, which renders `docs/MARKET-LEADERSHIP.md`; edit the
 * data, then `npm run registers` from app/.
 *
 * ## The one rule the memo is held to
 *
 * "Do not say all-in-one without being precise." So nothing here says
 * Semester is a whole platform; the *one X* table says, for each of the
 * thirteen, what carries it and what does not, and the count is the finding.
 */

import type { Seat } from '../launchreadiness';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Market-Leadership-and-the-Benchmark-Test.pdf',
    title: 'Anything else that should be added or improved to be the leader and benchmark in the market',
    what: 'The fourteen plays, the stakeholder table, the Academic Friction Index, No Wrong Door, the Campus AI Control Center, Knowledge Operations, the procurement room, portability, Trust Evidence, the Semester Standard, design partners, what not to do, the twelve-month plan and the benchmark test.',
  },
  {
    path: 'docs/expansion/Whole-Platform-Business-Model.pdf',
    title: 'What sets Semester apart is that it has everything: the whole business model and core principle',
    what: 'The one-X promise, the connected graph and flywheel, the five layers, the shared services no module may re-create, the reusable workflows, the revenue lines, the business-model boundaries, the disruption table, the live-business standard and the enablement scopes.',
  },
  {
    path: 'docs/expansion/University-EdTech-Audit-IT-Compliance-and-Faculty-Playbook.pdf',
    title: 'University edtech audit: the faculty change-management playbook',
    what: 'The six phases, the faculty segments, the policy families and what every policy carries, the moment-by-moment support table, the champion programme, the measures and the communications.',
  },
];

export const STANDINGS = ['built', 'partial', 'not-built', 'held'] as const;
export type Standing = (typeof STANDINGS)[number];

export const STANDING_MEANING: Record<Standing, string> = {
  built: 'Exists and an automated test exercises it',
  partial: 'Some of it exists in code; the gap says what does not',
  'not-built': 'Nothing of it exists beyond a document',
  held: 'Conflicts with a decision already on main, which holds until the owner reopens it',
};

export const DECISION_FILES: readonly string[] = ['docs/DECISION-LOG.md', 'DECISIONS.md', 'docs/DO-NOT-BUILD.md', 'docs/FACULTY-COURSE-STUDIO-DESIGN.md', 'docs/architecture/0003-no-application-server.md'];

export interface Evidence {
  path: string;
  shows: string;
}

export interface Item {
  id: string;
  item: string;
  asks: string;
  /** Master-register rows that carry it. Empty when none does. */
  rows: readonly string[];
  standing: Standing;
  evidence: readonly Evidence[];
  gap: string;
}

// ── The position, and the enduring benchmark ─────────────────────────────────

export const POSITION =
  'Semester is the student-facing operating layer that makes a university’s existing systems understandable and usable — and adds a native learning, planning, support, community and career experience where the existing stack leaves gaps.';

export const ENDURING_BENCHMARK: readonly string[] = [
  'A student should not have to understand a university’s fragmented technology or organizational chart to make progress.',
  'A faculty member should not have to stitch together separate tools to teach, assess, grade and support students.',
  'An advisor or staff member should not have to reconstruct context from five systems.',
  'An institution should not have to choose between a unified student experience and privacy, accessibility, interoperability or governance.',
  'An IT team should not have to accept lock-in, shadow AI or unobservable data flows to improve the student experience.',
];

// ── "One X": the promise, item by item ───────────────────────────────────────

export const ONES: readonly Item[] = [
  {
    id: 'ONE-01', item: 'One identity', asks: 'A single account across the student’s own devices, the institution’s SSO and every module.',
    rows: ['IAM-001', 'IAM-002', 'IAM-003'], standing: 'partial',
    evidence: [
      { path: 'supabase/identity-provisioning.check.sql', shows: 'SAML membership bound to the account by the institution, not guessed' },
      { path: 'app/src/lib/cloud.ts', shows: 'one Supabase account behind every synced row' },
    ],
    gap: 'Institution SSO is tested against no real identity provider; the LTI arrival links to the same account, and MFA for privileged roles is designed only.',
  },
  {
    id: 'ONE-02', item: 'One student profile', asks: 'One profile the student edits once and every module reads.',
    rows: ['IAM-002', 'STU-011'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/profile.ts', shows: 'the profile record' },
      { path: 'app/src/lib/mecontrols.ts', shows: 'the one control surface under Me: what Semester knows, who sees it, how to change either' },
    ],
    gap: 'Career, athletics and community each hold profile fields of their own; the student edits them in three places.',
  },
  {
    id: 'ONE-03', item: 'One calendar', asks: 'Every deadline, class, appointment and event on one calendar, from the syllabus, the school and the student.',
    rows: ['STU-010', 'INT-011'], standing: 'built',
    evidence: [
      { path: 'app/src/screens/calendar-source.test.ts', shows: 'every source of a calendar entry named and labelled' },
      { path: 'app/src/lib/subscribe.ts', shows: 'the outbound feed with its staleness rule' },
    ],
    gap: 'Club events and office hours reach the calendar only when the student adds them.',
  },
  {
    id: 'ONE-04', item: 'One action system', asks: 'One ranked list of what to do next, with its reason, across every module.',
    rows: ['STU-001', 'STU-002'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/actions.test.ts', shows: 'rank(): the most important action, the next three, the rest, each with an explanation' },
      { path: 'app/src/components/TodayActionCenter.test.tsx', shows: 'the Action Center on Today, behind its flag' },
    ],
    gap: 'The Action Center is behind a flag that is off in production; office actions, help requests and shares have lists of their own.',
  },
  {
    id: 'ONE-05', item: 'One search experience', asks: 'One search over everything the student holds, ranked one way.',
    rows: ['STU-009'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/find.ts', shows: 'one ranker over records, on the device (ADR 0006)' },
      { path: 'app/src/components/Command.tsx', shows: 'the command palette' },
    ],
    gap: 'Campus places, people and the support directory are searched by their own screens.',
  },
  {
    id: 'ONE-06', item: 'One notification center', asks: 'Every notice through one engine with an owner, a preference, a cap and a way out.',
    rows: ['STU-001'], standing: 'built',
    evidence: [
      { path: 'app/src/lib/notify.test.ts', shows: 'tiers, the cap per tier and the “why” line on every reminder' },
      { path: 'app/src/donotbuild.test.ts', shows: 'only three files may create a notification' },
    ],
    gap: 'Institutional notices arrive in the Notices hub, which is a channel rather than a notification; the cap does not count them.',
  },
  {
    id: 'ONE-07', item: 'One source-of-truth pattern', asks: 'Every fact carries where it came from, how fresh it is, and what scope it is shared in.',
    rows: ['TRUST-001', 'TRUST-002', 'TRUST-003', 'TRUST-004'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/source.test.ts', shows: 'the five source labels; only a school system may say institution_verified' },
      { path: 'app/src/components/SourceBadge.test.tsx', shows: 'the badge that shows a label' },
      { path: 'app/src/lib/integration/freshness.ts', shows: 'freshness classes for synced records' },
    ],
    gap: 'Freshness and privacy scope are not on every surface a fact appears on; estimates are labelled in some places and not others.',
  },
  {
    id: 'ONE-08', item: 'One accessibility workspace', asks: 'The student’s own accessibility settings, chosen once, following them to every device and module — never inferred.',
    rows: ['A11Y-004', 'UX-002'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/accessmode.ts', shows: 'presets over the look keys and four modes, never switched on for somebody' },
      { path: 'app/src/components/AccessModes.tsx', shows: 'the one place to set them' },
    ],
    gap: 'Accommodations in the LMS are building (LMS-009) and do not read the workspace; generated content is not checked against it.',
  },
  {
    id: 'ONE-09', item: 'One data-agency center', asks: 'One place to see what is held, who can see it, and to export, share, revoke or delete.',
    rows: ['STU-011', 'UOS-007'], standing: 'built',
    evidence: [
      { path: 'app/src/components/TrustCenter.test.tsx', shows: 'active and past shares, revocation, export and deletion in one place' },
      { path: 'app/src/lib/privacy.test.ts', shows: 'the disclosure kept true to what syncs' },
    ],
    gap: 'One Sharing list across the three share tables is designed (D-037) and not built; a FERPA exception cannot be recorded.',
  },
  {
    id: 'ONE-10', item: 'One support-routing experience', asks: 'Any question routes to the right official office with only what the student chose to send.',
    rows: ['STU-012'], standing: 'built',
    evidence: [
      { path: 'app/src/lib/help-routes.test.ts', shows: 'nine needs, each to a destination; nothing sent until ticked; two destinations directory-only' },
      { path: 'app/src/lib/nowrongdoor.test.ts', shows: 'a sentence in the student’s own words is matched to a door, wellbeing first, and nothing typed is stored' },
      { path: 'app/src/components/GetHelp.test.tsx', shows: 'the preview before anything leaves' },
    ],
    gap: 'A referral has no status the student can track after it leaves; the basic-needs navigator routes and does not hand off.',
  },
  {
    id: 'ONE-11', item: 'One AI governance model', asks: 'Every model call under one policy, one provider registry and one kill switch.',
    rows: ['AI-001', 'AI-006', 'AI-012'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/aikillswitch.test.ts', shows: 'both runtimes read kill.ai_generation; an unreadable switch is thrown' },
      { path: 'app/src/lib/toolkit/policy.ts', shows: 'assignment over course over school over university' },
      { path: 'supabase/intelligence-policy.check.sql', shows: 'a provider usable only once the institution approved it and a budget' },
    ],
    gap: 'The student’s own key on their own device is outside the switch by design; no evaluation set exists; the AI use policy a student reads is not started.',
  },
  {
    id: 'ONE-12', item: 'One integration gateway', asks: 'Every institutional system through one gateway with one contract, one journal and one health view.',
    rows: ['INT-001', 'INT-014'], standing: 'partial',
    evidence: [
      { path: 'packages/institution/src/index.ts', shows: 'the transport contract every adapter implements' },
      { path: 'app/server/institution/journal.ts', shows: 'the two-phase journal: never twice, never on a timer' },
      { path: 'app/src/lib/integration/catalog.ts', shows: 'the catalog of connectors' },
    ],
    gap: 'The adapter registry is deliberately empty; no connector has synced a real institution.',
  },
  {
    id: 'ONE-13', item: 'One Operations Console', asks: 'One console for the company’s own operations: approvals, evidence, incidents, tenants.',
    rows: ['IAM-010', 'IAM-011'], standing: 'held',
    evidence: [
      { path: 'docs/DO-NOT-BUILD.md', shows: 'rule 1: no new top-level navigation; the school-side tools live under university' },
      { path: 'docs/DECISION-LOG.md', shows: 'D-110: the console’s controls are data before the console; the console map stays missing until there is one' },
    ],
    gap: 'Its controls are written (ops/operations-console/); the console would live under an existing root, and none exists.',
  },
];

// ── The crucial rule: shared services ────────────────────────────────────────

export const SHARED_RULE = 'No module may create its own identity, permissions, notifications, audit log, source model, data-retention behaviour or visual system. It uses the shared platform services.';

export interface Shared {
  service: string;
  held: 'mechanical' | 'review';
  holders: readonly Evidence[];
}

export const SHARED: readonly Shared[] = [
  { service: 'Identity', held: 'mechanical', holders: [{ path: 'supabase/rls-coverage.check.sql', shows: 'every table is under RLS keyed to auth.uid(); a module cannot invent a second identity' }] },
  { service: 'Permissions', held: 'mechanical', holders: [{ path: 'supabase/capabilities.check.sql', shows: 'least privilege by capability, granted and audited in one place' }, { path: 'app/src/lib/rolelaunch.test.ts', shows: 'no internal role holds a student-record capability' }] },
  { service: 'Notifications', held: 'mechanical', holders: [{ path: 'app/src/donotbuild.test.ts', shows: 'rule 4: only lib/notify.ts, Ringing.tsx and the service worker may create a notification' }] },
  { service: 'Audit log', held: 'review', holders: [{ path: 'supabase/migrations/20260928320000_audit_correlation_and_outbox.sql', shows: 'one audit shape with a correlation id (ADR 0010); older modules keep their own audit tables' }] },
  { service: 'Source model', held: 'mechanical', holders: [{ path: 'app/src/lib/source.test.ts', shows: 'five labels, and institution_verified only from a school system' }] },
  { service: 'Data retention', held: 'mechanical', holders: [{ path: 'app/src/lib/retention.test.ts', shows: 'a new table with no retention answer fails the build' }] },
  { service: 'Visual system', held: 'mechanical', holders: [{ path: 'app/src/styles/rules.ts', shows: 'the style audit: no custom button, card, modal or palette' }, { path: 'app/src/lib/contrast.test.ts', shows: 'every ground walked for both faded rungs' }] },
];

// ── The five layers, and the disruption they answer ─────────────────────────

export const LAYERS: readonly { layer: string; holds: string; domains: readonly string[] }[] = [
  { layer: 'Student experience', holds: 'Today, the plan, calendar and actions, courses, Study Studio, work completion, grades, portfolio, career, community, support, transfer, notices, search, Me.', domains: ['STU', 'UOS', 'UX'] },
  { layer: 'Academic and learning', holds: 'Course workspaces, the source library, assignments, submission, assessment, rubrics, gradebook, feedback, accessible delivery, course AI policy, outcomes.', domains: ['LMS', 'MIG'] },
  { layer: 'Institutional experience', holds: 'Service content operations, advisor and faculty tools, handoffs, transfer and career workflows, club operations, communications, policy publishing, AI policy configuration, freshness and ownership, aggregate friction.', domains: ['UOS', 'IMP', 'SUP'] },
  { layer: 'Trust and governance', holds: 'Identity and SSO, roles, consent, source/scope/status, retention and holds, AI policy and evaluations, accessibility evidence, audit and incidents, integration health, contracts and commitments.', domains: ['IAM', 'TRUST', 'SEC', 'LEG', 'A11Y', 'AI'] },
  { layer: 'Platform and operations', holds: 'Tenants, entitlements, billing, implementation, the integration gateway, flags, monitoring, support, incident and status operations, the evidence register, the customer trust view, analytics.', domains: ['PRG', 'INT', 'SRE', 'COM'] },
];

export interface Disruption {
  reality: string;
  standard: string;
  rows: readonly string[];
}

export const DISRUPTION: readonly Disruption[] = [
  { reality: 'Separate portals for every office', standard: 'One student-facing action layer', rows: ['STU-001', 'STU-002'] },
  { reality: 'LMS separated from planning and support', standard: 'Coursework, planning, feedback and help connected', rows: ['LMS-002', 'STU-010', 'STU-012'] },
  { reality: 'The student must know which office owns a problem', standard: 'No Wrong Door support routing', rows: ['STU-012'] },
  { reality: 'Course content is a file repository', standard: 'A source-aware, accessible learning workspace', rows: ['LMS-003', 'AI-004', 'AI-005'] },
  { reality: 'AI is inconsistent and ungoverned', standard: 'Course- and institution-controlled AI with visible limits', rows: ['AI-006', 'AI-008', 'AI-012'] },
  { reality: 'Grades appear without explanatory context', standard: 'Rubric-linked, source-aware, reviewable feedback and grade history', rows: ['LMS-006', 'LMS-013', 'LMS-014'] },
  { reality: 'Clubs and events are separate from student goals', standard: 'Participation becomes optional evidence and opportunity discovery', rows: ['UOS-003', 'UOS-004'] },
  { reality: 'Career systems ignore academic projects', standard: 'A student-controlled skills and evidence graph', rows: ['UOS-004', 'UOS-007'] },
  { reality: 'Accessibility is retrofitted', standard: 'Accessibility preferences and alternatives are native', rows: ['A11Y-004', 'A11Y-005', 'A11Y-006'] },
  { reality: 'IT receives one-off integration requests', standard: 'One standards-first integration gateway', rows: ['INT-001', 'INT-002', 'INT-009'] },
  { reality: 'Privacy and security are procurement blockers', standard: 'Trust and governance are platform features', rows: ['SEC-013', 'COM-003', 'PRG-002'] },
  { reality: 'Student data is scattered and opaque', standard: 'Data agency, consent, sharing, export and audit controls', rows: ['STU-011', 'UOS-007', 'TRUST-003'] },
  { reality: 'Institutions are locked into disconnected vendors', standard: 'Modular adoption, documented export and interoperable standards', rows: ['LEG-004', 'INT-006', 'INT-007'] },
];

// ── The fourteen plays ───────────────────────────────────────────────────────

export const PLAYS: readonly Item[] = [
  {
    id: 'PL-01', item: 'Make adoption radically easy: the Semester Launch System',
    asks: 'Week 0 readiness, weeks 1–4 setup, weeks 5–8 pilot, weeks 9–12 scale decision, with eleven artifacts.',
    rows: ['IMP-001', 'SUP-003'], standing: 'built',
    evidence: [
      { path: 'app/src/lib/launch/ninety-day.test.ts', shows: 'three windows of thirty days, every item with an owner and evidence, none before its prerequisites' },
      { path: 'docs/operating-model/PILOT-TO-PRODUCTION.md', shows: 'the lifecycle from pilot to production, with the tenant_rollout states' },
    ],
    gap: 'The programme exists as items; no institution has run it. The Launch Center screen is building (IMP-001).',
  },
  {
    id: 'PL-02', item: 'Replace work, not just interfaces',
    asks: 'A before/after workflow for each of eight stakeholders, showing time saved or friction removed for their own team.',
    rows: ['PRG-002'], standing: 'not-built',
    evidence: [{ path: 'docs/ROLE-LAUNCH-REGISTER.md', shows: 'what each role can do today, by row, which is the material a before/after would be written from' }],
    gap: 'No before/after workflow is written for any stakeholder. The role register says what exists; it does not say what it replaced.',
  },
  {
    id: 'PL-03', item: 'A measurable Academic Friction Index',
    asks: 'Nine questions measured by institution and in aggregate, baseline to pilot to plan; friction of the system, never deficiency of the student.',
    rows: ['UOS-008'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/ops/firstyear.test.ts', shows: 'twenty-four measures, each with its source or the statement that none exists' },
      { path: 'app/src/lib/clarity.ts', shows: 'the one survey question: did this help you understand what to do next?' },
    ],
    gap: 'Seven of the nine questions have a measure; none has been read for an institution. See the table below.',
  },
  {
    id: 'PL-04', item: 'No Wrong Door as a real service layer',
    asks: 'Eight student situations, each routed to the official owner with only safe clarifying questions, a handoff packet the student chooses to share, a tracked referral status, and escalation.',
    rows: ['STU-012'], standing: 'built',
    evidence: [
      { path: 'app/src/lib/nowrongdoor.test.ts', shows: 'describe the problem in your own words and be sent to the right door; crisis wording routes to counseling first; NEVER is printed with every door' },
      { path: 'app/src/lib/help-routes.ts', shows: 'nine needs to a destination each; nothing sent until ticked; NEVER_SENT lists what never goes' },
      { path: 'app/src/lib/basicneeds.ts', shows: 'seventeen categories read against the support directory' },
    ],
    gap: 'Five of eight situations reach a door by the router’s own match, read by the test; none has a tracked referral status after it leaves. See the table below.',
  },
  {
    id: 'PL-05', item: 'Accessibility as a product advantage',
    asks: 'A personal accessibility workspace, accessible creation and source cards, keyboard-first flows, screen-reader gates, accessible math and tables, plain-language and focus modes, issue reporting, a public changelog.',
    rows: ['A11Y-001', 'A11Y-004', 'A11Y-006', 'A11Y-007'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/accessmode.ts', shows: 'the workspace: presets and four modes, never inferred' },
      { path: 'app/src/a11y/axe.test.tsx', shows: 'axe-core over the rendered app' },
      { path: 'docs/WCAG-UI-AUDIT-SCORECARD.md', shows: 'every component scored, every score citing its test' },
    ],
    gap: 'No manual assistive-technology pass, no ACR, no public issue route, no changelog; generated content is unchecked (GA-01 to GA-03).',
  },
  {
    id: 'PL-06', item: 'The safest campus AI platform: a Campus AI Control Center',
    asks: 'Approved providers, tenant and course policy, classification rules, authorized sources, a model inventory, evaluations, incidents, cost controls, feedback, kill switches, student-facing transparency.',
    rows: ['AI-001', 'AI-002', 'AI-006', 'AI-011', 'AI-012', 'AI-013'], standing: 'partial',
    evidence: [
      { path: 'supabase/intelligence-policy.check.sql', shows: 'providers, budgets and approved sources per institution' },
      { path: 'app/src/lib/aikillswitch.test.ts', shows: 'the kill switch every generator reads' },
      { path: 'app/src/components/institutional/ControlPlane.tsx', shows: 'the institution’s control plane, preview-only' },
    ],
    gap: 'Each of the eleven items rests on a master row and none is above tested; evaluations, incidents and the student-facing AI policy are building or designed. See the table below.',
  },
  {
    id: 'PL-07', item: 'Own the source-freshness problem: Campus Knowledge Operations',
    asks: 'Every published resource with owner, source, audience, review dates, expiry, accessibility and translation status, policy version, related workflow, search demand, broken links and reported issues; then the stale, the unanswered and the unmaintained surfaced.',
    rows: ['TRUST-002', 'UOS-001'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/source.ts', shows: 'the five source labels a resource carries' },
      { path: 'app/src/lib/integration/freshness.ts', shows: 'freshness classes and their text' },
      { path: 'app/src/lib/official-notices.ts', shows: 'what the school shared, as messages with freshness' },
    ],
    gap: 'Four of thirteen fields exist; none of the seven signals is surfaced. See the table below.',
  },
  {
    id: 'PL-08', item: 'Make procurement unusually easy: procurement in a day',
    asks: 'Thirteen artifacts, accurate first, in one room.',
    rows: ['COM-003', 'SEC-013'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/trustroom.test.ts', shows: 'the NDA room: named reviewer, expiring link, every read recorded' },
      { path: 'docs/trust/COMPLIANCE-CROSSWALK.md', shows: 'the twenty artifacts a critical-tier vendor owes and what Semester could hand over today' },
    ],
    gap: 'Three artifacts exist, nine are drafts, eight do not exist; the crosswalk page counts them, and the critical tier (grade passback) adds an impact assessment, legal review and executive risk acceptance that nothing carries. A day is possible when the drafts are in force.',
  },
  {
    id: 'PL-09', item: 'Promise portability and prove it',
    asks: 'Student exports, customer exports in documented formats, QTI 3 export, LTI and OneRoster, documented APIs and webhooks, migration support, an offboarding plan, no export fee, no hidden dependency on proprietary AI memory.',
    rows: ['LEG-004', 'INT-007', 'INT-013'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/export.test.ts', shows: 'CSV, Markdown and ICS exports of everything the student holds' },
      { path: 'app/src/lib/workspace-backup.test.ts', shows: 'a whole workspace backed up and restored' },
    ],
    gap: 'Eight of ten promises have a file behind them; QTI export and the customer export have none, and the offboarding plan is written, not built. See the table below.',
  },
  {
    id: 'PL-10', item: 'A Trust Evidence product',
    asks: 'A live, safe customer view: enabled modules, integration health, the data map, AI policy, accessibility status, audit and export activity, support and SLA status, maintenance, release impact, known limitations, contract alignment.',
    rows: ['SEC-013', 'INT-014', 'COM-003'], standing: 'built',
    evidence: [
      { path: 'app/src/lib/trustdashboard.test.ts', shows: 'the twelve rows an institution sees, every one derived from what the app knows about itself; an absence said plainly; usage suppressed under n = 10' },
      { path: 'app/src/components/institutional/TrustDashboard.tsx', shows: 'the view, under the institution’s control plane' },
      { path: 'app/src/lib/ops/commitments.ts', shows: 'the customer commitment register' },
    ],
    gap: 'The data exists for ten of eleven panels and the dashboard renders them; audit and export activity has no row, and no institution is connected for it to show. See the table below.',
  },
  {
    id: 'PL-11', item: 'The Semester Standard',
    asks: 'A public, measurable benchmark of ten lines, with an annual scorecard that discloses shortcomings.',
    rows: ['PRG-002', 'TRUST-001'], standing: 'built',
    evidence: [
      { path: 'app/src/lib/standard.test.ts', shows: 'the eleven public commitments of /semester-standard/, each with what holds it and the gap disclosed on the page' },
      { path: 'app/src/lib/ops/claims.test.ts', shows: 'every public claim carries a register word and is refused above its rows' },
    ],
    gap: 'Ten of ten lines are carried by a commitment of the public standard, read by the test; no annual scorecard has been published. See the table below.',
  },
  {
    id: 'PL-12', item: 'A research and practitioner organization',
    asks: 'Eight public assets that help universities before they buy: an annual friction index, an AI policy canvas, an accessible assessment toolkit, playbooks and a maturity model.',
    rows: [], standing: 'partial',
    evidence: [
      { path: 'app/src/site/render.tsx', shows: '/research/ (the Friction Index with its method set before its data, the design-partner council) and /resources/ai-governance-canvas/' },
      { path: 'docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', shows: 'the research practice, as a process nobody yet runs' },
    ],
    gap: 'Two of the eight assets have a public page: a method and a canvas, no data and no partners. The proof policy forbids a number without a measurement behind it.',
  },
  {
    id: 'PL-13', item: 'A design-partner network',
    asks: 'Nine kinds of institution recruited deliberately, with structured influence: a paid or discounted pilot, baseline and success measures, named sponsors, co-design, accessibility and security review, quarterly evidence review, a case study only with approval.',
    rows: ['SUP-003', 'COM-002'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/gtm/pilot.ts', shows: 'pilot readiness, the buying committee, the decision log, and the verdict' },
      { path: 'app/src/lib/beta.ts', shows: 'the private beta: invitations each accepted by the person' },
    ],
    gap: 'No design partner exists and no institution has been recruited; the site is forbidden from saying otherwise (D-110). See the table below.',
  },
  {
    id: 'PL-14', item: 'Win through implementation, not just sales',
    asks: 'Twelve implementation elements from an executive alignment workshop to an annual maturity assessment, built into the commercial model.',
    rows: ['IMP-001', 'SUP-003', 'COM-002'], standing: 'partial',
    evidence: [
      { path: 'docs/operating-model/CHANGE-MANAGEMENT.md', shows: 'the change path, the stakeholder map, the adoption tools and the readiness score with its pilot threshold' },
      { path: 'app/src/lib/launch/ninety-day.ts', shows: 'training, communications, hypercare and the ninety-day review as items with owners' },
    ],
    gap: 'Nine of twelve elements are written; none is priced in the deal desk, and no institution has been through any.',
  },
];

// ── The stakeholder table ────────────────────────────────────────────────────

export const STAKEHOLDERS: readonly { who: string; eliminate: string }[] = [
  { who: 'Students', eliminate: 'Searching across portals, unclear next steps, missed deadlines, inaccessible materials, uncertainty about where to get help.' },
  { who: 'Faculty', eliminate: 'Repeated “where do I find this?” questions, manual course setup, unclear AI-policy communication, disconnected feedback workflows.' },
  { who: 'Advisors', eliminate: 'Reconstructing student context across systems, repetitive meeting preparation, unclear referrals.' },
  { who: 'Student affairs', eliminate: 'Stale club and service directories, manual officer transitions, scattered event and referral workflows.' },
  { who: 'IT', eliminate: 'One-off integrations, ungoverned AI tools, unmanaged data exports, unclear vendor controls.' },
  { who: 'Accessibility teams', eliminate: 'Late-stage remediation, inaccessible student workflows, nonstandard content authoring.' },
  { who: 'Security and privacy teams', eliminate: 'Opaque data use, uncontrolled staff access, unexplained AI providers, impossible audit requests.' },
  { who: 'Executives', eliminate: 'A fragmented student experience, unprovable value, costly duplicate tools, low adoption.' },
];

// ── The Academic Friction Index, against the first-year measures ─────────────

export const FRICTION_RULE = 'Measure the system’s friction, not the student’s deficiency. No secret student-risk score, ever.';

export const FRICTION: readonly { question: string; measure: string | null; note: string }[] = [
  { question: 'Can students find an official answer?', measure: 'trust-comprehension', note: 'Whether the student could say where each fact came from is the usability study’s question; the source label is the mechanism.' },
  { question: 'Can they identify the next action?', measure: 'path-clarity', note: 'The one survey question under the Action Center: did this help you understand what to do next?' },
  { question: 'Can they complete a core workflow without support?', measure: 'meaningful-actions', note: 'Actions completed, not screens opened; the golden path is the workflow.' },
  { question: 'Can they distinguish official information from estimates?', measure: 'trust-comprehension', note: 'The same usability study, asked of an estimate and of a verified fact.' },
  { question: 'Can they use the workflow with keyboard, screen reader, zoom and mobile?', measure: 'a11y-task-success', note: 'Success at a workflow with assistive technology; no reading has been taken.' },
  { question: 'Can they recover from a mistake?', measure: null, note: 'Undo, restore and TypeToConfirm exist (DO-NOT-BUILD rule 11); nothing measures a recovery.' },
  { question: 'Can they find the right human office?', measure: null, note: 'Help routes to nine needs; whether the student reached a person is not recorded.' },
  { question: 'Can staff maintain accurate, accessible information?', measure: 'integration-freshness', note: 'Freshness of synced records is measured for connectors; staff-maintained pages have no measure.' },
  { question: 'Can the institution see its own friction?', measure: 'implementation-time', note: 'Time to implement is the only institutional friction figure defined.' },
];

// ── No Wrong Door, against the help routes ───────────────────────────────────

/** The eight situations, each with the door the router’s own `match()` returns — the test reads it, so this cannot drift from the code. */
export const STUDENT_SAYS: readonly { says: string; need: string | null; route: string }[] = [
  { says: 'I cannot register.', need: 'registration', route: 'Registration Center and the registrar route' },
  { says: 'I need help paying for school.', need: 'money', route: 'Financial aid, directory-only: nothing is sent' },
  { says: 'I am overwhelmed by this class.', need: 'wellbeing', route: 'Counseling first — “overwhelmed” is matched before the class is; the router says why' },
  { says: 'I need a study room.', need: null, route: 'Rooms and spaces on the campus screens; not a help route' },
  { says: 'I need help with housing.', need: null, route: 'The housing screen; not a help route' },
  { says: 'I want an internship.', need: 'career', route: 'Career services' },
  { says: 'I am transferring.', need: 'registration', route: 'The registrar’s door; the transfer hub is designed and not built' },
  { says: 'I do not know who to ask.', need: null, route: 'No match: every door is listed rather than one guessed' },
];

export const BEHAVIOURS: readonly { behaviour: string; path: string | null; note: string }[] = [
  { behaviour: 'Asks only safe clarifying questions', path: 'app/src/lib/nowrongdoor.ts', note: 'It never decides, and NEVER is printed with every door; NEVER_SENT lists what never leaves.' },
  { behaviour: 'Identifies the official or appropriate owner', path: 'app/src/lib/nowrongdoor.ts', note: 'A sentence is matched to one of nine doors, wellbeing first; two are directory-only.' },
  { behaviour: 'Shows source-labelled next actions', path: 'app/src/lib/source.ts', note: 'The labels exist; a help route’s answer is not yet labelled.' },
  { behaviour: 'Prepares a concise handoff packet', path: 'app/src/lib/nowrongdoor.ts', note: 'summary(): built from the sentence alone, nothing the app added about the student; preview() shows every line before it is sent.' },
  { behaviour: 'Lets the student choose whether to share', path: 'app/src/components/GetHelp.tsx', note: 'Nothing leaves until ticked and confirmed.' },
  { behaviour: 'Tracks only operational referral status', path: null, note: 'Only the registration handoff has one (`app/src/lib/handoff-status.ts`), as the student’s own report on their device. A help request keeps its own statuses; aid and accessibility are directory-only and have none. The office’s reply is not read back.' },
  { behaviour: 'Provides recovery and escalation', path: 'docs/CAMPUS-ESCALATION-POLICY.md', note: 'The escalation policy is written; no screen offers it.' },
];

// ── The Launch System, against the ninety-day programme ─────────────────────

export const LAUNCH_SYSTEM: readonly { window: string; asks: string; tasks: readonly string[] }[] = [
  { window: 'Week 0', asks: 'Readiness assessment, stakeholders, data map, security and accessibility review, baseline friction measurement, success criteria.', tasks: ['icp-cohort', 'data-inventory', 'launch-metrics', 'a11y-core'] },
  { window: 'Weeks 1–4', asks: 'SSO, branding, core content, support routes, limited integrations, staff training, student communications, pilot setup.', tasks: ['tenant-flags', 'identity', 'content-loaded', 'training', 'comms'] },
  { window: 'Weeks 5–8', asks: 'Pilot with a cohort, feedback, accessibility testing, integration reconciliation, remediation, adoption measurement.', tasks: ['launch-cohort', 'hypercare', 'track', 'fix-friction'] },
  { window: 'Weeks 9–12', asks: 'Scale decision, implementation plan, department rollout, change management, executive value review, renewal and expansion plan.', tasks: ['midpoint-report', 'annual-proposal', 'quotes'] },
];

export const DELIVERABLES: readonly { deliverable: string; path: string | null }[] = [
  { deliverable: 'Implementation workbook', path: 'docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md' },
  { deliverable: 'Named customer-success owner', path: null },
  { deliverable: 'Integration capability map', path: 'app/src/lib/integration/catalog.ts' },
  { deliverable: 'Data-flow diagram', path: 'docs/ARCHITECTURE.md' },
  { deliverable: 'Accessibility acceptance record', path: null },
  { deliverable: 'AI policy configuration', path: 'docs/market-readiness/AI_GOVERNANCE.md' },
  { deliverable: 'Campus communications kit', path: 'docs/launch/ANNOUNCEMENT-TEMPLATES.md' },
  { deliverable: 'Faculty and advisor quick-start guides', path: 'docs/launch/FIRST-DAY-CHECKLISTS.md' },
  { deliverable: 'Student onboarding sequence', path: 'docs/launch/STUDENT-QUICK-START.md' },
  { deliverable: 'Support escalation directory', path: 'docs/CAMPUS-ESCALATION-POLICY.md' },
  { deliverable: 'Pilot outcome scorecard', path: 'app/src/lib/gtm/pilot.ts' },
];

// ── The Campus AI Control Center ─────────────────────────────────────────────

export const AI_CONTROL_CENTER: readonly { item: string; rows: readonly string[] }[] = [
  { item: 'Approved models and providers', rows: ['AI-002'] },
  { item: 'Tenant and course policy controls', rows: ['AI-006'] },
  { item: 'Prompt and data classification rules', rows: ['AI-007', 'AI-010'] },
  { item: 'Authorized source libraries', rows: ['AI-004'] },
  { item: 'Model and version inventory', rows: ['AI-002'] },
  { item: 'Evaluations and red-team evidence', rows: ['AI-011'] },
  { item: 'Safety incidents', rows: ['AI-014'] },
  { item: 'Usage and cost controls', rows: ['AI-003'] },
  { item: 'User feedback', rows: ['AI-013'] },
  { item: 'Feature rollout and kill switches', rows: ['AI-012', 'PRG-007'] },
  { item: 'Student-facing AI transparency', rows: ['AI-008', 'AI-013'] },
];

// ── Knowledge Operations ─────────────────────────────────────────────────────

export const KNOWLEDGE_FIELDS: readonly { field: string; carried: string | null }[] = [
  { field: 'Owner', carried: null },
  { field: 'Source', carried: 'source_label on every expansion table (lib/source.ts)' },
  { field: 'Audience', carried: null },
  { field: 'Last reviewed date', carried: 'verified_at on an EvidenceReference (intelligence/contracts.ts)' },
  { field: 'Next review date', carried: null },
  { field: 'Expiry', carried: 'expires_at on shares and grants; not on a resource' },
  { field: 'Accessibility status', carried: null },
  { field: 'Translation status', carried: null },
  { field: 'Policy version', carried: 'policy_version on consent_record and ai_policy' },
  { field: 'Related workflow', carried: null },
  { field: 'Search demand', carried: null },
  { field: 'Broken-link status', carried: null },
  { field: 'Student-reported issues', carried: null },
];

export const KNOWLEDGE_SIGNALS: readonly string[] = [
  'Information at risk of becoming stale',
  'High-search, no-answer questions',
  'Frequently failed handoffs',
  'Broken official links',
  'Content missing accessible formats',
  'Services with long response times',
  'Pages nobody maintains',
];

// ── Portability ──────────────────────────────────────────────────────────────

export const PORTABILITY: readonly { promise: string; path: string | null; note: string }[] = [
  { promise: 'Student-controlled eligible exports', path: 'app/src/lib/export.ts', note: 'CSV, Markdown and ICS, plus the whole-workspace backup.' },
  { promise: 'Customer data export in documented formats', path: null, note: 'No institutional export; the student’s is the only one.' },
  { promise: 'QTI 3 assessment export', path: null, note: 'Designed (INT-007).' },
  { promise: 'LTI and OneRoster standards support', path: 'app/src/lib/ltikey.test.ts', note: 'LTI 1.3 launch, deep linking and grade services; OneRoster not started (INT-006).' },
  { promise: 'Documented APIs and webhooks', path: 'app/src/lib/interop.ts', note: 'Scopes and the standards register; the public integration registry prints each row’s claim word; webhooks building (INT-013).' },
  { promise: 'Integration data maps', path: 'docs/INTEGRATION-DATA-PIPELINE-AUDIT.md', note: 'Per connector, as an audit rather than a customer map.' },
  { promise: 'Migration support', path: 'docs/DATA-MIGRATION-PLAN.md', note: 'Designed (MIG-001 to MIG-006).' },
  { promise: 'An offboarding plan', path: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', note: 'Written; the institutional path is not built (FERPA-7).' },
  { promise: 'No punitive export fee', path: 'docs/DECISION-LOG.md', note: 'D-009: export, deletion and saved plans are never paywalled.' },
  { promise: 'No hidden dependency on proprietary AI memory', path: 'app/src/lib/aihandoff.ts', note: 'Nothing is read back from an outside AI service; the assistant’s history is the student’s to delete.' },
];

// ── Trust Evidence: the customer view ────────────────────────────────────────

/** The memo’s eleven panels against the twelve rows of `trustdashboard.ts`, which derives every row from what the app knows about itself. */
export const TRUST_EVIDENCE: readonly { panel: string; path: string | null }[] = [
  { panel: 'Enabled modules and entitlements', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'Integration health and freshness', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'Current data-map configuration', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'AI policy configuration', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'Accessibility status and remediation tracker', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'Audit and export activity', path: null },
  { panel: 'Support and SLA status', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'Planned maintenance', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'Release-impact notices', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'Known limitations', path: 'app/src/lib/trustdashboard.ts' },
  { panel: 'Contract commitment alignment', path: 'app/src/lib/ops/commitments.ts' },
];

// ── The Semester Standard ────────────────────────────────────────────────────

/**
 * The memo’s ten lines, each pointed at the commitment of the public Semester
 * Standard (`app/src/lib/standard.ts`, printed at /semester-standard/) that
 * carries it. That register is the authoritative version and holds each
 * commitment to the tree with its own status; this table only says which of
 * its lines answers which of the memo’s. The test checks every id exists.
 */
export const STANDARD: readonly { line: string; commitment: string | null; path: string | null; how: string }[] = [
  { line: 'Every critical fact has a source.', commitment: 'source', path: 'app/src/lib/source.test.ts', how: 'Five labels; only a school system says institution_verified.' },
  { line: 'Every estimate has a limitation.', commitment: 'estimate', path: 'app/src/components/NotOfficial.tsx', how: 'The not-official notice; the public tools label their results estimated.' },
  { line: 'Every high-impact action is reviewable.', commitment: 'audit', path: 'app/server/institution/journal.ts', how: 'No consequential write without exact review and confirmation; never twice.' },
  { line: 'Every student can control eligible sharing.', commitment: 'share', path: 'app/src/components/TrustCenter.test.tsx', how: 'Shares listed, revocable, expiring.' },
  { line: 'Every critical flow is accessible.', commitment: 'keyboard', path: 'app/scripts/accessibility-smoke.mjs', how: 'The critical journeys in a real browser; no manual pass yet.' },
  { line: 'Every AI use has a policy and an explanation.', commitment: 'ai-context', path: 'app/src/lib/governance/ai-lifecycle.ts', how: 'The quality line under every reply; the gates; the student-facing AI policy is not started.' },
  { line: 'Every integration shows data scope and health.', commitment: 'integration-health', path: 'app/src/lib/integration/catalog.ts', how: 'Scope per connector; health is building (INT-014).' },
  { line: 'Every customer can export and offboard.', commitment: 'export', path: null, how: 'The student can; the customer path is written, not built.' },
  { line: 'Every public claim has evidence.', commitment: 'evidence', path: 'app/src/lib/ops/claims.test.ts', how: 'A claim above its rows fails the build.' },
  { line: 'Every incident has an accountable communication path.', commitment: 'incident', path: 'app/src/lib/governance/incident-comms.ts', how: 'A notice per audience with required sections; never exercised.' },
];

export const ASSETS: readonly { asset: string; path: string | null; note: string }[] = [
  { asset: 'Annual Academic Friction Index', path: 'app/src/site/render.tsx', note: '/research/: the method, set before its data; no reading has been taken.' },
  { asset: 'Campus AI Policy Canvas', path: 'app/src/site/render.tsx', note: '/resources/ai-governance-canvas/: ten boxes an institution fills in before it turns on an assistant.' },
  { asset: 'Accessible Assessment Toolkit', path: null, note: 'Nothing.' },
  { asset: 'Transfer Student Navigation Playbook', path: null, note: 'The transfer hub is a design, not a public playbook.' },
  { asset: 'Basic-Needs Navigator Blueprint', path: null, note: 'The navigator is a design, not a public blueprint.' },
  { asset: 'Student Data Agency Toolkit', path: null, note: 'Nothing.' },
  { asset: 'Interoperability Maturity Model', path: 'docs/INTEROPERABILITY-ROADMAP.md', note: 'The standards in order with their claim words; not a maturity model an institution scores itself on.' },
  { asset: 'Semester Implementation Academy', path: null, note: 'Nothing.' },
];

export const PARTNER_TYPES: readonly string[] = [
  'Community college', 'Regional public university', 'Private university', 'Large research institution', 'HBCU', 'Hispanic-serving institution',
  'Online or hybrid institution', 'Disability-services leader', 'Transfer-intensive institution',
];

export const INFLUENCE: readonly { item: string; path: string | null }[] = [
  { item: 'A paid or discounted pilot', path: 'app/src/lib/governance/deal-desk.ts' },
  { item: 'A clear use case', path: 'app/src/lib/gtm/pilot.ts' },
  { item: 'Baseline and success measures', path: 'app/src/lib/gtm/pilot.ts' },
  { item: 'Named executive and operational sponsors', path: 'app/src/lib/gtm/pilot.ts' },
  { item: 'Student, faculty and staff co-design sessions', path: null },
  { item: 'Accessibility testing', path: 'docs/accessibility/AT-PASS-PROTOCOL.md' },
  { item: 'Security and privacy review', path: 'docs/SECURITY-ACCESSIBILITY-READINESS.md' },
  { item: 'Quarterly evidence review', path: 'docs/PROOF-CALENDAR.md' },
  { item: 'A published case study only with approval', path: 'app/src/lib/ops/claims.ts' },
];

export const IMPLEMENTATION: readonly { item: string; path: string | null }[] = [
  { item: 'Executive alignment workshop', path: null },
  { item: 'Campus journey map', path: 'docs/operating-model/CHANGE-MANAGEMENT.md' },
  { item: 'Stakeholder and governance map', path: 'docs/operating-model/CHANGE-MANAGEMENT.md' },
  { item: 'Technical readiness review', path: 'app/src/lib/readiness.ts' },
  { item: 'Data and integration plan', path: 'docs/market-readiness/INTEGRATION_READINESS.md' },
  { item: 'Role-based training', path: 'docs/launch/FIRST-DAY-CHECKLISTS.md' },
  { item: 'Faculty and student champion programme', path: null },
  { item: 'Communications calendar', path: 'docs/launch/ANNOUNCEMENT-TEMPLATES.md' },
  { item: 'Office hours', path: null },
  { item: 'Launch support', path: 'app/src/lib/launch/ninety-day.ts' },
  { item: 'Ninety-day adoption review', path: 'app/src/lib/launch/ninety-day.ts' },
  { item: 'Annual maturity assessment', path: 'docs/operating-model/OPERATIONAL-MATURITY.md' },
];

// ── The business model ───────────────────────────────────────────────────────

export interface RevenueLine {
  line: string;
  buyer: string;
  purchase: string;
  compounds: string;
  /** `proposed`: a line the deal desk could price; `held`: a decision on main keeps it out for now. */
  standing: 'proposed' | 'held';
  decisions: readonly string[];
  note: string;
}

export const REVENUE: readonly RevenueLine[] = [
  { line: 'Individual student plan', buyer: 'Student', purchase: 'Personal Academic OS: planning, study, work completion, portfolio', compounds: 'Bottom-up adoption and product learning', standing: 'held', decisions: ['D-009'], note: 'Plus is priced $7.99 a month or $59 a year (D-134) and its individual billing lifecycle was live-accepted on 2026-10-03 (docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md); checkout stays held by the governed acquisition control, and the price is not a public claim until approved. Export, deletion and saved plans are never paywalled.' },
  { line: 'Department or programme plan', buyer: 'Department, transfer center, advising, career office, student affairs', purchase: 'One module plus the governed student experience', compounds: 'Creates institutional champions', standing: 'proposed', decisions: [], note: 'The deal desk’s department floor is a proposed default; no price book exists.' },
  { line: 'Institution platform licence', buyer: 'University', purchase: 'The connected student, learning, community, support and governance platform', compounds: 'Expands modules and embeds shared infrastructure', standing: 'proposed', decisions: [], note: 'Campus and system floors proposed in the deal desk.' },
  { line: 'Enterprise implementation', buyer: 'IT, academic affairs, student success', purchase: 'SSO, integrations, migration, configuration, training, launch support', compounds: 'Reduces risk and speeds adoption', standing: 'proposed', decisions: [], note: 'An implementation fee floor is proposed; waivable only as capped pilot credit.' },
  { line: 'Native learning and assessment', buyer: 'Academic affairs, faculty, online learning', purchase: 'LMS, assessment, QTI, gradebook, feedback, accessible learning', compounds: 'Replaces fragmented academic tools', standing: 'proposed', decisions: [], note: 'D-1067 reopens this direction. The native gradebook is built; the complete LMS authoring and assessment surface and any institutional cutover remain incomplete.' },
  { line: 'AI governance and learning services', buyer: 'CIO, provost, IT, teaching and learning center', purchase: 'The Campus AI Control Center, policy, approved sources, evaluations', compounds: 'Meets a major emerging institutional need', standing: 'proposed', decisions: [], note: 'AI capacity and overage must be written into every order (deal desk).' },
  { line: 'Community and student-life operations', buyer: 'Student affairs, campus life', purchase: 'Clubs, events, mentorship, engagement, moderation', compounds: 'Extends daily student relevance', standing: 'proposed', decisions: [], note: 'No unmoderated marketplace or public feed (boundary).' },
  { line: 'Career and opportunity network', buyer: 'Career services, experiential learning', purchase: 'Portfolio, skills evidence, alumni and employer workflows, opportunities', compounds: 'Connects academic work to workforce outcomes', standing: 'proposed', decisions: [], note: 'Employers never receive student-level data (deal desk, marketplace rule).' },
  { line: 'Premium support and success', buyer: 'Institution', purchase: 'Dedicated support, training, implementation, advisory', compounds: 'Protects renewals and expands accounts', standing: 'proposed', decisions: [], note: 'No 24/7 or emergency response is promised (SUP-002 designed).' },
  { line: 'Approved payments and transactions', buyer: 'Institution or authorized campus unit', purchase: 'Ticketing, dues, approved payments', compounds: 'Later-stage transactional revenue', standing: 'held', decisions: ['D-009'], note: 'Campus payments, ticketing and dues stay out: no institutional or campus-transaction billing exists. Individual Plus billing is a separate line (D-134; accepted 2026-10-03).' },
  { line: 'Approved employer and partner services', buyer: 'Employers, partners, institutions', purchase: 'Verified events, office hours, opportunities — never student-data access', compounds: 'Expands the ecosystem without selling student data', standing: 'proposed', decisions: [], note: 'Sponsorship is a separate opt-in that reads nothing about the student (DO-NOT-BUILD rule 10).' },
];

// ── The lines not crossed ────────────────────────────────────────────────────

export interface Line {
  rule: string;
  /** A boundary id from `boundaries.ts`, a DO-NOT-BUILD rule number, or `proposed` when nothing holds it yet. */
  held: { boundary: string } | { rule: number } | { path: string } | 'proposed';
  note: string;
}

export const LINES: readonly Line[] = [
  { rule: 'Do not sell student data.', held: { boundary: 'data-sale' }, note: 'Mechanical: no ad or tracking host in the source.' },
  { rule: 'Do not sell access to hidden student behaviour.', held: { boundary: 'surveillance' }, note: 'No unapproved proctoring or surveillance.' },
  { rule: 'Do not charge students for essential privacy, export, safety or support access.', held: { path: 'docs/DECISION-LOG.md' }, note: 'D-009: export, deletion and saved plans are never paywalled.' },
  { rule: 'Do not let employers buy access to grades, accommodations, basic-needs activity, private AI conversations or undisclosed profiles.', held: { boundary: 'data-sale' }, note: 'The employer opt-in shares named artifacts only; the service register’s EMPLOYER_NEVER list says what never goes.' },
  { rule: 'Do not use targeted advertising based on education records or sensitive data.', held: { rule: 10 }, note: 'No student data for advertising or sponsorship targeting.' },
  { rule: 'Do not create pay-to-win club or opportunity placement.', held: 'proposed', note: 'Nothing sells placement today and nothing forbids it. Recorded so the rule is a decision, not a drift.' },
  { rule: 'Do not build a giant feature list without shared foundations.', held: { path: 'SEMESTER-OPERATING-SYSTEM.md' }, note: 'The scope rule and its nine questions, asked in the pull-request template.' },
  { rule: 'Do not claim to replace the SIS, registrar, financial aid or human support before authority and integrations warrant it.', held: { boundary: 'sis-direct' }, note: 'No direct SIS connection; the claims register refuses a word above its rows.' },
  { rule: 'Do not market AI grading, retention prediction or student risk as automated decision products.', held: { boundary: 'ai-decisions' }, note: 'No official decision by AI; no behavioural risk scoring (its own boundary).' },
  { rule: 'Do not collect sensitive data because it may become useful later.', held: { boundary: 'surveillance' }, note: 'Minimum necessary by construction: the app asks for what the current screen needs (DO-NOT-BUILD rule 5).' },
  { rule: 'Do not use dark patterns, engagement addiction loops or behaviourally targeted ads.', held: { rule: 4 }, note: 'Every notification has an owner, a preference, a cap and a way out; the ethics of growth stance in the maturity register.' },
  { rule: 'Do not make accessibility a premium module.', held: 'proposed', note: 'Nothing gates an accessibility setting behind a plan, and nothing forbids it. Proposed as a boundary.' },
  { rule: 'Do not make integration or offboarding difficult to preserve revenue.', held: { path: 'docs/DECISION-LOG.md' }, note: 'D-009 for the student; the institutional offboarding path is written and not built, so the line is a promise not yet provable.' },
  { rule: 'Do not overpromise 24/7 or emergency response.', held: { path: 'app/src/site/pages.tsx' }, note: 'The contact page promises no response time; the crisis notice routes to people.' },
  { rule: 'Do not build custom one-off features that compromise the shared platform.', held: { boundary: 'forks' }, note: 'No custom per-tenant forks; configuration tiers say what a tenant may change.' },
];

// ── The twelve-month roadmap, the benchmark test ─────────────────────────────

export const ROADMAP: readonly { quarter: string; focus: string; proof: string; rows: readonly string[] }[] = [
  { quarter: 'Q1', focus: 'Core coherence: one identity, context, design system, source/scope/status, a shared audit model', proof: 'Users experience a single platform rather than disconnected modules', rows: ['IAM-002', 'UX-001', 'TRUST-001', 'SEC-006'] },
  { quarter: 'Q2', focus: 'Student value: Today, work completion, Study Studio, No Wrong Door support, transfer and basic-needs navigation', proof: 'Students reach a meaningful outcome quickly and can find verified help', rows: ['STU-001', 'STU-002', 'STU-012', 'LMS-005'] },
  { quarter: 'Q3', focus: 'Institutional trust: AI Control Center, Knowledge Operations, procurement room, accessibility QA, integration health', proof: 'Buyers can assess controls without months of document chasing', rows: ['AI-001', 'TRUST-002', 'COM-003', 'A11Y-007', 'INT-014'] },
  { quarter: 'Q4', focus: 'Scale and category leadership: implementation academy, design partners, the Friction Index, portability and offboarding', proof: 'Pilot evidence, a public methodology, references, a repeatable expansion model', rows: ['IMP-001', 'SUP-003', 'UOS-008', 'LEG-004'] },
];

export const BENCHMARK: readonly string[] = [
  'Does this make a student’s next right action clearer?',
  'Does it reduce work for faculty, staff or IT, not merely move it?',
  'Is the source, authority, scope and freshness visible?',
  'Is it usable with keyboard, screen reader, zoom, mobile and low bandwidth?',
  'Can the user correct, undo, export, delete, revoke or get help?',
  'Is there a named institutional owner and a human escalation path?',
  'Can it integrate through standards and be offboarded without lock-in?',
  'Can we measure the real outcome without surveilling students?',
  'Can we prove every public claim?',
];

/** The memo's test: a feature is added or marketed only if every question is answered yes. Pure. */
export function benchmark(answers: readonly boolean[]): { pass: boolean; failing: string[] } {
  if (answers.length !== BENCHMARK.length) throw new Error(`benchmark needs ${BENCHMARK.length} answers`);
  const failing = BENCHMARK.filter((_, i) => !answers[i]);
  return { pass: failing.length === 0, failing };
}

/** What this change built, scored against the benchmark. A `no` is a finding, not a disqualification of the page. */
export const BUILT_HERE: readonly { what: string; answers: readonly boolean[]; note: string }[] = [
  { what: 'The compliance crosswalk (docs/trust/COMPLIANCE-CROSSWALK.md)', answers: [false, true, true, true, false, true, true, true, true], note: 'A reviewer’s page: it clarifies no student action and offers no undo; every score is a register row, every claim provable.' },
  { what: 'The evidence register (docs/trust/EVIDENCE-REGISTER.md)', answers: [false, true, true, true, false, true, true, true, true], note: 'The same: reduces IT and security work, names owners and escalation, proves its claims; not a student surface.' },
  { what: 'This page', answers: [false, true, true, true, false, true, true, true, true], note: 'Holds the memo to the tree; reduces nobody’s work but the next reader’s.' },
];

// ── The live-business standard, and the scopes ───────────────────────────────

export const LIVE_STANDARD: readonly { requirement: string; path: string | null }[] = [
  { requirement: 'A clear customer and user outcome', path: 'app/src/lib/governance/charters.ts' },
  { requirement: 'An accountable product owner', path: 'app/src/lib/governance/charters.ts' },
  { requirement: 'A complete data and permission model', path: 'app/src/lib/governance/module-privacy.ts' },
  { requirement: 'Accessibility acceptance criteria', path: 'docs/WCAG-UI-AUDIT-SCORECARD.md' },
  { requirement: 'Source, freshness and authority behaviour', path: 'app/src/lib/source.ts' },
  { requirement: 'A support and escalation path', path: 'docs/CAMPUS-ESCALATION-POLICY.md' },
  { requirement: 'Monitoring and an operational runbook', path: 'docs/RUNBOOKS.md' },
  { requirement: 'Pricing and entitlement logic', path: 'app/src/lib/governance/deal-desk.ts' },
  { requirement: 'Export and offboarding behaviour', path: 'app/src/lib/export.ts' },
  { requirement: 'A security, privacy and AI assessment', path: 'app/src/lib/governance/ai-lifecycle.ts' },
  { requirement: 'Customer documentation', path: 'docs/launch/WHAT-IS-SEMESTER.md' },
  { requirement: 'An implementation playbook', path: 'docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md' },
  { requirement: 'A measured adoption and value metric', path: 'app/src/lib/ops/firstyear.ts' },
];

export const SCOPES: readonly { scope: string; path: string | null; how: string }[] = [
  { scope: 'Institution', path: 'app/src/lib/flags.ts', how: 'tenant_feature_policy per school' },
  { scope: 'Campus', path: 'app/src/lib/governance/hierarchy.ts', how: 'A policy node at the campus level' },
  { scope: 'Department', path: null, how: 'No department node; a school is the finest tenant unit' },
  { scope: 'Programme', path: 'app/src/lib/governance/hierarchy.ts', how: 'A policy node at the programme level' },
  { scope: 'Cohort', path: 'app/src/lib/beta.ts', how: 'The private beta’s invitation list is the only cohort mechanism' },
  { scope: 'Course', path: 'app/src/lib/toolkit/policy.ts', how: 'Course AI policy over school over university' },
  { scope: 'Role', path: 'supabase/capabilities.check.sql', how: 'Capabilities granted by role' },
  { scope: 'Term', path: null, how: 'Nothing is enabled per term' },
  { scope: 'Individual user consent', path: 'app/src/components/SupportAccess.tsx', how: 'Consented capability windows, per student' },
];

export const WORKFLOWS: readonly { workflow: string; path: string | null; note: string }[] = [
  { workflow: 'Create → review → approve → publish → update → expire → archive', path: null, note: 'No publishing machine; Course Studio publishes without a review state.' },
  { workflow: 'Draft → submit → receive → review → decide → notify → appeal → close', path: 'packages/institution/src/workflow.ts', note: 'The submission and grade-passback machines (ADR 0009); no appeal state.' },
  { workflow: 'Connect → authorize → sync → reconcile → monitor → disconnect → export', path: 'app/server/institution/journal.ts', note: 'The two-phase action journal; reconcile and monitor are building (INT-014).' },
  { workflow: 'Share → scope → consent → access → revoke → retain/delete', path: 'app/src/lib/sharing.ts', note: 'Every share ends within a term and is revocable; deletion does not yet consult a hold.' },
  { workflow: 'Report → triage → protect → investigate → decide → appeal → learn', path: 'app/src/lib/moderation.ts', note: 'Reports and audited decisions; no appeal route (TS-1).' },
];

// ── The faculty playbook ─────────────────────────────────────────────────────

export const FACULTY_SEGMENTS: readonly string[] = [
  'Early adopters', 'Course coordinators', 'Adjunct and part-time faculty', 'Large-enrollment instructors', 'Online and hybrid instructors', 'Accessibility champions', 'Skeptical faculty', 'Teaching assistants', 'Department chairs',
];

export const FACULTY_PHASES: readonly Item[] = [
  {
    id: 'FP-1', item: 'Listen and map', asks: 'Segment faculty; map the LMS workflow, pain points, assessment and content-migration needs, AI-policy concerns, accessibility needs, support and high-stakes dates; run short compensated design sessions with seven questions.',
    rows: ['LMS-016'], standing: 'not-built',
    evidence: [{ path: 'docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', shows: 'the research practice; no faculty session has been held' }],
    gap: 'No faculty has been interviewed; main is written from the student’s side.',
  },
  {
    id: 'FP-2', item: 'Give faculty control', asks: 'Six policy families a course sets without becoming an administrator; every policy with a plain-language student preview, version history, effective date, course override, institutional baseline, accessibility check and printable view.',
    rows: ['AI-006', 'LMS-002', 'LMS-006'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/toolkit/policy.ts', shows: 'the course AI policy resolved assignment over course over school over university' },
      { path: 'app/src/components/CourseStudio.test.tsx', shows: 'Course Studio: what an instructor sets up' },
    ],
    gap: 'Three of six families have a setting of some kind; see the table below. No policy carries a version history or a student preview.',
  },
  {
    id: 'FP-3', item: 'Pilot, do not impose', asks: 'Three to eight representative courses; a limited scope; eight non-negotiable measures; never the highest-stakes grading first.',
    rows: ['IMP-001', 'SUP-003'], standing: 'partial',
    evidence: [{ path: 'app/src/lib/gtm/pilot.ts', shows: 'pilot readiness and the verdict; a pilot without measures is refused' }],
    gap: 'The pilot machinery is for an institution, not a course; no per-course pilot scope exists.',
  },
  {
    id: 'FP-4', item: 'Enable through the work', asks: 'Role- and moment-specific help at seven moments from before term to end of term, instead of generic training.',
    rows: ['SUP-001'], standing: 'partial',
    evidence: [
      { path: 'app/src/lib/coursestudio.ts', shows: 'Course Studio: the before-term setup, the one moment with a tool' },
      { path: 'docs/launch/FIRST-DAY-CHECKLISTS.md', shows: 'a first-day checklist per role' },
      { path: 'docs/ONBOARDING-AND-CONTEXTUAL-HELP.md', shows: 'help where the work is, as a design' },
    ],
    gap: 'One moment of seven has material. See the table below.',
  },
  {
    id: 'FP-5', item: 'Build faculty champions', asks: 'Department-nominated, recognised champions with early access, peer demonstrations, office hours and a clear boundary: they advise, they are not unpaid support.',
    rows: ['SUP-003'], standing: 'not-built',
    evidence: [{ path: 'docs/operating-model/CHANGE-MANAGEMENT.md', shows: 'the champion network as a process; AD-03 partial' }],
    gap: 'No champion programme; the maturity register marks the network partial on the strength of the document alone.',
  },
  {
    id: 'FP-6', item: 'Measure and improve', asks: 'Eleven faculty-value measures, from setup time per course to willingness to continue, instead of logins.',
    rows: ['LMS-017'], standing: 'not-built',
    evidence: [{ path: 'docs/FACULTY-ENABLEMENT.md', shows: 'faculty enablement, part 4 of the expansion command: nothing built' }],
    gap: 'No faculty measure is defined in the first-year measures; course analytics is building for students only.',
  },
];

export const POLICY_FAMILIES: readonly { family: string; options: string; path: string | null; note: string }[] = [
  { family: 'Course AI policy', options: 'Not allowed / limited / allowed with disclosure / instructor-defined', path: 'app/src/lib/toolkit/policy.ts', note: 'banned, limited, allowed, unstated — read from the syllabus and overridable.' },
  { family: 'Assessment policy', options: 'Practice, graded, open book, timed, accommodation-aware, late work, attempts, release rules', path: 'app/src/lib/examattempt.ts', note: 'A practice paper kept, resumed and receipted; nothing graded, timed or accommodation-aware.' },
  { family: 'Communication policy', options: 'Announcement cadence, reminders, office-hours availability, notification preferences', path: null, note: 'The student sets reminder preferences; no course sets a cadence.' },
  { family: 'Content policy', options: 'Source ownership, visibility, copyright and access expiry, reuse and import permissions', path: null, note: 'Content rights are a maturity area (CR-01 to CR-11), mostly owed.' },
  { family: 'Grading policy', options: 'Rubrics, anonymous grading, TA role, moderation, release, appeal and regrade', path: null, note: 'Rubrics and the gradebook are designed; instructors see no individual student data by decision.' },
  { family: 'Student-support policy', options: 'Approved help routes and referral language', path: 'app/src/lib/help-routes.ts', note: 'The routes exist for the student; a course cannot approve or word them.' },
];

export const POLICY_CARRIES: readonly string[] = ['A plain-language student preview', 'A version history', 'An effective date', 'A course-level override', 'An institutional baseline', 'An accessibility check', 'An export or printable view'];

export const MOMENTS: readonly { moment: string; support: string; path: string | null }[] = [
  { moment: 'Before term', support: 'Course migration clinic, syllabus review, AI-policy configuration, accessibility check', path: 'app/src/lib/coursestudio.ts' },
  { moment: 'Week 1', support: 'Student onboarding scripts, announcements, office hours, roster support', path: null },
  { moment: 'Before the first assignment', support: 'Rubric builder, submission preview, grading practice, TA calibration', path: null },
  { moment: 'Before the first assessment', support: 'Student-preview test, accommodation review, QTI and accessibility validation, contingency plan', path: null },
  { moment: 'During grading', support: 'Inline help, feedback templates, AI-assist disclosure, grade-release checklist', path: null },
  { moment: 'Midterm', support: 'Adoption review, student feedback, workload check, accessibility issue review', path: null },
  { moment: 'End of term', support: 'Grade export and reconciliation, archive, course reflection, next-term plan', path: null },
];

export const FACULTY_MEASURES: readonly string[] = [
  'Setup time per course', 'Time spent locating or creating materials', 'Assignment creation and grading time', 'Feedback turnaround', 'Repeated student questions',
  'Accessibility issues caught before release', 'Student completion and error rate', 'Support escalation volume', 'AI-policy clarity', 'Faculty confidence', 'Willingness to continue',
];

export const FACULTY_PROMISES: readonly string[] = [
  'Semester will not replace your academic judgment.',
  'AI will not assign final grades or make misconduct findings.',
  'You control course-specific AI and assessment policies within institutional rules.',
  'Students see clear source, policy and limitation labels.',
  'You will receive migration, accessibility, grading and support help.',
  'The pilot is designed to find what should change before broader rollout.',
];

// ── Where the documents conflict with a decision on main ─────────────────────

export const CONFLICTS: readonly { asks: string; decision: string; heldAs: string }[] = [
  { asks: 'Payments and approved campus transactions as a module and a revenue line', decision: 'D-009 kept billing out until a server-side environment and explicit approval; individual Plus billing has since been live-accepted (2026-10-03) with checkout held by the acquisition control, and campus payments and transactions remain out', heldAs: 'Campus payments held; individual Plus billing accepted but its checkout held; the bill screen reads a statement' },
  { asks: 'One Operations Console', decision: 'DO-NOT-BUILD rule 1 and D-110: no new top-level navigation; the console’s controls are data before the console', heldAs: 'ONE-13 held' },
  { asks: 'An external immutable audit archive and a customer trust dashboard as a separate service', decision: 'ADR 0003: no application server beyond the gateway; no second database', heldAs: 'Trust Evidence panels named against the data that exists; no service' },
  { asks: 'Five student destinations as the navigation', decision: 'D-003: the five are the primary tab bar behind journeyNavigation; the shelves stay', heldAs: 'ONE-04 and ONE-05 partial, not held' },
];

/** The seat each play answers to. Used only to render who would own the gap. */
export const PLAY_OWNER: Record<string, Seat> = {
  'PL-01': 'success', 'PL-02': 'product', 'PL-03': 'product', 'PL-04': 'success', 'PL-05': 'accessibility', 'PL-06': 'product', 'PL-07': 'data',
  'PL-08': 'trust', 'PL-09': 'engineering', 'PL-10': 'trust', 'PL-11': 'founder', 'PL-12': 'founder', 'PL-13': 'founder', 'PL-14': 'success',
};

export const ITEMS: readonly Item[] = [...ONES, ...PLAYS, ...FACULTY_PHASES];

/** Every master row the page names, once. */
export function allRows(): string[] {
  const ids = new Set<string>();
  for (const i of ITEMS) for (const id of i.rows) ids.add(id);
  for (const d of DISRUPTION) for (const id of d.rows) ids.add(id);
  for (const a of AI_CONTROL_CENTER) for (const id of a.rows) ids.add(id);
  for (const q of ROADMAP) for (const id of q.rows) ids.add(id);
  return [...ids];
}

/** Every path the page cites, once. */
export function allPaths(): string[] {
  const paths = new Set<string>();
  for (const i of ITEMS) for (const e of i.evidence) paths.add(e.path);
  for (const s of SHARED) for (const h of s.holders) paths.add(h.path);
  for (const x of [...BEHAVIOURS, ...DELIVERABLES, ...PORTABILITY, ...TRUST_EVIDENCE, ...STANDARD, ...ASSETS, ...INFLUENCE, ...IMPLEMENTATION, ...LIVE_STANDARD, ...SCOPES, ...WORKFLOWS, ...POLICY_FAMILIES, ...MOMENTS]) if (x.path) paths.add(x.path);
  for (const l of LINES) if (typeof l.held === 'object' && 'path' in l.held) paths.add(l.held.path);
  return [...paths];
}
