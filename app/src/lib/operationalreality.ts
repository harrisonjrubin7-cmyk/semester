/**
 * Operational reality: what it takes for the platform to run as a company,
 * held to the tree.
 *
 * Two documents of 28 September 2026 — "anything else needed to make this a
 * reality" and "anything missing for this to be operational" — are kept under
 * `docs/expansion/` as supplied. Both say the same thing from different ends:
 * the vision, the domains, the compliance architecture and the commercial
 * model are described; what is missing is the execution, validation and
 * evidence layer — a master operating plan with owners and gates, a hard
 * launch definition, verified production behaviour, failure and load testing,
 * data-quality operations, support as a product, implementation capacity,
 * revenue operations, key-person resilience, and one go-live dossier per
 * launch.
 *
 * This module holds each of those to what the tree has. A great deal of it is
 * already a register, a guard or a game day nobody has run; the rest is named
 * here as missing so that nobody sells it. Under D-108's and D-111's rule: a
 * supplied PDF is never its own evidence, every cited file exists, every
 * standing is held to the kind of file it cites, and every edge case, risk,
 * game day or maturity control named here exists in the register that owns it.
 *
 * `docs/OPERATIONAL-REALITY-REGISTER.md` is rendered from this file by
 * `operationalreality.test.ts`; edit the data, then `npm run registers` from
 * app/. Standings were read at `origin/main` `ff52ba4` on 28 September 2026.
 */

import type { Seat } from './launchreadiness';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Anything-Else-Needed-to-Make-This-a-Reality.pdf',
    title: 'Anything else needed to make this a reality',
    what: 'The company operating system, the organizational model, the customer-proof engine, service tiers, the implementation factory, packaging discipline, brand and category assets, the whole-platform readiness test and the execution priorities.',
  },
  {
    path: 'docs/expansion/Anything-Missing-for-This-to-Be-Operational.pdf',
    title: 'Anything missing or not covered for this to be operational',
    what: 'The master operating plan, the launch readiness review, production verification, failure and recovery testing, capacity and cost proof, data quality, support as a product, implementation capacity, revenue operations, key-person resilience, the go-live dossier and the final checklist.',
  },
];

export const STANDINGS = ['tested', 'building', 'designed', 'not-started', 'held'] as const;
export type Standing = (typeof STANDINGS)[number];

export const STANDING_MEANING: Record<Standing, string> = {
  tested: 'An automated test, a database check or a CI script holds it',
  building: 'Code carries some of it; the gap says what it does not',
  designed: 'A document says what it would be; nothing runs',
  'not-started': 'Nothing in the tree beyond the register that names it',
  held: 'A decision already on main answers it differently, and holds until the owner reopens it',
};

export const DECISION_FILES: readonly string[] = ['docs/DECISION-LOG.md', 'DECISIONS.md', 'docs/DO-NOT-BUILD.md', 'docs/LAUNCH-DECISIONS.md', 'docs/architecture/0003-no-application-server.md'];

export interface Evidence {
  path: string;
  shows: string;
}

export interface Item {
  /** Stable: `OR-<section>-nn`. */
  id: string;
  item: string;
  asks: string;
  standing: Standing;
  evidence: Evidence[];
  gap: string;
}

type Row = [item: string, asks: string, standing: Standing, evidence: [path: string, shows: string][], gap: string];

const rows = (prefix: string, list: readonly Row[]): Item[] =>
  list.map(([item, asks, standing, evidence, gap], i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    item, asks, standing,
    evidence: evidence.map(([path, shows]) => ({ path, shows })),
    gap,
  }));

// ── 1. One master operating plan ────────────────────────────────────────────

/** The five permanent workstreams, and the seats that carry each today. */
export const WORKSTREAMS: readonly { workstream: string; goal: string; seats: readonly Seat[]; note: string }[] = [
  { workstream: 'Product & Engineering', goal: 'Build a coherent, accessible, reliable platform', seats: ['product', 'engineering', 'accessibility'], note: 'The master register’s PRG, STU, LMS, UX and A11Y rows.' },
  { workstream: 'Trust & Compliance', goal: 'Prove privacy, security, AI, accessibility and interoperability controls', seats: ['security', 'privacy', 'trust', 'data'], note: 'SEC, TRUST, AI and INT rows; docs/trust/; the proof calendar.' },
  { workstream: 'Customer Delivery', goal: 'Implement, train, support, measure and renew institutions', seats: ['success', 'operations', 'champion'], note: 'IMP and SUP rows; the ninety-day programme; pilot-to-production.' },
  { workstream: 'Commercial', goal: 'Generate qualified pipeline, sell pilots, manage contracts, collect revenue', seats: ['founder', 'finance'], note: 'COM and LEG rows; the deal desk; the GTM plan. No sales seat exists; the finance seat (D-118) is vacant.' },
  { workstream: 'Corporate Operations', goal: 'Entity, finance, people, insurance, legal, vendor and board operations', seats: ['founder', 'finance'], note: 'LEG-001 and nothing else; the finance seat (D-118) is vacant, and no people or legal seat exists.' },
];

/** The thirteen fields every initiative carries, and which register field already holds each. */
export const PLAN_FIELDS: readonly { field: string; carriedBy: string | null }[] = [
  { field: 'Initiative', carriedBy: 'masterregister `Requirement.capability`; ninety-day `title`' },
  { field: 'Outcome', carriedBy: 'masterregister `requirement`; commitments `scope`' },
  { field: 'Workstream', carriedBy: 'masterregister domain prefix; gates A–H' },
  { field: 'Owner', carriedBy: 'ninety-day `owner`; proofcalendar `owner`; risk `owner`; warroom `owner` — every seat vacant' },
  { field: 'Backup owner', carriedBy: null },
  { field: 'Budget', carriedBy: null },
  { field: 'Dependencies', carriedBy: 'ninety-day `after`; commitments `dependsOn`' },
  { field: 'Risk level', carriedBy: 'masterregister `severity` P0–P2; risk `RISKS`' },
  { field: 'Evidence required', carriedBy: 'ninety-day `evidence`; masterregister `validation`; proofcalendar `artifact`' },
  { field: 'Target date', carriedBy: 'proofcalendar `window`; commitments `due` — no date on a master row' },
  { field: 'Status', carriedBy: 'masterregister `status`; ninety-day `Status`' },
  { field: 'Go/no-go gate', carriedBy: 'masterregister gates A–H; launchreadiness `GATES`' },
  { field: 'Customer impact', carriedBy: 'commitments `communication`; console `CUSTOMER_IMPACT`' },
];

// ── 2. The company operating system ─────────────────────────────────────────

