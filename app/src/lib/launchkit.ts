/**
 * The SaaS launch kit, held to the tree.
 *
 * Three documents of 28 September 2026 — the *Semester SaaS Launch Kit*, its
 * summary, and the answer to "what should be in our first pilot agreement, how
 * do we price this module by module, what is our go-to-market plan, what legal
 * entities and insurance do we need, draft our governance council charter" —
 * are kept under `docs/expansion/` as supplied. Between them they describe the
 * company around the product: entity and formation, insurance, the pilot
 * agreement package, module-by-module pricing, the higher-education
 * go-to-market plan, a Product Governance Council charter, and a first-30-day
 * checklist.
 *
 * Almost none of that is code, and the repository cannot form a company, bind
 * a policy or sign a contract. What it can do is say, for each thing the kit
 * asks for, what the tree already holds — a deal-desk rule with a test, a
 * pilot rule the database enforces, a drafted outline for counsel, a decision
 * on main that answers the question differently — and what it does not. So
 * this is a crosswalk, under D-108's and D-111's rule: a supplied PDF is never
 * its own evidence, every cited file exists, and every standing is held to
 * the kind of file it cites.
 *
 * `docs/SAAS-LAUNCH-KIT.md` is rendered from this file by `launchkit.test.ts`;
 * edit the data, then `npm run registers` from app/.
 *
 * ## Standings
 *
 *   - `tested`      an automated test or a database check holds the rule.
 *   - `building`    code carries some of it; the gap says what it does not.
 *   - `designed`    a document says what it would be; nothing runs.
 *   - `not-started` nothing in the tree beyond the register that names it.
 *   - `held`        a decision already on main answers it differently, and
 *                   the decision holds until the owner reopens it.
 *
 * Standings were read at `origin/main` `ff52ba4` on 28 September 2026.
 *
 * ## The entity, in one line
 *
 * The kit recommends a Delaware C-Corporation "if venture funding is likely".
 * The owner attested on 28 September (HECVAT COMP-01) that Semester is a
 * single-member LLC, and docs/LAUNCH-DECISIONS.md item 4 asked for exactly
 * that. So the entity item is `held`: an LLC exists; converting it is a
 * question for counsel when a priced round is planned, not a gap in the tree.
 */

import type { Seat } from './launchreadiness';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Semester-SaaS-Launch-Kit.pdf',
    title: 'Semester SaaS Launch Kit',
    what: 'The launch operating model, the C-Corp checklist, insurance readiness, pilot terms, the module pricing model, the higher-ed GTM plan, the council charter and the first-30-day checklist.',
  },
  {
    path: 'docs/expansion/SaaS-Launch-Kit-Summary.pdf',
    title: 'Build an all-in-one SaaS launch kit',
    what: 'The same kit in summary: pilot essentials, the module table, the bands, the 180-day sequence, the insurance sequence, the council.',
  },
  {
    path: 'docs/expansion/First-Pilot-Agreement-Pricing-GTM-Entities-and-Council-Charter.pdf',
    title: 'What should be in our first pilot agreement',
    what: 'The pilot structure and eighteen agreement sections, the pilot SOW, pricing layers and guardrails, the two-engine GTM, the entity and insurance sequence, and the council charter in full.',
  },
];

export const STANDINGS = ['tested', 'building', 'designed', 'not-started', 'held'] as const;
export type Standing = (typeof STANDINGS)[number];

export const STANDING_MEANING: Record<Standing, string> = {
  tested: 'An automated test or a database check holds the rule',
  building: 'Code carries some of it; the gap says what it does not',
  designed: 'A document says what it would be; nothing runs',
  'not-started': 'Nothing in the tree beyond the register that names it',
  held: 'A decision already on main answers it differently, and holds until the owner reopens it',
};

/** The files a `held` standing may cite: where decisions are written. */
export const DECISION_FILES: readonly string[] = [
  'docs/DECISION-LOG.md',
  'DECISIONS.md',
  'docs/DO-NOT-BUILD.md',
  'docs/LAUNCH-DECISIONS.md',
  'docs/PAID-PILOT-FRAMEWORK.md',
  'docs/FACULTY-COURSE-STUDIO-DESIGN.md',
  'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md',
];

export interface Evidence {
  /** Repository-relative. The test fails if it does not exist. */
  path: string;
  shows: string;
}

export interface Item {
  /** Stable: `LK-<section>-nn`. */
  id: string;
  item: string;
  /** What the kit asks for, in its own terms. */
  asks: string;
  standing: Standing;
  evidence: Evidence[];
  /** What the tree lacks, or which decision holds. */
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

// ── 1. The commercial position and its rules ─────────────────────────────────

export const POSITION =
  'One platform agreement: the Foundation platform entitlement, institution-configured modules, an implementation scope, a support tier, and transparent usage and cost guardrails.';

/** The kit's core commercial rules, each held to where the tree already says it. */
export const COMMERCIAL_RULES: readonly Item[] = rows('LK-RULE', [
  ['Foundation is required', 'The Foundation platform is required for institutional use; modules are activated on it.', 'building',
    [['app/src/lib/plans.ts', 'four plans: Free, Student, Student Plus, Institution; the institution plan is “through your university”'], ['supabase/migrations/20260928004730_tenant_plan.sql', 'one current plan per school, written by the service role']],
    'No Foundation entitlement distinct from the institution plan, and no module entitlement rides on it; modules are build-time flags, not purchasable rows.'],
  ['Core controls are never premium', 'Privacy, accessibility, export, security and core data controls are never a premium add-on.', 'tested',
    [['app/src/lib/plans.test.ts', 'the free plan carries export and deletion; no plan withholds privacy or accessibility'], ['app/src/lib/export.ts', 'export for every account']],
    'True for student plans. No institutional entitlement model exists to hold the rule at that level.'],
  ['Every module has an owner before sale', 'A named product owner, operational owner, data model, support model, accessibility requirements and an implementation playbook before a module is sold.', 'tested',
    [['app/src/lib/governance/charters.ts', 'every module.* flag has a charter with owners, cost model, kill switch and review date'], ['app/src/lib/governance/charters.test.ts', 'a flag without a charter, or a charter with an empty field, fails']],
    'Owners are role labels; every seat is vacant. No implementation playbook per module.'],
  ['Services are separately scoped', 'Implementation, migration, custom development and premium support are separately scoped and priced.', 'tested',
    [['app/src/lib/governance/deal-desk.ts', 'an implementation-fee floor; custom work needs product approval'], ['app/src/lib/governance/deal-desk.test.ts', 'the floor and the custom-work approver are held']],
    'Proposed defaults, not a price book; no migration or premium-support price.'],
  ['AI and storage costs are capped', 'AI and storage require an explicit allowance, cap, customer-managed account or overage term.', 'tested',
    [['app/src/lib/governance/deal-desk.ts', 'a deal without an AI overage policy is refused'], ['app/src/lib/governance/deal-desk.test.ts', 'held'], ['supabase/migrations/20260924163000_intelligence_provider_runtime.sql', 'private.reserve_ai_budget: an atomic monthly budget per tenant']],
    'No storage allowance or overage anywhere; the AI budget is a tenant cap, not a contract term.'],
  ['No sale of student data', 'No sale of student data, hidden behaviour, academic data, accommodation data, basic-needs activity or private AI conversations.', 'tested',
    [['app/src/lib/gtm/sponsor.ts', 'sponsors never receive student-level data; protected surfaces refused even when a school lists them'], ['app/src/lib/gtm/sponsor.test.ts', 'held'], ['docs/legal/PRIVACY-POLICY-DRAFT.md', 'the draft says so, for counsel']],
    'The privacy policy is a draft, not in force.'],
  ['Partners buy services, not access', 'Employers and partners may purchase approved services, never undisclosed student access.', 'tested',
    [['app/src/lib/gtm/sponsor.ts', 'placements carry a visible “Sponsored” label and a why-shown explanation; reports go out as suppressed aggregates'], ['supabase/gtm.check.sql', 'the database refuses the same']],
    'No employer or partner product exists to sell; the rule is held on sponsorship only.'],
]);

// ── 2. Entity and formation ─────────────────────────────────────────────────

export const ENTITY: Item = {
  id: 'LK-ENT-01',
  item: 'Entity path',
  asks: 'Choose a Delaware C-Corp when venture capital, options and enterprise sales are expected; an LLC when bootstrapped; decide with startup counsel and a CPA.',
  standing: 'held',
  evidence: [
    { path: 'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', shows: 'COMP-01: a single-member LLC, wholly owned by its founder (owner attestation, 28 September 2026); legal name, state and formation date still to add' },
    { path: 'docs/LAUNCH-DECISIONS.md', shows: 'item 4: “Form the company, e.g. an LLC, and choose the state”' },
  ],
  gap: 'An LLC exists by the owner’s attestation and no formation record is in the tree. Converting to a C-Corp is a question for counsel when a priced round is planned; it is not a gap here.',
};

/** The formation checklist, twenty items, each read against the tree. */
export const FORMATION: readonly Item[] = rows('LK-FORM', [
  ['Counsel and CPA', 'Retain startup counsel and a CPA.', 'not-started',
    [['docs/LAUNCH-DECISIONS.md', 'item 5: take the legal drafts to a lawyer; ask the Wond’ry about student-founder resources']],
    'No counsel or CPA is named anywhere.'],
  ['Name and trademark clearance', 'Clear the company name, domain and trademark conflicts.', 'designed',
    [['IP.md', '§2: “Semester” is likely merely descriptive; the USPTO search to run is written out'], ['docs/operating-model/DEFENSIBILITY.md', 'register the mark in core classes; hold the primary domains']],
    'The search has not been run and no custom domain is held; the app runs at the GitHub Pages address.'],
  ['Structure chosen', 'Choose a Delaware C-Corp, LLC or another approved structure.', 'held',
    [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: a single-member LLC']],
    'Chosen: an LLC. See LK-ENT-01.'],
  ['Registered agent', 'Appoint a registered agent.', 'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01 leaves the state of formation to add']], 'Not recorded.'],
  ['Formation filed', 'File the certificate of incorporation or formation documents.', 'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: formation date still to add']], 'Attested, not evidenced: no certificate is filed under docs/evidence/, which does not exist.'],
  ['EIN and registrations', 'Obtain an EIN and required state and local registrations.', 'not-started', [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'financial controls: tax nexus reviewed annually and on entering a new state, by an external accountant']], 'Not recorded.'],
  ['Bylaws or operating agreement', 'Adopt bylaws or an operating agreement.', 'not-started', [['docs/operating-model/RISK-GOVERNANCE.md', 'governance bodies: eight, every one “none named”']], 'Not recorded.'],
  ['Directors, officers, signers', 'Appoint initial directors, officers and authorized signers.', 'not-started', [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'invoice and expense approval by amount, finance and CEO']], 'No signing authority is recorded; the master register’s LEG-001 gap names it.'],
  ['Founder equity and cap table', 'Approve founder equity grants and maintain a cap table.', 'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: 100% owned by the founder']], 'A single owner; no cap table is needed until a second holder, and none exists.'],
  ['Founder IP assignment', 'Execute founder invention and IP assignment and confidentiality agreements.', 'designed',
    [['docs/trust/SOC2-READINESS.md', 'CC1-08: no agreements exist; counsel drafts a confidentiality and IP assignment agreement, including one for the founder’s own entity'], ['IP.md', '§1: whether Vanderbilt has a claim, with the deciding facts and the email to send']],
    'No assignment from the founder to the LLC is recorded; the Vanderbilt question is prepared, not asked.'],
  ['Equity incentive plan', 'Create an equity incentive plan before meaningful hiring, if appropriate.', 'not-started', [['docs/operating-model/OPERATING-RHYTHM.md', 'monthly: hiring and capacity → open roles']], 'One person works in the company; no plan and no hiring plan.'],
  ['83(b) election', 'Evaluate 83(b) election requirements with counsel.', 'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: an LLC with one member']], 'Not applicable to a single-member LLC with no restricted stock; revisit on conversion.'],
  ['Bank and payment processor', 'Open a company bank account and a payment-processor account.', 'not-started',
    [['app/src/lib/masterregister.ts', 'COM-001: no payment processor, no invoicing'], ['docs/DECISION-LOG.md', 'D-009: billing stays out of the app for now']],
    'No bank account or processor is recorded. D-009 keeps billing out of the app.'],
  ['Accounting and monthly close', 'Accounting system, chart of accounts, expense approvals and a monthly close.', 'designed',
    [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'financial controls: tiered expense approval, budget vs actual monthly, 13-week cash forecast, monthly close review'], ['app/src/lib/ops/firstyear.ts', 'runway, ARR/MRR and gross-margin measures; the numbers live in the financial workspace, not the repository']],
    'Controls and owners on a page; no accounting system, no close has happened, no numbers anywhere.'],
  ['Payroll and sales-tax registration', 'Register for payroll, sales/use tax and local tax obligations.', 'not-started', [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'tax nexus by an external accountant']], 'Not recorded.'],
  ['Signature authority and legal review', 'Establish contract-signature authority and a legal review process.', 'designed',
    [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'legal sits at the deal desk for non-standard paper'], ['app/src/lib/governance/deal-desk.ts', 'nonstandard terms add the legal approver']],
    'A rule about who approves; no signatory is named and nothing may be signed (SEMESTER-OPERATING-SYSTEM.md, contract templates).'],
  ['Staff and advisor agreements', 'Employee, contractor and advisor confidentiality and IP-assignment agreements.', 'designed',
    [['docs/operating-model/DEFENSIBILITY.md', '“Every employee and contractor signs an invention assignment before first commit”'], ['docs/trust/SOC2-READINESS.md', 'CC1-07: training before access; no staff yet']],
    'A commitment on a page; no agreement exists and no one to sign one.'],
  ['Policy set adopted', 'Records retention, privacy, security, accessibility and AI governance policies.', 'building',
    [['RETENTION.md', 'retention per table and device store'], ['SECURITY.md', 'the security policy'], ['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'accessibility governance'], ['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'AI governance'], ['app/src/lib/ops/claims.ts', 'POLICIES: each policy’s status, not-started through in-force']],
    'Product policies exist; the retention schedule has no corporate-records classes (maturity RM-01), and no policy is in force.'],
  ['Board and advisor governance', 'Board or advisor governance, meeting records and a corporate document repository.', 'designed',
    [['docs/operating-model/RISK-GOVERNANCE.md', 'board-level reporting: the ten-item quarterly report'], ['docs/operating-model/OPERATING-RHYTHM.md', 'quarterly: board/advisor review → board deck']],
    'No board, no advisor, no minutes and no minute book; the operating-system register is the nearest thing to a document repository, and it holds controlled documents, not corporate records.'],
  ['Corporate records repository', 'Keep certificate, bylaws, consents, cap table, IP assignments, EIN, banking resolutions, insurance certificates, trademark documents and the policy register in one place.', 'not-started',
    [['app/src/lib/masterregister.ts', 'NEEDS_EVIDENCE_DIR: no row rises above tested until docs/evidence/ exists'], ['ops/operations-console/README.md', 'an insurance certificate is an expiring artifact under docs/evidence/']],
    'docs/evidence/ does not exist. Corporate records would not belong in a public repository in any case; a private store is the gap, and its index would be filed here.'],
]);

