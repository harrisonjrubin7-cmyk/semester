/**
 * The single source of truth: which document is the current authoritative
 * version of each thing the company runs on, who owns it, when it was last
 * reviewed, and what it rests on.
 *
 * ## Why this is data
 *
 * The repository holds several hundred Markdown files. Many are audits of a
 * moment, several are plans that were overtaken, and a few are the thing
 * itself. A reader cannot tell which is which from the titles, and the danger
 * the closing brief names — "competing documents and inconsistent promises" —
 * is exactly what happens when two of them disagree and nobody has said which
 * one wins. So this module says, for each category, *one* path or `null`, and
 * `operatingsystem.test.ts` refuses a path that does not exist, a superseded
 * document with no redirect, a decision that is not in the log, and a
 * category that claims a document while calling itself missing.
 *
 * ## What "owner" means here
 *
 * A council seat from `launchreadiness.ts`, never a person. The seats are the
 * accountabilities the launch command defined; a document is owned by whoever
 * holds the seat, and the rendered page says which seats are held. Today none
 * is, and the page says that too, rather than printing a name nobody accepted.
 *
 * ## Version and review
 *
 * `version` counts reviews of the *entry* — the decision that this path is the
 * authoritative one and that its content was read and stands. It is not the
 * document's own revision count; git holds that. `nextReview` is a date, and
 * the test holds it after `lastReviewed`. Registers that change with every
 * merge are reviewed monthly; the rest quarterly.
 */

import type { Seat } from '../launchreadiness';

export type SourceStatus = 'current' | 'draft' | 'missing';

export interface Source {
  /** A slug, stable across renames of the category title. */
  id: string;
  /** The category as the closing brief names it. */
  category: string;
  /** The one authoritative path, repository-relative — or `null` when none exists. */
  path: string | null;
  /** `current`: read and stands. `draft`: the authoritative one, but not yet fit to act on. `missing`: nothing is. */
  status: SourceStatus;
  owner: Seat;
  version: number;
  lastReviewed: string;
  nextReview: string;
  /**
   * Documents this one replaced. A path may appear here only if that file
   * carries a redirect to the authoritative one (D-002 asks for exactly that
   * before a plan is retired), and the test reads the file to check.
   */
  supersedes: readonly string[];
  /** `D-nnn` from docs/DECISION-LOG.md, `ADR-nnnn` from docs/architecture/, or `DECISIONS §n` from DECISIONS.md. */
  decisions: readonly string[];
  /** Not authoritative, but read next. Every path must exist. */
  alsoRead?: readonly string[];
  /** What the authoritative document is, and is not. */
  note?: string;
  /** Required when `missing`: what would close it. */
  gap?: string;
}

/** The nineteen categories the closing brief lists, in its order. */
export const BRIEF_CATEGORIES: readonly string[] = [
  'Company strategy',
  'Product vision',
  'Master readiness register',
  'Role launch register',
  'Claims register',
  'Architecture decision records',
  'Roadmap',
  'Risk register',
  'Design system',
  'Accessibility register',
  'Security/compliance evidence index',
  'Integration catalog',
  'Data inventory and lineage',
  'Customer implementation method',
  'Support/runbook library',
  'Commercial catalog',
  'Contract templates',
  'Company site map',
  'Operations Console map',
];

const REVIEWED = '2026-09-28';
const MONTHLY = '2026-10-28';
const QUARTERLY = '2026-12-28';

