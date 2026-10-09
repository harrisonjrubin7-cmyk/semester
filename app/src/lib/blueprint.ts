/**
 * The Product Modernization Blueprint, held to the tree.
 *
 * Three documents arrived on 28 September 2026 and are kept under
 * `docs/expansion/` as supplied: a twelve-point modernization blueprint, the
 * architecture audit that produced it, and the longer enhancement paper both
 * draw on. Between them they ask for a great deal, and nearly all of it is
 * already a row of the master launch readiness register (`masterregister.ts`)
 * — the two plans describe the same platform. So this is not a second
 * register. It is the blueprint's own structure (twelve points, twenty-seven
 * front-end priorities, the backend, console and company items, five waves and
 * a decision rule) with each item pointed at the master rows that carry it,
 * and a standing read off the tree on the day, so a reader of the blueprint
 * can find where each thing it names actually is.
 *
 * `docs/MODERNIZATION-BLUEPRINT.md` is rendered from this file by
 * `blueprint.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## What a standing may claim
 *
 *   - `built` cites an automated test that runs on every change.
 *   - `partial` cites code. Something of the item exists; the gap says what
 *     does not.
 *   - `not-built` cites at most a document. Nothing of the item exists.
 *   - `held` cites a recorded decision. The item conflicts with a decision
 *     already on main, and the decision holds until the owner reopens it
 *     (DECISION-LOG.md's rule). Held is not a refusal; it is a pointer to the
 *     paragraph that would have to change first.
 *
 * Every cited file exists, every cited master row exists, and the test holds
 * each standing to the kind of file it cites — the same rule the master
 * register is held to. Standings were read at `origin/main` `fd8fc0b` on
 * 28 September 2026, before the changes in the same pull request as this
 * file, except where the evidence names those changes.
 */

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Semester-Product-Modernization-Blueprint.pdf',
    title: 'Semester Product Modernization Blueprint',
    what: 'The twelve points, the front-end order and scoring gate, the backend and console structure, the waves and the decision rule.',
  },
  {
    path: 'docs/expansion/Product-Architecture-Audit-and-12-Point-Blueprint.pdf',
    title: 'Product architecture audit: front-end, backend, console, and SaaS feature gaps',
    what: 'The audit the blueprint was written from: the same structure, in summary.',
  },
  {
    path: 'docs/expansion/Front-End-Backend-Console-and-SaaS-Enhancements.pdf',
    title: 'What on the front end, backend, console and app/SaaS can be further enhanced',
    what: 'The longer paper behind both: the student action layer, Decision Packets, explain-before-recommend, the Launch Method, the trust advantage.',
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

/** The files a `held` standing may cite: where the decisions are written. */
export const DECISION_FILES: readonly string[] = [
  'docs/DECISION-LOG.md',
  'DECISIONS.md',
  'docs/DO-NOT-BUILD.md',
  'docs/FACULTY-COURSE-STUDIO-DESIGN.md',
  'docs/architecture/0003-no-application-server.md',
  'docs/architecture/0006-search-is-one-ranker.md',
];

export interface Evidence {
  /** Repository-relative. A test fails if it does not exist. */
  path: string;
  shows: string;
}

export interface Item {
  /** `BP-nn`, `FE-nn`, `BE-nn`, `OC-nn` or `CO-nn`, stable. */
  id: string;
  item: string;
  /** What the blueprint asks for, in its own terms. */
  asks: string;
  /** The master register rows that carry it. Empty when none does — a finding in itself. */
  rows: string[];
  standing: Standing;
  evidence: Evidence[];
  /** What the tree lacks, or which decision holds. */
  gap: string;
}

export type Tier = 'P0' | 'P1' | 'P2' | 'P3';

export interface Priority extends Item {
  tier: Tier;
}

export const TIER_TITLE: Record<Tier, string> = {
  P0: 'Launch-blocking experience foundations',
  P1: 'Retention-driving student workflows',
  P2: 'Faculty and institution adoption',
  P3: 'Differentiation and ecosystem',
};

// ── 1. The twelve points ─────────────────────────────────────────────────────

export const POINTS: readonly Item[] = [
  {
    id: 'BP-01',
    item: 'Unified AppShell and context-first UX',
    asks: 'Five student destinations (Today, My Path, Search, Plan, Me); contextual modules; a shared ContextHeader with source, freshness and privacy scope; a shared Action Center; a command palette; consistent states.',
    rows: ['UX-001', 'STU-001', 'STU-002', 'STU-009'],
    standing: 'partial',
    evidence: [
      { path: 'app/src/lib/tabbar.ts', shows: 'FIVE_DESTINATIONS as the production default; journeyNavigation=off restores the legacy tabs' },
      { path: 'app/src/lib/fivedestinations.test.ts', shows: 'Holds the five to the screens they open' },
      { path: 'app/src/components/unity/ContextBar.tsx', shows: 'A context bar with title, statuses, save state and actions, placed on six surfaces' },
      { path: 'app/src/components/Command.tsx', shows: 'The command palette, on / and ⌘K' },
    ],
    gap: 'The five destinations and Action Center are production defaults with explicit rollback flags. The shell context strip carries term, location, workflow, Continue and health; privacy scope still belongs to object-level context rather than the global strip.',
  },
  {
    id: 'BP-02',
    item: 'Today as a decision workspace',
    asks: 'One Most Important action, three to five next, commitments, Path Snapshot, "what changed since your last visit", explain-before-recommend, snooze/dismiss/correct/share/help, no surveillance labels.',
    rows: ['STU-001', 'STU-002'],
    standing: 'partial',
    evidence: [
      { path: 'app/src/lib/actions.ts', shows: 'rank(): mostImportant, next (capped at three by an explicit continuity decision), rest; the Explanation shape' },
      { path: 'app/src/components/ExplanationSheet.tsx', shows: 'Why now, why this, based on, what it changes, what Semester cannot tell you, other options' },
      { path: 'app/src/lib/today-center.ts', shows: 'planCommitments and the UNCALM wording guard' },
      { path: 'app/src/lib/since.ts', shows: '"Since you were here": ticks, feeds, announcements and sittings only' },
    ],
    gap: 'Production default with an explicit rollback flag. No Share control or compare-options action on an action; "what changed" does not cover the plan, path or sources; the wording guard runs on Today only.',
  },
  {
    id: 'BP-03',
    item: 'Decision Packets for high-value moments',
    asks: 'Registration, Advisor, Study, Career and Study Abroad packets, each with context, sources, assumptions, options, next actions, human handoff, share scope, export, audit and freshness.',
    rows: ['STU-005', 'STU-008', 'UOS-004', 'UOS-006'],
    standing: 'partial',
    evidence: [
      { path: 'app/src/lib/advisor-meeting.ts', shows: 'The advisor agenda with a share payload, export after a full preview' },
      { path: 'app/src/lib/advisor-shares.ts', shows: 'Expiring, revocable shares with a read log — the one packet with a share model' },
      { path: 'app/src/lib/registration-day.ts', shows: 'Ranked backups, checklist, readiness, a downloadable section list' },
      { path: 'app/src/lib/career-evidence.ts', shows: 'Evidence and résumé versions' },
    ],
    gap: 'No shared packet model: each moment is its own screen and shape, and only the advisor one has share scope, expiry and audit. Registration, study, career and study-abroad carry no sources, assumptions or freshness fields.',
  },
  {
    id: 'BP-04',
    item: 'Contextual Ask Semester',
    asks: 'A context tray and a source tray, modes Explain/Practice/Plan/Draft/Execute, structured answers with citations and limitations, draft-to-action with preview and confirmation, policy-aware refusals with alternatives, editable and deletable memory.',
    rows: ['AI-004', 'AI-005', 'AI-006', 'AI-008', 'AI-009', 'AI-013'],
    standing: 'partial',
    evidence: [
      { path: 'app/src/ai/Opening.tsx', shows: '"Using right now" and "What it can and cannot see"' },
      { path: 'app/src/intelligence/Disclosure.tsx', shows: 'Evidence with verifiedAt, uncertainty and policy, after an answer' },
      { path: 'app/src/intelligence/contracts.ts', shows: 'IntegrityMode: explain, hint, practice, review, draft; ProposedAction with before/after and receipt' },
      { path: 'app/src/ai/HelpNotice.tsx', shows: 'Why a request is limited, and that planning help still works' },
      { path: 'app/src/lib/aboutme.ts', shows: 'Memory typed by the student only, editable from Settings' },
    ],
    gap: 'No Plan or Execute mode. The source tray appears only after an answer, and Ask does not honour the source locker\'s exclusions. Memory is reachable from Settings, not from Ask.',
  },
  {
    id: 'BP-05',
    item: 'Accessible native LMS advantage',
    asks: 'Course Studio with modules, versions, conditional release and preview; assignment durability and receipts; assessment autosave, resume, accommodations and recovery; rubrics, batch grading, grade history, a student what-if view; outcomes, archive, export.',
    rows: ['LMS-002', 'LMS-004', 'LMS-005', 'LMS-008', 'LMS-010', 'LMS-011', 'LMS-014'],
    standing: 'partial',
    evidence: [
      { path: 'docs/decisions/D-1067.md', shows: 'The owner reopened the boundary: Semester is to replace the LMS gradebook through phased migration' },
      { path: 'app/src/components/CourseStudio.tsx', shows: 'Course rules, guidance and packs' },
      { path: 'app/src/screens/Gradebook.tsx', shows: 'The course-scoped instructor and student gradebook of record' },
      { path: 'app/src/lib/gradebook/gradebook.test.ts', shows: 'Weighted schemes and append-only grade history' },
      { path: 'app/src/lib/examattempt.ts', shows: 'Practice-paper autosave, resume and a receipt — the LMS learning plan\'s smallest open item, closed in this change' },
      { path: 'app/src/lib/whatif.ts', shows: 'The student what-if grade view' },
    ],
    gap: 'The native gradebook exists, but complete LMS module/file authoring, graded submission, QTI delivery, batch and anonymous grading, accessibility UAT and an institutional cutover remain incomplete.',
  },
  {
    id: 'BP-06',
    item: 'Integration Control Plane',
    asks: 'Connector catalog, tenant configuration, OAuth/mTLS/LTI credentials, mappings, freshness, webhook verification, durable inbox, reconciliation, circuit breaker, customer-visible health.',
    rows: ['INT-001', 'INT-009', 'INT-010', 'INT-013', 'INT-014'],
    standing: 'partial',
    evidence: [
      { path: 'supabase/migrations/20260927170000_integration_control_plane.sql', shows: 'Provider registry, connections with vault-pointer credentials, mappings, idempotent webhook_events, dead letters, kill switches' },
      { path: 'supabase/migrations/20260928040000_integration_quality.sql', shows: 'Reconciliation runs and discrepancies; mapping versions' },
      { path: 'app/src/components/institutional/IntegrationDashboard.tsx', shows: 'The school\'s own connector health, with reason, confirmation and audit' },
      { path: 'app/src/lib/integration/retry.ts', shows: 'Backoff with jitter and a permanent-error list' },
    ],
    gap: 'No inbound webhook endpoint, so no signature, timestamp or replay verification (INT-013). No automatic circuit breaker, only manual pause and kill switches. Only mock adapters exist, and the sync job is parked.',
  },
  {
    id: 'BP-07',
    item: 'Source-of-truth and data-lineage engine',
    asks: 'Every material fact carries source kind, system, record id, URL, verified/synced time, authority, classification, retention, mapping version, access policy, conflict rule and official fallback.',
    rows: ['TRUST-001', 'TRUST-002', 'TRUST-003', 'INT-001'],
    standing: 'partial',
    evidence: [
      { path: 'supabase/migrations/20260927170000_integration_control_plane.sql', shows: 'canonical_entity_references: source_system, source_record_id, source_url, source_timestamp, classification, freshness_status, mapping_version, confidence' },
      { path: 'app/src/lib/source.ts', shows: 'The five source labels the app shows' },
      { path: 'app/src/lib/integration/lineage.ts', shows: 'Lineage types on the client' },
      { path: 'docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md', shows: 'The design, which still says nothing is built and is out of date' },
    ],
    gap: 'No source_kind, synced_at on canonical rows, access_policy, conflict-resolution rule or official fallback column; conflict precedence is hard-coded. The lineage document needs its "nothing built" line replaced with what is.',
  },
  {
    id: 'BP-08',
    item: 'Policy-as-code and governed configuration',
    asks: 'Ten policy kinds, each versioned with owner, approver, scope, effective date, tests, audit event, rollback and a customer-communication decision.',
    rows: ['PRG-003', 'PRG-007', 'AI-001', 'AI-006'],
    standing: 'partial',
    evidence: [
      { path: 'app/src/lib/flags.ts', shows: 'Flags as code with owner, rollback, review date and kill switches' },
      { path: 'supabase/migrations/20260927235000_governance_registries.sql', shows: 'Tiered configuration requests with approval steps and review dates' },
      { path: 'app/src/lib/governance/ai-lifecycle.ts', shows: 'AI gates G0–G5' },
    ],
    gap: 'No uniform versioned policy record across the ten kinds; assessment, accessibility and support-access policies have no artifact at all. The flag evaluator runs on the client.',
  },
  {
    id: 'BP-09',
    item: 'High-assurance tenant and role architecture',
    asks: 'Tenant hierarchy, role/capability matrix, object authorization, RLS and storage isolation, time-bound support access, privileged access review, break-glass, immutable audit.',
    rows: ['IAM-006', 'IAM-007', 'IAM-008', 'IAM-009', 'IAM-010', 'IAM-011'],
    standing: 'partial',
    evidence: [
      { path: 'supabase/rls-coverage.check.sql', shows: 'Every table has RLS on; no write policy of true' },
      { path: 'supabase/integration-rls-matrix.check.sql', shows: 'Four accounts per table: see, change, delete' },
      { path: 'app/src/lib/governance/hierarchy.ts', shows: 'The five-level policy hierarchy resolved' },
      { path: 'supabase/migrations/20260925103000_support_access.sql', shows: 'Consent-backed support access, at most seven days' },
      { path: 'app/src/lib/rolelaunch.ts', shows: 'The internal boundary: no Semester role holds a student-record capability, held by rolelaunch.test.ts (this change)' },
    ],
    gap: 'No privileged access review or recertification; no two-person, time-limited break-glass; no MFA for privileged roles (IAM-005).',
  },
  {
    id: 'BP-10',
    item: 'Reliability for academic critical periods',
    asks: 'Journey SLOs and error budgets, synthetic checks, RUM, load tests, an academic operations calendar, release freezes, on-call, restore and DR drills, status page, game days.',
    rows: ['SRE-001', 'SRE-002', 'SRE-005', 'SRE-007', 'SRE-009', 'SRE-010'],
    standing: 'partial',
    evidence: [
      { path: 'app/src/lib/governance/error-budgets.ts', shows: 'Fifteen journey SLOs and error budgets as code: eight adopted, seven proposed' },
      { path: '.github/workflows/production-smoke.yml', shows: 'Hourly synthetic probes' },
      { path: 'app/public/status.html', shows: 'A status page that checks from the reader\'s browser (#902)' },
      { path: 'RESTORE.md', shows: 'The restore drill, rehearsed in CI' },
    ],
    gap: 'No RUM (would have to be first-party: no tracking SDK may load), no load tests, no academic peak calendar or release freeze, no production restore yet, no SLI measurement.',
  },
  {
    id: 'BP-11',
    item: 'Institution Launch Method and customer operating platform',
    asks: 'Discover → Design → Configure → Connect → Validate → Train → Launch → Hypercare → Measure → Expand; a Launch Center; projects, RACI, UAT, go-live gates; customer portal; training academy; QBR and renewal; offboarding.',
    rows: ['IMP-001', 'SUP-003', 'LEG-004'],
    standing: 'partial',
    evidence: [
      { path: 'supabase/migrations/20260928050000_tenant_rollout.sql', shows: 'A rollout state machine with evidence-gated gates, UAT sign-off and sponsor go-live' },
      { path: 'app/src/lib/governance/rollout.ts', shows: 'Phases with RACI evidence, not yet drawn by any screen' },
      { path: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', shows: 'Offboarding as a plan' },
    ],
    gap: 'The method is not named anywhere and its phases are not mapped to the rollout state machine. No Launch Center UI, customer portal, training academy, UAT scripts or QBR workflow.',
  },
  {
    id: 'BP-12',
    item: 'Student portability: Credential Wallet and evidence graph',
    asks: 'A wallet, a skills/evidence graph, student-selected artifacts, scoped verification requests, institution-issued credentials, private-by-default sharing with expiring revocable links, export, CASE/Open Badges/CLR.',
    rows: ['UOS-004', 'UOS-007'],
    standing: 'partial',
    evidence: [
      { path: 'app/src/components/SkillsGraph.tsx', shows: 'The skills graph, behind careerSkillsGraph' },
      { path: 'supabase/migrations/20260928301000_advisor_shares.sql', shows: 'Time-limited, revocable shares with a view history — for advisor packets only' },
      { path: 'app/src/lib/career-evidence.ts', shows: 'Evidence the student chose' },
      { path: 'app/src/components/CredentialWallet.tsx', shows: 'Private-by-default wallet with per-item authority and selected export' },
      { path: 'app/src/lib/credential-wallet.test.ts', shows: 'Only confirmed or selected evidence enters the non-official export' },
    ],
    gap: 'The wallet foundation is device-local. Credentials cannot be shared by an expiring, revocable link; no issuer correction/revocation service or validated Open Badges, CLR or CASE exchange exists.',
  },
];

// ── 2. The twenty-seven front-end priorities ────────────────────────────────

export const PRIORITIES: readonly Priority[] = [
  // P0 — launch-blocking experience foundations
  { id: 'FE-01', tier: 'P0', item: 'Unified AppShell and navigation', asks: 'One shell, the five destinations, one navigation model.', rows: ['UX-001'], standing: 'partial',
    evidence: [{ path: 'app/src/lib/tabbar.ts', shows: 'FIVE_DESTINATIONS behind journeyNavigation' }, { path: 'app/src/App.tsx', shows: 'The shell: header, skip link, heading focus, tabs, rail, shelves' }],
    gap: 'Five is not the production default; search has no nav.ts destination; D-003 misstates DEFAULT_TABS.' },
  { id: 'FE-02', tier: 'P0', item: 'Real login, signup and auth-state UX', asks: 'A real sign-in, sign-up, reset, SSO, a signed-out state, demo kept apart from production.', rows: ['IAM-001', 'IAM-003', 'PRG-008'], standing: 'built',
    evidence: [{ path: 'app/src/components/Credentials.tsx', shows: 'Sign in, sign up, SSO, OAuth, reset' }, { path: 'app/src/state/logindoor.test.tsx', shows: '#/login, #/signin and #/signup open the door' }, { path: 'app/src/lib/demosplit.test.ts', shows: 'The deployed site is the product; the demo is beside it' }],
    gap: 'Sign-in is a section of Account rather than its own page; no session-expired or re-authentication state.' },
  { id: 'FE-03', tier: 'P0', item: 'Consistent source, freshness and privacy components', asks: 'One badge vocabulary for source, freshness, authority and privacy scope, used wherever a fact is shown.', rows: ['TRUST-001', 'TRUST-002', 'TRUST-003'], standing: 'partial',
    evidence: [{ path: 'app/src/components/SourceBadge.tsx', shows: 'Seven trust kinds, in 24 files' }, { path: 'app/src/components/unity/Status.tsx', shows: 'A second vocabulary, StatusChip, in four files' }, { path: 'app/src/components/unity/Visibility.tsx', shows: 'The privacy-scope pattern, placed once' }, { path: 'docs/design/DESIGN-DEBT.md', shows: 'DD-003: the two vocabularies, unresolved' }],
    gap: 'Two trust vocabularies (DD-003); the privacy-scope component is almost unplaced.' },
  { id: 'FE-04', tier: 'P0', item: 'Design tokens and component library', asks: 'Tokens for colour, type, spacing, surface, focus, motion and target size; shared components.', rows: ['UX-002', 'PRG-004'], standing: 'built',
    evidence: [{ path: 'app/src/styles/tokens.css', shows: 'The semantic token layer' }, { path: 'app/src/styles/tokens.test.ts', shows: 'Holds it' }, { path: 'app/src/styles/rules.ts', shows: 'Type and spacing scales enforced by lint' }, { path: 'app/src/components/ui.tsx', shows: 'The primitives' }],
    gap: 'Tokens are enforced; component use is not — thousands of inline style blocks, no catalog.' },
  { id: 'FE-05', tier: 'P0', item: 'Loading, empty, error, offline, stale and no-permission states', asks: 'A shared component for each state, used by every feature.', rows: ['UX-001'], standing: 'partial',
    evidence: [{ path: 'app/src/components/unity/States.tsx', shows: 'LoadingState, ErrorState, PermissionNotice, OfflineStrip' }, { path: 'app/src/lib/uxstates.ts', shows: 'The UX_STATES matrix' }, { path: 'app/src/components/SyncStrip.tsx', shows: 'Offline, on every layout' }, { path: 'docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md', shows: 'The rule; names the missing policy-restricted state' }],
    gap: 'The shared states are barely placed (LoadingState in one file, OfflineStrip in none); no "you do not have access" component; no test requires a screen to use them.' },
  { id: 'FE-06', tier: 'P0', item: 'Keyboard, focus, semantic, contrast and reflow baseline', asks: 'Keyboard-only success, visible focus, one main and one h1, contrast on every ground, reflow at 320px.', rows: ['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004'], standing: 'built',
    evidence: [{ path: 'app/src/lib/contrast.test.ts', shows: 'Every ground, both faded rungs' }, { path: 'app/scripts/accessibility-smoke.mjs', shows: 'axe and 320px reflow on six journeys, in CI' }, { path: '.github/workflows/contrast.yml', shows: 'Contrast as a CI step' }],
    gap: 'Reflow at 320px is proven for six journeys only; the all-screens sweep is open (RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md).' },
  { id: 'FE-07', tier: 'P0', item: 'Mobile-first core routes', asks: 'Every capability reachable at every width.', rows: ['UX-003'], standing: 'built',
    evidence: [{ path: 'app/src/widthgate.test.ts', shows: 'Every file that reads the width has a parity row' }, { path: 'docs/CAPABILITY-PARITY-MATRIX.md', shows: 'The rows, all Parity' }],
    gap: 'Parity is structural; rendering at 320px is proven only for the smoke journeys.' },
  { id: 'FE-08', tier: 'P0', item: 'Save, autosave and recovery feedback', asks: 'Visible durable-save state, draft recovery, no lost work.', rows: ['LMS-005'], standing: 'built',
    evidence: [{ path: 'app/src/lib/draft.ts', shows: 'Drafts for long fields, fourteen days, a restored line' }, { path: 'app/src/lib/browser-recovery.test.ts', shows: 'Closed-tab recovery' }, { path: 'app/src/lib/examattempt.test.ts', shows: 'The practice paper kept, resumed and receipted (this change)' }],
    gap: 'Nine of eighty-one text areas use useDraft; visible save state on about five surfaces; no per-item conflict UI.' },
  // P1 — retention-driving student workflows
  { id: 'FE-09', tier: 'P1', item: 'Today / Action Center decision workspace', asks: 'See BP-02.', rows: ['STU-001', 'STU-002'], standing: 'partial',
    evidence: [{ path: 'app/src/components/TodayActionCenter.tsx', shows: 'Most important, next, commitments, data freshness' }, { path: 'app/src/components/ActionCenter.tsx', shows: 'Snooze, not relevant, something is wrong, ask for help' }],
    gap: 'Behind today_action_center; no share, view-source or compare-options control.' },
  { id: 'FE-10', tier: 'P1', item: 'My Path and Registration Center', asks: 'Path Snapshot, requirements, registration readiness in one place.', rows: ['STU-003', 'STU-005'], standing: 'built',
    evidence: [{ path: 'app/src/screens/Degree.tsx', shows: 'The degree: taken, scenarios, snapshot' }, { path: 'app/src/lib/registration-day.ts', shows: 'Readiness and the checklist' }, { path: 'app/src/lib/fivedestinations.test.ts', shows: 'My Path opens the degree' }],
    gap: 'Registration (yes) and My Path (degree) are separate destinations; personal blocks against course meetings are still open.' },
  { id: 'FE-11', tier: 'P1', item: 'Plan, schedule conflict and backup course workflow', asks: 'Conflicts, ranked clash-free backups, cart credit total.', rows: ['STU-007'], standing: 'built',
    evidence: [{ path: 'app/src/lib/registration.ts', shows: 'conflicts()' }, { path: 'app/src/lib/registration-day.ts', shows: 'Up to five ranked backups, other sections first' }, { path: 'app/src/lib/registration-day.test.ts', shows: 'Holds the ranking' }],
    gap: 'Personal, work and study blocks are not yet conflicts.' },
  { id: 'FE-12', tier: 'P1', item: 'Advisor Packet and safe sharing', asks: 'Agenda, questions, plan snapshot, scoped share with expiry and revocation.', rows: ['STU-008', 'UOS-007'], standing: 'built',
    evidence: [{ path: 'app/src/lib/advisor-meeting.ts', shows: 'The meeting and its share payload' }, { path: 'app/src/lib/advisor-shares.ts', shows: 'Expiry, revocation, read log' }, { path: 'app/src/lib/advisor-shares.test.ts', shows: 'Holds the share state machine' }],
    gap: 'Behind advisor_meeting_mode; the payload carries no sources, assumptions or freshness; the migration is not applied.' },
  { id: 'FE-13', tier: 'P1', item: 'Contextual Ask Semester', asks: 'See BP-04.', rows: ['AI-008', 'AI-013'], standing: 'partial',
    evidence: [{ path: 'app/src/ai/Opening.tsx', shows: 'What it can and cannot see' }, { path: 'app/src/intelligence/ModePicker.tsx', shows: 'Five modes' }],
    gap: 'No Plan or Execute mode; the source tray comes after the answer; exclusions are not honoured by Ask.' },
  { id: 'FE-14', tier: 'P1', item: 'Study Studio and source workflow', asks: 'Approved sources in, study assets out, exclusions honoured.', rows: ['AI-004', 'AI-007'], standing: 'partial',
    evidence: [{ path: 'app/src/components/StudyStudio.tsx', shows: 'Blocked sources excluded, provenance recorded' }, { path: 'app/src/lib/source-locker.ts', shows: 'The locker' }, { path: 'app/src/lib/study-readiness.ts', shows: 'recommend()' }],
    gap: 'Behind study_readiness and source_locker; no single study packet; nothing is synced or exported.' },
  { id: 'FE-15', tier: 'P1', item: 'Search with source-aware results', asks: 'Results carry source, owner and freshness.', rows: ['STU-009'], standing: 'partial',
    evidence: [{ path: 'app/src/lib/find.ts', shows: 'Hit: kind, title, sub, tag, score — no source label' }, { path: 'app/src/screens/Search.tsx', shows: 'The search screen' }],
    gap: 'No SourceLabel, authority or freshness on a result.' },
  // P2 — faculty and institution adoption
  { id: 'FE-16', tier: 'P2', item: 'Course Studio', asks: 'See BP-05.', rows: ['LMS-002'], standing: 'partial',
    evidence: [{ path: 'docs/decisions/D-1067.md', shows: 'Native LMS direction approved' }, { path: 'app/src/components/CourseStudio.tsx', shows: 'Rules, guidance, packs' }],
    gap: 'Rules, guidance and study packs exist; modules, pages, files, media, objectives, conditional release and accessibility UAT do not.' },
  { id: 'FE-17', tier: 'P2', item: 'Assignment, submission and recovery', asks: 'Idempotent submission, receipts, version history.', rows: ['LMS-004', 'LMS-005'], standing: 'partial',
    evidence: [{ path: 'app/src/lib/assignment.ts', shows: 'Instructions broken down, drafts critiqued' }, { path: 'app/src/lib/docversions.ts', shows: 'Student document versions' }],
    gap: 'No submission model, so no idempotent submit, server receipt or submission history.' },
  { id: 'FE-18', tier: 'P2', item: 'Assessment and accommodations', asks: 'Autosave, resume, timer state, accommodations applied, recovery, deadline logic.', rows: ['LMS-008', 'LMS-009', 'LMS-010'], standing: 'partial',
    evidence: [{ path: 'app/src/screens/Exam.tsx', shows: 'The practice paper: now kept through lib/examattempt.ts, with a receipt' }, { path: 'app/src/lib/examattempt.test.ts', shows: 'Holds the screen to keeping it' }],
    gap: 'Practice papers only: no persisted timer authority, no accommodations applied, no audited staff recovery, no deadline boundary.' },
  { id: 'FE-19', tier: 'P2', item: 'Gradebook and feedback', asks: 'Rubrics, accessible feedback, batch and anonymous grading, grade history, what-if, passback.', rows: ['LMS-011', 'LMS-012', 'LMS-013', 'LMS-014'], standing: 'partial',
    evidence: [{ path: 'app/src/screens/Gradebook.tsx', shows: 'Instructor and student views behind course-scoped grants' }, { path: 'app/src/lib/gradebook/gradebook.test.ts', shows: 'Weighted schemes and versioned grades' }, { path: 'app/src/lib/gradebook/passback.test.ts', shows: 'Authorized passback rules' }, { path: 'app/src/lib/whatif.ts', shows: 'The student what-if' }],
    gap: 'The gradebook, history, moderation, release, regrades, export and passback exist; rubric authoring, batch and anonymous grading and institutional cutover evidence do not.' },
  { id: 'FE-20', tier: 'P2', item: 'Institution admin and policy UI', asks: 'Tenant configuration, modules, flags, policy.', rows: ['PRG-007', 'UOS-009'], standing: 'partial',
    evidence: [{ path: 'app/src/screens/University.tsx', shows: 'Control plane, integrations, campaigns, operations, demand — each behind a flag' }],
    gap: 'Every tab is off or preview by default; no policy-version UI.' },
  { id: 'FE-21', tier: 'P2', item: 'Integration-health and source-governance UI', asks: 'Customer-visible connector health, freshness, mappings, reconciliation.', rows: ['INT-014'], standing: 'partial',
    evidence: [{ path: 'app/src/components/institutional/IntegrationDashboard.tsx', shows: 'Health, reason, confirmation, audit' }],
    gap: 'Behind integrationDashboard; mock adapters only.' },
  { id: 'FE-22', tier: 'P2', item: 'Implementation, UAT and training UI', asks: 'A Launch Center, UAT scripts, training.', rows: ['IMP-001'], standing: 'not-built',
    evidence: [{ path: 'docs/GOLDEN-PATH-TEST-SCRIPT.md', shows: 'The golden-path script, as a document' }],
    gap: 'The rollout state machine has no screen.' },
  // P3 — differentiation and ecosystem
  { id: 'FE-23', tier: 'P3', item: 'Career and evidence graph', asks: 'Skills, evidence, verification.', rows: ['UOS-004'], standing: 'partial',
    evidence: [{ path: 'app/src/components/SkillsGraph.tsx', shows: 'The graph, behind careerSkillsGraph' }, { path: 'app/src/lib/career-evidence.ts', shows: 'Evidence and skill decisions' }],
    gap: 'No target-role packet; no share scope.' },
  { id: 'FE-24', tier: 'P3', item: 'Credential Wallet', asks: 'See BP-12.', rows: ['UOS-007'], standing: 'partial',
    evidence: [{ path: 'app/src/components/CredentialWallet.tsx', shows: 'Student-confirmed skills and selected artifacts with authority-preserving export' }, { path: 'app/src/lib/credential-wallet.test.ts', shows: 'Selection and not-official export boundaries' }],
    gap: 'Device-local foundation only; no expiring or revocable credential share and no institution issuer service.' },
  { id: 'FE-25', tier: 'P3', item: 'Campus Hub and opportunity marketplace', asks: 'Campus knowledge, events, opportunities.', rows: ['UOS-002', 'UOS-005'], standing: 'built',
    evidence: [{ path: 'app/src/screens/Opportunities.tsx', shows: 'The marketplace' }, { path: 'app/src/screens/Hub.tsx', shows: 'The hub' }, { path: 'app/src/lib/listings.test.ts', shows: 'Holds the listings the marketplace shows' }, { path: 'supabase/listings.check.sql', shows: 'Who may publish and see a listing' }],
    gap: 'Campus knowledge graph is building (UOS-001).' },
  { id: 'FE-26', tier: 'P3', item: 'Study abroad, athlete and transfer modules', asks: 'Student-controlled context modules by moment.', rows: ['UOS-006'], standing: 'partial',
    evidence: [{ path: 'app/src/lib/learner-pathways.ts', shows: 'Transfer, working, caregiver, military, online, graduate, credential, international, changing — device-only' }, { path: 'app/src/screens/Athletics.tsx', shows: 'Athletics as its own screen' }],
    gap: 'No first-year, athlete or study-abroad pathway in the chooser; the choice shapes nothing on Today or Ask.' },
  { id: 'FE-27', tier: 'P3', item: 'Developer portal and integration sandbox', asks: 'A portal, a sandbox.', rows: ['INT-001'], standing: 'partial',
    evidence: [{ path: 'docs/SYNC-SIMULATION-SANDBOX.md', shows: 'The sandbox design' }, { path: 'app/src/components/institutional/OperationsStudio.tsx', shows: 'The developer platform tab, behind institutionalOperations' }],
    gap: 'No public portal.' },
];

// ── 3. Backend, console and company ─────────────────────────────────────────

export const PLATFORM: readonly Item[] = [
  { id: 'BE-01', item: 'Modular monolith with domain boundaries', asks: 'One deployable with named domain boundaries and an extraction path.', rows: ['PRG-001'], standing: 'held',
    evidence: [{ path: 'docs/architecture/0003-no-application-server.md', shows: 'No app server, no microservices, no event bus, no second database' }, { path: 'docs/ARCHITECTURE.md', shows: 'The layer diagram and concern table' }],
    gap: 'The blueprint and the ADR agree on the monolith. No document names the domain boundaries or their owners; that is the open half.' },
  { id: 'BE-02', item: 'Postgres with RLS and negative authorization tests', asks: 'RLS on every tenant- or user-scoped table; tests that a role cannot.', rows: ['IAM-008'], standing: 'built',
    evidence: [{ path: 'supabase/rls-coverage.check.sql', shows: 'RLS on for the whole schema' }, { path: 'supabase/integration-rls-matrix.check.sql', shows: 'Four accounts per table' }, { path: 'app/src/isolation.test.ts', shows: 'Client-side isolation' }],
    gap: 'No storage cross-tenant listing suite; FORCE RLS deliberately off.' },
  { id: 'BE-03', item: 'Append-only audit with protected retention', asks: 'Immutable audit events, retention that survives the tenant.', rows: ['SEC-006'], standing: 'partial',
    evidence: [{ path: 'supabase/migrations/20260924184500_gateway_action_journal.sql', shows: 'The gateway journal, purged after 180 days' }, { path: 'supabase/migrations/20260925103000_support_access.sql', shows: 'support_access_event with an immutability trigger' }],
    gap: 'tenant_policy_audit_event has no immutability trigger; audit rows cascade with their school; no external archive (which ADR 0003 would have to allow).' },
  { id: 'BE-04', item: 'Permission-aware search index', asks: 'A server index filtered by tenant, object and source access.', rows: ['STU-009'], standing: 'held',
    evidence: [{ path: 'docs/architecture/0006-search-is-one-ranker.md', shows: 'Search is one ranker, on the device' }, { path: 'app/src/lib/search.ts', shows: 'That ranker' }],
    gap: 'A server-side index reopens ADR 0006 and ADR 0003.' },
  { id: 'BE-05', item: 'Scoped object storage', asks: 'Scoped paths, signed URLs, type and malware validation, lifecycle.', rows: ['IAM-009', 'INT-012'], standing: 'partial',
    evidence: [{ path: 'supabase/functions/_shared/mediascan.ts', shows: 'Magic-byte and hash scanning, not yet deployed' }, { path: 'supabase/migrations/20260928100000_trust_room.sql', shows: 'A private bucket with size and type limits and signed URLs' }],
    gap: 'Two buckets; the scanner is not deployed; student files stay on the device with no lifecycle.' },
  { id: 'BE-06', item: 'Durable jobs: idempotency, retries, dead letters, reconciliation', asks: 'A job layer with all four.', rows: ['INT-013', 'INT-001'], standing: 'partial',
    evidence: [{ path: 'supabase/migrations/20260927170000_integration_control_plane.sql', shows: 'Idempotent webhook_events, dead letters, operator replay' }, { path: 'app/src/lib/integration/retry.ts', shows: 'Backoff and permanent errors' }, { path: 'supabase/scheduler.sql', shows: 'Nine pg_cron jobs' }],
    gap: 'The sync job is parked; push_queue has no attempts or dead letter; no general job table.' },
  { id: 'BE-07', item: 'Governed analytics aggregate model', asks: 'Aggregates apart from production records, with a small-cell floor.', rows: ['UOS-008'], standing: 'built',
    evidence: [{ path: 'ANALYTICS.md', shows: 'One activity table, three marks, no third party' }, { path: 'docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', shows: 'The n ≥ 10 floor' }, { path: 'app/src/lib/cohortfloor.test.ts', shows: 'Holds the floor' }],
    gap: 'Separation is by policy in the one database, not by infrastructure.' },
  { id: 'BE-08', item: 'Security: server-side authorization, MFA/SSO for privileged users, kill switches, threat models, negative tests', asks: 'All five.', rows: ['IAM-005', 'SEC-002', 'AI-012'], standing: 'partial',
    evidence: [{ path: 'supabase/functions/_shared/killswitch.ts', shows: 'kill.ai_generation read before any generation (this change)' }, { path: 'app/src/lib/aikillswitch.test.ts', shows: 'Holds both runtimes to it' }, { path: 'docs/INTEGRATION-THREAT-MODEL.md', shows: 'The integration threat model' }, { path: 'supabase/migrations/20261008223000_privileged_role_mfa.sql', shows: 'platform_admin and support_agent grants require an aal2 JWT' }, { path: 'supabase/privileged-mfa.check.sql', shows: 'aal1 refusals, aal2 controls and an ordinary-role non-regression' }],
    gap: 'Privileged product roles require aal2 in the shared capability predicate, but production Auth settings, recovery and provider-console enforcement lack filed proof; threat models cover integrations only.' },
  { id: 'BE-09', item: 'AI pipeline stages', asks: 'Policy, source-access validation, injection-resistant assembly, provider route, grounding evaluation, citations, confirmation for writes, audit, kill switch.', rows: ['AI-003', 'AI-006', 'AI-010', 'AI-011', 'AI-012'], standing: 'partial',
    evidence: [{ path: 'app/server/institution/intelligence.ts', shows: 'Scope refusal, source-not-approved, citations, confirmation-required, and now ai-generation-killed' }, { path: 'docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', shows: 'The evaluation harness: nothing built' }],
    gap: 'No prompt-injection-resistant assembly; no output grounding evaluation or release gate.' },
  { id: 'BE-10', item: 'Standards: LTI 1.3 Advantage, OneRoster, QTI, Common Cartridge, CASE, Caliper, CLR/Open Badges, Edu-API', asks: 'Standards-first.', rows: ['INT-002', 'INT-003', 'INT-004', 'INT-005', 'INT-006', 'INT-007', 'INT-008'], standing: 'partial',
    evidence: [{ path: 'supabase/functions/lti/index.ts', shows: 'LTI 1.3 launch, deep linking, AGS, membership' }],
    gap: 'Everything but LTI is a document or a register row.' },
  { id: 'OC-01', item: 'A Semester-internal operations console organised around work', asks: 'Command Center, Customers, Tenants, Identity, Implementation, Support, Integrations, Reliability, Compliance, Revenue, Product Quality, Audit.', rows: ['SUP-001', 'SUP-003', 'IMP-001', 'COM-001'], standing: 'partial',
    evidence: [{ path: 'app/src/screens/University.tsx', shows: 'School-facing tabs: control plane, integrations, campaigns, operations, demand' }, { path: 'app/src/screens/Moderation.tsx', shows: 'The Trust & Safety console' }, { path: 'docs/DO-NOT-BUILD.md', shows: 'Rule 1: it lives under an existing root' }],
    gap: 'No cross-tenant console: none of Command Center, Customers, Tenants, Implementation, Reliability, Compliance, Revenue, Product Quality or Audit search exists. Revenue is held by D-009 (billing stays out).' },
  { id: 'OC-02', item: 'Academic operations modes', asks: 'The console changes for registration, assessment, grade and term-start periods.', rows: ['SRE-009'], standing: 'not-built',
    evidence: [{ path: 'docs/REGISTRATION-DAY-MODE.md', shows: 'The student\'s registration-day mode, which is a different thing' }],
    gap: 'Nothing switches an operator view by academic period.' },
  { id: 'OC-03', item: 'Console role tiers 0–4 and break-glass', asks: 'Executive read-only through two-person break-glass; no internal role inherits student-record access.', rows: ['IAM-010', 'IAM-011'], standing: 'built',
    evidence: [{ path: 'app/src/lib/rolelaunch.ts', shows: 'OPERATIONS_ONLY and STUDENT_RECORD: the boundary (this change)' }, { path: 'app/src/lib/rolelaunch.test.ts', shows: 'Holds every platform and commercial role to it, both directions' }],
    gap: 'The principle is now a test; the tiers and a two-person, time-limited break-glass are not modelled.' },
  { id: 'OC-04', item: 'Console UX: action queue, tenant context, no colour-only severity, saved views, confirmation with impact preview, runbook at the point of action, audit link', asks: 'All seven.', rows: ['SUP-001'], standing: 'partial',
    evidence: [{ path: 'app/src/components/institutional/IntegrationDashboard.tsx', shows: 'Reason, confirmation and audit log' }, { path: 'app/src/lib/status.ts', shows: 'Never colour alone' }],
    gap: 'No action queue, saved views, impact preview, runbook link or audit link outside the integration dashboard.' },
  { id: 'CO-01', item: 'Compliance automation', asks: 'Evidence freshness, control tests, HECVAT mapping, VPAT tracking, subprocessor notices, DPA status, access reviews, restore reminders, pen-test closure, AI evaluation expiry.', rows: ['SEC-011', 'SEC-012', 'A11Y-007'], standing: 'partial',
    evidence: [{ path: 'app/src/lib/hecvat-readiness.test.ts', shows: 'HECVAT readiness held to the tree' }, { path: 'app/src/lib/trust/subprocessors.ts', shows: 'The subprocessor register' }],
    gap: 'Registers are static: no freshness alerts, review deadlines or expiry reminders; docs/evidence/ does not exist.' },
  { id: 'CO-02', item: 'Public trust advantage', asks: 'A Student Data Bill of Rights, source labels, AI governance, an accessibility demo lab, a HECVAT/VPAT/DPA request centre, status transparency, portability, a no-surveillance pledge.', rows: ['SEC-013', 'SRE-010'], standing: 'partial',
    evidence: [{ path: 'app/src/site/pages.tsx', shows: 'Security, privacy and accessibility pages that say what is not done' }, { path: 'app/public/status.html', shows: 'Status transparency' }, { path: 'docs/operating-model/TRUST-BRAND-AND-LEGAL.md', shows: 'The no-surveillance statement, drafted and not on the site' }],
    gap: 'No Bill of Rights, AI-governance page, demo lab or request centre; the pledge is drafted but unpublished.' },
  { id: 'CO-03', item: 'Semester Launch Method as a product', asks: 'A branded, repeatable ten-step method with scope, owners, artifacts and success criteria.', rows: ['IMP-001'], standing: 'partial',
    evidence: [{ path: 'app/src/lib/governance/rollout.ts', shows: 'Phases with RACI evidence' }, { path: 'supabase/migrations/20260928050000_tenant_rollout.sql', shows: 'The gated state machine' }],
    gap: 'The ten steps are not named or mapped to the state machine.' },
  { id: 'CO-04', item: 'Design-partner councils and thought leadership', asks: 'Eight councils; a publication programme.', rows: ['PRG-001'], standing: 'not-built',
    evidence: [{ path: 'docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', shows: 'A customer advisory board, on paper' }],
    gap: 'None of the eight councils or the publications exist, and none is something a repository can build.' },
];

// ── 4. The waves and the decision rule ──────────────────────────────────────

export const WAVES: readonly { id: string; title: string; items: string[] }[] = [
  { id: 'Wave 0', title: 'Assess and stabilize', items: ['Repository, deployment, data and auth audit', 'Claims register and capability matrix', 'Route and component consolidation', 'Demo/production separation', 'P0 security, accessibility and reliability remediation'] },
  { id: 'Wave 1', title: 'Product foundation', items: ['AppShell and design system', 'Real auth, tenant and RLS', 'Today and Action Center', 'My Path, registration and plan core', 'Source, freshness and privacy states', 'Observability, backup and rollback'] },
  { id: 'Wave 2', title: 'Institutional trust and workflow', items: ['SSO and SCIM', 'Integration Control Plane', 'Trust, HECVAT, VPAT and DPA package', 'Institution Launch Center', 'Support, implementation and customer portal', 'Policy-as-code'] },
  { id: 'Wave 3', title: 'Native LMS and governed AI', items: ['Course Studio', 'Assignments and submissions', 'Assessment and accommodations', 'Gradebook, audit and passback', 'LTI, OneRoster, QTI and Common Cartridge', 'Contextual Ask Semester and Study Studio', 'AI evaluations and kill switch', 'Migration and parallel run'] },
  { id: 'Wave 4', title: 'Defensible ecosystem', items: ['Credential Wallet', 'Skills and evidence graph', 'CASE, Open Badges and CLR', 'Career, campus and opportunity network', 'Developer portal and sandbox', 'Benchmark and research programme'] },
];

/** The blueprint's ten criteria. Work is prioritised when it does at least two. */
export const RULE: readonly string[] = [
  'Makes a recurring student decision clearer.',
  'Reduces enterprise trust or procurement risk.',
  'Unblocks multiple product modules.',
  'Prevents loss of student work or data.',
  'Improves accessibility in a critical workflow.',
  'Makes implementation repeatable.',
  'Supports academic peak reliability.',
  'Creates portable student value.',
  'Reduces operational or support burden.',
  'Creates evidence for a defensible market claim.',
];

/** What the blueprint defers, whatever else it does. */
export const DEFER: readonly string[] = [
  'Mainly decorative.',
  'Duplicates another system without a clear advantage.',
  'Requires surveillance.',
  'Cannot be reliably supported.',
  'Lacks a clear source, authority or privacy model.',
];

export const RULE_MINIMUM = 2;

/**
 * Whether a piece of work passes the rule: at least two criteria, every one of
 * them a real criterion, and none of the deferrals. A criterion named twice
 * counts once, and one that is not on the list refuses the whole claim — a
 * justification with a made-up reason beside two real ones is not a
 * justification with two real reasons, it is one nobody checked.
 */
export function prioritised(criteria: readonly string[], deferrals: readonly string[] = []): boolean {
  if (deferrals.some((d) => DEFER.includes(d))) return false;
  if (criteria.some((c) => !RULE.includes(c))) return false;
  return new Set(criteria).size >= RULE_MINIMUM;
}

/** What this change built, and which criteria each satisfies. */
export const BUILT_HERE: readonly { what: string; criteria: string[] }[] = [
  { what: 'Practice paper kept, resumed and receipted (lib/examattempt.ts)', criteria: [RULE[3], RULE[6]] },
  { what: 'kill.ai_generation read by both AI runtimes (_shared/killswitch.ts)', criteria: [RULE[1], RULE[6], RULE[9]] },
  { what: 'No internal role holds a student-record capability (rolelaunch.ts)', criteria: [RULE[1], RULE[9]] },
  { what: 'This crosswalk, and four master rows re-read', criteria: [RULE[5], RULE[9]] },
];

export const ITEMS: readonly Item[] = [...POINTS, ...PRIORITIES, ...PLATFORM];