/** The essential corporate files the kit lists, and whether any is in evidence. None is. */
export const CORPORATE_FILES: readonly string[] = [
  'Certificate of incorporation or formation documents',
  'Bylaws or operating agreement',
  'Board and stockholder consents',
  'Cap table and equity records',
  'Founder stock purchase documents',
  'IP assignment documents',
  'Employee, contractor and advisor agreements',
  'EIN confirmation and tax registrations',
  'Banking resolutions',
  'Insurance policies and certificates',
  'Trademark and domain documentation',
  'Policy register and corporate records schedule',
];

// ── 3. Insurance ────────────────────────────────────────────────────────────

export interface Coverage extends Item {
  trigger: string;
  purpose: string;
  brokerQuestion: string;
}

type CoverageRow = [item: string, trigger: string, purpose: string, brokerQuestion: string, standing: Standing, evidence: [string, string][], gap: string];

const COVERAGE_ROWS: readonly CoverageRow[] = [
  ['Commercial general liability', 'Formation, or the first office, venue or customer-contract requirement', 'Third-party bodily injury, property damage, certain advertising-injury claims', 'Required limits, additional-insured terms, worldwide territory',
    'not-started', [['app/src/lib/masterregister.ts', 'LEG-001: insurance in place — designed, no certificate in evidence']], 'No policy; no institution has yet asked for one.'],
  ['Technology E&O / professional liability', 'Before paid pilots and enterprise contracts', 'Claims caused by software or service error, failure to perform, or professional negligence', 'Does it cover SaaS outage, implementation failure, content- and AI-related professional exposure?',
    'not-started', [['app/src/lib/masterregister.ts', 'LEG-001 and COM-003: the procurement packet lacks insurance']], 'No policy. The kit puts this before the first paid pilot; docs/trust/README.md’s signature blockers name only cyber.'],
  ['Cyber liability', 'Before production personal, student or customer data', 'Breach response, forensics, notification, ransomware, cyber business interruption', 'Does it cover privacy claims, regulatory response, vendor incidents, social engineering?',
    'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-03: “No policy is held. A certificate will be filed under docs/evidence/ once one is bought.”'], ['docs/market-readiness/HECVAT_READINESS.md', 'LEGAL-2 cyber liability insurance certificate: NOT_STARTED']],
    'No policy, and hecvat-readiness.test.ts fails any READY insurance claim with no filed document. Production holds real accounts already (delete-account is live), so by the kit’s own trigger this is overdue.'],
  ['Directors and officers', 'Before outside financing, a formal board or a priced round', 'Management, governance and fiduciary claims', 'Does it include entity coverage and an appropriate retention?',
    'not-started', [['docs/operating-model/RISK-GOVERNANCE.md', 'no board is named']], 'No board and no financing; not yet triggered.'],
  ['Employment practices liability', 'At employee hiring, or as part of the D&O package', 'Employment-related allegations', 'Multi-state workforce and contractor treatment?',
    'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: one person working in the company']], 'No employees; not yet triggered.'],
  ['Workers’ compensation', 'When legally required for employees in the relevant states', 'Work-related injury obligations', 'Which employee locations trigger coverage?',
    'not-started', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: one person working in the company']], 'No employees; not yet triggered.'],
  ['Crime / social engineering', 'When payments, AP, wire transfers or vendor disbursements mature', 'Fraud, funds-transfer and employee-dishonesty risk', 'Are payment-processor and wire-fraud losses covered?',
    'not-started', [['app/src/lib/masterregister.ts', 'COM-001: no payment processor']], 'No payments flow; not yet triggered.'],
  ['Media / IP', 'As public content, AI, marketplace and brand activity expand', 'Some media, copyright or IP claims, subject to exclusions', 'What AI and content exclusions apply?',
    'not-started', [['docs/operating-model/TRUST-BRAND-AND-LEGAL.md', 'horizon scanning: copyright, model training, AI output policy']], 'No policy; the AI features that would trigger it ship behind flags.'],
  ['Key person', 'Later, if the business depends heavily on one individual', 'Financial consequences of losing key leadership', 'Which roles, and what limits?',
    'not-started', [['app/src/lib/governance/risk.ts', 'R-09: one person holds every seat'], ['app/src/lib/governance/maturity.ts', 'DS-01 founder unavailable: no delegate holds credentials']],
    'The dependence is total and recorded; the coverage is not held and the written unavailability plan R-09 asks for does not exist.'],
];

export const COVERAGES: readonly Coverage[] = COVERAGE_ROWS.map(([item, trigger, purpose, brokerQuestion, standing, evidence, gap], i) => ({
  id: `LK-INS-${String(i + 1).padStart(2, '0')}`,
  item, asks: `${trigger}.`, trigger, purpose, brokerQuestion, standing,
  evidence: evidence.map(([path, shows]) => ({ path, shows })),
  gap,
}));

