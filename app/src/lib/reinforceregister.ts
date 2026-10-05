/**
 * The reinforcement register: seven briefs of 29 September 2026 on what else
 * would make Semester the leader and the benchmark of its market — the
 * operating disciplines, the final moats, the executive benchmark answer, the
 * feature benchmark with TrustEd Apps, pricing and K–12, the 1EdTech
 * compliance and go-to-market playbook with its summary, and the leader and
 * pioneer brief — read against the tree.
 *
 * `docs/REINFORCEMENT-REGISTER.md` is rendered from this file and
 * `ops/operatingmodel.ts` by `reinforceregister.test.ts`; edit the data, then
 * `npm run registers` from app/.
 *
 * ## Seven briefs, one register
 *
 * The briefs repeat each other: the Semester Graph is asked for four times,
 * the procurement package five, the councils four, the Registration and Path
 * Pilot three. A row here is one thing the tree would have to hold, and
 * `asks` lists every brief item that asks for it, so a repeated ask is one row
 * with several citations rather than several rows that drift apart.
 *
 * Most of what they ask for already has a home. The one-operating-system
 * register (`oneos.ts`), the market-leadership register (`ops/leadership.ts`)
 * and the Connect register (`connectregister.ts`) read earlier briefs the same
 * way; where a row here is the same thing as one of theirs, `overlaps` names
 * it (`oneos:graph`, `lead:PL-13`, `connect:SME-001`), the test holds that it
 * exists, and the status is read again rather than copied.
 *
 * ## Statuses and the evidence rule
 *
 * The communities register's: `designed` cites a document, `building` cites
 * code, `tested` cites a test, `not-started` cites no code. Nothing is above
 * `tested`, because nothing has an artifact under `docs/evidence/`. A supplied
 * brief is never its own evidence.
 *
 * ## Where a brief and the tree disagree
 *
 * Some asks conflict with a decision already recorded — a price, a pilot
 * length, a statement already on the site. Those are `CONFLICTS`: the brief's
 * ask, the tree's position, and whose decision it is. Nothing here changes a
 * recorded decision; a merged decision is a decision.
 *
 * Assessed against `origin/main` at `beaa839` on 2026-09-29, with this
 * branch's own files counted where they close an item.
 */
import type { Seat } from './launchreadiness';
import type { Status } from './communitiesregister';

export { STATUSES, type Status } from './communitiesregister';

/** The seven briefs, by the letter an `asks` citation uses. */
export const BRIEFS: readonly { key: string; path: string; title: string; items: number }[] = [
  { key: 'R', path: 'docs/expansion/Reinforcing-the-Operating-Disciplines.pdf', title: 'Any other area or aspect that can be further reinforced, expanded, improved and strengthened', items: 22 },
  { key: 'M', path: 'docs/expansion/Final-Moats-and-the-Benchmark-Checklist.pdf', title: 'Anything else to make this bulletproof, irresistible, the front runner and the benchmark', items: 18 },
  { key: 'E', path: 'docs/expansion/Executive-Answer-Edtech-Benchmark-Audit.pdf', title: 'Executive answer: edtech benchmark audit', items: 10 },
  { key: 'F', path: 'docs/expansion/Feature-Benchmark-TrustEd-Pricing-and-K12.pdf', title: 'Feature benchmark dashboard, TrustEd Apps gap matrix, pricing and margins, K–12 playbook', items: 5 },
  { key: 'P', path: 'docs/expansion/1EdTech-Compliance-and-GTM-Playbook.pdf', title: 'Semester: 1EdTech TrustEd Apps compliance, competitive benchmark, GTM and university packaging playbook', items: 10 },
  { key: 'V', path: 'docs/expansion/TrustEd-Apps-Vetting-Matrix-Summary.pdf', title: 'TrustEd Apps vetting matrix: the summary and the five most urgent actions', items: 5 },
  { key: 'L', path: 'docs/expansion/Leader-and-Pioneer-of-the-Category.pdf', title: 'Anything else to make me the leader and pioneer of this market', items: 16 },
];

export interface Area {
  id: string;
  title: string;
  why: string;
}

export interface Item {
  id: string;
  item: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
  /** Brief items that ask for this, as `R3`, `M12`, `E`, `P6`. */
  asks: readonly string[];
  /** The same thing in another register: `oneos:<id>`, `lead:<id>`, `connect:<id>`. */
  overlaps: readonly string[];
}

type Row = [item: string, status: Status, evidence: [path: string, shows: string][], gap: string, asks: string[], overlaps?: string[]];

const T = 'tested' as const;
const B = 'building' as const;
const D = 'designed' as const;
const N = 'not-started' as const;