export const OPERATING_SYSTEM: readonly Item[] = rows('OR-OS', [
  ['Company', 'Legal entity, IP assignment, founder and contractor agreements, banking, accounting, tax, insurance, cap table, board and advisor governance.', 'designed',
    [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: a single-member LLC by attestation; COMP-03: no insurance'], ['docs/SAAS-LAUNCH-KIT.md', 'the formation checklist, item by item'], ['app/src/lib/masterregister.ts', 'LEG-001, designed']],
    'The entity exists by attestation; nothing else in the list is recorded.'],
  ['Commercial', 'Pricing book, order form, MSA, DPA, pilot agreement, SOW, security addendum, SLA, implementation terms, renewal terms, procurement response library, discount-approval policy.', 'tested',
    [['app/src/lib/governance/deal-desk.test.ts', 'the discount ladder and the refusals'], ['app/src/lib/gtm/rfp.test.ts', 'the procurement response library refuses unsupported claims'], ['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'the agreement outline'], ['docs/trust/DPA-CHECKLIST.md', 'the DPA checklist'], ['docs/trust/SLA.md', 'the SLA once it can be offered']],
    'Rules and outlines; no price book, no MSA, no order form, no signed anything (LEG-002, COM-002).'],
  ['People', 'An org chart for now and twelve months out, role scorecards, a hiring plan, a contractor policy, security, accessibility and AI training, onboarding and offboarding.', 'designed',
    [['docs/LAUNCH-READINESS-COUNCIL.md', 'twelve seats; four held by the founder, acting, eight vacant'], ['docs/trust/SOC2-READINESS.md', 'CC1-01 org chart and RACI; CC1-07 training before access; CC6-06 joiner-mover-leaver'], ['docs/operating-model/OPERATING-RHYTHM.md', 'monthly: hiring and capacity']],
    'One person; no org chart, scorecard, hiring plan, contractor policy or training record.'],
  ['Decision-making', 'Annual strategy, quarterly priorities, a product council, a security, privacy, accessibility and AI governance council, a customer escalation process, risk-acceptance authority, an ADR process.', 'tested',
    [['app/src/lib/governance/risk.test.ts', 'exceptions expire within 90 days; no P0 exception without executive, security and legal'], ['app/src/lib/launchreadiness.test.ts', 'risk acceptance is the founder seat’s, with an expiry'], ['docs/architecture/README.md', 'the ADR process, ten records'], ['docs/operating-model/OPERATING-RHYTHM.md', 'weekly, monthly, quarterly, annually'], ['SEMESTER-OPERATING-SYSTEM.md', 'company strategy: missing']],
    'The authorities are code and the cadence is a page; no strategy memo, and no council has met.'],
  ['Finance', 'Budget, runway, burn, cash forecast, unit economics, module-level gross margin, AI and cloud cost allocation, pricing and discount controls, a receivables process.', 'designed',
    [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'financial controls: 13-week cash forecast, budget vs actual, close review, tax nexus'], ['app/src/lib/ops/firstyear.ts', 'runway, ARR/MRR and gross margin as measures; the numbers live outside the repository'], ['app/src/lib/governance/maturity.ts', 'FO-01 cost allocation owed; FO-09 unit cost partial; FO-10 margin guardrails owed']],
    'Controls named, none operating; no budget, no forecast, no unit cost, no receivable.'],
]);

// ── 3. The organizational model ─────────────────────────────────────────────

/** Eight functions, each with its initial owner as the kit names it, the seat that carries it, and the non-negotiable. */
export const FUNCTIONS: readonly { fn: string; initialOwner: string; responsibility: string; seat: Seat | null; note: string }[] = [
  { fn: 'Product and design', initialOwner: 'Founder / product lead', responsibility: 'Product strategy, user research, plan, design quality', seat: 'product', note: '' },
  { fn: 'Engineering', initialOwner: 'Technical lead', responsibility: 'Architecture, delivery, reliability, technical debt', seat: 'engineering', note: '' },
  { fn: 'Security and privacy', initialOwner: 'A named internal owner plus qualified outside support', responsibility: 'Risk register, access, vendors, incidents, customer review', seat: 'security', note: 'The privacy seat is separate.' },
  { fn: 'Accessibility', initialOwner: 'A named owner plus disabled-user testing partners', responsibility: 'WCAG delivery, ACR/VPAT, remediation, support', seat: 'accessibility', note: 'No testing partner.' },
  { fn: 'AI governance', initialOwner: 'A named owner', responsibility: 'Model and provider approval, evaluations, policy, incident response', seat: 'trust', note: '' },
  { fn: 'Customer implementation', initialOwner: 'Customer-success lead', responsibility: 'Launch plan, configuration, training, adoption, value review', seat: 'success', note: '' },
  { fn: 'Support and operations', initialOwner: 'Operations / support lead', responsibility: 'Service desk, escalation, incident communications, runbooks', seat: 'operations', note: 'The operations seat (D-120), vacant; the master register’s Support and SRE sign-offs are its to give.' },
  { fn: 'Sales, partnerships, finance, legal', initialOwner: 'Founder, then outsourced until justified in-house', responsibility: 'Pipeline, proposals, contracts, references, tax, insurance, cash controls', seat: 'founder', note: 'Sales stays the founder’s; finance and legal have the finance seat (D-118), vacant.' },
];

export const DRI_RULE =
  'Every module needs a directly responsible individual for product, source and content accuracy, operations, support, privacy, accessibility, and revenue and entitlement decisions. charters.ts names product, engineering and support owners per module as role labels; no person holds any.';

// ── 4. The customer-proof engine ────────────────────────────────────────────

export const PROOF_ENGINE: readonly Item[] = rows('OR-PROOF', [
  ['Discovery', 'Institution pain map, stakeholder map, current-stack map, baseline friction metrics, target cohort, success definition.', 'tested',
    [['app/src/lib/gtm/pilot.ts', 'a workflow, cohort, baseline, sponsor, champion and metrics, or the plan is refused'], ['app/src/lib/gtm/pilot.test.ts', 'held'], ['docs/INSTITUTIONAL-CHANGE-MANAGEMENT.md', 'stakeholder mapping']],
    'No current-stack map or pain map template; no discovery has happened.'],
  ['Readiness', 'Security, privacy, accessibility and integration review, data map, roles, source-content owners, AI policy, training and launch communication plan.', 'tested',
    [['app/src/lib/launch/content.ts', 'CONTENT_READINESS: thirteen items with a named person each'], ['app/src/lib/launch/content.test.ts', 'held'], ['docs/operating-model/CHANGE-MANAGEMENT.md', 'the readiness assessment, scored 1–5, pilot threshold 30 of 50'], ['supabase/tenant-rollout.check.sql', 'exit gates need evidence']],
    'The scored assessment is a page; the content register has never been filled for a real school.'],
  ['Launch', 'SSO and tenant setup, source configuration, onboarding, training, office hours, live support, measured rollout.', 'tested',
    [['app/src/lib/launch/ninety-day.ts', 'tenant-flags, identity, content-loaded, uat, training, support-ready, launch-cohort'], ['app/src/lib/launch/ninety-day.test.ts', 'a step cannot be done before its prerequisites'], ['app/src/lib/governance/rollout.ts', 'CUTOVER_CHECKLIST, sixteen lines']],
    'No cohort has launched.'],
  ['Value review', 'Student clarity, work completion, verified-resource discovery, support handoff, accessibility success, adoption by role, implementation effort, support burden, operational evidence.', 'building',
    [['ANALYTICS.md', 'three figures, no cell under ten'], ['app/src/lib/ops/firstyear.ts', 'the first-year measures: measured, instrumented or defined'], ['app/src/lib/gtm/kpi.ts', 'no rate for an empty cohort; no causal claim']],
    'No verified-resource-discovery, handoff-success or accessibility-success measure is instrumented.'],
  ['Expansion', 'Mutual success plan, module plan, integration plan, commercial conversion, reference permission.', 'tested',
    [['app/src/lib/gtm/pilot.ts', 'pilotVerdict: convert or expand only signed and clean'], ['app/src/lib/governance/rollout.ts', 'expansion_decision gate; DECISION_OPTIONS'], ['app/src/lib/governance/rollout.test.ts', 'held']],
    'No mutual success plan structure exists (below).'],
]);

/** The three proofs universities want, and the measure that would show each. */
export const PROOFS: readonly { proof: string; shows: string; measure: string }[] = [
  { proof: 'Student proof', shows: 'Students find the next action, complete work and reach support faster', measure: 'ANALYTICS.md activation and actions; `firstyear.ts` students group; no time-to-support measure' },
  { proof: 'Staff proof', shows: 'Faculty, advisors and service offices do less repetitive work and receive better-prepared students', measure: 'No staff-side measure is instrumented; `advisor-meeting.ts` prepares the student, nothing counts the meeting' },
  { proof: 'IT proof', shows: 'The platform is secure, accessible, interoperable, observable and easier to govern than point solutions', measure: 'The master register and the proof calendar, 0 of 19 artifacts filed' },
];

// ── 5. Reliability and service operations ───────────────────────────────────

export interface ServiceTier extends Item {
  tier: string;
  examples: string;
  requirement: string;
}

type TierRow = [tier: string, examples: string, requirement: string, standing: Standing, evidence: [string, string][], gap: string];

const TIER_ROWS: readonly TierRow[] = [
  ['Tier 0', 'Public marketing and resource pages', 'Standard monitoring and support', 'tested',
    [['.github/workflows/production-smoke.yml', 'hourly public and gateway probes'], ['app/src/lib/statuspage.test.ts', 'the status page checks from the reader’s browser']], 'No tier word anywhere; the probe exists without being called a tier.'],
  ['Tier 1', 'Student planning, Today, actions, resource discovery', 'Business-critical monitoring and recovery', 'building',
    [['app/src/lib/governance/error-budgets.ts', 'today_load 99.9; SLOs per journey with burn policy'], ['app/scripts/golden-path.mjs', 'the golden path, in CI'], ['MONITORING.md', 'the one alert: AI spend']],
    'SLOs are declared and unmeasured; the only alert is spend.'],
  ['Tier 2', 'SSO, course access, assignments, submissions, integrations', 'Enhanced monitoring, tested fallback, defined incident response', 'building',
    [['app/src/lib/governance/error-budgets.ts', 'sign_in 99.95, assignment_draft_save 99.99'], ['app/src/lib/draft.test.ts', 'drafts survive'], ['docs/market-readiness/INCIDENT_RESPONSE.md', 'SEV1–SEV4'], ['app/src/lib/syncstatus.test.ts', 'stale-data fallback']],
    'No live SSO or LMS exchange has run; fallback is tested in unit tests only.'],
  ['Tier 3', 'Grading, assessments, payments, high-impact record workflows', 'Strongest controls, change-freeze periods, reconciliation, senior approval', 'held',
    [['docs/DECISION-LOG.md', 'D-009: payments remain held'], ['docs/decisions/D-1067.md', 'gradebook direction reopened; cutover remains gated'], ['app/src/lib/masterregister.ts', 'SRE-009: no academic peak calendar or change-freeze policy']],
    'The gradebook is built, but Tier 3 activation remains held pending a peak calendar, change-freeze policy, institutional parallel run and cutover approval; payments remain out by decision.'],
  ['Restricted', 'Basic-needs intake, accommodation workflows, health and safety data', 'Explicit institutional owner, restricted access, special privacy and safety controls', 'building',
    [['app/src/lib/ops/console.ts', 'the restricted classification: named grant, logged read'], ['docs/MODULE-PRIVACY-MODEL.md', 'no basic-needs case-manager role'], ['docs/CRISIS-RESPONSE-RUNBOOK.md', 'person-at-risk reports']],
    'A data class exists; no restricted workflow or owner does.'],
];

export const SERVICE_TIERS: readonly ServiceTier[] = TIER_ROWS.map(([tier, examples, requirement, standing, evidence, gap], i) => ({
  id: `OR-TIER-${String(i + 1).padStart(2, '0')}`,
  item: tier, asks: requirement, tier, examples, requirement, standing,
  evidence: evidence.map(([path, shows]) => ({ path, shows })),
  gap,
}));

/** The twelve definitions every tier owes, and what the tree has for each, for any tier. */
export const TIER_DEFINITIONS: readonly { definition: string; tree: string | null }[] = [
  { definition: 'Service-level objective', tree: '`error-budgets.ts` JOURNEYS, unmeasured' },
  { definition: 'Availability target', tree: 'docs/trust/SLA.md, once it can be offered' },
  { definition: 'RTO', tree: null },
  { definition: 'RPO', tree: null },
  { definition: 'Monitoring signals', tree: 'docs/trust/APM-RUNBOOK.md thresholds; only AI spend is wired' },
  { definition: 'On-call coverage', tree: null },
  { definition: 'Incident severity', tree: 'INCIDENT_RESPONSE.md SEV1–SEV4; APM-RUNBOOK P0–P3' },
  { definition: 'Customer communication rule', tree: 'INCIDENT_RESPONSE.md: contacts hear from us before their students; `incident-comms.ts`' },
  { definition: 'Maintenance windows', tree: null },
  { definition: 'Release and change-freeze periods', tree: '`error-budgets.ts` POLICY freezes on budget; `rollout.ts` avoids registration and finals; no calendar' },
  { definition: 'Fallback or manual procedure', tree: 'docs/REGISTRATION-DAY-MODE.md; docs/OFFLINE-MODE.md' },
  { definition: 'Recovery test cadence', tree: '`risk.ts` GAME_DAYS, sixteen, none held; proof calendar restore quarterly' },
];

// ── 6. The implementation factory ───────────────────────────────────────────

export const FACTORY: readonly Item[] = rows('OR-FACT', [
  ['Institution discovery workbook', 'A workbook for discovery.', 'not-started', [['docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md', 'DISCOVER gives it one line']], 'None exists.'],
  ['Integration and capability questionnaire', 'What the institution runs and can connect.', 'designed', [['docs/SSO-TENANT-ONBOARDING.md', '“Before anything technical”'], ['docs/SCHOOL_DATA_PACK.md', 'a format, not a questionnaire']], 'No questionnaire.'],
  ['Data-map template', 'Sources, categories, purposes, retention, access.', 'building', [['app/src/lib/governance/data-contracts.ts', 'contracts with steward roles and readiness()'], ['RETENTION.md', 'every table and its class']], 'A contract per domain, not a fillable map per institution.'],
  ['Source-content import template', 'How official content arrives.', 'not-started', [['docs/launch/CONTENT-READINESS-REGISTER.md', 'what must be ready, not how it is imported']], 'None exists.'],
  ['Service-directory template', 'The support directory the institution fills.', 'building', [['app/src/lib/campusdirectory.ts', 'the campus directory'], ['app/src/lib/serviceregister.ts', 'the resource model, nine of fifteen fields carried']], 'No template an institution takes and fills.'],
  ['Role and permission matrix', 'Who may do what.', 'designed', [['docs/INTEGRATION-PERMISSION-MATRIX.md', 'the matrix'], ['docs/institutional-rollout/tenant-role-schema-map.md', 'roles to schema']], 'Held as pages; `app_roles` is the code.'],
  ['AI policy configuration kit', 'The settings and the choices.', 'building', [['app/src/lib/launch/content.ts', 'ai_policy as a readiness item'], ['app/src/lib/governance/config-tiers.ts', 'policy settings and their reviewers']], 'No kit; a flag and a readiness line.'],
  ['Accessibility configuration checklist', 'What to check before launch.', 'designed', [['docs/ACCESSIBILITY-POLISH-CHECKLIST.md', 'the checklist'], ['docs/accessibility/AT-PASS-PROTOCOL.md', 'the AT pass']], 'Engineering-facing, not an institution’s checklist.'],
  ['Onboarding guides by role', 'Student, faculty, advisor, admin.', 'tested', [['app/src/lib/launch/content.ts', 'LAUNCH_PACKAGE: quick starts and admin onboarding'], ['app/src/lib/launch/content.test.ts', 'held'], ['docs/launch/STUDENT-QUICK-START.md', 'the student one']], 'Written; never given.'],
  ['SSO, LTI, OneRoster and SCIM setup guides', 'One per family.', 'designed', [['docs/SSO-TENANT-ONBOARDING.md', 'SSO'], ['docs/LTI-1.3-LAUNCH-RUNBOOK.md', 'LTI'], ['docs/SCIM-LIFECYCLE-MANAGEMENT.md', 'SCIM'], ['docs/SAML-IMPLEMENTATION-RUNBOOK.md', 'SAML']], 'No OneRoster guide.'],
  ['Testing scripts', 'What a school runs to accept.', 'tested', [['docs/GOLDEN-PATH-TEST-SCRIPT.md', 'the journey'], ['app/scripts/golden-path.mjs', 'the same, in CI'], ['docs/vanderbilt/identity-scim-acceptance.md', 'identity acceptance']], 'Run by CI, never by a school.'],
  ['Launch communications kit', 'Announcements per audience.', 'designed', [['docs/launch/ANNOUNCEMENT-TEMPLATES.md', 'the templates']], 'Never filled.'],
  ['Go-live checklist', 'The cutover.', 'tested', [['app/src/lib/governance/rollout.ts', 'CUTOVER_CHECKLIST'], ['app/src/lib/governance/rollout.test.ts', 'held'], ['docs/market-readiness/GO_LIVE_CHECKLIST.md', 'the technical list']], 'Never run.'],
  ['Hypercare plan', 'The first two weeks.', 'building', [['app/src/lib/launch/ninety-day.ts', 'hypercare: a daily issue log for two weeks']], 'A programme step, not a plan.'],
  ['30/60/90-day review', 'Reviews on a cadence.', 'designed', [['docs/90-DAY-LAUNCH-PROGRAM.md', 'reviews and escalation'], ['docs/PROOF-CALENDAR.md', 'month 1, 2, 3']], 'No review template.'],
  ['Expansion maturity model', 'What a mature deployment looks like.', 'not-started', [['docs/operating-model/PILOT-TO-PRODUCTION.md', 'phases 0–7, which end at production']], 'None exists.'],
  ['Offboarding and export checklist', 'Leaving cleanly.', 'designed', [['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'the hard boundaries and the steps']], 'No tenant-wide export job or deletion certificate (LEG-004).'],
]);

// ── 7. Packaging, brand and the readiness test ──────────────────────────────

/** One institutional package: modules phase in, but buying is not fragmented. */
export const PACKAGES: readonly { package: string; holds: string; kitModules: readonly string[] }[] = [
  { package: 'Semester Institutional', holds: 'The student operating system, native LMS and gradebook, institutional control plane, SSO/LTI/OneRoster and approved SIS integrations, plus pilot, migration, training, cutover and hypercare', kitModules: ['LK-MOD-01', 'LK-MOD-02', 'LK-MOD-03', 'LK-MOD-04', 'LK-MOD-05', 'LK-MOD-06', 'LK-MOD-07', 'LK-MOD-08', 'LK-MOD-09', 'LK-MOD-10', 'LK-MOD-11', 'LK-MOD-12'] },
];

export const BRAND: readonly { asset: string; asks: string; tree: string }[] = [
  { asset: 'A clear category', asks: 'The University Operating System / Academic Navigation Platform / Source-Aware Student Experience Layer', tree: 'None chosen; Company strategy is missing in SEMESTER-OPERATING-SYSTEM.md' },
  { asset: 'A clear belief', asks: 'Students should not need to understand a university’s bureaucracy or fragmented technology to make progress', tree: 'README.md and docs/launch/WHAT-IS-SEMESTER.md say it in their own words' },
  { asset: 'A clear proof', asks: 'One identity, one action layer, one trust model, one operating system', tree: 'docs/SEMESTER-PLATFORM-UNITY-PATTERNS.md; the five destinations' },
  { asset: 'A clear standard', asks: '“Semester Standard”: source, scope, status, accessibility, data agency, AI governance, portability, evidence', tree: 'Each is a register; nothing names the set as a standard' },
];

export const PUBLIC_WORKS: readonly { work: string; tree: string }[] = [
  { work: 'Academic Friction Index', tree: 'Unchecked in the service register (S26)' },
  { work: 'Transfer Navigation Playbook', tree: 'None; docs/TRANSFER-TRANSITION-HUB.md is the product design' },
  { work: 'Accessible Learning Toolkit', tree: 'None' },
  { work: 'Campus AI Governance Canvas', tree: 'None; docs/operating-model/AI-GOVERNANCE-BOARD.md is Semester’s own' },
  { work: 'Student Data Agency Guide', tree: 'None; docs/STUDENT-DATA-CONTROL-CENTER.md is the product' },
  { work: 'Interoperability Maturity Model', tree: 'Unchecked in the service register (S26)' },
];

/** The whole-platform readiness test: twelve questions every enabled domain answers, and the register that answers each today. */
export const READINESS_TEST: readonly { question: string; required: string; answeredBy: string }[] = [
  { question: 'What outcome does it create?', required: 'A measurable user or institution outcome, not “engagement”', answeredBy: '`charters.ts` successMetrics; SCOPE_QUESTIONS “What student decision does it clarify?”' },
  { question: 'Who owns it?', required: 'Named product, operational and institutional owner', answeredBy: '`charters.ts` owners (role labels); SCOPE_QUESTIONS “Who owns it?”; every seat vacant' },
  { question: 'What data does it use?', required: 'Mapped, classified, minimized, retained, controlled', answeredBy: 'RETENTION.md; `data-contracts.ts`; MODULE-PRIVACY-MODEL.md' },
  { question: 'Who can access it?', required: 'Role-based, least privilege, auditable, time-bound where needed', answeredBy: '`app_roles`; ADR 0002; supabase/rls-coverage.check.sql; advisor shares expire' },
  { question: 'What is official?', required: 'Source, authority and status explicitly visible', answeredBy: '`source.ts` labels; /platform/system-boundaries/' },
  { question: 'What can fail?', required: 'Risk analysis, monitoring, fallback, recovery, support runbook', answeredBy: 'EDGE-CASE-CATALOG.md; RISK-GOVERNANCE.md; RUNBOOKS.md; monitoring is one alert' },
  { question: 'Is it accessible?', required: 'Tested with critical assistive-technology paths and alternatives', answeredBy: 'WCAG-UI-AUDIT-SCORECARD.md; the axe smoke; no human AT pass' },
  { question: 'Is AI involved?', required: 'Policy, sources, provider, limits, evaluation, human review defined', answeredBy: '`ai-lifecycle.ts`; AI-ASSURANCE.md; the kill switch' },
  { question: 'How is it sold?', required: 'Entitlement, price, implementation scope, contract terms', answeredBy: 'Nothing: no entitlement per module, no price, no contract (SAAS-LAUNCH-KIT.md)' },
  { question: 'How is it supported?', required: 'Owner, support hours, escalation, SLA/SLO, knowledge base', answeredBy: 'SUPPORT_PLAYBOOK.md tiers; support tickets; no hours, owner or knowledge base' },
  { question: 'How does it leave?', required: 'Export, retention, deletion, offboarding, portability', answeredBy: 'DATA-PORTABILITY-AND-OFFBOARDING.md; student export and deletion tested; no tenant export' },
  { question: 'How do you prove it works?', required: 'Outcome metrics, customer evidence, audit evidence', answeredBy: 'ANALYTICS.md; PROOF-CALENDAR.md, 0 of 19 filed; no customer' },
];

export const PRIORITIES: readonly Item[] = rows('OR-PRI', [
  ['Company foundation', 'Entity, IP, contracts, finance, insurance, security and governance ownership.', 'designed', [['docs/SAAS-LAUNCH-KIT.md', 'the formation and insurance checklists, item by item'], ['docs/LAUNCH-DECISIONS.md', 'step 1']], 'Entity attested; the rest not started.'],
  ['Shared platform core', 'Identity, context, object model, permissions, source/scope/status, audit, search, notifications, data controls, integrations, design system.', 'tested', [['app/src/lib/source.test.ts', 'source labels'], ['supabase/rls-coverage.check.sql', 'every table has RLS'], ['app/src/lib/search.test.ts', 'one ranker'], ['docs/design/SEMESTER-UI-CONSTITUTION.md', 'the design system']], 'The core is the product as built.'],
  ['Every domain a configurable module with a readiness brief', 'Complete briefs, not disconnected feature requests.', 'tested', [['app/src/lib/governance/charters.ts', 'a charter per module flag'], ['app/src/lib/governance/charters.test.ts', 'held']], 'Charters exist for flagged modules; the domains without a flag have none.'],
  ['A design-partner council', 'Students, faculty, disability services, advising, IT and security, registrar, student affairs, transfer, career, executive leadership.', 'not-started', [['docs/operating-model/RISK-GOVERNANCE.md', 'a customer advisory board with no members']], 'None exists.'],
  ['A repeatable implementation factory', 'Templates, automation, training, measurable launch gates.', 'building', [['app/src/lib/governance/rollout.ts', 'the lifecycle and cutover'], ['docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md', 'DISCOVER → CONFIGURE → INTEGRATE → PILOT → EXPAND → OPERATE']], 'Seven of seventeen assets are missing or not started.'],
  ['Real service operations', 'Monitoring, incident response, release management, support, reliability tiers, customer communication.', 'building', [['app/src/lib/governance/error-budgets.ts', 'SLOs'], ['app/src/lib/supporttickets.ts', 'tickets'], ['MONITORING.md', 'one alert']], 'No on-call, no tiers, no measured SLO.'],
  ['Compliance and evidence as a live capability', 'HECVAT and TrustEd readiness, accessibility evidence, AI controls, an always-current procurement room.', 'tested', [['supabase/trust-room.check.sql', 'the room'], ['app/src/lib/hecvat-readiness.test.ts', 'a READY claim needs a filed document'], ['docs/PROOF-CALENDAR.md', '0 of 19 filed']], 'The room is live and nearly empty.'],
  ['Sell the unified story, deliver in waves', 'Modules activated in institution-configured waves.', 'tested', [['app/src/lib/ops/claims.ts', 'institution-configured is a register word with a floor'], ['app/src/lib/ops/claims.test.ts', 'held']], 'Nothing has been sold.'],
]);

// ── 8. The launch readiness review ──────────────────────────────────────────

export const REVIEW_DECISIONS: readonly { decision: string; when: string; tree: string }[] = [
  { decision: 'GO', when: 'All mandatory gates pass; known low-risk limitations are disclosed', tree: '`launchreadiness.decide()` go; docs/launch/KNOWN-LIMITATIONS.md is the disclosure' },
  { decision: 'GO WITH CONDITIONS', when: 'Only time-bound, documented, non-critical conditions remain, with owners and customer disclosures assigned', tree: '`launchreadiness.decide()` go-with-conditions (D-117): nothing open except P2/P3 blockers the founder accepted with a reason, an expiry and what pilot users are told; the verdict lists each condition' },
  { decision: 'NO-GO', when: 'Any P0 security, privacy, accessibility, grade-integrity, data-loss, operational-readiness, legal or unsupported-claim risk remains', tree: '`launchreadiness.decide()` no-go; the current verdict' },
];

// ── 9. Real production verification ────────────────────────────────────────

export interface Check {
  domain: string;
  check: string;
  /** A test, check or CI script that verifies it, or null. */
  guard: string | null;
}

const checks = (domain: string, list: readonly [check: string, guard: string | null][]): Check[] => list.map(([check, guard]) => ({ domain, check, guard }));

export const VERIFICATION: readonly Check[] = [
  ...checks('Authentication', [
    ['Sign-up', 'supabase/invites.check.sql'],
    ['Email verification', 'app/src/lib/cloud.test.ts'],
    ['Sign-in', 'app/scripts/golden-path.mjs'],
    ['Password reset', 'app/src/lib/cloud.test.ts'],
    ['SSO', 'supabase/identity-provisioning.check.sql'],
    ['MFA for privileged roles', null],
    ['Session timeout', null],
    ['Account recovery', 'app/src/lib/browser-recovery.test.ts'],
    ['Session revocation', 'app/src/lib/token.test.ts'],
    ['Deprovisioning', 'supabase/scim-gateway.check.sql'],
  ]),
  ...checks('Authorization', [
    ['Tenant isolation', 'supabase/tenancy.check.sql'],
    ['Role escalation attempts', 'supabase/rolegrants.check.sql'],
    ['Cross-course access', 'supabase/coursestudio.check.sql'],
    ['Cross-institution access', 'supabase/integration-rls-matrix.check.sql'],
    ['Support-access expiry', 'supabase/support-access.check.sql'],
    ['Revoked-share behaviour', 'supabase/advisor.check.sql'],
    ['API authorization', 'app/server/institution/auth.test.ts'],
    ['Storage-bucket rules', 'supabase/community.check.sql'],
    ['Admin-console boundaries', 'supabase/admins.check.sql'],
  ]),
  ...checks('Data lifecycle', [
    ['Create, update, delete', 'app/src/lib/records.test.ts'],
    ['Export', 'app/src/lib/export.test.ts'],
    ['Revoke share', 'supabase/familyshare.check.sql'],
    ['Disconnect integration', 'app/src/lib/revoke.test.ts'],
    ['Retention expiry', 'supabase/retention-sweeps.check.sql'],
    ['Backup expiration', null],
    ['Legal hold', 'supabase/integration-hardening.check.sql'],
    ['Restore', 'supabase/restore.sh'],
    ['Account deletion', 'supabase/deletion.check.sql'],
  ]),
  ...checks('Payment', [
    ['Successful payment', null],
    ['Failed payment', null],
    ['Duplicate payment', null],
    ['Refund', null],
    ['Invoice and receipt', null],
    ['Tax calculation', null],
    ['Entitlement upgrade and downgrade', 'app/src/lib/entitlement.test.ts'],
    ['Cancellation', null],
    ['Access revocation', 'supabase/tenant-plan.check.sql'],
  ]),
  ...checks('Integration', [
    ['SSO', 'supabase/tenant-sso-policy.check.sql'],
    ['LTI launch', 'supabase/lti.check.sql'],
    ['Roster and context data', 'supabase/lti-membership.check.sql'],
    ['Grade sync where enabled', 'supabase/ltiags.check.sql'],
    ['Token expiration', 'app/src/lib/ltikey.test.ts'],
    ['Permission revocation', 'app/src/lib/revoke.test.ts'],
    ['Rate limiting', 'supabase/rate-limits.check.sql'],
    ['Duplicate events', 'supabase/outbox.check.sql'],
    ['Source outage', null],
    ['Reconciliation', 'supabase/integration-quality.check.sql'],
    ['Graceful degradation', 'app/src/lib/syncstatus.test.ts'],
  ]),
  ...checks('Student workflows', [
    ['Today', 'app/scripts/golden-path.mjs'],
    ['Plan', 'app/src/lib/degree.test.ts'],
    ['Course and source access', 'app/src/lib/source.test.ts'],
    ['Assignment completion', 'app/src/lib/assignment.test.ts'],
    ['Study support', 'app/src/lib/studystudio.test.ts'],
    ['Advisor and service handoff', 'app/src/lib/help-routes.test.ts'],
    ['Notification preference', 'app/src/lib/notify.test.ts'],
    ['Accessibility preferences', 'app/scripts/accessibility-smoke.mjs'],
    ['Error recovery', 'app/src/lib/browser-recovery.test.ts'],
    ['Support ticket', 'supabase/support-tickets.check.sql'],
  ]),
  ...checks('Institution workflows', [
    ['Tenant setup', 'supabase/tenant-rollout.check.sql'],
    ['User and role administration', 'supabase/role-grant-audit.check.sql'],
    ['Source-content management', 'app/src/lib/launch/content.test.ts'],
    ['Policy configuration', 'app/src/lib/governance/config-tiers.test.ts'],
    ['Integration health', 'app/src/components/institutional/IntegrationDashboard.test.tsx'],
    ['Audit export', null],
    ['Support escalation', null],
    ['Data export', null],
    ['Customer offboarding', null],
  ]),
];

export const VERIFICATION_RULE =
  'Nothing here is complete until a real test has evidence: an automated test record, a manual script, a screen recording where helpful, an audit event, the result, an owner, a date, and the remediation if it failed. A guard in this table proves the behaviour in CI against a disposable database; none has been run against production with a record filed, because docs/evidence/ does not exist.';

// ── 10. Stress, failure and recovery ────────────────────────────────────────

export interface Failure {
  scenario: string;
  /** Ids in edgecases.ts (EC-), risk.ts (R-, GD-) or maturity.ts (two letters). Empty when none names it. */
  ids: readonly string[];
  runbook: string | null;
}

export const FAILURES: readonly Failure[] = [
  { scenario: 'Database unavailable', ids: ['GD-05'], runbook: 'docs/RUNBOOKS.md' },
  { scenario: 'Migration fails halfway', ids: ['EC-INF-06'], runbook: 'ROLLBACK.md' },
  { scenario: 'Backup restore required', ids: ['EC-INF-07', 'GD-13', 'R-10'], runbook: 'RESTORE.md' },
  { scenario: 'Regional or cloud-provider outage', ids: ['EC-INF-08', 'EX-05', 'DS-07'], runbook: 'docs/market-readiness/DISASTER_RECOVERY.md' },
  { scenario: 'DNS or CDN outage', ids: ['EC-INF-09', 'EX-09'], runbook: null },
  { scenario: 'Payment-provider outage', ids: ['EC-COM-01', 'GD-15', 'DS-04'], runbook: null },
  { scenario: 'Email-provider outage', ids: ['EC-INF-10'], runbook: null },
  { scenario: 'Identity-provider outage', ids: ['GD-01', 'EC-ID-04'], runbook: 'docs/INSTITUTIONAL-SSO-LAUNCH-READINESS.md' },
  { scenario: 'LMS or SIS integration outage', ids: ['GD-02', 'GD-03', 'EC-DQ-06'], runbook: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md' },
  { scenario: 'Webhook flood or duplicate events', ids: ['EC-DQ-04', 'EC-DQ-05', 'EC-INF-05', 'GD-07'], runbook: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md' },
  { scenario: 'AI-provider outage or unsafe-response surge', ids: ['EC-AI-04', 'EC-AI-09', 'GD-04', 'R-07'], runbook: 'docs/RUNBOOKS.md' },
  { scenario: 'Queue backlog', ids: ['GD-06'], runbook: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md' },
  { scenario: 'Storage or upload outage', ids: ['EC-INF-12'], runbook: null },
  { scenario: 'Expired certificate', ids: ['EC-INF-03'], runbook: null },
  { scenario: 'Secret or key-rotation failure', ids: ['EC-INF-01', 'EC-INF-02'], runbook: 'SECRETS.md' },
  { scenario: 'Malicious account or rate-limit attack', ids: ['EC-AI-09', 'R-12'], runbook: null },
  { scenario: 'Accidental administrator misconfiguration', ids: ['EC-INF-11', 'GD-10', 'EC-ID-08', 'GD-11'], runbook: null },
  { scenario: 'Critical staff member unavailable', ids: ['DS-01', 'DS-02', 'DS-11', 'R-08', 'R-09'], runbook: null },
];

/** What every scenario owes, and which register field carries it. */
export const SCENARIO_FIELDS: readonly { field: string; carriedBy: string | null }[] = [
  { field: 'Detection signal', carriedBy: '`edgecases.ts` guard, when one exists' },
  { field: 'Customer impact', carriedBy: '`risk.ts` Risk.notify' },
  { field: 'Severity', carriedBy: '`edgecases.ts` critical; `risk.ts` severity' },
  { field: 'Named incident commander', carriedBy: null },
  { field: 'Technical mitigation', carriedBy: '`risk.ts` mitigation' },
  { field: 'Manual fallback', carriedBy: '`charters.ts` fallback, per module' },
  { field: 'Customer communication template', carriedBy: 'docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md; `incident-comms.ts`' },
  { field: 'Recovery objective', carriedBy: null },
  { field: 'Evidence preservation', carriedBy: '`postmortem.ts`' },
  { field: 'Post-incident review owner', carriedBy: null },
];

export const RECOVERY_RULE = 'An untested backup is not a recovery plan. The restore rehearsal runs in CI against a disposable project; no restore of production has been timed, so no RTO or RPO can be stated (R-10).';

// ── 11. Capacity, performance and cost ──────────────────────────────────────

export const LOAD_SCENARIOS: readonly string[] = [
  'Concurrent sign-in at the start of term',
  'Course-material access before an exam',
  'Assignment-submission burst near a deadline',
  'Assessment delivery and autosave load',
  'Grade-release spike',
  'Notification and digest batch',
  'Roster sync and import volume',
  'Search-index update volume',
  'Document upload and processing volume',
  'AI request burst and provider throttling',
  'Admin and audit export volume',
];

export const THRESHOLDS: readonly { threshold: string; tree: string | null }[] = [
  { threshold: 'Response-time budgets', tree: 'docs/trust/APM-RUNBOOK.md p95 1.5 s / 4 s; `error-budgets.ts` LCP ≤ 2.5 s, INP ≤ 200 ms, guard null' },
  { threshold: 'Error-rate threshold', tree: 'APM-RUNBOOK.md 5xx > 1% / 5%, not wired' },
  { threshold: 'Queue-depth threshold', tree: 'APM-RUNBOOK.md queue age 10 / 30 min, not wired' },
  { threshold: 'Database saturation threshold', tree: 'APM-RUNBOOK.md 70% / 85%, not wired' },
  { threshold: 'Autosave durability requirement', tree: '`error-budgets.ts` assignment_draft_save 99.99; `draft.test.ts`' },
  { threshold: 'Maximum accepted upload and processing time', tree: null },
  { threshold: 'RTO and RPO by service tier', tree: null },
  { threshold: 'Cost per active student', tree: '`maturity.ts` FO-09, partial: no unit cost is measured' },
  { threshold: 'Cost per AI-successful action', tree: 'COMMERCIAL-GOVERNANCE.md dashboard design; usage recorded per tenant' },
  { threshold: 'Cost per large integration sync', tree: null },
  { threshold: 'Cost per support ticket', tree: null },
  { threshold: 'Load test of any journey', tree: null },
];

export const CAPACITY_RULE = 'One load harness exists, for the database only: supabase/load.sh runs registration-week and everyday-sync scenarios against every migration in CI, each against a latency budget, then asserts invariants, and PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md records its readings (SRE-007, D-154). Nothing loads PostgREST, GoTrue or the edge functions, and no journey that does not exist yet has a target.';

// ── 12. Data quality and migration readiness ────────────────────────────────

export const DATA_QUALITY: readonly Item[] = rows('OR-DQ', [
  ['Data reconciliation dashboard', 'What the source says against what Semester shows.', 'tested', [['app/src/lib/integration/reconcile.ts', 'reconciliation'], ['app/src/components/institutional/IntegrationDashboard.test.tsx', 'the dashboard renders it']], 'Admin-facing; never fed by a live source.'],
  ['Schema-drift detection', 'A source changes shape and somebody knows.', 'tested', [['app/src/lib/integration/drift.ts', 'detectDrift'], ['app/src/lib/integration/quality.test.ts', 'held'], ['supabase/fingerprint.sql', 'our own schema’s fingerprint, checked by rehearse.sh']], 'Held in code.'],
  ['Field-level lineage', 'Every field knows its source.', 'tested', [['app/src/lib/integration/lineage.ts', 'breachLevel, ownerProblems'], ['app/src/lib/integration/quality.test.ts', 'held']], 'Held in code.'],
  ['Source owner and freshness SLA', 'A person and a deadline per source.', 'tested', [['app/src/lib/governance/data-contracts.ts', 'CONTRACTS with steward roles; REQUIRED_TO_GO_LIVE'], ['app/src/lib/governance/data-contracts.test.ts', 'a contract is unstaffed until a named person holds each role'], ['app/src/lib/integration/freshness.ts', 'freshness']], 'Every contract is unstaffed.'],
  ['Import validation and duplicate resolution', 'Bad rows quarantined; duplicates resolved and reversible.', 'tested', [['app/src/lib/integration/pipeline.ts', 'quarantine'], ['app/src/lib/integration/duplicates.ts', 'resolveDuplicate, reverseResolution'], ['app/src/lib/integration/quality.test.ts', 'held']], 'Held in code.'],
  ['Connector contract tests', 'Every connector proves its declaration.', 'tested', [['app/src/lib/integration/adapter.ts', 'validateDeclaration'], ['app/src/lib/integration/mock-sis.test.ts', 'the mock SIS'], ['app/src/lib/integration/mock-campus.test.ts', 'the mock campus']], 'Mock adapters only; no live provider.'],
  ['Sync simulation sandbox', 'Run a sync without writing.', 'tested', [['app/src/lib/integration/simulate.ts', 'simulate'], ['app/server/institution/sandbox.test.ts', 'held'], ['docs/SYNC-SIMULATION-SANDBOX.md', 'the design']], 'Held in code.'],
  ['Dead-letter queue and repair workflow', 'Failed events are kept and replayed.', 'tested', [['app/src/lib/integration/retry.ts', 'retry'], ['supabase/outbox.check.sql', 'the outbox'], ['app/server/integration/worker.test.ts', 'the worker'], ['docs/INTEGRATION-OPERATOR-RUNBOOK.md', '§5 pause, resume, replay']], 'Held in code.'],
  ['Stale-data labels and fallback UX', 'A stale figure says so.', 'tested', [['app/src/lib/integration/freshness.ts', 'freshnessSentence'], ['app/src/lib/syncstatus.test.ts', 'the sync status'], ['supabase/canonical-display.check.sql', 'the canonical display']], 'Held in code.'],
  ['Source outage behaviour', 'What the product does when a source is down.', 'designed', [['docs/operating-model/RISK-GOVERNANCE.md', 'game days GD-02 and GD-03, not held']], 'A game day nobody has run.'],
  ['Customer-visible integration health', 'The institution sees the health of its own connections.', 'tested', [['app/src/lib/control-plane.ts', 'integration health'], ['app/src/lib/control-plane.test.ts', 'held']], 'Admin-facing in the app; no customer has seen it.'],
  ['Versioned data contracts', 'Mappings propose, simulate, approve, go live, roll back.', 'tested', [['app/src/lib/integration/mapping-versions.ts', 'the five states'], ['packages/institution/src/events.test.ts', 'event contracts'], ['docs/data-contract.md', 'the app sync contract']], 'Held in code.'],
  ['Migration rollback and reconciliation', 'A migration can be reversed and its result reconciled.', 'designed', [['app/src/lib/governance/rollout.ts', 'MIGRATION_ACCEPTANCE'], ['docs/DATA-MIGRATION-PLAN.md', 'the plan'], ['docs/market-readiness/MIGRATION_PLAYBOOK.md', 'the playbook']], 'Acceptance lines and a plan; no migration tooling.'],
]);

// ── 13. Support as a product ────────────────────────────────────────────────

export const SUPPORT: readonly Item[] = rows('OR-SUP', [
  ['Help center and searchable documentation', 'A place to look first.', 'tested', [['app/src/lib/guidebook.ts', 'the guidebook'], ['app/src/lib/guidebook.test.ts', 'held'], ['docs/launch/FAQ.md', 'the FAQ']], 'In-app only; no public help center.'],
  ['In-app support route', 'Ask for help from inside the product.', 'tested', [['app/src/lib/supporttickets.ts', 'seven categories; stable SUP references; 24 h / 72 h first-response targets'], ['supabase/support-tickets.check.sql', 'five a day; identity-free staff queue; reply idempotency; three-notice rolling-day cap'], ['app/src/components/console/supportqueue.test.tsx', 'operator queue, approved context, replies and resolution states'], ['app/src/lib/supportnotify.test.ts', 'generic email hint, origin/auth/capability refusal, vendor gate, durable retries and visible dead letters']], 'The individual beta queue is live and founder-staffed; production ticket creation, staff reply, Help-thread receipt and resolution passed UAT October 3, 2026. Email delivery mechanics reached provider acceptance in that UAT, but the worker and UI are parked until Resend vendor review, executed terms/DPA, ownership and activation approval are recorded; Outlook inbox receipt is also pending.'],
  ['Ticket intake, triage, priority, ownership, SLA, escalation', 'A queue that is worked.', 'building', [['app/src/lib/supporttickets.ts', 'categories and targets'], ['docs/market-readiness/SUPPORT_PLAYBOOK.md', 'T1–T3 and when to escalate']], 'Founder-operated beta owner; no published hours, rota, contracted escalation route or SLA commitment.'],
  ['Student, institution and technical routing', 'Three doors.', 'designed', [['docs/market-readiness/SUPPORT_PLAYBOOK.md', 'T1–T3 only'], ['app/src/lib/help-routes.ts', 'student → campus office, which is a different thing']], 'One door.'],
  ['Knowledge base with owner and review date', 'Articles that are somebody’s.', 'not-started', [['docs/launch/FAQ.md', 'a starting knowledge base with no owner or date']], 'None exists.'],
  ['Status page', 'Public, current.', 'tested', [['app/public/status.html', 'checks from the reader’s browser'], ['app/src/lib/statuspage.test.ts', 'held']], 'No subscriber notification (SRE-010).'],
  ['Incident communications', 'By audience, on a clock.', 'tested', [['app/src/lib/governance/incident-comms.ts', 'compose() by audience'], ['app/src/lib/governance/incident-comms.test.ts', 'held'], ['docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md', 'initial, update, resolution, handoff']], 'Never sent.'],
  ['Accessibility support route', 'A named way to ask for a format or a person.', 'tested', [['app/src/lib/supporttickets.ts', 'the accessibility category, 24 h'], ['supabase/support-tickets.check.sql', 'held']], 'No named person behind it.'],
  ['Privacy and security reporting route', 'Where a report goes.', 'designed', [['SECURITY.md', 'the owner: a personal mailbox; no security.txt'], ['app/src/lib/supporttickets.ts', 'the privacy category']], 'A personal Gmail; LAUNCH-DECISIONS item 2.'],
  ['AI safety report route', 'Report an unsafe or wrong AI answer.', 'building', [['app/src/lib/feedback.ts', 'wrong is a feedback kind'], ['app/src/lib/safetyreport.test.ts', 'safety reports']], 'Generic feedback; no AI-specific route or owner.'],
  ['Billing and refund route', 'Money questions.', 'held', [['docs/DECISION-LOG.md', 'D-009: billing stays out']], 'Out by decision.'],
  ['After-hours policy', 'What happens at 2 a.m.', 'designed', [['docs/trust/APM-RUNBOOK.md', '“There is no 24/7 coverage”']], 'Stated honestly; no policy beyond that (SUP-002).'],
  ['Customer admin escalation tree', 'Who at the institution hears what, in what order.', 'designed', [['docs/vanderbilt/incident-routing.md', 'routing for the first tenant, every owner unassigned']], 'One tenant’s draft.'],
  ['Support QA and recurring-issue review', 'Tickets read for patterns.', 'not-started', [['docs/market-readiness/SUPPORT_PLAYBOOK.md', 'no QA step']], 'None exists.'],
]);

export const TICKET_FIELDS: readonly { field: string; carriedBy: string | null }[] = [
  { field: 'Customer impact', carriedBy: null },
  { field: 'Severity', carriedBy: '`supporttickets.ts` category, which sets the target' },
  { field: 'Owner', carriedBy: null },
  { field: 'Target response', carriedBy: '`firstResponseHours`: 24 or 72' },
  { field: 'Target resolution or update cadence', carriedBy: null },
  { field: 'Escalation rule', carriedBy: 'SUPPORT_PLAYBOOK.md tiers' },
  { field: 'Communication template', carriedBy: 'INCIDENT_COMMUNICATION_TEMPLATES.md, for incidents only' },
  { field: 'Root-cause or problem-record link', carriedBy: '`postmortem.ts`, for incidents only' },
];

// ── 14. Implementation and change-management capacity ───────────────────────

export const IMPLEMENTATION: readonly Item[] = rows('OR-IMP', [
  ['Implementation manager role', 'A person who runs each implementation.', 'designed', [['docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md', 'roles on our side: implementation lead, engineer, support lead']], 'Nobody holds it; the success seat is vacant.'],
  ['Institution readiness assessment', 'Scored before a pilot starts.', 'designed', [['docs/operating-model/CHANGE-MANAGEMENT.md', 'ten items scored 1–5; pilot threshold 30 of 50, no item at 1']], 'A page; never scored.'],
  ['Executive and operational sponsor requirements', 'Both named before start.', 'tested', [['app/src/lib/gtm/pilot.ts', 'executiveSponsor and operationalChampion required'], ['app/src/lib/gtm/pilot.test.ts', 'held'], ['app/src/lib/governance/rollout.ts', 'sponsor_qualified and sponsor_go_live gates']], 'Held in code.'],
  ['Current-state workflow mapping', 'How the institution does it today.', 'not-started', [['docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md', 'one line under DISCOVER']], 'None exists.'],
  ['Data and integration discovery', 'What connects and what it carries.', 'designed', [['docs/SSO-TENANT-ONBOARDING.md', 'before anything technical'], ['docs/SCHOOL_DATA_PACK.md', 'the pack format']], 'No questionnaire.'],
  ['Content and source ownership inventory', 'Every official item has a named owner.', 'tested', [['app/src/lib/launch/content.ts', 'CONTENT_READINESS with namedPerson()'], ['app/src/lib/launch/content.test.ts', 'held']], 'Never filled for a real school.'],
  ['Policy configuration', 'The institution’s settings, reviewed by tier.', 'tested', [['app/src/lib/governance/config-tiers.ts', 'SETTINGS, TIER_REVIEWERS, NEVER'], ['app/src/lib/governance/config-tiers.test.ts', 'held']], 'Held in code.'],
  ['Accessibility and AI readiness', 'The statement and the policy before launch.', 'tested', [['app/src/lib/launch/content.ts', 'ai_policy, accessibility_statement, accessibility_guide, privacy_ai_guide'], ['app/src/lib/launch/content.test.ts', 'held']], 'Readiness lines; the accessibility statement itself is not started.'],
  ['Training by role', 'Student, faculty, advisor, admin.', 'tested', [['app/src/lib/launch/checklists.ts', 'FIRST_DAY per role'], ['app/src/lib/launch/checklists.test.ts', 'held'], ['docs/LAUNCH-CONTENT-AND-TRAINING.md', '§3 training']], 'Never delivered.'],
  ['Pilot communication calendar', 'Who hears what, when.', 'building', [['app/src/lib/launch/ninety-day.ts', 'comms'], ['app/src/lib/governance/maturity.ts', 'AD-06 partial: not a calendar an institution can take and fill']], 'A programme step, not a calendar.'],
  ['Student champion network', 'Students who carry the launch.', 'building', [['app/src/lib/launch/content.ts', 'ambassador_kit'], ['app/src/lib/launchreadiness.ts', 'the champion seat, vacant']], 'A kit line and a seat.'],
  ['Hypercare period', 'Two weeks of daily attention.', 'building', [['app/src/lib/launch/ninety-day.ts', 'hypercare']], 'A programme step.'],
  ['Adoption review', 'Read the numbers with the sponsor.', 'building', [['app/src/lib/launch/ninety-day.ts', 'midpoint-report'], ['docs/PROOF-CALENDAR.md', 'the cadence']], 'No template.'],
  ['Expansion decision', 'Decide what comes next, in writing.', 'tested', [['app/src/lib/governance/rollout.ts', 'expansion_decision; DECISION_OPTIONS'], ['app/src/lib/governance/rollout.test.ts', 'held']], 'Held in code.'],
]);

/** The Mutual Success Plan, field by field, and what already carries each. */
export const SUCCESS_PLAN: readonly { field: string; carriedBy: string | null }[] = [
  { field: 'Institution objective', carriedBy: '`PilotPlan.workflow`' },
  { field: 'Cohort', carriedBy: '`PilotPlan.cohort`' },
  { field: 'Enabled modules', carriedBy: null },
  { field: 'Success measures', carriedBy: '`PilotPlan.metrics`' },
  { field: 'Baseline', carriedBy: '`PilotPlan.baseline`; per-metric baseline' },
  { field: 'Target', carriedBy: 'per-metric target' },
  { field: 'Owner on each side', carriedBy: '`executiveSponsor`, `operationalChampion`; nothing on Semester’s side' },
  { field: 'Milestones', carriedBy: '`midpointReviewDate`, `conversionDate`' },
  { field: 'Risks', carriedBy: null },
  { field: 'Decision dates', carriedBy: '`conversionDate`' },
  { field: 'Expansion conditions', carriedBy: null },
];

// ── 15. Revenue operations and finance ──────────────────────────────────────

export const REVOPS: readonly { item: string; tree: string | null }[] = [
  { item: 'CRM source of truth', tree: '`gtm_accounts`, `gtm_stakeholders`, `gtm_decision_log`, written by Semester’s sales role; empty' },
  { item: 'Lead, account and contact hierarchy', tree: '`gtm_accounts` and `gtm_stakeholders`' },
  { item: 'Opportunity stages and exit criteria', tree: '`gtm/stages.ts` SALES_STAGES and SALES_EXIT, tested' },
  { item: 'Forecasting', tree: null },
  { item: 'Proposal generation', tree: null },
  { item: 'Contract approval', tree: '`deal-desk.ts` review(): the approvers a deal needs' },
  { item: 'Quote-to-order workflow', tree: null },
  { item: 'Invoice schedule', tree: null },
  { item: 'Collections and dunning', tree: null },
  { item: 'Revenue recognition guidance from a CPA', tree: 'COMMERCIAL-GOVERNANCE.md: subscription ratably, implementation on delivery; no CPA' },
  { item: 'Expense approval', tree: 'COMMERCIAL-GOVERNANCE.md: tiered by amount' },
  { item: 'Budget versus actual', tree: 'COMMERCIAL-GOVERNANCE.md: monthly; no budget exists' },
  { item: 'Monthly close', tree: 'COMMERCIAL-GOVERNANCE.md: close review; none has happened' },
  { item: 'Cash forecast', tree: 'COMMERCIAL-GOVERNANCE.md: 13-week rolling; none exists' },
  { item: 'Tax and nexus review', tree: 'COMMERCIAL-GOVERNANCE.md: external accountant, annually and per new state' },
  { item: 'Vendor approvals', tree: 'COMMERCIAL-GOVERNANCE.md: finance plus security for data processors; docs/trust/VENDOR-RISK-REGISTER.md' },
  { item: 'Procurement and purchasing policy', tree: null },
  { item: 'Discount approval matrix', tree: '`deal-desk.ts` DEAL_POLICY, tested' },
  { item: 'Financial reporting', tree: null },
];

// ── 16. Hiring and key-person resilience ────────────────────────────────────

export const PEOPLE: readonly { item: string; tree: string | null }[] = [
  { item: 'Role scorecards', tree: null },
  { item: 'Hiring plan', tree: 'OPERATING-RHYTHM.md monthly: open roles; none listed' },
  { item: 'Contractor and vendor access controls', tree: 'SOC2-READINESS.md CC6-06; `console.ts` break-glass with two approvers' },
  { item: 'Documented onboarding and offboarding', tree: 'SOC2-READINESS.md CC1-07, CC6-06; maturity DO-05 owed' },
  { item: 'Succession or backup owner for every critical system', tree: null },
  { item: 'Runbooks for production, support, finance, legal and sales', tree: 'docs/RUNBOOKS.md for production; nothing for finance, legal or sales' },
  { item: 'Emergency secrets access under strict control', tree: 'SECRETS.md: where they are, not who else may use them (DS-01)' },
  { item: 'Founder-unavailability plan', tree: 'R-09 asks for it; none written' },
  { item: 'Customer-communication delegation', tree: null },
  { item: 'Knowledge-transfer requirements', tree: 'maturity DO-02 owed' },
  { item: 'Investor and board reporting', tree: 'RISK-GOVERNANCE.md board-level report, ten items; no board' },
];

// ── 17. The go-live dossier ─────────────────────────────────────────────────

/** One dossier per launch, pilot, module or high-risk integration. Each section, and what already carries it. */
export const DOSSIER: readonly { section: string; holds: string; carriedBy: string | null }[] = [
  { section: 'Scope', holds: 'Enabled, excluded, deferred', carriedBy: '`RolloutRecord`; `PilotPlan`; no excluded list' },
  { section: 'Customer', holds: 'Institution, cohort, roles, owner, contract or order form, support contacts', carriedBy: '`gtm_accounts`, `gtm_pilots`; no order form' },
  { section: 'Product', holds: 'User journeys, success measures, known limitations, accessibility status', carriedBy: 'docs/GOLDEN-PATH-TEST-SCRIPT.md; docs/launch/KNOWN-LIMITATIONS.md; WCAG-UI-AUDIT-SCORECARD.md' },
  { section: 'Data', holds: 'Data map, classification, source owner, retention, sharing, deletion, integration scope, freshness plan', carriedBy: 'RETENTION.md; `data-contracts.ts`; MODULE-PRIVACY-MODEL.md' },
  { section: 'Security', holds: 'Threat model, roles, MFA, logging, tests, vulnerabilities, secrets, approvals', carriedBy: 'docs/INTEGRATION-THREAT-MODEL.md; SECRETS.md; no MFA, no pen test' },
  { section: 'AI', holds: 'Model and provider, data use, policy, evaluation, limitations, monitoring, disable plan', carriedBy: '`ai-lifecycle.ts`; AI-ASSURANCE.md; the kill switch' },
  { section: 'Operations', holds: 'SLOs, monitoring, alerts, on-call, support routes, runbooks, dependencies, RTO/RPO, rollback, DR evidence', carriedBy: '`error-budgets.ts`; RUNBOOKS.md; ROLLBACK.md; no on-call, no RTO/RPO, no DR evidence' },
  { section: 'Commercial', holds: 'Entitlements, pricing, invoicing, implementation scope, renewal path', carriedBy: '`tenant_plan`; `deal-desk.ts`; no price, no invoice' },
  { section: 'Change', holds: 'Training, communications, documentation, schedule, hypercare', carriedBy: '`launch/content.ts`; `launch/checklists.ts`; ninety-day steps' },
  { section: 'Evidence', holds: 'Links to every approval, test, policy, audit artifact and accepted exception', carriedBy: '`LaunchState` acceptances; docs/evidence/ does not exist' },
  { section: 'Decision', holds: 'Go / go with conditions / no-go; named approver; date; next review', carriedBy: '`launchreadiness.decide()`: go, go-with-conditions or no-go, with the conditions listed; no approver name or next-review date on the verdict' },
];

// ── 18. The final checklist ─────────────────────────────────────────────────

export type Answer = 'yes' | 'partly' | 'no';

export const FINAL_CHECKLIST: readonly { line: string; answer: Answer; why: string }[] = [
  { line: 'A registered company, bank account, accounting, contracts, IP ownership, insurance and a cash and runway model', answer: 'no', why: 'An LLC by attestation; nothing else.' },
  { line: 'We can sell, sign, invoice, collect, support, renew and offboard a customer', answer: 'no', why: 'No signatory, no invoice, no support hours; student offboarding only.' },
  { line: 'At least one paid, bounded pilot with named owners, success measures, data scope and a conversion path', answer: 'no', why: 'The rules that would bound it are tested; no pilot exists.' },
  { line: 'A student can create an account or use SSO, reach real value, receive help, control eligible data and recover from failure', answer: 'partly', why: 'Sign-up, value, data controls and recovery are tested; help is a ticket nobody answers; SSO has no live exchange.' },
  { line: 'An institution can configure its tenant, manage roles, control policies, review integrations, access evidence and receive support', answer: 'partly', why: 'Configuration, roles, policies and integration health are tested; no evidence room contents, no support.' },
  { line: 'Production is separate from staging; secrets protected; access reviewed; isolation, backups, restore, monitoring, alerting and rollback tested', answer: 'partly', why: 'Isolation and restore are tested in CI; no production restore, one alert, no access review, rollback untested in production.' },
  { line: 'We have tested performance, failure, recovery, security, privacy, accessibility, AI behaviour and integration reconciliation', answer: 'partly', why: 'Reconciliation, privacy and AI behaviour are tested; no load test, no game day held, no pen test, no human AT pass.' },
  { line: 'Written and tested runbooks for incidents, customer communication, data requests, integration failures and vendor outages', answer: 'partly', why: 'Written for incidents, communication and integrations; none tested; none for vendor outages.' },
  { line: 'A current Trust Center, procurement room, DPA, security package, accessibility statement, AI policy, retention policy and subprocessor list', answer: 'partly', why: 'Room, security whitepaper, retention and subprocessors are current; no public Trust Center, DPA, accessibility statement or in-force AI policy.' },
  { line: 'A product governance council, evidence register, release gates, risk and exception process and accountable owners', answer: 'partly', why: 'Gates and the exception process are code; the council has no members, the evidence register is empty, every owner is vacant.' },
  { line: 'We know which features are live, pilot-only or planned, and never sell or imply unsupported capability', answer: 'yes', why: 'The claims register gives every public claim a register word with a floor, and the build fails above it.' },
  { line: 'We can measure activation, reliability, support quality, implementation effort, accessibility success, customer value, revenue, cost, retention and expansion', answer: 'partly', why: 'Activation is measured; reliability and cost are instrumented; the rest are defined only.' },
];

export const BOTTOM_LINE: readonly string[] = ['Build it', 'Test it', 'Secure it', 'Document it', 'Staff it', 'Sell it', 'Implement it', 'Support it', 'Measure it', 'Recover it', 'Renew it'];

/** Every item with a standing. */
export const ITEMS: readonly Item[] = [...OPERATING_SYSTEM, ...PROOF_ENGINE, ...SERVICE_TIERS, ...FACTORY, ...PRIORITIES, ...DATA_QUALITY, ...SUPPORT, ...IMPLEMENTATION];