/** The underwriting packet: what a broker asks for, and what the tree can hand over today. */
export const UNDERWRITING: readonly Item[] = rows('LK-UW', [
  ['Entity, ownership, revenue, headcount', 'Legal entity, ownership, revenue, projected revenue, employee and contractor count.', 'designed',
    [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: a single-member LLC, one person; revenue is nil']], 'Legal name, state and date still to add; no revenue projection exists.'],
  ['Product, customers, high-risk workflows', 'Product description, customer type and high-risk workflows.', 'designed',
    [['docs/launch/WHAT-IS-SEMESTER.md', 'the product in plain words'], ['docs/MODULE-PRIVACY-MODEL.md', 'what each module holds and the authority boundaries'], ['ops/claims/README.md', 'every public claim with its register word']],
    'Assembled from three pages; not one document.'],
  ['Security overview and architecture', 'Security overview and an architecture diagram.', 'designed',
    [['docs/trust/SECURITY-WHITEPAPER.md', 'the security whitepaper'], ['docs/architecture/README.md', 'the ten decision records'], ['docs/UNIVERSITY-OS-ARCHITECTURE.md', 'the architecture']],
    'No diagram as such; the whitepaper and ADRs are prose.'],
  ['Control evidence', 'MFA, encryption, logging, backups, incident response and vulnerability-management evidence.', 'building',
    [['docs/market-readiness/SECURITY_READINESS.md', 'the controls and their state'], ['supabase/restore.sh', 'the restore drill'], ['docs/market-readiness/INCIDENT_RESPONSE.md', 'severity model and process'], ['app/src/lib/security.test.ts', 'the policy held to the Edge Function variables']],
    'Controls exist; the evidence of operating them does not, because docs/evidence/ does not exist (master register, evidence index: missing).'],
  ['Privacy set', 'Privacy policy, DPA, subprocessor list, retention policy and AI data-use policy.', 'building',
    [['docs/legal/PRIVACY-POLICY-DRAFT.md', 'draft for counsel'], ['docs/trust/DPA-CHECKLIST.md', 'DPA requirements; not a signed agreement'], ['docs/SUBPROCESSORS.md', 'the subprocessor register'], ['RETENTION.md', 'retention'], ['docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md', 'the no-training policy, a draft for counsel'], ['app/src/lib/trust/legal-drafts.test.ts', 'the drafts name every subprocessor and say they are not in force']],
    'Two of five are drafts and the DPA is a checklist; the subprocessor and retention registers are current.'],
  ['Education-record data and safeguards', 'Description of student and education-record data and its safeguards.', 'tested',
    [['docs/FERPA-COPPA-1EDTECH-READINESS.md', 'FERPA, COPPA and 1EdTech readiness'], ['app/src/lib/trust/ferpa-coppa-readiness.test.ts', 'held'], ['RETENTION.md', 'every table and its class']],
    'Held; the school-official language waits on counsel.'],
  ['Prior claims and incidents', 'Prior claims or incidents and their remediation.', 'designed',
    [['app/src/lib/postmortem.ts', 'the post-mortem shape'], ['docs/market-readiness/INCIDENT_RESPONSE.md', 'the process']],
    'None to declare; no incident log exists to prove it.'],
  ['Institutions’ insurance requirements', 'Contractual insurance requirements from target institutions.', 'not-started',
    [['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'assumes cyber-liability insurance is in place']],
    'No institution has stated a requirement; no target-account list exists to ask.'],
  ['Limits, retentions, certificates', 'Requested limits, deductibles or retentions, exclusions and certificate requirements.', 'not-started',
    [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-03: the certificate’s future home']], 'Nothing to request against; no broker is engaged.'],
]);

// ── 4. The pilot agreement ──────────────────────────────────────────────────

/** The recommended agreement package, seven documents. */
export const PACKAGE: readonly Item[] = rows('LK-PKG', [
  ['Pilot agreement or MSA', 'The master terms the order form hangs from.', 'designed',
    [['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'twenty-six sections the agreement needs, and a sample scope; an outline for counsel, not agreement language'], ['app/src/lib/gtm/rfp.ts', 'CT-1: “None has been reviewed by qualified counsel, approved or signed”']],
    'No counsel-approved MSA exists: an unapproved draft is in docs/legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md, and the outline is the rest of it. LEG-002 in the master register: designed.'],
  ['Order form / pilot SOW', 'Cohort, modules, environments, integrations, roles, milestones, exclusions, fees.', 'building',
    [['app/src/lib/gtm/pilot.ts', 'PilotPlan: dates, workflow, cohort, baseline, sponsor, champion, data plan, 3–5 metrics with baselines, conversion date, agreed annual price, midpoint review'], ['app/src/lib/gtm/pilot.test.ts', 'pilotReadiness refuses a plan missing any of them'], ['app/src/lib/launch/ninety-day.ts', 'charter-drafts: “Draft charter and order form, reviewed by counsel”']],
    'The fields a pilot must carry are code and the database refuses a pilot without them; no order-form document renders them for a signature.'],
  ['Data Processing Addendum', 'FERPA school-official terms, permitted processing, subprocessors, retention, deletion, legal hold, export.', 'designed',
    [['docs/trust/DPA-CHECKLIST.md', 'the clause requirements and what the product supports today; starting clause language'], ['app/src/lib/ops/claims.ts', 'POLICIES: dpa is an outline; the student-data addendum is not started']],
    'A checklist for counsel; the tenant-wide export and deletion certification its termination clause needs do not exist yet.'],
  ['Security, privacy, accessibility and AI exhibit', 'One exhibit stating the safeguards, the accessibility documentation and process, and the AI data-use and no-training terms.', 'building',
    [['app/src/lib/governance/module-privacy.ts', 'CONTRACT_TERMS: the terms a contract carries per module'], ['app/src/lib/trust/ai-training-policy.ts', 'DEFAULT_RULE: no training on production content by default'], ['app/src/lib/trust/ai-training-policy.test.ts', 'held'], ['docs/SECURITY-ACCESSIBILITY-READINESS.md', 'what a reviewer receives and what is absent']],
    'The terms exist as data in three places; no exhibit assembles them, and the accessibility conformance report it would attach has not been produced.'],
  ['Support and service-level exhibit', 'Scope, hours, severities, escalation, maintenance windows, objectives, exclusions; not an emergency service.', 'designed',
    [['docs/trust/SLA.md', 'the pilot SLA once it can be offered: 99.9% core, AI best-effort, credits, exclusions'], ['app/src/lib/gtm/rfp.ts', 'SS-1 support planned; SS-2 no uptime commitment'], ['app/src/community/governance.ts', 'NOT_AN_EMERGENCY_SERVICE']],
    'Nothing is committed: no support hours, no owner, no on-call (SUP-002). The emergency boundary is stated for communities, not in a contract exhibit.'],
  ['Implementation plan and launch gates', 'Milestones, readiness reviews, the go decision, hypercare.', 'tested',
    [['docs/operating-model/PILOT-TO-PRODUCTION.md', 'phases 0–7, the cutover checklist, the RACI'], ['app/src/lib/launchreadiness.ts', 'the gates and decide(): GO or NO-GO'], ['app/src/lib/launchreadiness.test.ts', 'an open P0/P1 is NO-GO and no acceptance waives it'], ['supabase/tenant-rollout.check.sql', 'the tenant lifecycle refuses an exit gate without evidence']],
    'The gates are code; no institution has passed through them, and every council seat is vacant.'],
  ['Regulated-data exhibit', 'A business-associate, payment or other regulated-data exhibit, only if applicable.', 'held',
    [['docs/DO-NOT-BUILD.md', 'what is not built'], ['docs/DECISION-LOG.md', 'D-009: billing stays out of the app']],
    'Not applicable by decision: no health data is processed and no payments flow. Revisit when either changes.'],
]);

/** The pilot term sheet: fourteen positions, each held to where the tree already takes it. */
export const TERM_SHEET: readonly Item[] = rows('LK-TERM', [
  ['Parties', 'Semester’s legal entity and the institution’s.', 'held',
    [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'COMP-01: the LLC, name to add']], 'The party exists by attestation; its legal name is not yet on file, so no paper names it.'],
  ['Term', 'One academic term or 90–180 days, with explicit dates.', 'held',
    [['app/src/lib/gtm/pilot.ts', 'pilotReadiness: exactly 26 weeks, or the plan is refused'], ['app/src/lib/gtm/pilot.test.ts', 'held'], ['docs/PAID-PILOT-FRAMEWORK.md', '“The two length rules agree”: 26 weeks inside the deal desk’s six months']],
    'The owner set every pilot to 26 weeks (D-134); pilotReadiness refuses any other length. That is 182 days, two past the kit’s 90–180; the code’s rule holds.'],
  ['Scope', 'Named cohort, modules, environments, integrations and roles only.', 'tested',
    [['app/src/lib/gtm/pilot.ts', 'no_cohort, no data plan → refused'], ['supabase/gtm.check.sql', 'the database refuses a pilot without the §6.2 elements'], ['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'included and excluded lists']],
    'Modules are not enumerable per tenant; the scope names features, not entitlements.'],
  ['Purpose', 'Validate a defined outcome, not general unlimited use.', 'tested',
    [['app/src/lib/gtm/pilot.ts', 'a workflow, a baseline and 3–5 metrics each with a baseline'], ['app/src/lib/gtm/pilot.test.ts', 'held']], 'Held in code.'],
  ['Fees', 'A paid pilot; invoice schedule and taxes stated; credit toward an annual licence only if specified.', 'tested',
    [['app/src/lib/governance/deal-desk.ts', 'minimum pilot ACV $15k (proposed); pilot credit capped at 50%; implementation fee waived only as capped credit'], ['app/src/lib/governance/deal-desk.test.ts', 'held']],
    'Proposed defaults, not a price book; no invoice can be issued (COM-001).'],
  ['Cohort', 'A defined covered population and an enrollment cap.', 'building',
    [['app/src/lib/gtm/pilot.ts', 'cohort required'], ['docs/PAID-PILOT-FRAMEWORK.md', '10–200 students, as a checklist item']],
    'The 10–200 bound is a checklist line, not code.'],
  ['Data', 'Minimum necessary; an approved data map; nothing outside it.', 'tested',
    [['app/src/lib/gtm/pilot.ts', 'a minimum-necessary read-only data plan; sandbox until production data is approved'], ['app/src/lib/gtm/campaign.ts', 'education-record, aid, health, disability and conduct fields refused by name'], ['app/src/lib/gtm/campaign.test.ts', 'held']],
    'The forbidden classes are enforced for campaigns; the pilot data plan is free text.'],
  ['Customer authority', 'The institution retains official authority for registration, degree audit, aid, discipline, accommodations, health and final decisions.', 'tested',
    [['app/src/site/platform.ts', 'AUTHORITIES and BOUNDARIES, shown at /platform/system-boundaries/'], ['app/src/site/site.test.tsx', 'the page renders them'], ['app/src/lib/governance/module-privacy.ts', 'DECISION_RIGHTS'], ['docs/trust/PILOT-AGREEMENT-OUTLINE.md', '§26: no production, grade or registration authority before written approval']],
    'Held publicly and in data; not yet in agreement language.'],
  ['AI', 'No general-purpose training on production data by default; approved provider and data use only.', 'tested',
    [['app/src/lib/trust/ai-training-policy.ts', 'DEFAULT_RULE'], ['app/src/lib/trust/ai-training-policy.test.ts', 'held to the privacy page’s promise'], ['docs/trust/DPA-CHECKLIST.md', 'no secondary use or training, unchecked until provider terms are accepted'], ['docs/trust/PROVIDER-TERMS.md', 'the providers’ published terms, verbatim; none signed']],
    'A draft for counsel; provider terms are recorded as published, and none is accepted or signed.'],
  ['Support', 'Named contacts, hours, a severity framework, an escalation route, and an explicit non-emergency boundary.', 'designed',
    [['docs/market-readiness/SUPPORT_PLAYBOOK.md', 'T1–T3 tiers'], ['docs/market-readiness/INCIDENT_RESPONSE.md', 'the severity model'], ['app/src/community/governance.ts', 'NOT_AN_EMERGENCY_SERVICE']],
    'No named contact, no hours, no support address separate from a personal mailbox (LAUNCH-DECISIONS item 2).'],
  ['Success', 'Baseline, target, method, data owner, review dates, end-of-pilot value review.', 'tested',
    [['app/src/lib/gtm/pilot.ts', 'metrics with baseline and target; a midpoint review date; a conversion date near the end'], ['app/src/lib/gtm/pilot.test.ts', 'held'], ['docs/market-readiness/PILOT_PLAYBOOK.md', 'success criteria decided before, measured after']],
    'No data owner per metric and no method field.'],
  ['Publicity', 'No logo, case study, testimonial or outcome claim without written approval.', 'tested',
    [['app/src/lib/ops/claims.ts', 'PROOF_RULES: no logo without the institution’s written permission; shown at /proof/'], ['app/src/lib/ops/claims.test.ts', 'held'], ['app/src/lib/launch/ninety-day.ts', 'quotes: each with the speaker’s written permission']],
    'Held as a public rule; not yet a clause.'],
  ['Conversion', 'A pre-agreed option and decision date; no automatic conversion.', 'tested',
    [['app/src/lib/gtm/pilot.ts', 'pilotVerdict: no signature, no outcome; convert and expand refused while a high-severity issue is open'], ['app/src/lib/gtm/pilot.test.ts', 'held'], ['docs/PILOT-TO-ANNUAL-CONVERSION.md', 'four outcomes, all real: convert, expand, pause, stop']],
    'No explicit no-auto-renewal clause anywhere; the rule is that nothing converts unsigned.'],
  ['Exit', 'Export, transition support, deletion or retention, credential revocation, closeout.', 'building',
    [['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'offboarding a school: each student’s own export first, deletion confirmation per category'], ['app/src/lib/export.ts', 'student export'], ['supabase/deletion.check.sql', 'deletion empties what it claims'], ['app/src/lib/revoke.test.ts', 'a revoke cannot be undone']],
    'Student-level export and deletion are tested; no tenant-wide export job, no deletion certificate, no transition runbook (LEG-004).'],
]);

/** The eighteen core agreement sections, each mapped to the section numbers of the outline that carry it. */
export const AGREEMENT_SECTIONS: readonly { section: string; outline: readonly number[]; note: string }[] = [
  { section: 'Parties, effective date, definitions', outline: [1], note: 'Order of precedence: MSA, DPA, SOW, SLA.' },
  { section: 'Purpose, scope, cohort, enabled modules, excluded features', outline: [2, 4, 5, 6], note: '' },
  { section: 'Implementation plan; customer and Semester responsibilities', outline: [7, 8, 9], note: '' },
  { section: 'Fees, invoicing, payment, taxes, optional annual credit', outline: [16], note: 'Usage and AI capacity limits sit in the same section.' },
  { section: 'Service access, entitlement, acceptable use, suspension', outline: [], note: 'Not in the outline. Acceptable use lives in the student terms draft; suspension rights are nowhere.' },
  { section: 'Data ownership, permitted processing, FERPA school-official duties, minimization, no secondary use', outline: [10, 11], note: 'The DPA checklist carries the clause language.' },
  { section: 'Privacy, DPA, subprocessors, retention, deletion, legal hold, export', outline: [11, 23], note: '' },
  { section: 'Security safeguards, incident notification, customer cooperation', outline: [11, 22], note: '' },
  { section: 'AI terms: provider and data use, no training by default, policy configuration, limitations, human oversight', outline: [13], note: 'The no-training policy is a draft for counsel.' },
  { section: 'Accessibility: conformance statement, known limitations, feedback route, remediation, customer duties', outline: [14], note: 'No ACR exists to attach.' },
  { section: 'Interoperability: SSO, LTI, OneRoster, API scope, testing, dependencies, rate limits, mapping', outline: [12], note: '' },
  { section: 'Support, service objectives, maintenance, status communications, change-freeze periods', outline: [15, 17], note: 'Best-effort with named response times, not a credit-bearing SLA.' },
  { section: 'Intellectual property, customer content, feedback, product improvements', outline: [20, 21], note: '' },
  { section: 'Confidentiality', outline: [20], note: '' },
  { section: 'Warranties, disclaimers, indemnity, limitation of liability, insurance', outline: [], note: 'Not in the outline; counsel’s provisions (below).' },
  { section: 'Termination, transition, export, deletion, survival', outline: [23], note: '' },
  { section: 'Pilot evaluation, optional conversion, non-binding plan language', outline: [18, 19, 24], note: '' },
  { section: 'Governing law, notices, assignment, standard terms', outline: [], note: 'Not in the outline; counsel’s provisions (below).' },
];

/** The pilot SOW template, field by field, and the `PilotPlan` field that already carries it. */
export const SOW: readonly { field: string; carriedBy: string | null; note: string }[] = [
  { field: 'Pilot name', carriedBy: null, note: 'A `gtm_pilots` row has an id, not a name.' },
  { field: 'Institution', carriedBy: null, note: 'The pilot belongs to a `gtm_accounts` row; the plan itself does not name the institution.' },
  { field: 'Pilot period', carriedBy: 'startDate, endDate', note: 'Exactly 26 weeks.' },
  { field: 'Population', carriedBy: 'cohort', note: 'Free text; no enrollment cap field.' },
  { field: 'Enabled modules', carriedBy: null, note: 'Modules are flags on the tenant, not a list in the plan.' },
  { field: 'Enabled integrations', carriedBy: 'dataPlan', note: 'A minimum-necessary read-only data plan; integrations are not enumerated.' },
  { field: 'Excluded modules', carriedBy: null, note: 'Nothing records what is out; the outline’s excluded list is prose.' },
  { field: 'Customer responsibilities', carriedBy: 'executiveSponsor, operationalChampion', note: 'Two named roles; no content-owner or escalation-contact fields.' },
  { field: 'Semester responsibilities', carriedBy: null, note: 'docs/operating-model/PILOT-TO-PRODUCTION.md’s RACI, not a plan field.' },
  { field: 'Success metrics', carriedBy: 'metrics', note: '3–5, each with baseline and target.' },
  { field: 'Review dates', carriedBy: 'midpointReviewDate', note: 'One midpoint; the kit asks for kickoff, weeks 2, 4, 10 and the end.' },
  { field: 'Conversion decision date', carriedBy: 'conversionDate', note: 'Within end −14 / +30 days.' },
  { field: 'Pilot fee', carriedBy: 'annualPriceAgreed', note: 'The annual price is agreed; the pilot fee itself is not a field.' },
];

/** Provisions the kit leaves to counsel, and which the tree does not attempt. */
export const COUNSEL_PROVISIONS: readonly string[] = [
  'Confidentiality', 'Intellectual property and feedback', 'Warranties and disclaimers', 'Indemnification', 'Limitation of liability', 'Insurance', 'Governing law and venue', 'Assignment', 'Force majeure', 'Notices', 'Publicity', 'Export controls and sanctions',
];

// ── 5. Module-by-module pricing ─────────────────────────────────────────────

/** The commercial layers, each with its pricing basis and where the tree holds it. */
export const LAYERS: readonly Item[] = rows('LK-LAYER', [
  ['Semester Foundation', 'An annual platform fee by enrollment band or covered population.', 'building',
    [['app/src/lib/governance/deal-desk.ts', 'minimum ACV by tier: pilot, department, campus, system'], ['app/src/site/more.tsx', 'HowWePrice: cohort size, modules switched on, connected systems, support tier move the price']],
    'Tiers by institution size exist; no enrollment bands and no figure per band.'],
  ['Domain modules', 'An annual fee per module by band, population or scope.', 'building',
    [['app/src/site/more.tsx', '“A module that is off is not billed”'], ['docs/ENTITLEMENT-RESOLUTION.md', 'the order: kill switch → tenant plan → module → usage allowance']],
    'Modules are build-time flags with charters; no per-module price, and no tenant can buy one.'],
  ['Implementation', 'One-time fixed scope plus change-order rules.', 'tested',
    [['app/src/lib/governance/deal-desk.ts', 'implementation fee floor $10k, waived only as capped pilot credit'], ['app/src/lib/governance/deal-desk.test.ts', 'held']], 'A floor, not a scope or a rate card.'],
  ['Premium support', 'An annual percentage or a tiered fixed fee.', 'not-started',
    [['docs/trust/SLA.md', 'a pilot SLA once it can be offered']], 'No support tiers priced; no premium tier can be staffed (SUP-002).'],
  ['AI usage', 'An included allowance plus transparent overage, or a customer-selected model account.', 'tested',
    [['app/src/lib/governance/deal-desk.ts', 'a deal without an AI overage policy is refused'], ['app/src/lib/governance/deal-desk.test.ts', 'held'], ['app/src/lib/allowance.ts', 'DEFAULT_MONTHLY_CALLS = 60 per student, metered'], ['supabase/migrations/20260924163000_intelligence_provider_runtime.sql', 'reserve_ai_budget']],
    'Allowance and cap exist; no overage price and no customer-managed model account.'],
  ['Storage and large files', 'An included allowance plus overage or an archival tier.', 'not-started',
    [['RETENTION.md', 'what is kept and for how long']], 'No storage allowance anywhere.'],
  ['Payments', 'Pass-through processor fee plus a transparent platform fee, for approved transactions only.', 'held',
    [['docs/DECISION-LOG.md', 'D-009: billing stays out of the app']], 'Out by decision.'],
  ['Custom work', 'Time-and-materials or a fixed SOW.', 'tested',
    [['app/src/lib/governance/deal-desk.ts', 'custom work needs the product approver and a scorecard'], ['app/src/lib/governance/deal-desk.test.ts', 'held']], 'An approval rule; no rate.'],
]);

export interface Module extends Item {
  buyer: string;
  metric: string;
  included: string;
  guardrail: string;
}

type ModuleRow = [item: string, buyer: string, metric: string, included: string, guardrail: string, standing: Standing, evidence: [string, string][], gap: string];

const MODULE_ROWS: readonly ModuleRow[] = [
  ['Semester Foundation', 'Institution, department, program', 'Enrollment band, covered cohort or campus scope', 'Identity and context, Today, planning, actions and calendar, source/scope/status, account and data controls, search, notifications', 'Required for institutional modules',
    'tested', [['app/src/lib/nav.ts', 'the five destinations: home, calendar, study, support, me'], ['app/src/lib/fivedestinations.test.ts', 'held'], ['app/src/lib/source.ts', 'the five source labels the database enforces'], ['app/src/lib/mecontrols.test.ts', 'account and data controls']],
    'Built as the product; not sold as an entitlement.'],
  ['Academic Navigation', 'Student success, advising, transfer', 'Covered students or program scope', 'Plan, advisor agenda, verified service routing, transition workflows', 'Never represents official audit or registration by default',
    'tested', [['app/src/lib/degree.test.ts', 'student-entered requirements; nothing official'], ['app/src/lib/advisor-meeting.test.ts', 'the agenda carries only what the student ticked'], ['app/src/lib/help-routes.test.ts', 'routes sent only on confirm'], ['docs/TRANSFER-TRANSITION-HUB.md', 'eight workflows: two building, six tested']],
    'No module boundary; these are student features on every account.'],
  ['Learning & LMS', 'Academic affairs, online learning', 'Active course enrollments or institution band', 'Course workspace, content, work completion, Study Studio, course AI policy', 'Separate high-stakes assessment scope if needed',
    'tested', [['app/src/lib/coursestudio.test.ts', 'Course Studio'], ['app/src/lib/studystudio.test.ts', 'Study Studio'], ['docs/decisions/D-1067.md', 'native LMS and gradebook replacement approved']],
    'Course rules, guidance and study packs are tested; full modules, files, graded submissions and accessibility UAT remain incomplete.'],
  ['Assessment & Gradebook', 'Academic affairs', 'Active course enrollments or high-stakes scope', 'QTI, rubrics, delivery, feedback, grade ledger', 'Sell only with mature support, audit and accessibility controls',
    'tested', [['app/src/lib/gradebook/gradebook.test.ts', 'weighted schemes and append-only grade versions'], ['app/src/lib/gradebook/passback.test.ts', 'authorized passback'], ['supabase/gradebook.check.sql', 'course scope, moderation, release and registrar export']],
    'The native gradebook exists; rubric authoring, batch and anonymous grading, high-stakes assessment delivery and institutional cutover evidence remain incomplete.'],
  ['Student Life & Community', 'Student affairs', 'Institution band or active community users', 'Clubs, events, mentorship, community and service discovery, moderation controls', 'Safety and moderation scope must match the staffing model',
    'tested', [['docs/COMMUNITIES-REGISTER.md', 'the four blueprints held to the tree'], ['app/src/lib/communitiesregister.test.ts', 'held'], ['app/src/lib/moderation.test.ts', 'moderation']],
    'No staffing model exists to match; the register says which pieces are missing.'],
  ['Student Support Navigator', 'Student success, basic-needs and transfer offices', 'Institution band or service-network scope', 'Resource directory, handoffs, source freshness, referral controls', 'Sensitive intake requires a restricted workflow and an explicit owner',
    'tested', [['app/src/lib/help-routes.test.ts', 'the support directory routes only on confirm'], ['docs/BASIC-NEEDS-NAVIGATOR.md', 'seventeen categories, ten route somewhere'], ['app/src/lib/basicneeds.test.ts', 'held']],
    'No case-manager role and no restricted intake workflow (MODULE-PRIVACY-MODEL).'],
  ['Career & Pathways', 'Career services, experiential learning', 'Covered students or active career users', 'Opportunities, portfolio, skills evidence, alumni and employer workflows', 'No sale of student data or hidden employer targeting',
    'tested', [['app/src/lib/career-evidence.test.ts', 'portfolio items only from what the student confirmed'], ['app/src/lib/skills-graph.test.ts', 'skills evidence'], ['app/src/lib/gtm/sponsor.test.ts', 'no student-level data to sponsors']],
    'No employer workflow exists.'],
  ['AI Control Center', 'CIO, provost, teaching and learning', 'Institution band plus AI use tier', 'Policy, provider controls, approved sources, evaluation, governance', 'Include an allowance, cap or customer-managed model account',
    'tested', [['app/src/lib/aiflags.test.ts', 'AI flags'], ['app/src/lib/aikillswitch.test.ts', 'kill.ai_generation read by everything that generates'], ['app/src/lib/governance/ai-lifecycle.ts', 'the lifecycle gates'], ['docs/operating-model/AI-ASSURANCE.md', 'the RMF matrix and the 800-1 checklist']],
    'Controls are data and flags; no institution-facing control screen, and no AI use tier is priced.'],
  ['Institutional Control Plane', 'CIO, IT, security', 'Institution band', 'Audit and evidence, integration health, retention and consent, admin controls', 'Include core security, privacy and accessibility controls',
    'building', [['app/src/lib/control-plane.ts', 'the control plane'], ['app/src/lib/control-plane.test.ts', 'held'], ['ops/operations-console/README.md', 'the console’s controls as data before the console']],
    'No operations console screen (SEMESTER-OPERATING-SYSTEM.md: missing).'],
  ['Interoperability Pack', 'CIO, IT', 'Per integration family or enterprise tier', 'SSO, SCIM, LTI, OneRoster, APIs, webhooks, data map, sync health', 'Custom integrations require a separate SOW',
    'tested', [['supabase/identity-provisioning.check.sql', 'SSO and SCIM provisioning'], ['app/src/lib/lti.test.ts', 'LTI 1.3'], ['docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md', 'reconciliation']],
    'No live exchange with any institution’s IdP or LMS; no per-family price.'],
  ['Payments / Transactions', 'Campus operations', 'Transaction fee plus operating scope', 'Approved payments, ticketing, dues, receipts and reconciliation', 'Later-stage; processor compliance and policy required',
    'held', [['docs/DECISION-LOG.md', 'D-009: billing stays out']], 'Out by decision.'],
  ['Premium Support / Success', 'Institution', 'Fixed annual tier or a percentage of the subscription', 'Named CSM, priority support, office hours, health review, training', 'Do not promise 24/7 unless staffed and contracted',
    'designed', [['docs/market-readiness/SUPPORT_PLAYBOOK.md', 'T1–T3'], ['docs/PILOT-TO-ANNUAL-CONVERSION.md', 'the quarterly business review']],
    'One person; no tier can be staffed (SUP-002, SUP-003).'],
];

export const MODULES: readonly Module[] = MODULE_ROWS.map(([item, buyer, metric, included, guardrail, standing, evidence, gap], i) => ({
  id: `LK-MOD-${String(i + 1).padStart(2, '0')}`,
  item, asks: included, buyer, metric, included, guardrail, standing,
  evidence: evidence.map(([path, shows]) => ({ path, shows })),
  gap,
}));

/** The kit's starting bands — hypotheses, never published prices — beside what the tree holds. */
export const BANDS: readonly { scope: string; software: string; implementation: string; motion: string; tree: string }[] = [
  { scope: 'Individual student', software: 'Free tier; $8–25/month paid', implementation: 'None', motion: 'Product-led adoption', tree: 'plans.ts: Free; Plus $7.99/mo or $59/yr; Pro $14.99/mo or $99/yr — planned, not on sale (D-009).' },
  { scope: 'Department or program pilot', software: '$10,000–30,000', implementation: '$5,000–20,000', motion: 'Paid pilot, defined cohort', tree: 'DEAL_POLICY: minimum pilot ACV $15,000 and department $25,000, proposed; implementation floor $10,000.' },
  { scope: 'Small institutional deployment', software: '$30,000–90,000', implementation: '$15,000–75,000', motion: 'Foundation plus one or two modules', tree: 'DEAL_POLICY: campus minimum $75,000, proposed.' },
  { scope: 'Mid-market institution', software: '$90,000–250,000', implementation: '$50,000–200,000', motion: 'Multiple modules, SSO, integration, enablement', tree: 'No band.' },
  { scope: 'Large or enterprise university', software: '$250,000–750,000+', implementation: '$150,000–500,000+', motion: 'Multi-year platform agreement, governance, premium support', tree: 'DEAL_POLICY: system minimum $200,000, proposed; multi-year discount 3%/year capped at 9%.' },
];

/** What a price calculator would take. None exists; each input names the register that could feed it. */
export const CALCULATOR_INPUTS: readonly { input: string; source: string }[] = [
  { input: 'Institution enrollment band', source: 'Not modelled; `tenant_plan` carries a tier name, not a band.' },
  { input: 'Covered population or active course enrollments', source: '`PilotPlan.cohort`, free text.' },
  { input: 'Campuses or entities', source: 'ADR 0005: multi-campus scoping.' },
  { input: 'Enabled module set', source: 'Tenant flags (docs/FEATURE-FLAG-REGISTRY.md).' },
  { input: 'SSO, SCIM, LTI, OneRoster and API families', source: 'docs/INTEGRATION-PERMISSION-MATRIX.md.' },
  { input: 'Data migration volume and complexity', source: 'docs/DATA-MIGRATION-PLAN.md.' },
  { input: 'Content and source-directory readiness', source: 'docs/launch/CONTENT-READINESS-REGISTER.md.' },
  { input: 'AI model, allowance and expected AI volume', source: '`allowance.ts` and `reserve_ai_budget`.' },
  { input: 'Storage and file-processing requirements', source: 'Not modelled.' },
  { input: 'Support tier and named-service requirements', source: 'docs/market-readiness/SUPPORT_PLAYBOOK.md tiers; none priced.' },
  { input: 'Implementation timeline and staffing', source: 'docs/operating-model/PILOT-TO-PRODUCTION.md phases.' },
  { input: 'Security, privacy, accessibility and compliance requirements', source: 'docs/market-readiness/PROCUREMENT_CHECKLIST.md.' },
  { input: 'Custom development scope', source: '`deal-desk.ts` customWork, an approval only.' },
  { input: 'Contract length and payment terms', source: '`deal-desk.ts` years; no payment terms.' },
];

/** The pricing guardrails, each held to where the tree already refuses the thing. */
export const GUARDRAILS: readonly Item[] = rows('LK-GUARD', [
  ['Foundation is not optional', 'Foundation is required for any institutional use.', 'building', [['supabase/migrations/20260928004730_tenant_plan.sql', 'one current plan per school']], 'No Foundation entitlement distinct from the plan.'],
  ['Core controls are not premium', 'Never price privacy, accessibility, export or security controls as add-ons.', 'tested', [['app/src/lib/plans.test.ts', 'ALWAYS_INCLUDED: export, delete, saved plans on every plan']], 'Held for student plans only.'],
  ['No implementation discount without scope cut', 'Do not discount implementation unless scope is proportionally reduced.', 'tested', [['app/src/lib/governance/deal-desk.ts', 'the fee floor is waived only as capped pilot credit'], ['app/src/lib/governance/deal-desk.test.ts', 'held']], 'Held by the deal desk.'],
  ['No unlimited AI at a fixed price', 'Never include unlimited AI usage without a cost cap.', 'tested', [['app/src/lib/governance/deal-desk.ts', 'aiOverageDefined required'], ['app/src/lib/governance/deal-desk.test.ts', 'held'], ['supabase/migrations/20260924163000_intelligence_provider_runtime.sql', 'the tenant budget']], 'Held by the deal desk and the tenant budget.'],
  ['No student data, audiences or targeting for sale', 'Never sell student data, advertising audiences or employer targeting.', 'tested', [['app/src/lib/gtm/sponsor.test.ts', 'held'], ['supabase/gtm.check.sql', 'held in SQL']], 'Held in code and in SQL.'],
  ['No module in contract language before it is owned', 'Do not promise a module until it has an owner, support model, tested controls and documented scope.', 'tested', [['app/src/lib/ops/claims.ts', 'every public claim carries a register word and is refused above its floor'], ['app/src/lib/ops/claims.test.ts', 'held'], ['app/src/lib/gtm/rfp.test.ts', 'an available claim without evidence is refused']], 'Held for public claims and RFP answers; no contract template exists to hold.'],
  ['Pilots priced to cover real work', 'Price pilots to cover onboarding, support and learning, not merely hosting.', 'tested', [['app/src/lib/governance/deal-desk.ts', 'minimum pilot ACV'], ['app/src/lib/governance/deal-desk.test.ts', 'held']], 'A proposed floor; no cost model behind it (maturity FO-09).'],
  ['No “free forever”', 'Refuse free-forever enterprise commitments.', 'tested', [['app/src/lib/governance/deal-desk.ts', 'freeForever → refused'], ['app/src/lib/governance/deal-desk.test.ts', 'held']], 'Held by the deal desk.'],
]);

// ── 6. The higher-education go-to-market plan ───────────────────────────────

export const MARKET_POSITION = {
  statement: 'Semester is the unified, source-aware, accessible, governed operating system for the full university journey.',
  students: 'Know what matters, what is official, what to do next, and who can help.',
  institutions: 'Connect existing systems and services into a secure, interoperable, measurable and student-centered experience without sacrificing institutional authority.',
  tree: 'No category statement exists on main. The nearest is rfp.ts ES-1 — “a planning and experience layer over university life, not a system of record” — and the operating-system register lists Company strategy as missing.',
};

/** The kit's ideal early customers, beside the GTM playbook's own list. */
export const IDEAL_CUSTOMERS: readonly { profile: string; inPlaybook: boolean; note: string }[] = [
  { profile: 'Transfer-intensive institutions and transfer centers', inPlaybook: true, note: 'The playbook’s first profile.' },
  { profile: 'Community colleges and regional public universities', inPlaybook: true, note: 'The playbook’s first profile.' },
  { profile: 'Student-success and advising organizations', inPlaybook: true, note: 'The playbook’s third: a private college with a student-success champion.' },
  { profile: 'Accessibility-forward institutions', inPlaybook: false, note: 'Absent from the playbook.' },
  { profile: 'Institutions with fragmented service and resource landscapes', inPlaybook: false, note: 'Absent as a profile; the pain is the product’s premise.' },
  { profile: 'Large gateway-course or academic-support programs', inPlaybook: false, note: 'Absent.' },
  { profile: 'Career and experiential-learning teams', inPlaybook: true, note: 'The playbook’s second: a career center, library or research office.' },
  { profile: 'Institutions formalizing campus AI governance', inPlaybook: false, note: 'Absent.' },
];

/** The buyer map, each offer read against the claims register's word for it. */
export const BUYERS: readonly { buyer: string; pain: string; message: string; offer: string; committeeRole: string | null; offerStanding: string }[] = [
  { buyer: 'VP / AVP Student Success', pain: 'Students cannot find correct next actions or support', message: 'One source-aware student action layer', offer: 'Academic Navigation / No Wrong Door pilot', committeeRole: 'executive_sponsor', offerStanding: 'The support directory and help routes are tested; “No Wrong Door” is not a named offer.' },
  { buyer: 'Transfer Center director', pain: 'Transfer students lose time, context and confidence across systems', message: 'A transfer transition operating system with official-source routing', offer: 'Transfer Hub pilot', committeeRole: null, offerStanding: 'Two of eight hub workflows are building; no hub screen exists (TRANSFER-TRANSITION-HUB.md).' },
  { buyer: 'CIO / CISO', pain: 'Fragmented tools, shadow AI, integration and audit burden', message: 'A governed, standards-first, observable platform', offer: 'Control-plane / AI governance discovery workshop', committeeRole: 'cio', offerStanding: 'Controls are data; no console screen.' },
  { buyer: 'Provost / Academic Affairs', pain: 'Inconsistent learning support and course AI practice', message: 'Course-aware Study Studio, work completion, accessibility and policy', offer: 'Learning / AI pilot', committeeRole: null, offerStanding: 'Study Studio and Course Studio are tested; course AI policy is a flag.' },
  { buyer: 'Student Affairs leader', pain: 'Community, clubs, events and services are disconnected', message: 'A governed belonging and service-discovery layer', offer: 'Student Life pilot', committeeRole: null, offerStanding: 'The communities register says which of the four blueprints is missing.' },
  { buyer: 'Career Services leader', pain: 'Academic work is disconnected from workforce evidence', message: 'Skills evidence, portfolio, opportunities and student-controlled sharing', offer: 'Career Pathways pilot', committeeRole: null, offerStanding: 'Career evidence and the skills graph are tested; no employer workflow.' },
];

export interface Phase {
  phase: string;
  window: string;
  items: readonly Item[];
}

/** The 180-day sequence. The tree's plan is ninety days; the third phase has nothing to stand on. */
export const SEQUENCE: readonly Phase[] = [
  {
    phase: 'Market and sales readiness', window: 'Days 1–30',
    items: rows('LK-P1', [
      ['Category narrative and messaging', 'Finalize the category, the ideal-customer profile and buyer-specific messaging.', 'designed', [['docs/INSTITUTIONAL-GTM-PLAYBOOK.md', 'ideal customer profile in order of fit; the buying committee'], ['app/src/lib/launch/ninety-day.ts', 'icp-cohort']], 'No category statement; four of the kit’s eight profiles are absent.'],
      ['Public trust surfaces', 'Website, Trust Center, accessibility, AI transparency, system boundaries and a pilot landing page.', 'building', [['app/src/site/platform.ts', 'BOUNDARIES at /platform/system-boundaries/'], ['app/src/site/site.test.tsx', 'the public pages render'], ['app/src/lib/ops/claims.ts', 'POLICIES: accessibility statement and AI-use policy not started']], 'System boundaries, security, privacy, proof and launch-readiness pages exist; no public Trust Center, accessibility statement or AI transparency page.'],
      ['Synthetic demo tenant', 'A synthetic demonstration tenant and a guided demo script.', 'tested', [['app/src/data/institutional-preview.ts', 'fictional tenants, every record synthetic'], ['app/src/lib/institutional-preview.test.ts', 'held'], ['app/src/lib/pagesdemo.test.ts', 'the /demo/ route']], 'No guided script.'],
      ['Procurement room baseline', 'Security overview, DPA, privacy policy, subprocessor list, accessibility statement, AI policy, implementation outline.', 'tested', [['supabase/trust-room.check.sql', 'NDA-first, commit-pinned, expiring grants: 51 checks'], ['docs/market-readiness/PROCUREMENT_CHECKLIST.md', 'what is in the packet and what is not']], 'The room is built; the packet lacks a signed DPA, an ACR, insurance, HECVAT and SOC 2 (COM-003).'],
      ['Contract and proposal templates', 'Pilot agreement, order form, SOW, pricing calculator and proposal template.', 'designed', [['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'the outline'], ['app/src/lib/launch/ninety-day.ts', 'charter-drafts']], 'Outlines only; no calculator, no proposal template.'],
      ['Target account list', 'Fifty to a hundred institutions or programs.', 'not-started', [['docs/INSTITUTIONAL-GTM-PLAYBOOK.md', 'the profiles to target']], 'No list; the `gtm_accounts` table is empty.'],
      ['Discovery interviews', 'Fifteen to twenty-five structured buyer-discovery interviews.', 'not-started', [['PILOT.md', 'twenty to thirty student willingness-to-pay interviews, planned']], 'No buyer interview script or record; the student interviews are a different question.'],
      ['Design partners', 'Recruit three to five.', 'building', [['app/src/lib/launch/ninety-day.ts', 'recruit-beta: institutional design partners'], ['app/src/lib/governance/release-readiness.ts', 'the design_partner stage']], 'No partner; no count.'],
    ]),
  },
  {
    phase: 'Sell and launch pilots', window: 'Days 31–90',
    items: rows('LK-P2', [
      ['One to three paid pilots', 'Convert qualified discovery into paid, bounded pilots.', 'tested', [['app/src/lib/gtm/pilot.ts', 'pilotReadiness'], ['app/src/lib/gtm/stages.ts', 'sixteen sales stages with exit criteria'], ['app/src/lib/gtm/stages.test.ts', 'held']], 'No pilot has been sold.'],
      ['Readiness workshops', 'Implementation and readiness workshops with each pilot.', 'designed', [['docs/operating-model/PILOT-TO-PRODUCTION.md', 'phase 0–1'], ['docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md', 'the playbook']], 'Process on a page.'],
      ['Configure', 'Source content, roles, accessibility, AI policy and integrations.', 'tested', [['app/src/lib/launch/ninety-day.ts', 'tenant-flags, identity, content-loaded'], ['supabase/tenant-rollout.check.sql', 'the lifecycle gates']], 'Never run for a real tenant.'],
      ['Train', 'Staff, faculty and advisors, student champions, support contacts.', 'building', [['app/src/lib/launch/checklists.ts', 'first-day checklists per role'], ['docs/LAUNCH-CONTENT-AND-TRAINING.md', 'training content'], ['docs/FACULTY-ENABLEMENT.md', 'faculty enablement']], 'No session has been given.'],
      ['Launch with hypercare', 'Communications, onboarding, office hours and hypercare.', 'building', [['app/src/lib/launch/ninety-day.ts', 'launch-cohort, hypercare: a daily issue log for two weeks'], ['docs/launch/ANNOUNCEMENT-TEMPLATES.md', 'the announcements']], 'No cohort has launched.'],
      ['Measure from day one', 'Activation, clarity, verified-resource discovery, support handoff, accessibility success, implementation effort, stakeholder value.', 'building', [['ANALYTICS.md', 'the three figures, no cell under ten'], ['app/src/lib/ops/firstyear.ts', 'first-year measures'], ['app/src/lib/gtm/kpi.ts', 'KPI formulas with no rate for an empty cohort']], 'No verified-resource-discovery or accessibility-success measure.'],
      ['Weekly reviews and a 30-day evidence report', 'Weekly pilot reviews; a 30-day evidence report to each customer.', 'designed', [['docs/90-DAY-LAUNCH-PROGRAM.md', 'reviews and escalation'], ['docs/PROOF-CALENDAR.md', 'month by month, 0 of 19 artifacts filed']], 'No report template.'],
    ]),
  },
  {
    phase: 'Turn pilots into repeatability', window: 'Days 91–180',
    items: rows('LK-P3', [
      ['Midpoint and final value reviews', 'Conduct them, and decide.', 'tested', [['app/src/lib/gtm/pilot.ts', 'midpointReviewDate; pilotVerdict'], ['app/src/lib/gtm/pilot.test.ts', 'held'], ['app/src/lib/launch/ninety-day.ts', 'midpoint-report']], 'Nothing to review yet.'],
      ['Convert to annual contracts', 'With a modular expansion plan.', 'tested', [['app/src/lib/gtm/pilot.ts', 'convert or expand only signed and with no open high-severity issue'], ['app/src/lib/gtm/pilot.test.ts', 'held'], ['docs/PILOT-TO-ANNUAL-CONVERSION.md', 'the decision meeting and the annual proposal']], 'No contract to convert to.'],
      ['Standardize implementation', 'Templates, integration patterns, defaults, training, runbooks, evidence reports.', 'designed', [['docs/operating-model/PILOT-TO-PRODUCTION.md', 'the method'], ['docs/RUNBOOKS.md', 'the runbook index']], 'Nothing has been run once, so nothing is standardized from experience.'],
      ['References only when verified', 'Case-study approval only with verified results.', 'tested', [['app/src/lib/ops/claims.ts', 'PROOF_RULES'], ['app/src/lib/ops/claims.test.ts', 'held']], 'Held in code.'],
      ['Practitioner resources', 'Academic Friction diagnostic, Transfer Navigation Playbook, Accessible Learning Toolkit, Campus AI Governance Canvas.', 'not-started', [['docs/SERVICE-EXPANSION-REGISTER.md', 'S26: the Academic Friction Index and the interoperability model, unchecked']], 'None exists.'],
      ['Partner relationships', 'Higher-ed consultants, accessibility specialists, integrators, standards communities.', 'not-started', [['docs/INSTITUTIONAL-GTM-PLAYBOOK.md', 'the playbook names no partner channel']], 'None exists.'],
    ]),
  },
];

/** The channel plan, and what the tree has for each. */
export const CHANNELS: readonly { channel: string; purpose: string; firstAction: string; tree: string }[] = [
  { channel: 'Founder-led outbound', purpose: 'Find and learn from high-fit buyers', firstAction: 'A personalized message about transfer, navigation, governed AI or accessibility friction', tree: 'Nothing; the `target_account` stage exists and no account is in it.' },
  { channel: 'LinkedIn', purpose: 'Executive credibility and distribution', firstAction: 'Weekly evidence-led posts, short workflow videos, research findings', tree: 'Nothing.' },
  { channel: 'Website and SEO', purpose: 'Convert intent and build trust', firstAction: 'Audience pages, Trust Center, pilot call to action, synthetic demo, procurement library', tree: 'Audience pages, /demo/, /proof/ and the trust room exist (docs/PUBLIC-SITE.md); no public Trust Center.' },
  { channel: 'Webinars and clinics', purpose: 'Demonstrate expertise before the sale', firstAction: 'Transfer navigation, accessible assessment, campus AI governance, service-content operations', tree: 'Nothing. `gtm/manager.ts` CHANNELS are a school’s enrollment channels, not Semester’s.' },
  { channel: 'Conferences and associations', purpose: 'Reach qualified networks', firstAction: 'EDUCAUSE, 1EdTech, NACADA, NASPA, transfer, community-college, accessibility and career communities', tree: 'Nothing; 1EdTech appears only as a standards reference.' },
  { channel: 'Student product-led growth', purpose: 'Create real end-user demand', firstAction: 'Free personal planning and study value, clearly non-official, with a privacy boundary', tree: '/signup/ starts free with no card; four free public tools at /tools/; the ambassador programme is still to build (EXECUTION-PLAN #8).' },
  { channel: 'Partnerships', purpose: 'Extend reach and implementation capacity', firstAction: 'Consultants, accessibility partners, integrators, associations', tree: 'Nothing.' },
];

/** The thirteen-step sales process beside the sixteen sales stages in `gtm/stages.ts`. */
export const SALES_PROCESS: readonly { step: string; stage: string | null }[] = [
  { step: 'Target account', stage: 'target_account' },
  { step: 'Personalized problem hypothesis', stage: null },
  { step: 'Discovery meeting', stage: 'discovery' },
  { step: 'Workflow, stakeholder and current-stack map', stage: 'qualified' },
  { step: 'Tailored synthetic demo', stage: 'multi_stakeholder_demo' },
  { step: 'Security, accessibility, AI and integration qualification', stage: 'technical_review' },
  { step: 'Paid-pilot design workshop', stage: 'outcome_workshop' },
  { step: 'Proposal and procurement room', stage: 'procurement_legal' },
  { step: 'Contract', stage: 'contracted' },
  { step: 'Implementation readiness', stage: 'implementation' },
  { step: 'Pilot launch', stage: 'live' },
  { step: 'Midpoint value review', stage: null },
  { step: 'Annual conversion and module expansion', stage: 'expansion' },
];

/** The seventeen pipeline metrics, each with where a figure would come from, or nowhere. */
export const PIPELINE_METRICS: readonly { metric: string; source: string | null }[] = [
  { metric: 'Target accounts contacted', source: null },
  { metric: 'Positive-response rate', source: null },
  { metric: 'Discovery meetings', source: null },
  { metric: 'Qualified opportunities', source: 'gtm_accounts rows past `qualified`' },
  { metric: 'Pilot-design workshops', source: null },
  { metric: 'Pilot proposals', source: 'gtm_accounts rows at `proposal`' },
  { metric: 'Pilot win rate', source: null },
  { metric: 'Sales cycle length', source: null },
  { metric: 'Pilot implementation duration', source: 'gtm_pilots start and end' },
  { metric: 'Pilot activation rate', source: 'ANALYTICS.md activation, aggregate only' },
  { metric: 'Pilot-to-annual conversion', source: 'gtm_pilot_outcomes decisions' },
  { metric: 'Annual contract value', source: 'ops/firstyear.ts ARR' },
  { metric: 'Implementation margin', source: null },
  { metric: 'Gross margin by tenant and module', source: 'ops/firstyear.ts gross margin; maturity FO-01 allocation owed' },
  { metric: 'Expansion pipeline', source: null },
  { metric: 'Renewal rate', source: 'gtm/kpi.ts netRevenueRetention' },
  { metric: 'Reference and case-study permission rate', source: null },
];

// ── 7. The Product Governance Council charter ───────────────────────────────

export const COUNCIL_PURPOSE =
  'The Semester Product Governance Council ensures that every enabled platform capability advances Semester’s mission — a unified, accessible, source-aware, privacy-respecting, interoperable university operating system — while balancing student value, institutional authority, security, privacy, accessibility, AI safety, operational reliability, commercial viability and evidence-based claims.';

export const COUNCIL_SCOPE: readonly string[] = [
  'New platform modules and material features',
  'High-risk data uses and integrations',
  'AI models, providers, policies, evaluations and tool actions',
  'Assessment, grading, integrity and student-record workflows',
  'Accessibility requirements, known limitations and remediation priorities',
  'Community, mentoring, moderation, safety and sensitive-support workflows',
  'Identity, permissions, sharing, retention, deletion and export behaviour',
  'Institutional configuration and multi-tenant product behaviour',
  'Major release approval and customer-impacting change',
  'External product claims, certifications, plan commitments and launch materials',
];

export const COUNCIL_PRINCIPLES: readonly string[] = [
  'Student agency and dignity',
  'Institutional authority for official decisions',
  'Accessibility as core quality',
  'Source, Scope and Status for material information and recommendations',
  'Minimum necessary data and privacy by design',
  'Security and resilience by design',
  'Human accountability for high-impact outcomes',
  'Standards-first interoperability and portability',
  'Evidence before public claim',
  'One coherent platform, not disconnected tools',
  'Modular activation with shared foundations',
  'No dark patterns, hidden surveillance or sale of student data',
];

/** The twelve council roles, each mapped to the launch-readiness seat that already carries the accountability, or none. */
export const COUNCIL_ROLES: readonly { role: string; decides: string; seat: Seat | null; note: string }[] = [
  { role: 'Council chair / product executive', decides: 'Agenda, prioritization, product strategy, the decision record', seat: 'founder', note: 'The founder seat decides risk acceptance and holds the decision log.' },
  { role: 'Engineering leader', decides: 'Architecture, delivery feasibility, resilience, technical debt', seat: 'engineering', note: '' },
  { role: 'Security lead', decides: 'Security risk, access, incidents, supplier requirements', seat: 'security', note: '' },
  { role: 'Privacy / legal lead', decides: 'Data use, contracts, FERPA, retention, legal holds', seat: 'privacy', note: '' },
  { role: 'Accessibility lead', decides: 'WCAG, ACR/VPAT, disabled-user impact, remediation gates', seat: 'accessibility', note: '' },
  { role: 'AI governance lead', decides: 'Models and providers, evaluations, policy, high-risk uses, misuse controls', seat: 'trust', note: 'The trust seat chairs the AI governance board.' },
  { role: 'Customer success / implementation lead', decides: 'Deployability, training, support, customer outcome and change impact', seat: 'success', note: '' },
  { role: 'Design / research lead', decides: 'User experience, usability, student, faculty and staff evidence', seat: 'product', note: 'Folded into the product seat.' },
  { role: 'Institutional advisory representative', decides: 'Higher-ed workflow and authority perspective', seat: 'champion', note: 'The champion seat must be held at the institution, not at Semester.' },
  { role: 'Student advisory representative', decides: 'Student clarity, agency, accessibility and lived experience', seat: null, note: 'No seat. The nearest is the customer advisory board in RISK-GOVERNANCE.md, with no members.' },
  { role: 'Finance / commercial representative', decides: 'Pricing, entitlement, margin, contract impact', seat: 'finance', note: 'The eleventh seat, added on 29 September (D-118); vacant. The deal desk’s finance approver is this seat.' },
  { role: 'Operations / SRE representative', decides: 'Monitoring, supportability, incident readiness, release readiness', seat: 'operations', note: 'The twelfth seat, added on 29 September (D-120); vacant. The master register’s SRE and Support sign-offs are this seat’s.' },
];

/** What must come to the council before release, each held to the gate that already asks. */
export const DECISION_RIGHTS: readonly Item[] = rows('LK-RIGHT', [
  ['New education-record processing', 'Any feature processing education-record PII or sensitive data in a new way.', 'tested', [['app/src/lib/governance/config-tiers.ts', 'TIER_REVIEWERS: privacy and security review the higher tiers'], ['app/src/lib/governance/config-tiers.test.ts', 'held'], ['app/src/lib/governance/module-privacy.ts', 'the launch gates']], 'A reviewer role, not a sitting council.'],
  ['New AI provider, model, tool action or training change', 'Approval before any of them.', 'tested', [['app/src/lib/governance/ai-lifecycle.ts', 'the lifecycle gates and their evidence'], ['app/src/lib/governance/ai-lifecycle.test.ts', 'held'], ['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'responsibilities']], 'The board has a charter and no members.'],
  ['Grading, integrity, discipline, accommodation, basic-needs, payment, minors, moderation', 'Any feature touching these.', 'tested', [['app/src/lib/governance/risk.ts', 'DECISION_QUESTIONS and DECISION_RULE: not clearly yes is not launch-ready'], ['app/src/lib/governance/risk.test.ts', 'held'], ['app/src/lib/launchreadiness.ts', 'the seats and what each decides']], 'Held as questions; no body sits.'],
  ['New external integration or scope change', 'Approval before it.', 'tested', [['app/src/lib/governance/data-contracts.ts', 'a connector is chartered by its data contract'], ['app/src/lib/governance/data-contracts.test.ts', 'held']], 'Held in code.'],
  ['Retention, sharing, access, export or deletion change', 'Approval before a material change.', 'tested', [['app/src/lib/retention.test.ts', 'RETENTION.md is held to the tables'], ['app/src/lib/governance/config-tiers.ts', 'NEVER: settings no tenant may change']], 'Held by tests, not by a meeting.'],
  ['Critical accessibility, privacy, security or reliability impact', 'Any release with one.', 'tested', [['app/src/lib/governance/release-readiness.ts', 'promote(): a floor of 60 on every dimension, then the stage threshold'], ['app/src/lib/governance/release-readiness.test.ts', 'held'], ['app/src/lib/launchreadiness.ts', 'an open P0/P1 is NO-GO']], 'Held in code.'],
  ['Public claims', 'Any claim about certification, compliance, security, accessibility, AI safety, outcomes or interoperability.', 'tested', [['app/src/lib/ops/claims.ts', 'a claim above its register floor fails the build'], ['app/src/lib/ops/claims.test.ts', 'held']], 'Held in code.'],
  ['Exceptions to gates or thresholds', 'Any exception.', 'tested', [['app/src/lib/governance/risk.ts', 'reviewException: at most 90 days; no P0 exception without executive, security and legal'], ['app/src/lib/governance/risk.test.ts', 'held']], 'Held; zero exceptions open.'],
]);

/** The decision packet, each line beside the question or field the tree already asks. */
export const DECISION_PACKET: readonly { line: string; askedBy: string | null }[] = [
  { line: 'Problem and target outcome', askedBy: '`charters.ts` problem, jobToBeDone; SCOPE_QUESTIONS “What student decision does it clarify?”' },
  { line: 'Users and affected stakeholders', askedBy: '`charters.ts` primaryUser' },
  { line: 'Customer or institutional owner', askedBy: 'SCOPE_QUESTIONS “Who owns it?”' },
  { line: 'Scope and non-goals', askedBy: '`charters.ts` nonGoals; SCOPE_QUESTIONS “What does this replace?”' },
  { line: 'Workflow and user journey', askedBy: null },
  { line: 'Data inventory, classification, source, retention, sharing', askedBy: '`charters.ts` classification, sourceDependency; SCOPE_QUESTIONS “What data does it require?”' },
  { line: 'Permission and tenant-isolation model', askedBy: 'ADR 0002: RLS is the authorization boundary' },
  { line: 'Source, Scope and Status behaviour', askedBy: '`source.ts` labels; `ops/claims.ts` register words' },
  { line: 'Accessibility requirements and test plan', askedBy: '`charters.ts` accessibilityAcceptance' },
  { line: 'Security threat model and control plan', askedBy: null },
  { line: 'AI model, provider, policy and evaluation plan', askedBy: '`ai-lifecycle.ts` gate evidence' },
  { line: 'Integration and data-map impact', askedBy: '`data-contracts.ts`' },
  { line: 'Operational support, runbook and incident plan', askedBy: 'SCOPE_QUESTIONS “How is it supported?” “How does it fail?”; `charters.ts` owners.support, fallback' },
  { line: 'Commercial entitlement, pricing and implementation impact', askedBy: '`charters.ts` costModel; `deal-desk.ts` customWork' },
  { line: 'Success metrics, leading and lagging', askedBy: '`charters.ts` successMetrics' },
  { line: 'Known risks, residual risk, rollback and disable plan', askedBy: 'SCOPE_QUESTIONS “How is it removed if it does not work?”; `charters.ts` killSwitch' },
  { line: 'Required evidence, approvals and release gates', askedBy: '`release-readiness.ts`; `quality-gates.ts`' },
];

export const CADENCE: readonly { when: string; does: string; tree: string }[] = [
  { when: 'Weekly', does: 'Product and release readiness triage; risk review', tree: 'OPERATING-RHYTHM.md weekly; LAUNCH-READINESS-COUNCIL.md weekly during a pilot' },
  { when: 'Monthly', does: 'Plan, customer evidence, AI and vendor changes, accessibility backlog, privacy and security findings, operational metrics, commercial impact', tree: 'OPERATING-RHYTHM.md monthly' },
  { when: 'Quarterly', does: 'Risk appetite, policy review, incident learnings, audit evidence, standards progress, customer outcomes, strategy', tree: 'OPERATING-RHYTHM.md quarterly; AI-GOVERNANCE-BOARD.md quarterly; TRUST-BRAND-AND-LEGAL.md policy review' },
];

/** The six outcomes the kit asks for, beside the vocabularies the tree already uses. */
export const OUTCOMES: readonly { outcome: string; tree: string }[] = [
  { outcome: 'Approved', tree: '`governance_decisions.decision` build; `launchreadiness.decide()` GO; `gtm/pilot.ts` approved' },
  { outcome: 'Approved with required conditions', tree: '`launchreadiness.decide()` go-with-conditions: a founder-accepted P2/P3 with a reason, an expiry and a disclosure, listed on the verdict (D-117)' },
  { outcome: 'Pilot only', tree: '`governance_decisions.route` pilot; `release-readiness.ts` stage pilot' },
  { outcome: 'Deferred pending evidence', tree: '`governance_decisions.decision` defer' },
  { outcome: 'Rejected', tree: '`governance_decisions.decision` decline; `route` reject_or_redesign' },
  { outcome: 'Escalated for executive, legal or customer decision', tree: '`risk.ts` escalates(); `gtm/pilot.ts` blocked' },
];

/** The release blocks, each held to the gate that already refuses. */
export const RELEASE_BLOCKS: readonly Item[] = rows('LK-BLOCK', [
  ['Open P0/P1', 'No release with an open P0/P1 security, privacy, accessibility, grade-integrity or reliability finding.', 'tested', [['app/src/lib/launchreadiness.ts', 'no-blockers: an open P0 or P1 is NO-GO and no acceptance waives it'], ['app/src/lib/launchreadiness.test.ts', 'held']], 'Held in code.'],
  ['No owner or runbook', 'No release without named product, operational and support owners and a runbook.', 'tested', [['app/src/lib/governance/charters.ts', 'owners and fallback on every charter'], ['app/src/lib/governance/charters.test.ts', 'an empty field fails']], 'Owners are role labels; every seat is vacant, and the test cannot tell.'],
  ['Undocumented data flow, permissions or retention', 'No release without them documented.', 'tested', [['app/src/lib/retention.test.ts', 'every table in RETENTION.md'], ['app/src/lib/tablerls.test.ts', 'every table has RLS']], 'Held in code.'],
  ['Accessibility untested', 'No release without the required testing passed or an approved alternative.', 'building', [['docs/accessibility/AT-PASS-PROTOCOL.md', 'the assistive-technology pass'], ['app/src/lib/governance/release-readiness.ts', 'accessibility is a scored dimension with a floor']], 'No human AT pass has been run; the axe suite is automated only.'],
  ['AI evaluation or provider approval incomplete', 'No release of AI capability without them.', 'tested', [['app/src/lib/governance/ai-assurance.ts', 'RELEASE_GATE'], ['app/src/lib/governance/ai-assurance.test.ts', 'held']], 'Four gate lines are carried by nothing (AI-ASSURANCE.md).'],
  ['Integration untested in a sandbox', 'No integration release without sandbox validation.', 'building', [['docs/SYNC-SIMULATION-SANDBOX.md', 'the sandbox'], ['app/src/lib/governance/rollout.ts', 'the pilot-to-production tracker']], 'Designed; no sandbox run recorded.'],
  ['Communications, documentation, pricing or entitlement absent', 'No release without them.', 'tested', [['app/src/lib/launch/content.ts', 'content readiness per item'], ['app/src/lib/launch/content.test.ts', 'held']], 'Pricing and entitlement are not part of the content gate.'],
  ['Rollback untested for high-risk capability', 'No high-risk release without a tested disable.', 'tested', [['app/src/lib/aikillswitch.test.ts', 'the kill switch is read by everything that generates'], ['app/src/lib/rollback.test.ts', 'rollback'], ['ROLLBACK.md', 'the procedure']], 'The flags rollback has not been run against production (LAUNCH-DECISIONS item 10).'],
]);

/** The records the council keeps, and where each already lives. */
export const RECORDS: readonly { record: string; tree: string; standing: 'current' | 'partial' | 'missing' }[] = [
  { record: 'Decision records', tree: 'docs/DECISION-LOG.md (D-001 onward); `governance_decisions`, append-only', standing: 'current' },
  { record: 'Risk and exception register', tree: 'docs/operating-model/RISK-GOVERNANCE.md, rendered from `risk.ts`; exceptions: none open', standing: 'current' },
  { record: 'AI inventory and change log', tree: '`ai-training-policy.ts` PROVIDER_INVENTORY; no per-use-case inventory', standing: 'partial' },
  { record: 'Accessibility issue and remediation register', tree: 'docs/WCAG-UI-AUDIT-SCORECARD.md; no remediation register', standing: 'partial' },
  { record: 'Security and privacy evidence register', tree: 'docs/PROOF-CALENDAR.md: 0 of 19 artifacts filed; docs/evidence/ does not exist', standing: 'missing' },
  { record: 'Customer-impact release log', tree: 'CHANGELOG.md; role-based release notes designed', standing: 'partial' },
  { record: 'Public Trust Center updates', tree: 'No public Trust Center', standing: 'missing' },
];

// ── 8. The first thirty days ────────────────────────────────────────────────

/** The kit's first-30-day checklist, each beside the ninety-day task or owner decision that carries it. */
export const THIRTY_DAYS: readonly { item: string; carriedBy: string | null; note: string }[] = [
  { item: 'Select the entity path with counsel and a CPA', carriedBy: 'LAUNCH-DECISIONS item 4', note: 'Done as an LLC by attestation; counsel not named.' },
  { item: 'Form the entity, banking, accounting, founder IP assignment, cap table, contracting authority', carriedBy: 'LAUNCH-DECISIONS items 4–5', note: 'Entity attested; the rest not recorded.' },
  { item: 'Engage a broker; bind CGL, cyber and technology E&O', carriedBy: null, note: 'No broker; HECVAT COMP-03 records no policy.' },
  { item: 'Finalize the pilot agreement package and legal review', carriedBy: 'ninety-day charter-drafts', note: 'Outline only.' },
  { item: 'Finalize the Foundation, modules, implementation and support entitlement model', carriedBy: null, note: 'COM-002: no packages defined.' },
  { item: 'Set pilot and annual price floors and a discount approval workflow', carriedBy: '`deal-desk.ts` DEAL_POLICY', note: 'Proposed defaults awaiting finance.' },
  { item: 'Form the Product Governance Council and assign interim owners', carriedBy: 'LAUNCH-DECISIONS item 1', note: 'Every seat vacant.' },
  { item: 'Build the procurement room and the synthetic demo tenant', carriedBy: 'trust room; institutional-preview', note: 'Both built.' },
  { item: 'Build the first 50–100 account list', carriedBy: null, note: 'None.' },
  { item: 'Conduct 15–25 discovery conversations', carriedBy: null, note: 'None.' },
  { item: 'Recruit 3–5 design partners and sell the first paid pilot', carriedBy: 'ninety-day recruit-beta, sign-pilot', note: 'None yet.' },
  { item: 'Weekly pipeline, product-risk, customer-readiness and financial review', carriedBy: 'OPERATING-RHYTHM.md weekly', note: 'Scheduled; no record of one held.' },
];

export const PRINCIPLE: readonly string[] = [
  'Semester sells a unified platform.',
  'Pilots prove connected outcomes.',
  'Annual contracts activate modules in governed waves.',
  'Implementation is repeatable, paid and evidence-led.',
  'Governance protects the student, the institution and the company.',
  'Trust, accessibility, interoperability and operational reliability are product features, not marketing claims.',
];

/** Every item with a standing, for the tests and the counts. */
export const ITEMS: readonly Item[] = [
  ...COMMERCIAL_RULES, ENTITY, ...FORMATION, ...COVERAGES, ...UNDERWRITING, ...PACKAGE, ...TERM_SHEET, ...LAYERS, ...MODULES, ...GUARDRAILS,
  ...SEQUENCE.flatMap((p) => p.items), ...DECISION_RIGHTS, ...RELEASE_BLOCKS,
];