export const SOURCES: readonly Source[] = [
  {
    id: 'strategy',
    category: 'Company strategy',
    path: null,
    status: 'missing',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['DECISIONS §1', 'D-007'],
    alsoRead: ['MARKET-POSITION.md', 'docs/operating-model/DEFENSIBILITY.md', 'docs/gtm/EXECUTION-PLAN.md'],
    gap: 'The one-page strategy memo that docs/operating-model/OPERATING-RHYTHM.md schedules quarterly has not been written. MARKET-POSITION.md is a competitor review with an action plan and DEFENSIBILITY.md is the moat argument; neither states the strategy in one place a new hire could read first.',
  },
  {
    id: 'vision',
    category: 'Product vision',
    path: 'README.md',
    status: 'current',
    owner: 'product',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-003', 'D-006'],
    alsoRead: ['SEMESTER-MASTER-COMMAND.md', 'docs/launch/WHAT-IS-SEMESTER.md'],
    note: 'The opening paragraph is the vision as it is sold today. SEMESTER-MASTER-COMMAND.md is the specification behind it, and says which of its sections were never supplied.',
  },
  {
    id: 'master-register',
    category: 'Master readiness register',
    path: 'docs/MASTER-LAUNCH-READINESS-REGISTER.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/LAUNCH-READINESS-COUNCIL.md', 'docs/GO-NO-GO-CHECKLIST.md'],
    note: 'Rendered from app/src/lib/masterregister.ts; a test holds every row to the kind of file it cites. Nothing is above `tested` until docs/evidence/ exists.',
  },
  {
    id: 'role-register',
    category: 'Role launch register',
    path: 'docs/ROLE-LAUNCH-REGISTER.md',
    status: 'current',
    owner: 'security',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    note: 'Rendered from app/src/lib/rolelaunch.ts, which reads the roles out of the migrations. All 63 roles are `modeled`; none is provisionable.',
  },
  {
    id: 'claims',
    category: 'Claims register',
    path: null,
    status: 'missing',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['app/src/lib/rollout-capabilities.ts', 'docs/launch/CONTENT-READINESS-REGISTER.md'],
    gap: 'No register maps each external marketing or sales claim to its evidence and approved scope (master register PRG-002). The capability inventory covers product promises only. ops/customer-commitments/ holds promises made to a named customer; the general claims register is still to write.',
  },
  {
    id: 'adr',
    category: 'Architecture decision records',
    path: 'docs/architecture/README.md',
    status: 'current',
    owner: 'engineering',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['ADR-0001', 'ADR-0002', 'ADR-0003', 'ADR-0004', 'ADR-0005', 'ADR-0006'],
    note: 'Six records. Product decisions are not here: settled ones are in DECISIONS.md and the programme log is docs/DECISION-LOG.md.',
  },
  {
    id: 'roadmap',
    category: 'Roadmap',
    path: 'docs/PRODUCT-ROADMAP.md',
    status: 'current',
    owner: 'product',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-002'],
    alsoRead: ['docs/90-DAY-LAUNCH-PROGRAM.md', 'docs/LMS-LEARNING-ROADMAP.md'],
    note: 'The unified-platform plan of record. The root-level plans it overtook (IMPLEMENTATION-PLAN.md, COMPLETION-PLAN.md, ACTION-PLAN.md) are not listed as superseded because none carries a redirect yet; D-002 makes that backlog item BL-0.3.',
  },
  {
    id: 'risk',
    category: 'Risk register',
    path: null,
    status: 'missing',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/LAUNCH-READINESS-COUNCIL.md', 'docs/trust/SOC2-READINESS.md'],
    gap: 'No risk register exists (master register SEC-001 names its absence). Risk acceptances have a shape in app/src/lib/launchreadiness.ts — founder seat, expiry date, never P0/P1 — but nothing lists the risks themselves with owner, likelihood, impact and treatment.',
  },
  {
    id: 'design',
    category: 'Design system',
    path: 'docs/design/SEMESTER-UI-CONSTITUTION.md',
    status: 'current',
    owner: 'product',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/design/README.md', 'docs/DO-NOT-BUILD.md'],
    note: 'The quality contract the pull-request template cites (§9). Tokens live in app/src/styles/, primitives in app/src/components/ui.tsx, and the style and label audits run in `npm run lint`.',
  },
  {
    id: 'a11y',
    category: 'Accessibility register',
    path: 'docs/WCAG-UI-AUDIT-SCORECARD.md',
    status: 'current',
    owner: 'accessibility',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/market-readiness/ACCESSIBILITY_READINESS.md', 'docs/operating-model/ACCESSIBILITY-GOVERNANCE.md'],
    note: 'A per-component WCAG 2.2 scorecard where every score cites its test. It is not yet a findings register with remediation dates; the VPAT/ACR (master register A11Y-007) is on the proof calendar.',
  },
  {
    id: 'evidence',
    category: 'Security/compliance evidence index',
    path: null,
    status: 'missing',
    owner: 'security',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/trust/README.md', 'docs/market-readiness/HECVAT_READINESS.md', 'SECURITY.md'],
    gap: 'docs/evidence/ does not exist, and the master register lets no row above `tested` until it does. The trust package (docs/trust/) is the set of documents a reviewer reads; the evidence that any of them is operated has not been produced. docs/PROOF-CALENDAR.md schedules it.',
  },
  {
    id: 'integrations',
    category: 'Integration catalog',
    path: 'app/src/lib/integration/catalog.ts',
    status: 'current',
    owner: 'data',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-007', 'ADR-0003'],
    alsoRead: ['docs/UNIVERSITY_CONNECTIONS.md', 'docs/INTEGRATION-OPERATOR-RUNBOOK.md'],
    note: 'Written as data: provider domains, canonical entities, freshness and sync classes, and what no connector ingests by default; catalog.test.ts holds it to the SQL constraints. docs/UNIVERSITY_CONNECTIONS.md is the human record of what is actually connected.',
  },
  {
    id: 'data',
    category: 'Data inventory and lineage',
    path: 'RETENTION.md',
    status: 'current',
    owner: 'privacy',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['ADR-0001', 'ADR-0002'],
    alsoRead: ['docs/data-contract.md', 'docs/operating-model/DATA-STEWARDSHIP.md', 'docs/SUBPROCESSORS.md'],
    note: 'The inventory: every store and the clock that runs on it. Lineage — which client holds which field of the contract — is docs/data-contract.md, and who decides what a field means is DATA-STEWARDSHIP.md.',
  },
  {
    id: 'implementation',
    category: 'Customer implementation method',
    path: 'docs/operating-model/PILOT-TO-PRODUCTION.md',
    status: 'current',
    owner: 'success',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['DECISIONS §1'],
    alsoRead: ['docs/market-readiness/PILOT_PLAYBOOK.md', 'docs/90-DAY-LAUNCH-PROGRAM.md'],
    note: 'The lifecycle from directory listing to production tenant, held by app/src/lib/governance/rollout.ts. PILOT_PLAYBOOK.md is how a pilot is run once signed.',
  },
  {
    id: 'runbooks',
    category: 'Support/runbook library',
    path: 'docs/RUNBOOKS.md',
    status: 'current',
    owner: 'engineering',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/market-readiness/SUPPORT_PLAYBOOK.md'],
    note: 'An index, written for this register: the runbooks were real and scattered. app/src/lib/runbooklinks.test.ts holds every link in the operational set to a file that exists.',
  },
  {
    id: 'commercial',
    category: 'Commercial catalog',
    path: 'docs/operating-model/COMMERCIAL-GOVERNANCE.md',
    status: 'draft',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-009'],
    alsoRead: ['app/src/lib/plans.ts', 'docs/LAUNCH-DECISIONS.md'],
    note: 'Pricing governance and the deal desk, not a price list. The four packages are named in docs/LAUNCH-DECISIONS.md step 3 and the student plans in app/src/lib/plans.ts; no institutional price exists, and D-009 keeps billing out of the app for now.',
  },
  {
    id: 'contracts',
    category: 'Contract templates',
    path: 'docs/trust/PILOT-AGREEMENT-OUTLINE.md',
    status: 'draft',
    owner: 'privacy',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/trust/DPA-CHECKLIST.md', 'docs/legal/TERMS-OF-SERVICE-DRAFT.md', 'docs/legal/PRIVACY-POLICY-DRAFT.md'],
    note: 'Outlines for counsel, not agreement language: nothing in the repository may be signed. docs/LAUNCH-DECISIONS.md items 4 and 5 say what has to happen first.',
  },
  {
    id: 'site',
    category: 'Company site map',
    path: 'docs/PUBLIC-SITE.md',
    status: 'current',
    owner: 'product',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-011', 'D-031'],
    note: 'The routes are `ROUTES` in app/src/site/render.tsx: 18 content pages and 4 tools, prerendered to static HTML.',
  },
  {
    id: 'console',
    category: 'Operations Console map',
    path: null,
    status: 'missing',
    owner: 'engineering',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/CURRENT-SEMESTER-ARTIFACT-INVENTORY.md', 'docs/INTEGRATION-OPERATOR-RUNBOOK.md'],
    gap: 'There is no operations console and no /admin. Staff surfaces are tabs of app/src/screens/University.tsx behind build-time flags, and the operator runbook names functions and tables rather than screens. A map is written once there is a console to map.',
  },
  // ── "anything else": what the repository runs on that the brief's list did not name ──
  {
    id: 'decisions',
    category: 'Decision log',
    path: 'docs/DECISION-LOG.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: ['D-001', 'D-002'],
    alsoRead: ['DECISIONS.md'],
    note: 'The programme log, numbered D-nnn; DECISIONS.md holds the two long-lived product decisions. Every `decisions` entry on this page resolves to one of them or to an ADR.',
  },
  {
    id: 'do-not-build',
    category: 'Do-not-build register',
    path: 'docs/DO-NOT-BUILD.md',
    status: 'current',
    owner: 'product',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['ops/strategic-boundaries/README.md'],
    note: 'Product-level anti-patterns, with the test that holds each. The company-level lines are ops/strategic-boundaries/.',
  },
  {
    id: 'boundaries',
    category: 'Strategic boundaries',
    path: 'ops/strategic-boundaries/README.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-029', 'D-034', 'D-045'],
    note: 'The twelve things Semester will not build, whoever asks, and what holds each.',
  },
  {
    id: 'commitments',
    category: 'Customer commitment register',
    path: 'ops/customer-commitments/README.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    note: 'Every promise made to a named customer, with its product dependency and its evidence. Empty until a customer exists, and the test says why.',
  },
  {
    id: 'proof',
    category: 'Proof calendar',
    path: 'docs/PROOF-CALENDAR.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    note: 'The schedule for producing the evidence needed to sell: three months, then quarterly, each item naming the artifact it files and the register rows it moves.',
  },
  {
    id: 'war-room',
    category: 'Launch war room',
    path: 'docs/LAUNCH-WAR-ROOM.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/LAUNCH-READINESS-COUNCIL.md'],
    note: 'The daily board for the final weeks before launch: thirteen items, each with an owner and the document it is read from.',
  },
  {
    id: 'first-year',
    category: 'First-year success measures',
    path: 'docs/FIRST-YEAR-SUCCESS.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-005', 'D-009'],
    alsoRead: ['ANALYTICS.md'],
    note: 'What "lead the category" means in the first twelve months, as measures with sources. No target is set here; each is a founder decision recorded in the log.',
  },
  {
    id: 'council',
    category: 'Launch readiness council',
    path: 'docs/LAUNCH-READINESS-COUNCIL.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/GO-NO-GO-CHECKLIST.md', 'docs/LAUNCH-DECISIONS.md'],
    note: 'The seats, the gates and `decide()`. Every owner on this page is one of its seats.',
  },
  {
    id: 'rhythm',
    category: 'Operating rhythm',
    path: 'docs/operating-model/OPERATING-RHYTHM.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: [],
    alsoRead: ['docs/operating-model/README.md'],
    note: 'Weekly, monthly, quarterly and annual reviews, each with a written output. The proof calendar’s quarterly items are rows of its quarterly table.',
  },
  {
    id: 'gates',
    category: 'Engineering gates',
    path: 'REGRESSION-CHECKLIST.md',
    status: 'current',
    owner: 'engineering',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-010'],
    alsoRead: ['CLAUDE.md', '.github/pull_request_template.md'],
    note: 'The checks every change passes and the baseline figures. CLAUDE.md is the working agreement for agents; the pull-request template is what a reviewer sees.',
  },
  {
    id: 'analytics',
    category: 'Product analytics',
    path: 'ANALYTICS.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['D-005'],
    alsoRead: ['docs/PRODUCT-ANALYTICS-DATA-ETHICS.md'],
    note: 'Three marks and nothing else; a fourth is a decision. Every first-year measure that needs a new mark lands the way D-005 says.',
  },
  {
    id: 'subprocessors',
    category: 'Subprocessor register',
    path: 'docs/SUBPROCESSORS.md',
    status: 'current',
    owner: 'privacy',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: [],
    note: 'Every third party that touches data, and what it sees. The quarterly vendor review on the proof calendar reads it.',
  },
  {
    id: 'expansion',
    category: 'Strategic expansion register',
    path: 'docs/STRATEGIC-EXPANSION-REGISTER.md',
    status: 'current',
    owner: 'founder',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: MONTHLY,
    supersedes: [],
    decisions: ['DECISIONS §1'],
    alsoRead: ['docs/PRODUCT-ROADMAP.md'],
    note: 'Rendered from app/src/lib/expansionregister.ts: the phased expansion, each phase gated. The plan of record says what is built next; this says what may be entered at all.',
  },
  {
    id: 'supply-chain',
    category: 'Supply-chain policy',
    path: 'docs/SUPPLY-CHAIN.md',
    status: 'current',
    owner: 'engineering',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: [],
    note: 'Rendered from app/src/lib/supplychain.ts and the lockfiles; the test fails on a licence or Action nobody has named, and every deploy carries an SBOM.',
  },
  {
    id: 'security-policy',
    category: 'Security policy',
    path: 'SECURITY.md',
    status: 'current',
    owner: 'security',
    version: 1,
    lastReviewed: REVIEWED,
    nextReview: QUARTERLY,
    supersedes: [],
    decisions: ['ADR-0002'],
    alsoRead: ['SECRETS.md', 'docs/trust/SECURITY-WHITEPAPER.md'],
    note: 'How a report is handled and what is disclosed; app/src/lib/security.test.ts holds it to the variables the Edge Functions read.',
  },
];

/**
 * The permanent rule on scope, and the questions every addition answers
 * before it is built. Held to the pull-request template by the test, so the
 * questions are asked where the change is reviewed rather than remembered.
 */
export const SCOPE_RULE =
  'No new module launches unless it replaces, improves, or connects an existing student or institution workflow with measurable value.';

export const SCOPE_QUESTIONS: readonly string[] = [
  'What does this replace?',
  'What student decision does it clarify?',
  'What institution decision does it improve?',
  'What data does it require?',
  'Who owns it?',
  'How is it supported?',
  'How is it tested?',
  'How does it fail?',
  'How is it removed if it does not work?',
];

/** Directories whose contents are records of a moment, never the current version of anything. */
export const ARCHIVED = ['chats/', 'docs/superpowers/', 'docs/institutional-rollout/generated/', 'project/'];

export const bySlug = (id: string): Source => {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`no source ${id}`);
  return s;
};