const AREA_LIST: readonly (Area & { rows: readonly Row[] })[] = [
  {
    id: 'OPM',
    title: 'The operating model',
    why: 'Every product area has a primary user, a problem, five owners, a success metric, its dependencies, a fallback and a maturity stage, so no module drifts away from the system it belongs to.',
    rows: [
      ['Ten product areas, each with its fourteen fields', T, [['app/src/lib/ops/operatingmodel.ts', 'PRODUCT_AREAS'], ['app/src/lib/ops/operatingmodel.test.ts', 'every field filled, every owner a seat, every dependency an area']], 'Most ownerships rest on vacant seats; the rendered table says which.', ['R1']],
      ['Per-feature charters below the areas', T, [['app/src/lib/governance/charters.ts', 'one charter per module and ops flag'], ['app/src/lib/governance/charters.test.ts', 'no empty field, no lapsed review']], 'Eight charters; most of what students use is not behind a chartered flag.', ['R1', 'M16']],
      ['A named owner for every seat the areas rest on', B, [['app/src/lib/launchreadiness.ts', 'COUNCIL: four seats held, all by the founder']], 'Eight of twelve seats are vacant.', ['R1', 'M13']],
    ],
  },
  {
    id: 'LIF',
    title: 'One student lifecycle',
    why: 'Semester serves a person before, during and after college, and keeps the student’s own context across every stage.',
    rows: [
      ['Life stages from prospect to alumni as one vocabulary', T, [['app/src/lib/pathway.ts', 'LIFE_STAGES'], ['app/src/lib/pathway.test.ts', 'held'], ['docs/LIFECYCLE_REQUIREMENTS.md', 'one identity across stages']], 'Four stage vocabularies (pathway, launchpad, learner pathways, role) and no state machine joining them; a stage changes nothing about identity or permissions.', ['R2', 'F1']],
      ['Admitted and first-term students', B, [['app/src/lib/launchpad.ts', 'prospect to first term'], ['app/src/screens/Launchpad.tsx', 'the checklist']], 'No test of its own.', ['R2', 'R18']],
      ['Transfer, working, caregiver, online, graduate and international students', T, [['app/src/lib/learner-pathways.ts', 'nine pathways'], ['app/src/lib/learner-pathways.test.ts', 'held'], ['app/src/lib/transferhub.test.ts', 'the transfer hub']], '', ['R2']],
      ['Study abroad and near graduation', T, [['app/src/lib/abroad.test.ts', 'credit mapping'], ['app/src/lib/graduation.test.ts', 'the projection']], 'No graduation-to-alumni transition.', ['R2']],
      ['Alumni: portfolio, mentoring and continuing access', D, [['docs/CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md', 'nothing built yet']], 'The alumni role exists and is not ready.', ['R2', 'L4']],
    ],
  },
  {
    id: 'GRA',
    title: 'The Semester Graph and the university knowledge graph',
    why: 'One explainable graph joins the student, their goals, requirements, courses, work, skills, portfolio, opportunities, mentors and actions — and the need, office, resource, appointment and outcome — so every surface can say why.',
    rows: [
      ['Student → goal → requirement → course → assignment → skill → artifact → opportunity', B, [['app/src/lib/skills-graph.ts', 'course and work to skill to opportunity'], ['app/src/lib/skills-graph.test.ts', 'the skills part']], 'Skills only: no goal, requirement or assignment node joins it.', ['R3', 'M2', 'L6'], ['oneos:graph']],
      ['Need → office → resource → appointment → follow-up → outcome', B, [['app/src/lib/nowrongdoor.ts', 'need to office'], ['app/src/lib/office-actions.test.ts', 'office to action']], 'Nothing records the appointment, the follow-up or the student’s outcome.', ['R3', 'L6']],
      ['Every recommendation explainable', T, [['app/src/lib/actions.ts', 'reason, source and alternatives'], ['app/src/lib/actions.test.ts', 'held'], ['app/src/lib/whydue.test.ts', 'why this card, now']], '', ['R3', 'L6'], ['oneos:ac-why']],
      ['An owner, source, verification, review date, population, accessibility and handoff on every campus item', B, [['app/src/lib/campusdirectory.ts', 'the directory'], ['app/src/lib/integration/catalog.ts', 'a steward per source']], 'No review date or applicable population on a directory entry.', ['M2', 'R21'], ['oneos:campus-graph', 'lead:PL-07']],
      ['The graph kept portable, correctable and auditable', T, [['app/src/lib/export.test.ts', 'everything leaves as files'], ['supabase/evidence-graphs.check.sql', 'tenant and person isolation']], 'No correction flow on a graph edge.', ['L6', 'M3']],
    ],
  },
  {
    id: 'ACT',
    title: 'The next right action',
    why: 'The Action Center turns course, calendar, plan, advisor, campus, job and registration signals into one explainable action with what happens if the student acts or waits.',
    rows: [
      ['What happened, why it matters, its source and when it matters', T, [['app/src/lib/actions.ts', 'the envelope'], ['app/src/components/ActionCenter.test.tsx', 'held']], '', ['L5'], ['oneos:ac-envelope', 'oneos:ac-source']],
      ['What happens if the student acts, and if they wait', T, [['app/src/lib/actions.test.ts', 'consequence']], '', ['L5'], ['oneos:ac-consequence']],
      ['Primary action, alternatives and who can help', T, [['app/src/components/ActionCenter.test.tsx', 'alternatives and the help route']], '', ['L5'], ['oneos:ac-next']],
      ['Official, estimated, imported or needs review on every action', T, [['app/src/lib/source.ts', 'the source vocabulary'], ['app/src/lib/source.test.ts', 'held']], 'Confidence is not a field.', ['L5', 'E', 'F1']],
    ],
  },
  {
    id: 'OUT',
    title: 'Outcomes and measurement',
    why: 'Success is a measurable, student-controlled outcome per module, measured in four separate layers, and never a claim about grades or retention from engagement.',
    rows: [
      ['The never-measured list: risk scores, reading time, attention, individual AI use', T, [['app/src/lib/institution-ops.ts', 'FORBIDDEN'], ['app/src/lib/institution-ops.test.ts', 'refused, not hidden'], ['app/src/lib/cohortfloor.test.ts', 'no cohort under ten']], '', ['R4', 'M11', 'L3']],
      ['A student-controlled outcome for each module (My Path to Passport)', N, [['docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', 'what may be measured']], 'Three server marks exist (ANALYTICS.md); no module has its outcome defined as an event, and a fourth mark needs a decision (D-005).', ['R4', 'E', 'P']],
      ['Activation: time to first value, Path Snapshot rate, backup-course and agenda rates, week-4 retention', D, [['app/src/lib/gtm/kpi.ts', 'the funnel formulas'], ['ANALYTICS.md', 'three marks']], 'The formulas exist; none of the named rates is instrumented.', ['E', 'P', 'F'], ['lead:PL-03']],
      ['Student clarity: “I understand what I need to do next”', T, [['app/src/lib/clarity.ts', 'one question, on the device'], ['app/src/lib/clarity.test.ts', 'held']], 'The answer never leaves the device, so no pilot can aggregate it yet.', ['E', 'F', 'P', 'L4']],
      ['The Outcomes Lab: adoption, meaningful use, experience, operations and educational outcomes, measured apart', D, [['app/src/lib/ops/firstyear.ts', 'the measures, targets null'], ['docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', 'the research practice']], 'The layers are not one framework; educational outcomes need a study design and approvals nobody has written (expansion register RES).', ['M11']],
      ['No causal claim from engagement', T, [['app/src/lib/ops/claims.ts', 'PROOF_RULES'], ['app/src/lib/ops/claims.test.ts', 'held'], ['app/src/site/site.test.tsx', 'no page says Semester improves retention, persistence, graduation or grades']], '', ['M11', 'M17', 'E']],
    ],
  },
  {
    id: 'IMP',
    title: 'Implementation as a product',
    why: 'An institution can launch in weeks rather than quarters, through a repeatable playbook, a launch kit and a migration path that never forces a replacement.',
    rows: [
      ['A thirteen-phase playbook, each phase with stakeholders, inputs, outputs, owner, risks and a go/no-go', D, [['docs/operating-model/PILOT-TO-PRODUCTION.md', 'phases 0–7 with owners and exit criteria'], ['docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md', 'six one-line phases']], 'About nine of the thirteen phases are covered; no single artifact carries all of them.', ['R5', 'E'], ['lead:PL-14']],
      ['Rollout states with exit gates, read-only first', T, [['app/src/lib/governance/rollout.ts', 'the chain'], ['supabase/tenant-rollout.check.sql', 'enforced by the database']], '', ['R5', 'R22', 'L4', 'L9']],
      ['Integration sandbox and mapping versions with rollback', T, [['app/src/lib/integration/quality.test.ts', 'propose, simulate, approve, roll back']], 'docs/SYNC-SIMULATION-SANDBOX.md still says nothing is built.', ['R22', 'M8', 'L9']],
      ['Content, onboarding and launch templates', T, [['app/src/lib/launch/content.test.ts', 'the launch package'], ['docs/launch/STUDENT-QUICK-START.md', 'ready']], 'Faculty and advisor quick starts and the ambassador kit are not started.', ['M8', 'L9']],
      ['Guided tenant setup and an SSO wizard', D, [['docs/SSO-TENANT-ONBOARDING.md', 'a checklist'], ['supabase/tenant-sso-policy.check.sql', 'the policy the wizard would write']], 'No wizard; the SSO tables have no screen.', ['M8', 'L9', 'E'], ['oneos:ic-tenant']],
      ['Every pilot runs 26 weeks: the Registration and Path Pilot length', T, [['app/src/lib/gtm/pilot.ts', 'PILOT_WEEKS'], ['app/src/lib/gtm/pilot.test.ts', 'exactly 182 days, or refused']], 'The owner set it (D-134). The offer itself — 25–100 students, the explicit exclusions, the price sheet — is not packaged as one document.', ['E', 'P', 'V']],
      ['Pilot dashboard', B, [['app/src/lib/gtm/pilot.ts', 'readiness and verdict']], 'No screen reads the pilot tables.', ['M8', 'L9']],
      ['Institution data migration: plans, catalog, directories, events', N, [['docs/market-readiness/MIGRATION_PLAYBOOK.md', 'no production load path; evidence path and roster staging only']], 'Student-side import only; no SIS, ERP, Google or Microsoft mapping template.', ['R22']],
      ['Parallel-run mode', N, [], 'Named once in docs/INSTITUTIONAL_REQUIREMENTS.md; nothing designs it.', ['R22']],
    ],
  },
  {
    id: 'PKG',
    title: 'Editions, pricing and margins',
    why: 'One platform sold as purpose-built editions, priced so the operating cost of every package can be explained, and never in a way that makes a student doubt a recommendation.',
    rows: [
      ['Editions on one identity, one data model and one console', B, [['app/src/lib/launchkit.ts', 'twelve modules with buyer, metric and guardrail'], ['app/src/lib/entitlement.test.ts', 'resolution order, in shadow']], 'The packages are not the briefs’ editions, and no entitlement is tied to a package.', ['R6', 'E', 'P']],
      ['Student plans: Free, Plus, Pro', T, [['app/src/lib/plans.ts', 'Plus $7.99 or $59, Pro planned at $14.99 or $99'], ['app/src/lib/plans.test.ts', 'the pricing page and the catalog checkout charges, held to one price']], 'Pro has no catalog price and cannot be bought.', ['E', 'F', 'P']],
      ['Institution price floors and implementation fees', T, [['app/src/lib/governance/deal-desk.ts', 'minimum ACV per segment'], ['app/src/lib/governance/deal-desk.test.ts', 'held']], '', ['R19', 'F', 'P']],
      ['An institution value and pricing calculator', N, [['docs/SAAS-LAUNCH-KIT.md', 'the calculator’s inputs, and “none exists”']], 'No function computes an estimate from pilot size, registration volume, advising capacity or integration scope.', ['R7', 'F']],
      ['A gross-margin model by package: cloud, AI, storage, notifications, payments, support, implementation, moderation', N, [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'the AI unit-economics dashboard, designed']], 'Costs are recorded (the AI journal) and formulas tested (kpi.ts); nothing joins them per package.', ['R19', 'F', 'P']],
      ['AI priced on real cost: per-tenant budget and per-account allowance', T, [['supabase/gateway-journal.check.sql', 'tokens and cost per action']], 'No cost per active user or per meaningful action is reported.', ['R19', 'F']],
      ['Export, deletion and a saved plan never behind a paywall', T, [['app/src/lib/plans.test.ts', 'ALWAYS_INCLUDED']], '', ['M18', 'E', 'F']],
      ['Sponsored content labelled and kept out of academic, advising and support recommendations', T, [['app/src/lib/gtm/sponsor.test.ts', 'protected surfaces'], ['app/src/lib/gtm/campaign.test.ts', 'no targeting on education records']], 'No placement surface exists, by design.', ['R20', 'M18', 'F', 'P']],
      ['Community participation and support discovery never gated by a plan', B, [['app/src/community/governance.ts', 'REVENUE_NOT_TAKEN names it']], 'Nothing in entitlement resolution carves support or community out of plan gating.', ['M18']],
      ['Employer visibility opt-in, time-limited and auditable', T, [['supabase/expansion.check.sql', 'opt-in visibility and view log']], 'Expiry is enforced by a policy the check does not exercise.', ['M18', 'L4'], ['connect:CTL-008']],
    ],
  },
  {
    id: 'PRC',
    title: 'Procurement before the sales call',
    why: 'A buyer gets the whole package — security, privacy, accessibility, AI, implementation and contract — before asking, through a Trust Center and a Trust Room.',
    rows: [
      ['The policy set, each with its status', T, [['app/src/lib/ops/claims.ts', 'POLICIES'], ['app/src/lib/ops/claims.test.ts', 'nothing in force, and the site says so']], 'Nothing is in force; the privacy seat that would put it in force is vacant.', ['R8', 'M5', 'E', 'F', 'P', 'V']],
      ['Security overview and architecture', D, [['docs/trust/SECURITY-WHITEPAPER.md', 'the overview'], ['docs/UNIVERSITY-OS-ARCHITECTURE.md', 'the architecture']], 'No data-flow diagram as a picture.', ['R8', 'M5', 'E']],
      ['Subprocessor register', T, [['app/src/lib/trust/subprocessors.test.ts', 'held to the code'], ['docs/SUBPROCESSORS.md', 'draft']], 'Not yet read by counsel.', ['R8', 'M5', 'F', 'P']],
      ['Retention and deletion', T, [['app/src/lib/retention.test.ts', 'the schedule'], ['supabase/deletion.check.sql', 'deletion']], '', ['R8', 'M5', 'F', 'P']],
      ['Accessibility statement and VPAT', N, [['docs/trust/HECVAT-VPAT-PLAN.md', 'a plan']], 'Neither exists; /accessibility/ is an evidence page, not a statement.', ['R8', 'M5', 'F', 'P', 'V']],
      ['AI policy a student or institution reads', N, [['docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md', 'the internal data-use policy, draft']], 'The public AI Use Policy is not started.', ['R8', 'M5', 'F', 'P', 'V']],
      ['An Advertising and Sponsorship Policy and a standalone Acceptable Use Policy', N, [], 'Sponsorship rules are code (sponsor.ts); no policy document; the AUP is a section of the terms draft.', ['F', 'P']],
      ['DPA, pilot statement of work, standard contract', D, [['docs/trust/DPA-CHECKLIST.md', 'notes for counsel'], ['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'an outline']], 'Outlines, not signable documents.', ['R8', 'M5', 'E', 'P']],
      ['Business continuity summary', D, [['docs/market-readiness/DISASTER_RECOVERY.md', 'not started'], ['RESTORE.md', 'the restore procedure']], 'No RTO or RPO is stated.', ['R8', 'M5', 'E']],
      ['Company overview and insurance documents', N, [], 'Neither exists; the entity is the owner’s to attest.', ['R8', 'E']],
      ['A versioned Trust Room that grants exact versions and logs every open', T, [['app/src/screens/TrustRoom.tsx', 'the reviewer’s page'], ['supabase/trust-room.check.sql', 'held']], 'The mechanism; no artifact is published into it.', ['E', 'F', 'P'], ['lead:PL-08']],
      ['A public Trust Center hub', N, [], 'Two /trust/ pages exist; no hub gathers the policy set.', ['E', 'F', 'P', 'V'], ['oneos:trust-center']],
    ],
  },
  {
    id: 'TRU',
    title: '1EdTech TrustEd Apps',
    why: 'TrustEd Apps is a documentation and operations programme that proves what Semester does, across data privacy, security practices, accessibility and generative-AI data.',
    rows: [
      ['The four rubrics mapped to controls and scored from the registers', T, [['app/src/lib/trust/compliance-crosswalk.ts', 'thirty-nine rubric items, eleven of them the Generative AI Data Rubric'], ['app/src/lib/trust/compliance-crosswalk.test.ts', 'scores computed, capped at 2 without evidence']], 'A rubric item has no owner, review date or remediation of its own; the P0 tracker below adds them for the playbook’s blockers.', ['F', 'P', 'V', 'E']],
      ['The playbook’s P0 blockers, each with an owner and evidence', T, [['app/src/lib/reinforceregister.ts', 'P0'], ['app/src/lib/reinforceregister.test.ts', 'every P0 owned by a seat and cited']], 'Most owners are vacant seats.', ['P', 'V']],
      ['Every SECURITY DEFINER function with a disposition', T, [['app/src/lib/definerregister.test.ts', 'held'], ['docs/DEFINER-RLS-REGISTER.md', 'the register']], 'The playbook marks this not started; #965 landed it.', ['F', 'P', 'V']],
      ['The certification sequence: membership, privacy vetting, GenAI rubric, self-assessments, LTI, annual renewal', D, [['docs/FERPA-COPPA-1EDTECH-READINESS.md', 'EDT-5 and EDT-7 not started']], 'No ordered sequence with owners and dates; no membership.', ['E', 'F', 'L11']],
    ],
  },
  {
    id: 'CSX',
    title: 'The customer-success engine',
    why: 'Every institution has a shared success plan, named roles, a launch calendar, an adoption view, a quarterly review and a renewal plan, so it gains a partner rather than a licence.',
    rows: [
      ['Success plans, quarterly reviews, renewals and account health', T, [['supabase/commercial.check.sql', 'the tables and their refusals'], ['supabase/commercial-automation.check.sql', 'the nightly health run']], 'No screen reads them.', ['R9', 'M7', 'E'], ['oneos:co-success']],
      ['Named roles per institution: sponsor, implementation, student success, IT and security, content, faculty champion, student ambassadors', B, [['app/src/lib/gtm/pilot.ts', 'COMMITTEE_ROLES']], 'Committee roles for a pilot decision; no per-institution success roster.', ['R9', 'M7']],
      ['An adoption dashboard of leading indicators', N, [['docs/PILOT-TO-ANNUAL-CONVERSION.md', 'the conversion process']], 'Health signals are account-level only, by design; none of the brief’s indicators is computed.', ['R9', 'M7', 'E']],
    ],
  },
  {
    id: 'GOV',
    title: 'Councils, governance and people',
    why: 'Formal oversight that is not cosmetic: each body with a charter, a cadence, decision rights, an escalation path and documented outcomes, and the non-obvious roles filled before scale exposes gaps.',
    rows: [
      ['Student advisory council, paid and representative', D, [['docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', 'the recruitment matrix'], ['app/src/site/benchmark.tsx', '/research/: not yet running']], 'No council, members or compensation policy; no seat.', ['R10', 'M14', 'L12', 'P']],
      ['Institutional advisory council', D, [['docs/operating-model/RISK-GOVERNANCE.md', 'customer advisory councils, none named']], 'The champion seat is vacant.', ['R11', 'M14', 'L12', 'P'], ['lead:PL-13']],
      ['Accessibility, security and privacy, and AI governance bodies', D, [['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'the accessibility body'], ['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'the most complete charter']], 'No body has members; the AI board’s cadence differs between its charter and RISK-GOVERNANCE.', ['M14', 'L12', 'R13']],
      ['Community safety council', D, [['app/src/lib/governance/module-privacy.ts', 'a community safety area with an owner'], ['docs/CAMPUS-MODERATION-SOP.md', 'the moderation standard such a body would own']], 'No body exists.', ['M14', 'L12']],
      ['Product and feature-governance board', D, [['docs/operating-model/PORTFOLIO-GOVERNANCE.md', 'the portfolio council']], 'No members.', ['M14']],
      ['A review record for every high-risk feature: purpose, data, harms, consent, access, equity, oversight, audit, sunset', T, [['app/src/lib/governance/pia.ts', 'eleven questions'], ['app/src/lib/governance/pia.test.ts', 'held']], 'Harms, bias and equity, human oversight and a sunset condition are not fields.', ['R13', 'M14']],
      ['The non-obvious hires', B, [['app/src/lib/launchreadiness.ts', 'twelve seats']], 'Six of the brief’s twelve roles have no seat; no hiring plan or role scorecard.', ['M13', 'L16']],
    ],
  },
  {
    id: 'PRM',
    title: 'The Student Data Promise',
    why: 'A short, public, plain-language promise, each line backed by a control, so students trust Semester with context because they keep control of it.',
    rows: [
      ['No sale; no training of general models on student data', T, [['app/src/lib/transparency.ts', 'NEVER'], ['app/src/lib/trust/ai-training-policy.test.ts', 'held']], '', ['R14', 'M18', 'F', 'P', 'V']],
      ['No behavioural advertising on education records, plans or study activity', T, [['app/src/lib/transparency.ts', 'NEVER, added here'], ['app/src/lib/gtm/campaign.test.ts', 'every education-record field refused as targeting']], '', ['R14', 'M18', 'F', 'P']],
      ['Study activity never used to label ability or motivation', T, [['app/src/lib/transparency.ts', 'NEVER, added here'], ['app/src/lib/institution-ops.test.ts', 'attention and engagement inference refused']], '', ['R14', 'M4']],
      ['You see where information came from, and why a recommendation appeared', T, [['app/src/lib/standard.ts', 'source and ai-context'], ['app/src/lib/standard.test.ts', 'held']], '', ['R14']],
      ['You decide what to share, with whom and for how long, and can take it back', T, [['app/src/lib/sharing.test.ts', 'every share ends'], ['app/src/lib/trust/ferpa-consent.test.ts', 'the consent workflow']], '', ['R14', 'M3']],
      ['Disconnect, export and delete', T, [['app/src/lib/export.test.ts', 'export'], ['app/src/lib/deleteaccount.test.ts', 'deletion']], '', ['R14', 'M3']],
      ['The promise published as one page', T, [['app/src/site/benchmark.tsx', '/trust/data-and-ai-transparency/ and the Semester Standard'], ['app/src/lib/transparency.test.ts', 'every line held to the tree']], 'Published as the transparency page’s commitment and the Standard; no page is titled Student Data Promise, and no line is in force as policy.', ['R14', 'F', 'P', 'V']],
    ],
  },
  {
    id: 'A11',
    title: 'Accessibility as a moat',
    why: 'Accessibility is a visible part of the company: preferences that travel, accessible creation and exports, a public centre, and disabled students in paid research.',
    rows: [
      ['Keyboard, labels, focus, landmarks, motion and contrast checked on every build', T, [['app/src/a11y/labels.test.ts', 'every control named'], ['app/src/lib/keys.test.ts', 'shortcuts'], ['app/src/lib/look.test.ts', 'motion and contrast']], 'No screen-reader pass by a person yet.', ['R15', 'M6', 'L4'], ['lead:PL-05']],
      ['Captions and transcripts', T, [['app/src/lib/captions.test.ts', 'captions']], '', ['R15', 'M6']],
      ['A public accessibility page with a way to report a barrier', T, [['app/src/site/site.test.tsx', 'the route']], 'No published plan, no response commitment, no keyboard or screen-reader guide.', ['R15', 'M6', 'P']],
      ['Preferences that travel across every surface and device', B, [['app/src/lib/look.ts', 'look settings']], 'Held on the device; not a synced preference profile.', ['M6', 'P'], ['lead:ONE-08']],
      ['A student-controlled accommodations workflow', N, [], 'Nothing stores or routes an accommodation, by design until the privacy seat is held.', ['M6']],
      ['Disabled students and accessibility professionals in paid research', D, [['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'the paid assistive-tech panel']], 'No panel has met.', ['M6', 'P']],
    ],
  },
  {
    id: 'AIX',
    title: 'The trusted AI layer',
    why: 'Not “we have an AI chatbot”: intelligence that knows the course and the policy, cites its source, distinguishes fact from estimate, and never acts without the student’s confirmation.',
    rows: [
      ['Citations to the page or document an answer rests on', T, [['app/src/lib/cite.test.ts', 'page and document']], 'No slide or timestamp field.', ['M4', 'R21', 'L7', 'P']],
      ['Source strength and the fact, estimate, draft distinction', T, [['app/src/ai/quality.test.ts', 'per-answer source strength']], '', ['M4', 'L7']],
      ['Course and institution policy boundaries', T, [['app/src/lib/governance/ai-lifecycle.test.ts', 'the release gates']], '', ['M4', 'L7', 'P'], ['oneos:ai-policy']],
      ['Confirmation before send, share, pay, register, delete or change', T, [['app/src/lib/governance/ai-assurance.test.ts', 'risk tiers and human confirmation']], '', ['M4', 'L7', 'P']],
      ['Prompt-injection defence', T, [['app/src/ai/injection.live.test.ts', 'skips without a key']], 'The live suite has not been run by the owner (D-122).', ['L7', 'P']],
      ['Feedback: helpful, wrong, needs source, not relevant, already done', B, [['app/src/lib/feedback.ts', 'feedback'], ['app/src/components/ActionCenter.test.tsx', 'done and not relevant']], 'Helpful and needs source are not controls.', ['R21', 'L7']],
      ['Evaluation sets for correctness, integrity, accessibility, privacy and recommendation quality', D, [['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'nothing built'], ['app/src/lib/extractaccuracy.test.ts', 'one slice: syllabus extraction']], 'One labelled corpus; no release-gating evaluation.', ['R21', 'L7', 'P']],
    ],
  },
  {
    id: 'REL',
    title: 'Reliability as a visible feature',
    why: 'A student trusts Semester more when another system fails, because it explains what is unavailable, keeps safe context and offers the official fallback — and the company can show its reliability.',
    rows: [
      ['A public status page', T, [['app/public/status.html', 'the page'], ['app/src/lib/statuspage.test.ts', 'held']], 'No uptime history, planned-maintenance calendar or per-connector status.', ['L2', 'F']],
      ['Source freshness and degraded-mode messaging in the app', T, [['app/src/lib/source.test.ts', 'the labels'], ['app/src/lib/offline.test.ts', 'offline']], '', ['L2', 'E']],
      ['Service objectives and error budgets for the critical flows', D, [['docs/operating-model/SLOS-AND-ERROR-BUDGETS.md', 'the objectives']], 'Nothing measures them; no on-call rota exists.', ['L8']],
      ['Backup and restore rehearsed', B, [['supabase/restore.sh', 'the rehearsal CI runs on every change'], ['RESTORE.md', 'the procedure']], 'Run by a CI step rather than a test file; no production restore, no RTO or RPO.', ['L8', 'M15']],
      ['Release notes and a changelog', D, [['CHANGELOG.md', 'for testers']], '', ['L2'], ['oneos:co-changelog']],
      ['A responsible-disclosure route', T, [['app/public/.well-known/security.txt', 'the contact'], ['app/src/lib/security.test.ts', 'held']], 'No bug bounty.', ['L2']],
      ['A quarterly Trust Report', N, [], 'Nothing reports incidents, privacy requests, accessibility issues, AI feedback or community reports as a series.', ['L3'], ['lead:PL-10']],
    ],
  },
  {
    id: 'GRW',
    title: 'Growth, habit and community',
    why: 'Value before login, privacy-safe referral, and recurring rituals that make Semester the student’s operating rhythm rather than an emergency app.',
    rows: [
      ['Free public tools: timeline, schedule builder, registration checklist, advisor agenda', T, [['app/src/site/tools/Tools.test.tsx', 'five tools, nothing sent']], 'Eight of the thirteen tools the brief lists are named or absent.', ['R16', 'E', 'P']],
      ['A tool’s result carried into an account and a plan', N, [], 'The tools save nothing, deliberately; no import on sign-up exists.', ['R16', 'L13']],
      ['Referral that reveals nobody', T, [['supabase/referrals.check.sql', 'an ambassador sees two counts'], ['app/src/components/referrallink.test.tsx', 'the link']], 'No invite to a group, event, club or planning session.', ['R17', 'L13', 'E'], ['connect:AMB-001']],
      ['Sunday reset, Registration Ready and Semester Wrapped', T, [['app/src/lib/weekly.test.ts', 'the weekly report'], ['app/src/lib/registration-day.mode.test.ts', 'registration day'], ['app/src/lib/wrapped.test.ts', 'Wrapped']], 'Named differently in the app; Wrapped and registration mode are off by default.', ['R18', 'M1']],
      ['Midterm Momentum, Career Friday and Graduation Countdown', N, [], 'None exists.', ['R18', 'M1']],
      ['Growth loops: utility, ambassador, advisor, pilot, content, partner, employer, community', D, [['docs/INSTITUTIONAL-GTM-PLAYBOOK.md', 'the institutional motion'], ['app/src/lib/gtm/campaign.ts', 'the lifecycle stages']], 'No loop model; loops are prose in the briefs.', ['E', 'P', 'L13']],
    ],
  },
  {
    id: 'PAR',
    title: 'Partners and design partners',
    why: 'Partners expand Semester without rebuilding every system, each on one standard model, and design partners shape the common operating system without fragmenting it.',
    rows: [
      ['A standard partnership record: purpose, integration, data boundary, value, commercial model, support, branding, privacy, metric, exit plan', N, [['docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md', 'nothing called partnered without evidence']], 'No record carries the brief’s eleven fields.', ['R12']],
      ['Provider registry and vendor review', T, [['supabase/integration-quality.check.sql', 'provider maturity'], ['app/src/lib/trust/vendorrisk.test.ts', 'held']], 'No vendor assessed.', ['R12', 'M15']],
      ['A design-partner programme with bounded configurability and early access under flags', T, [['app/src/lib/governance/config-tiers.test.ts', 'configurability without forks'], ['app/src/lib/beta.test.ts', 'beta cohorts']], 'No packaged programme and no partner.', ['M9', 'E'], ['lead:PL-13']],
      ['Case studies only after real results', T, [['app/src/lib/ops/claims.test.ts', 'PROOF_RULES']], '', ['M9', 'E']],
    ],
  },
  {
    id: 'NAR',
    title: 'The category narrative and precise claims',
    why: 'One sentence every stakeholder repeats, and nothing on any page that the operation cannot back.',
    rows: [
      ['A headline and a statement, held to the register beside them', T, [['app/src/lib/oneos.ts', 'HEADLINE and STATEMENT'], ['app/src/lib/oneos.test.ts', 'held']], 'The briefs’ “connection problem” and “connected education operating system” sentences are not used.', ['M10', 'L1', 'P'], ['oneos:why-not']],
      ['One promise per stakeholder', B, [['app/src/lib/oneos.ts', 'MESSAGES']], 'Four audiences; the brief names ten.', ['L1']],
      ['No page claims to replace an official system, guarantee an outcome, improve retention, be fully compliant or be AI-safe', T, [['app/src/site/site.test.tsx', 'the five refused on every page, with a control']], 'Held over the site only; the app and the RFP library have their own lists.', ['M17']],
      ['Compliance words refused in the RFP library and launch guides', T, [['app/src/lib/gtm/rfp.test.ts', 'CLAIM_WORDS']], '', ['M17', 'M15']],
    ],
  },
  {
    id: 'BEN',
    title: 'The benchmark itself',
    why: 'A benchmark competitors are measured against: a production bar per feature, a module scorecard, a comparison by workflow, a published annual study, and a final checklist answered honestly.',
    rows: [
      ['A production bar every feature must clear before it is more than a demo', B, [['app/src/lib/governance/quality-gates.ts', 'the definition of done'], ['app/src/lib/governance/quality-gates.test.ts', 'the gate, on fixtures']], 'No feature is graded against it.', ['M16', 'F']],
      ['A 0–5 module scorecard, and “fully built” only at 4 or more on depth, privacy, accessibility, reliability and source integrity', T, [['app/src/lib/reinforceregister.ts', 'SCORING and mayClaimFullyBuilt'], ['app/src/lib/reinforceregister.test.ts', 'held']], 'The model and its gate; no module has been scored by a reviewer.', ['F', 'M16']],
      ['A comparison by workflow against LMS, SIS, student-success, career and campus-app categories', B, [['app/src/lib/oneos.ts', 'COMPARISON: eight rows, two columns']], 'The six-category, twenty-workflow matrix is not built.', ['F', 'E']],
      ['An annual Connected Student Experience Benchmark', D, [['docs/MARKET-LEADERSHIP.md', 'PL-03: the annual Academic Friction Index'], ['app/src/site/benchmark.tsx', '/research/: the method, no edition']], 'No data and no edition.', ['M12', 'L10'], ['lead:PL-03', 'lead:PL-12']],
      ['The final checklists, answered against existing question sets', T, [['app/src/lib/reinforceregister.ts', 'CHECKLIST'], ['app/src/lib/reinforceregister.test.ts', 'every question answered by a set that exists']], 'Four questions have no set that asks them.', ['M', 'P', 'L']],
    ],
  },
  {
    id: 'K12',
    title: 'K–12, as a configured edition later',
    why: 'K–12 is a deliberate extension of the same operating system, entered only once a district agreement, age-aware controls and guardian consent exist.',
    rows: [
      ['A stated minimum age and a posture on children', T, [['supabase/minimum-age.check.sql', 'under 13 refused at sign-up by the database'], ['docs/legal/TERMS-OF-SERVICE-DRAFT.md', 'at least 13']], 'Set by the owner (D-139); counsel has not reviewed it, and an age is stated, not verified.', ['F', 'P']],
      ['Guardian consent, age-aware design and strict guardian boundaries', T, [['supabase/minimum-age.check.sql', 'a minor is out of discovery, matching, messaging and employer visibility until 18'], ['supabase/k12-guardians.check.sql', 'only a K–12 school’s staff record a guardian, for a minor, and the link stops counting at 18']], 'Age-aware design is held, and a K–12 school’s staff can record and verify a guardian (D-1022); nothing a guardian reads through the link exists yet, and no guardian-facing screen is built.', ['F', 'P'], ['connect:CTL-006']],
      ['K–12 positioning, segments, module configuration, pilot and PRD', T, [['app/src/lib/k12/edition.ts', 'positioning, five segments, ten modules configured for a school, the 26-week pilot'], ['app/src/lib/k12/edition.test.ts', 'held'], ['app/src/site/k12.tsx', '/k-12/, which says no district uses Semester']], 'No PRD. Offered to nobody: mayTakeDistrictData() is the sixteen-item district baseline (D-140), and it is false.', ['F', 'P']],
    ],
  },
];

export const AREAS: readonly Area[] = AREA_LIST.map(({ rows: _rows, ...a }) => a);

export const ITEMS: readonly Item[] = AREA_LIST.flatMap((a) =>
  a.rows.map(([item, status, evidence, gap, asks, overlaps], i) => ({
    id: `${a.id}-${String(i + 1).padStart(3, '0')}`,
    item,
    status,
    evidence: evidence.map(([path, shows]) => ({ path, shows })),
    gap: gap || 'Held in code; nothing under docs/evidence/ shows it operating.',
    asks,
    overlaps: overlaps ?? [],
  })),
);

export const areaOf = (id: string) => AREAS.find((a) => a.id === id.split('-')[0])!;

// ── where a brief and the tree disagree ─────────────────────────────────────

export const CONFLICTS: readonly { asks: string; tree: string; decides: Seat; cites: string }[] = [
];

// ── the playbook's P0 blockers ──────────────────────────────────────────────

export interface Blocker {
  /** The playbook's own id. */
  id: string;
  control: string;
  owner: Seat;
  status: Status;
  evidence: string | null;
  next: string;
}

/**
 * Every row the compliance playbook marks P0 — "a blocker before institutional
 * data, public claim, or formal vetting" — with a seat as owner and the tree's
 * own reading rather than the playbook's, which predates #965 and much else.
 */
export const P0: readonly Blocker[] = [
  { id: 'DP-01', control: 'Public privacy notice', owner: 'privacy', status: D, evidence: 'docs/legal/PRIVACY-POLICY-DRAFT.md', next: 'Counsel review, then in force with a version and date.' },
  { id: 'DP-02', control: 'Terms of Service', owner: 'privacy', status: D, evidence: 'docs/legal/TERMS-OF-SERVICE-DRAFT.md', next: 'Counsel review, the minimum age of 13 (D-139) included.' },
  { id: 'DP-03', control: 'Data inventory', owner: 'data', status: T, evidence: 'app/src/lib/retention.test.ts', next: 'A field-level data dictionary beyond the per-table inventory.' },
  { id: 'DP-04', control: 'Data minimisation', owner: 'data', status: T, evidence: 'app/src/lib/governance/module-privacy.test.ts', next: 'A minimum-field review per connector scope.' },
  { id: 'DP-05', control: 'Student data ownership', owner: 'privacy', status: T, evidence: 'app/src/lib/transparency.test.ts', next: 'The promise in force as policy.' },
  { id: 'DP-06', control: 'No sale; no education-record behavioural advertising', owner: 'privacy', status: T, evidence: 'app/src/lib/gtm/campaign.test.ts', next: 'The same words in contract language.' },
  { id: 'DP-08', control: 'Subprocessors', owner: 'privacy', status: T, evidence: 'app/src/lib/trust/subprocessors.test.ts', next: 'Counsel review; published.' },
  { id: 'DP-09', control: 'Retention', owner: 'data', status: T, evidence: 'supabase/retention-sweeps.check.sql', next: 'Job logs kept as evidence.' },
  { id: 'DP-10', control: 'Export and deletion', owner: 'privacy', status: T, evidence: 'supabase/deletion.check.sql', next: 'An end-to-end run recorded under docs/evidence/.' },
  { id: 'DP-11', control: 'Consent', owner: 'privacy', status: T, evidence: 'app/src/lib/sharing.test.ts', next: 'An audit-log sample.' },
  { id: 'DP-14', control: 'Third-party sharing', owner: 'security', status: T, evidence: 'app/src/lib/trust/vendorrisk.test.ts', next: 'A vendor approval review for each processor.' },
  { id: 'SEC-01', control: 'Security governance', owner: 'security', status: D, evidence: 'SECURITY.md', next: 'The security seat accepted.' },
  { id: 'SEC-02', control: 'Secure SDLC', owner: 'engineering', status: T, evidence: 'app/src/lib/branchprotection.test.ts', next: 'CI screenshots kept as evidence.' },
  { id: 'SEC-03', control: 'Secrets management', owner: 'engineering', status: T, evidence: 'app/src/lib/security.test.ts', next: 'A rotation runbook exercised.' },
  { id: 'SEC-04', control: 'Authentication and admin MFA', owner: 'security', status: T, evidence: 'supabase/console-control-plane.check.sql', next: 'Fresh MFA is held for the operations console only; the claims register still says planned (IAM-005) for every other privileged role.' },
  { id: 'SEC-05', control: 'Authorisation and tenant isolation', owner: 'security', status: T, evidence: 'supabase/rls-coverage.check.sql', next: 'An external review.' },
  { id: 'SEC-06', control: 'SECURITY DEFINER review', owner: 'security', status: T, evidence: 'app/src/lib/definerregister.test.ts', next: 'Kept current as functions are added.' },
  { id: 'SEC-07', control: 'Database RLS', owner: 'security', status: T, evidence: 'supabase/rls-coverage.check.sql', next: 'A linter baseline kept.' },
  { id: 'SEC-09', control: 'Logging and audit', owner: 'security', status: T, evidence: 'supabase/access.check.sql', next: 'One event taxonomy and its retention.' },
  { id: 'SEC-11', control: 'Vulnerability management', owner: 'engineering', status: D, evidence: 'docs/SUPPLY-CHAIN.md', next: 'Patch SLAs by severity, measured.' },
  { id: 'SEC-13', control: 'Incident response', owner: 'operations', status: T, evidence: 'app/src/lib/governance/incident-comms.test.ts', next: 'The first tabletop exercise.' },
  { id: 'SEC-14', control: 'Business continuity', owner: 'operations', status: D, evidence: 'RESTORE.md', next: 'An RTO and RPO, and a production restore drill.' },
  { id: 'SEC-18', control: 'Environment separation', owner: 'engineering', status: D, evidence: 'docs/SUPPLY-CHAIN.md', next: 'Staging isolation validated.' },
  { id: 'A11Y-01', control: 'Accessibility statement', owner: 'accessibility', status: N, evidence: null, next: 'Write it from the /accessibility/ evidence.' },
  { id: 'A11Y-02', control: 'WCAG 2.2 AA as the acceptance baseline', owner: 'accessibility', status: T, evidence: 'app/src/lib/governance/quality-gates.test.ts', next: 'Applied to a real feature, not a fixture.' },
  { id: 'A11Y-03', control: 'Keyboard access', owner: 'accessibility', status: T, evidence: 'app/src/lib/keys.test.ts', next: 'A manual pass of the critical flows.' },
  { id: 'A11Y-04', control: 'Screen-reader support', owner: 'accessibility', status: T, evidence: 'app/src/a11y/labels.test.ts', next: 'An NVDA and VoiceOver pass by a person.' },
  { id: 'A11Y-05', control: 'Contrast and colour', owner: 'accessibility', status: T, evidence: 'app/src/lib/look.test.ts', next: '' },
  { id: 'AI-01', control: 'AI disclosure', owner: 'product', status: N, evidence: null, next: 'The public AI Use Policy.' },
  { id: 'AI-02', control: 'Provider register', owner: 'product', status: T, evidence: 'app/src/lib/trust/subprocessors.test.ts', next: 'Regions and retention per provider.' },
  { id: 'AI-03', control: 'No unauthorised training', owner: 'privacy', status: T, evidence: 'app/src/lib/trust/ai-training-policy.test.ts', next: 'Provider settings recorded as evidence.' },
  { id: 'AI-04', control: 'Source permissions', owner: 'product', status: T, evidence: 'app/src/lib/governance/ai-lifecycle.test.ts', next: '' },
  { id: 'AI-05', control: 'Source grounding', owner: 'product', status: T, evidence: 'app/src/lib/cite.test.ts', next: 'Slide and timestamp citations.' },
  { id: 'AI-06', control: 'Academic integrity', owner: 'product', status: T, evidence: 'app/src/lib/coursestudio.test.ts', next: 'A course policy in force at one institution.' },
  { id: 'AI-08', control: 'Consequential action confirmation', owner: 'product', status: T, evidence: 'app/src/lib/governance/ai-assurance.test.ts', next: '' },
  { id: 'AI-09', control: 'Prompt-injection defence', owner: 'security', status: T, evidence: 'app/src/ai/injection.live.test.ts', next: 'The live suite run by the owner.' },
];

// ── the module scorecard ────────────────────────────────────────────────────

/** The feature benchmark's ten criteria, with what 0, 3 and 5 mean. */
export const SCORING: readonly { id: string; criterion: string; zero: string; three: string; five: string }[] = [
  { id: 'depth', criterion: 'Real workflow depth', zero: 'Mockup only', three: 'Basic working flow', five: 'End-to-end, persistent, exception-safe workflow' },
  { id: 'integrity', criterion: 'Data integrity', zero: 'Demo-only', three: 'Imported data', five: 'Authoritative or clearly labelled source, freshness, reconciliation' },
  { id: 'privacy', criterion: 'Privacy and permissions', zero: 'Generic access', three: 'Basic role control', five: 'Object-level, consent-based, audited, revocable control' },
  { id: 'accessibility', criterion: 'Accessibility', zero: 'Unverified', three: 'Basic keyboard support', five: 'WCAG 2.2 AA tested, accessible exports, assistive-tech validation' },
  { id: 'mobile', criterion: 'Mobile readiness', zero: 'Desktop only', three: 'Responsive', five: 'Mobile-native workflows, offline where appropriate' },
  { id: 'integration', criterion: 'Integration', zero: 'Manual links', three: 'One connection', five: 'Standard connector, health, freshness, fallback, reconciliation' },
  { id: 'observability', criterion: 'Observability and reliability', zero: 'No measurement', three: 'Basic events', five: 'SLOs, error tracking, audit, adoption, support and quality metrics' },
  { id: 'student', criterion: 'Student value', zero: 'Nice feature', three: 'Helpful workflow', five: 'Repeatedly reduces real friction and creates visible progress' },
  { id: 'institution', criterion: 'Institutional value', zero: 'Local utility', three: 'Department value', five: 'Governed, measurable, scalable cross-campus value' },
  { id: 'defensibility', criterion: 'Defensibility', zero: 'Easily copied', three: 'Some workflows', five: 'Unique graph, relationships, trust, integrations and adoption loop' },
];

/** The criteria a module must score 4 or more on before it may be called fully built. */
export const FULLY_BUILT_GATE = ['depth', 'privacy', 'accessibility', 'observability', 'integrity'] as const;

export type Scores = Partial<Record<(typeof SCORING)[number]['id'], number>>;

/**
 * Whether a module may be marketed as fully built, and what stops it. An
 * unscored criterion is a failure, not a pass: nothing is fully built by
 * default.
 */
export function mayClaimFullyBuilt(scores: Scores): { may: boolean; short: string[] } {
  const short: string[] = [];
  for (const [id, s] of Object.entries(scores)) {
    if (!Number.isInteger(s) || (s as number) < 0 || (s as number) > 5) short.push(`${id} is scored ${s}, outside 0–5`);
  }
  for (const id of FULLY_BUILT_GATE) {
    const s = scores[id];
    if (s === undefined) short.push(`${id} is not scored`);
    else if (s < 4) short.push(`${id} is ${s}, below 4`);
  }
  return { may: short.length === 0, short };
}

// ── the final checklists ────────────────────────────────────────────────────

/**
 * The questions the briefs end on (M's twenty, P's eight, L's twelve lines),
 * merged where they ask the same thing, and each pointed at the question set
 * the tree already answers it in — so this does not become a fifth parallel
 * checklist. `answeredIn` is null where no set asks it.
 */
export const CHECKLIST: readonly { question: string; asks: readonly string[]; answeredIn: string | null }[] = [
  { question: 'Does a student have one place to understand the whole journey, and reach a useful next step within minutes?', asks: ['M', 'P', 'L'], answeredIn: 'app/src/lib/oneos.ts' },
  { question: 'Do all modules share identity, permissions, sources, actions, search, workspace and intelligence?', asks: ['M'], answeredIn: 'app/src/lib/ops/leadership.ts' },
  { question: 'Can a student start from a course, deadline, event, resource, mentor or opportunity and reach a clear next action?', asks: ['M', 'L'], answeredIn: 'app/src/lib/oneos.ts' },
  { question: 'Does it work on desktop, mobile, low bandwidth, keyboard and assistive technology?', asks: ['M', 'L'], answeredIn: 'app/src/lib/ops/leadership.ts' },
  { question: 'Can users see source, freshness, limitation and ownership for important information?', asks: ['M', 'P', 'L'], answeredIn: 'app/src/lib/standard.ts' },
  { question: 'Can users control sharing, revoke access, export and request deletion?', asks: ['M', 'P'], answeredIn: 'app/src/lib/standard.ts' },
  { question: 'Are AI actions explainable, source-grounded, policy-aware and confirmed before consequential changes?', asks: ['M', 'L'], answeredIn: 'app/src/lib/standard.ts' },
  { question: 'Are security, privacy, accessibility and incident practices documented and tested?', asks: ['M', 'L'], answeredIn: 'app/src/lib/trust/compliance-crosswalk.ts' },
  { question: 'Can a university pilot quickly with limited data, controlled scope and a measurable outcome?', asks: ['M', 'P', 'L'], answeredIn: 'app/src/lib/operationalreality.ts' },
  { question: 'Can IT, legal, privacy, accessibility, advising and student-success stakeholders all understand the platform?', asks: ['M'], answeredIn: 'app/src/lib/ops/leadership.ts' },
  { question: 'Does the console make content, permissions, integrations, flags, freshness and support governable without custom code?', asks: ['M', 'P'], answeredIn: 'app/src/lib/operationalreality.ts' },
  { question: 'Can Semester prove implementation quality and operational reliability, and explain degraded states?', asks: ['M', 'L'], answeredIn: 'app/src/lib/operationalreality.ts' },
  { question: 'Is there a repeatable sales, implementation, success, support and renewal model, with its operating cost explained per package?', asks: ['M', 'P'], answeredIn: 'app/src/lib/operationalreality.ts' },
  { question: 'Is every high-risk feature owned and reviewed?', asks: ['M'], answeredIn: 'app/src/lib/governance/pia.ts' },
  { question: 'Can the team ship safely, monitor quality, recover from failure and learn from each pilot?', asks: ['M', 'L'], answeredIn: 'app/src/lib/operationalreality.ts' },
  { question: 'Does Semester improve the student experience without becoming a surveillance system?', asks: ['P'], answeredIn: 'app/src/lib/ops/leadership.ts' },
  { question: 'Do students, advisors, faculty, staff, accessibility experts and institutions meaningfully shape the product?', asks: ['M', 'L'], answeredIn: null },
  { question: 'Is Semester known for a category-defining promise, not a list of features?', asks: ['M', 'L'], answeredIn: null },
  { question: 'Does it publish evidence, useful free tools, trusted content and original market insight?', asks: ['M', 'L'], answeredIn: null },
  { question: 'Does it earn student habit, institutional sponsorship and partner distribution, and grow more valuable as verified information connects?', asks: ['M'], answeredIn: null },
];

/** The commit the statuses were read against. */
export const ASSESSED_AT = 'beaa839';
