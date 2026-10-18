# SaaS launch kit

<!-- Rendered from app/src/lib/launchkit.ts by launchkit.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Three documents of 28 September 2026 describe the company around the product:
entity and formation, insurance, the pilot agreement package, module-by-module
pricing, the higher-education go-to-market plan, a Product Governance Council
charter and a first-30-day checklist. They are kept under `docs/expansion/` as
supplied. This page holds each thing they ask for to what the tree already has,
under the rule of [D-108](DECISION-LOG.md#d-108--the-modernization-blueprint-is-a-crosswalk-onto-the-master-register-not-a-second-register)
and [D-111](DECISION-LOG.md#d-111--five-research-documents-are-held-to-the-tree-as-crosswalks-and-the-pdfs-are-never-their-own-evidence):
a supplied PDF is never its own evidence, every cited file exists, and every
standing is held to the kind of file it cites. Standings were read at `origin/main`
`ff52ba4` on 28 September 2026.

**This is a business planning crosswalk, not legal, tax, accounting, insurance or
investment advice.** Nothing here may be signed; counsel, a CPA and a broker
come before any contract, entity change, equity, payment or compliance claim.

| Supplied document | What it holds |
| --- | --- |
| [Semester SaaS Launch Kit](expansion/Semester-SaaS-Launch-Kit.pdf) | The launch operating model, the C-Corp checklist, insurance readiness, pilot terms, the module pricing model, the higher-ed GTM plan, the council charter and the first-30-day checklist. |
| [Build an all-in-one SaaS launch kit](expansion/SaaS-Launch-Kit-Summary.pdf) | The same kit in summary: pilot essentials, the module table, the bands, the 180-day sequence, the insurance sequence, the council. |
| [What should be in our first pilot agreement](expansion/First-Pilot-Agreement-Pricing-GTM-Entities-and-Council-Charter.pdf) | The pilot structure and eighteen agreement sections, the pilot SOW, pricing layers and guardrails, the two-engine GTM, the entity and insurance sequence, and the council charter in full. |

## Standings

| Standing | Meaning |
| --- | --- |
| tested | An automated test or a database check holds the rule |
| building | Code carries some of it; the gap says what it does not |
| designed | A document says what it would be; nothing runs |
| not-started | Nothing in the tree beyond the register that names it |
| held | A decision already on main answers it differently, and holds until the owner reopens it |

Across the 132 items with a standing: tested 57 · building 19 · designed 20 · not-started 29 · held 7.

## 1. The commercial position and its rules

**One platform agreement: the Foundation platform entitlement, institution-configured modules, an implementation scope, a support tier, and transparent usage and cost guardrails.**

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-RULE-01 | Foundation is required | The Foundation platform is required for institutional use; modules are activated on it. | building | [`app/src/lib/plans.ts`](../app/src/lib/plans.ts) — four plans: Free, Student, Student Plus, Institution; the institution plan is “through your university”<br>[`supabase/migrations/20260928004730_tenant_plan.sql`](../supabase/migrations/20260928004730_tenant_plan.sql) — one current plan per school, written by the service role | No Foundation entitlement distinct from the institution plan, and no module entitlement rides on it; modules are build-time flags, not purchasable rows. |
| LK-RULE-02 | Core controls are never premium | Privacy, accessibility, export, security and core data controls are never a premium add-on. | tested | [`app/src/lib/plans.test.ts`](../app/src/lib/plans.test.ts) — the free plan carries export and deletion; no plan withholds privacy or accessibility<br>[`app/src/lib/export.ts`](../app/src/lib/export.ts) — export for every account | True for student plans. No institutional entitlement model exists to hold the rule at that level. |
| LK-RULE-03 | Every module has an owner before sale | A named product owner, operational owner, data model, support model, accessibility requirements and an implementation playbook before a module is sold. | tested | [`app/src/lib/governance/charters.ts`](../app/src/lib/governance/charters.ts) — every module.* flag has a charter with owners, cost model, kill switch and review date<br>[`app/src/lib/governance/charters.test.ts`](../app/src/lib/governance/charters.test.ts) — a flag without a charter, or a charter with an empty field, fails | Owners are role labels; every seat is vacant. No implementation playbook per module. |
| LK-RULE-04 | Services are separately scoped | Implementation, migration, custom development and premium support are separately scoped and priced. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — an implementation-fee floor; custom work needs product approval<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — the floor and the custom-work approver are held | Proposed defaults, not a price book; no migration or premium-support price. |
| LK-RULE-05 | AI and storage costs are capped | AI and storage require an explicit allowance, cap, customer-managed account or overage term. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — a deal without an AI overage policy is refused<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held<br>[`supabase/migrations/20260924163000_intelligence_provider_runtime.sql`](../supabase/migrations/20260924163000_intelligence_provider_runtime.sql) — private.reserve_ai_budget: an atomic monthly budget per tenant | No storage allowance or overage anywhere; the AI budget is a tenant cap, not a contract term. |
| LK-RULE-06 | No sale of student data | No sale of student data, hidden behaviour, academic data, accommodation data, basic-needs activity or private AI conversations. | tested | [`app/src/lib/gtm/sponsor.ts`](../app/src/lib/gtm/sponsor.ts) — sponsors never receive student-level data; protected surfaces refused even when a school lists them<br>[`app/src/lib/gtm/sponsor.test.ts`](../app/src/lib/gtm/sponsor.test.ts) — held<br>[`docs/legal/PRIVACY-POLICY-DRAFT.md`](legal/PRIVACY-POLICY-DRAFT.md) — the draft says so, for counsel | The privacy policy is a draft, not in force. |
| LK-RULE-07 | Partners buy services, not access | Employers and partners may purchase approved services, never undisclosed student access. | tested | [`app/src/lib/gtm/sponsor.ts`](../app/src/lib/gtm/sponsor.ts) — placements carry a visible “Sponsored” label and a why-shown explanation; reports go out as suppressed aggregates<br>[`supabase/gtm.check.sql`](../supabase/gtm.check.sql) — the database refuses the same | No employer or partner product exists to sell; the rule is held on sponsorship only. |

## 2. Entity and formation

Choose a Delaware C-Corp when venture capital, options and enterprise sales are expected; an LLC when bootstrapped; decide with startup counsel and a CPA. **Held:** An LLC exists by the owner’s attestation and no formation record is in the tree. Converting to a C-Corp is a question for counsel when a priced round is planned; it is not a gap here.

| Evidence | Shows |
| --- | --- |
| [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) | COMP-01: a single-member LLC, wholly owned by its founder (owner attestation, 28 September 2026); legal name, state and formation date still to add |
| [`docs/LAUNCH-DECISIONS.md`](LAUNCH-DECISIONS.md) | item 4: “Form the company, e.g. an LLC, and choose the state” |

The formation checklist, twenty items: tested 0 · building 1 · designed 6 · not-started 12 · held 1.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-FORM-01 | Counsel and CPA | Retain startup counsel and a CPA. | not-started | [`docs/LAUNCH-DECISIONS.md`](LAUNCH-DECISIONS.md) — item 5: take the legal drafts to a lawyer; ask the Wond’ry about student-founder resources | No counsel or CPA is named anywhere. |
| LK-FORM-02 | Name and trademark clearance | Clear the company name, domain and trademark conflicts. | designed | [`IP.md`](../IP.md) — §2: “Semester” is likely merely descriptive; the USPTO search to run is written out<br>[`docs/operating-model/DEFENSIBILITY.md`](operating-model/DEFENSIBILITY.md) — register the mark in core classes; hold the primary domains | The search has not been run and no custom domain is held; the app runs at the GitHub Pages address. |
| LK-FORM-03 | Structure chosen | Choose a Delaware C-Corp, LLC or another approved structure. | held | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: a single-member LLC | Chosen: an LLC. See LK-ENT-01. |
| LK-FORM-04 | Registered agent | Appoint a registered agent. | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01 leaves the state of formation to add | Not recorded. |
| LK-FORM-05 | Formation filed | File the certificate of incorporation or formation documents. | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: formation date still to add | Attested, not evidenced: no certificate is filed under docs/evidence/, which does not exist. |
| LK-FORM-06 | EIN and registrations | Obtain an EIN and required state and local registrations. | not-started | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) — financial controls: tax nexus reviewed annually and on entering a new state, by an external accountant | Not recorded. |
| LK-FORM-07 | Bylaws or operating agreement | Adopt bylaws or an operating agreement. | not-started | [`docs/operating-model/RISK-GOVERNANCE.md`](operating-model/RISK-GOVERNANCE.md) — governance bodies: eight, every one “none named” | Not recorded. |
| LK-FORM-08 | Directors, officers, signers | Appoint initial directors, officers and authorized signers. | not-started | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) — invoice and expense approval by amount, finance and CEO | No signing authority is recorded; the master register’s LEG-001 gap names it. |
| LK-FORM-09 | Founder equity and cap table | Approve founder equity grants and maintain a cap table. | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: 100% owned by the founder | A single owner; no cap table is needed until a second holder, and none exists. |
| LK-FORM-10 | Founder IP assignment | Execute founder invention and IP assignment and confidentiality agreements. | designed | [`docs/trust/SOC2-READINESS.md`](trust/SOC2-READINESS.md) — CC1-08: no agreements exist; counsel drafts a confidentiality and IP assignment agreement, including one for the founder’s own entity<br>[`IP.md`](../IP.md) — §1: whether Vanderbilt has a claim, with the deciding facts and the email to send | No assignment from the founder to the LLC is recorded; the Vanderbilt question is prepared, not asked. |
| LK-FORM-11 | Equity incentive plan | Create an equity incentive plan before meaningful hiring, if appropriate. | not-started | [`docs/operating-model/OPERATING-RHYTHM.md`](operating-model/OPERATING-RHYTHM.md) — monthly: hiring and capacity → open roles | One person works in the company; no plan and no hiring plan. |
| LK-FORM-12 | 83(b) election | Evaluate 83(b) election requirements with counsel. | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: an LLC with one member | Not applicable to a single-member LLC with no restricted stock; revisit on conversion. |
| LK-FORM-13 | Bank and payment processor | Open a company bank account and a payment-processor account. | not-started | [`app/src/lib/masterregister.ts`](../app/src/lib/masterregister.ts) — COM-001: no payment processor, no invoicing<br>[`docs/DECISION-LOG.md`](DECISION-LOG.md) — D-009: billing stays out of the app for now | No bank account or processor is recorded. D-009 keeps billing out of the app. |
| LK-FORM-14 | Accounting and monthly close | Accounting system, chart of accounts, expense approvals and a monthly close. | designed | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) — financial controls: tiered expense approval, budget vs actual monthly, 13-week cash forecast, monthly close review<br>[`app/src/lib/ops/firstyear.ts`](../app/src/lib/ops/firstyear.ts) — runway, ARR/MRR and gross-margin measures; the numbers live in the financial workspace, not the repository | Controls and owners on a page; no accounting system, no close has happened, no numbers anywhere. |
| LK-FORM-15 | Payroll and sales-tax registration | Register for payroll, sales/use tax and local tax obligations. | not-started | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) — tax nexus by an external accountant | Not recorded. |
| LK-FORM-16 | Signature authority and legal review | Establish contract-signature authority and a legal review process. | designed | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) — legal sits at the deal desk for non-standard paper<br>[`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — nonstandard terms add the legal approver | A rule about who approves; no signatory is named and nothing may be signed (SEMESTER-OPERATING-SYSTEM.md, contract templates). |
| LK-FORM-17 | Staff and advisor agreements | Employee, contractor and advisor confidentiality and IP-assignment agreements. | designed | [`docs/operating-model/DEFENSIBILITY.md`](operating-model/DEFENSIBILITY.md) — “Every employee and contractor signs an invention assignment before first commit”<br>[`docs/trust/SOC2-READINESS.md`](trust/SOC2-READINESS.md) — CC1-07: training before access; no staff yet | A commitment on a page; no agreement exists and no one to sign one. |
| LK-FORM-18 | Policy set adopted | Records retention, privacy, security, accessibility and AI governance policies. | building | [`RETENTION.md`](../RETENTION.md) — retention per table and device store<br>[`SECURITY.md`](../SECURITY.md) — the security policy<br>[`docs/operating-model/ACCESSIBILITY-GOVERNANCE.md`](operating-model/ACCESSIBILITY-GOVERNANCE.md) — accessibility governance<br>[`docs/operating-model/AI-GOVERNANCE-BOARD.md`](operating-model/AI-GOVERNANCE-BOARD.md) — AI governance<br>[`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) — POLICIES: each policy’s status, not-started through in-force | Product policies exist; the retention schedule has no corporate-records classes (maturity RM-01), and no policy is in force. |
| LK-FORM-19 | Board and advisor governance | Board or advisor governance, meeting records and a corporate document repository. | designed | [`docs/operating-model/RISK-GOVERNANCE.md`](operating-model/RISK-GOVERNANCE.md) — board-level reporting: the ten-item quarterly report<br>[`docs/operating-model/OPERATING-RHYTHM.md`](operating-model/OPERATING-RHYTHM.md) — quarterly: board/advisor review → board deck | No board, no advisor, no minutes and no minute book; the operating-system register is the nearest thing to a document repository, and it holds controlled documents, not corporate records. |
| LK-FORM-20 | Corporate records repository | Keep certificate, bylaws, consents, cap table, IP assignments, EIN, banking resolutions, insurance certificates, trademark documents and the policy register in one place. | not-started | [`app/src/lib/masterregister.ts`](../app/src/lib/masterregister.ts) — NEEDS_EVIDENCE_DIR: no row rises above tested until docs/evidence/ exists<br>[`ops/operations-console/README.md`](../ops/operations-console/README.md) — an insurance certificate is an expiring artifact under docs/evidence/ | docs/evidence/ does not exist. Corporate records would not belong in a public repository in any case; a private store is the gap, and its index would be filed here. |

### Essential corporate files

The kit lists twelve. None is in evidence, because `docs/evidence/` does not
exist and corporate records do not belong in a public repository; the gap is a
private store, and an index of it filed here.

- Certificate of incorporation or formation documents
- Bylaws or operating agreement
- Board and stockholder consents
- Cap table and equity records
- Founder stock purchase documents
- IP assignment documents
- Employee, contractor and advisor agreements
- EIN confirmation and tax registrations
- Banking resolutions
- Insurance policies and certificates
- Trademark and domain documentation
- Policy register and corporate records schedule

## 3. Insurance

Nine coverages in the kit’s sequence. All nine: tested 0 · building 0 · designed 0 · not-started 9 · held 0. Only cyber liability is
named anywhere on main, and the HECVAT draft records that no policy is held.

| ID | Coverage | When | Purpose | Ask the broker | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LK-INS-01 | Commercial general liability | Formation, or the first office, venue or customer-contract requirement | Third-party bodily injury, property damage, certain advertising-injury claims | Required limits, additional-insured terms, worldwide territory | not-started | [`app/src/lib/masterregister.ts`](../app/src/lib/masterregister.ts) — LEG-001: insurance in place — designed, no certificate in evidence | No policy; no institution has yet asked for one. |
| LK-INS-02 | Technology E&O / professional liability | Before paid pilots and enterprise contracts | Claims caused by software or service error, failure to perform, or professional negligence | Does it cover SaaS outage, implementation failure, content- and AI-related professional exposure? | not-started | [`app/src/lib/masterregister.ts`](../app/src/lib/masterregister.ts) — LEG-001 and COM-003: the procurement packet lacks insurance | No policy. The kit puts this before the first paid pilot; docs/trust/README.md’s signature blockers name only cyber. |
| LK-INS-03 | Cyber liability | Before production personal, student or customer data | Breach response, forensics, notification, ransomware, cyber business interruption | Does it cover privacy claims, regulatory response, vendor incidents, social engineering? | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-03: “No policy is held. A certificate will be filed under docs/evidence/ once one is bought.”<br>[`docs/market-readiness/HECVAT_READINESS.md`](market-readiness/HECVAT_READINESS.md) — LEGAL-2 cyber liability insurance certificate: NOT_STARTED | No policy, and hecvat-readiness.test.ts fails any READY insurance claim with no filed document. Production holds real accounts already (delete-account is live), so by the kit’s own trigger this is overdue. |
| LK-INS-04 | Directors and officers | Before outside financing, a formal board or a priced round | Management, governance and fiduciary claims | Does it include entity coverage and an appropriate retention? | not-started | [`docs/operating-model/RISK-GOVERNANCE.md`](operating-model/RISK-GOVERNANCE.md) — no board is named | No board and no financing; not yet triggered. |
| LK-INS-05 | Employment practices liability | At employee hiring, or as part of the D&O package | Employment-related allegations | Multi-state workforce and contractor treatment? | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: one person working in the company | No employees; not yet triggered. |
| LK-INS-06 | Workers’ compensation | When legally required for employees in the relevant states | Work-related injury obligations | Which employee locations trigger coverage? | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: one person working in the company | No employees; not yet triggered. |
| LK-INS-07 | Crime / social engineering | When payments, AP, wire transfers or vendor disbursements mature | Fraud, funds-transfer and employee-dishonesty risk | Are payment-processor and wire-fraud losses covered? | not-started | [`app/src/lib/masterregister.ts`](../app/src/lib/masterregister.ts) — COM-001: no payment processor | No payments flow; not yet triggered. |
| LK-INS-08 | Media / IP | As public content, AI, marketplace and brand activity expand | Some media, copyright or IP claims, subject to exclusions | What AI and content exclusions apply? | not-started | [`docs/operating-model/TRUST-BRAND-AND-LEGAL.md`](operating-model/TRUST-BRAND-AND-LEGAL.md) — horizon scanning: copyright, model training, AI output policy | No policy; the AI features that would trigger it ship behind flags. |
| LK-INS-09 | Key person | Later, if the business depends heavily on one individual | Financial consequences of losing key leadership | Which roles, and what limits? | not-started | [`app/src/lib/governance/risk.ts`](../app/src/lib/governance/risk.ts) — R-09: one person holds every seat<br>[`app/src/lib/governance/maturity.ts`](../app/src/lib/governance/maturity.ts) — DS-01 founder unavailable: no delegate holds credentials | The dependence is total and recorded; the coverage is not held and the written unavailability plan R-09 asks for does not exist. |

### The underwriting packet

What a broker asks for, and what the tree can hand over today: tested 1 · building 2 · designed 4 · not-started 2 · held 0.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-UW-01 | Entity, ownership, revenue, headcount | Legal entity, ownership, revenue, projected revenue, employee and contractor count. | designed | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: a single-member LLC, one person; revenue is nil | Legal name, state and date still to add; no revenue projection exists. |
| LK-UW-02 | Product, customers, high-risk workflows | Product description, customer type and high-risk workflows. | designed | [`docs/launch/WHAT-IS-SEMESTER.md`](launch/WHAT-IS-SEMESTER.md) — the product in plain words<br>[`docs/MODULE-PRIVACY-MODEL.md`](MODULE-PRIVACY-MODEL.md) — what each module holds and the authority boundaries<br>[`ops/claims/README.md`](../ops/claims/README.md) — every public claim with its register word | Assembled from three pages; not one document. |
| LK-UW-03 | Security overview and architecture | Security overview and an architecture diagram. | designed | [`docs/trust/SECURITY-WHITEPAPER.md`](trust/SECURITY-WHITEPAPER.md) — the security whitepaper<br>[`docs/architecture/README.md`](architecture/README.md) — the ten decision records<br>[`docs/UNIVERSITY-OS-ARCHITECTURE.md`](UNIVERSITY-OS-ARCHITECTURE.md) — the architecture | No diagram as such; the whitepaper and ADRs are prose. |
| LK-UW-04 | Control evidence | MFA, encryption, logging, backups, incident response and vulnerability-management evidence. | building | [`docs/market-readiness/SECURITY_READINESS.md`](market-readiness/SECURITY_READINESS.md) — the controls and their state<br>[`supabase/restore.sh`](../supabase/restore.sh) — the restore drill<br>[`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) — severity model and process<br>[`app/src/lib/security.test.ts`](../app/src/lib/security.test.ts) — the policy held to the Edge Function variables | Controls exist; the evidence of operating them does not, because docs/evidence/ does not exist (master register, evidence index: missing). |
| LK-UW-05 | Privacy set | Privacy policy, DPA, subprocessor list, retention policy and AI data-use policy. | building | [`docs/legal/PRIVACY-POLICY-DRAFT.md`](legal/PRIVACY-POLICY-DRAFT.md) — draft for counsel<br>[`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) — DPA requirements; not a signed agreement<br>[`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md) — the subprocessor register<br>[`RETENTION.md`](../RETENTION.md) — retention<br>[`docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) — the no-training policy, a draft for counsel<br>[`app/src/lib/trust/legal-drafts.test.ts`](../app/src/lib/trust/legal-drafts.test.ts) — the drafts name every subprocessor and say they are not in force | Two of five are drafts and the DPA is a checklist; the subprocessor and retention registers are current. |
| LK-UW-06 | Education-record data and safeguards | Description of student and education-record data and its safeguards. | tested | [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](FERPA-COPPA-1EDTECH-READINESS.md) — FERPA, COPPA and 1EdTech readiness<br>[`app/src/lib/trust/ferpa-coppa-readiness.test.ts`](../app/src/lib/trust/ferpa-coppa-readiness.test.ts) — held<br>[`RETENTION.md`](../RETENTION.md) — every table and its class | Held; the school-official language waits on counsel. |
| LK-UW-07 | Prior claims and incidents | Prior claims or incidents and their remediation. | designed | [`app/src/lib/postmortem.ts`](../app/src/lib/postmortem.ts) — the post-mortem shape<br>[`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) — the process | None to declare; no incident log exists to prove it. |
| LK-UW-08 | Institutions’ insurance requirements | Contractual insurance requirements from target institutions. | not-started | [`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) — assumes cyber-liability insurance is in place | No institution has stated a requirement; no target-account list exists to ask. |
| LK-UW-09 | Limits, retentions, certificates | Requested limits, deductibles or retentions, exclusions and certificate requirements. | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-03: the certificate’s future home | Nothing to request against; no broker is engaged. |

## 4. The pilot agreement

The recommended package is seven documents: tested 1 · building 2 · designed 3 · not-started 0 · held 1.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-PKG-01 | Pilot agreement or MSA | The master terms the order form hangs from. | designed | [`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) — twenty-six sections the agreement needs, and a sample scope; an outline for counsel, not agreement language<br>[`app/src/lib/gtm/rfp.ts`](../app/src/lib/gtm/rfp.ts) — CT-1: “None has been reviewed by qualified counsel, approved or signed” | No counsel-approved MSA exists: an unapproved draft is in docs/legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md, and the outline is the rest of it. LEG-002 in the master register: designed. |
| LK-PKG-02 | Order form / pilot SOW | Cohort, modules, environments, integrations, roles, milestones, exclusions, fees. | building | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — PilotPlan: dates, workflow, cohort, baseline, sponsor, champion, data plan, 3–5 metrics with baselines, conversion date, agreed annual price, midpoint review<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — pilotReadiness refuses a plan missing any of them<br>[`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — charter-drafts: “Draft charter and order form, reviewed by counsel” | The fields a pilot must carry are code and the database refuses a pilot without them; no order-form document renders them for a signature. |
| LK-PKG-03 | Data Processing Addendum | FERPA school-official terms, permitted processing, subprocessors, retention, deletion, legal hold, export. | designed | [`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) — the clause requirements and what the product supports today; starting clause language<br>[`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) — POLICIES: dpa is an outline; the student-data addendum is not started | A checklist for counsel; the tenant-wide export and deletion certification its termination clause needs do not exist yet. |
| LK-PKG-04 | Security, privacy, accessibility and AI exhibit | One exhibit stating the safeguards, the accessibility documentation and process, and the AI data-use and no-training terms. | building | [`app/src/lib/governance/module-privacy.ts`](../app/src/lib/governance/module-privacy.ts) — CONTRACT_TERMS: the terms a contract carries per module<br>[`app/src/lib/trust/ai-training-policy.ts`](../app/src/lib/trust/ai-training-policy.ts) — DEFAULT_RULE: no training on production content by default<br>[`app/src/lib/trust/ai-training-policy.test.ts`](../app/src/lib/trust/ai-training-policy.test.ts) — held<br>[`docs/SECURITY-ACCESSIBILITY-READINESS.md`](SECURITY-ACCESSIBILITY-READINESS.md) — what a reviewer receives and what is absent | The terms exist as data in three places; no exhibit assembles them, and the accessibility conformance report it would attach has not been produced. |
| LK-PKG-05 | Support and service-level exhibit | Scope, hours, severities, escalation, maintenance windows, objectives, exclusions; not an emergency service. | designed | [`docs/trust/SLA.md`](trust/SLA.md) — the pilot SLA once it can be offered: 99.9% core, AI best-effort, credits, exclusions<br>[`app/src/lib/gtm/rfp.ts`](../app/src/lib/gtm/rfp.ts) — SS-1 support planned; SS-2 no uptime commitment<br>[`app/src/community/governance.ts`](../app/src/community/governance.ts) — NOT_AN_EMERGENCY_SERVICE | Nothing is committed: no support hours, no owner, no on-call (SUP-002). The emergency boundary is stated for communities, not in a contract exhibit. |
| LK-PKG-06 | Implementation plan and launch gates | Milestones, readiness reviews, the go decision, hypercare. | tested | [`docs/operating-model/PILOT-TO-PRODUCTION.md`](operating-model/PILOT-TO-PRODUCTION.md) — phases 0–7, the cutover checklist, the RACI<br>[`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) — the gates and decide(): GO or NO-GO<br>[`app/src/lib/launchreadiness.test.ts`](../app/src/lib/launchreadiness.test.ts) — an open P0/P1 is NO-GO and no acceptance waives it<br>[`supabase/tenant-rollout.check.sql`](../supabase/tenant-rollout.check.sql) — the tenant lifecycle refuses an exit gate without evidence | The gates are code; no institution has passed through them, and every council seat is vacant. |
| LK-PKG-07 | Regulated-data exhibit | A business-associate, payment or other regulated-data exhibit, only if applicable. | held | [`docs/DO-NOT-BUILD.md`](DO-NOT-BUILD.md) — what is not built<br>[`docs/DECISION-LOG.md`](DECISION-LOG.md) — D-009: billing stays out of the app | Not applicable by decision: no health data is processed and no payments flow. Revisit when either changes. |

### The term sheet

Fourteen positions, each held to where the tree already takes it: tested 9 · building 2 · designed 1 · not-started 0 · held 2.
The one conflict is the term: the kit says 90–180 days and `gtm/pilot.ts` runs
every pilot for exactly 26 weeks, 182 days, as the owner set it (D-134).

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-TERM-01 | Parties | Semester’s legal entity and the institution’s. | held | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: the LLC, name to add | The party exists by attestation; its legal name is not yet on file, so no paper names it. |
| LK-TERM-02 | Term | One academic term or 90–180 days, with explicit dates. | held | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — pilotReadiness: exactly 26 weeks, or the plan is refused<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held<br>[`docs/PAID-PILOT-FRAMEWORK.md`](PAID-PILOT-FRAMEWORK.md) — “The two length rules agree”: 26 weeks inside the deal desk’s six months | The owner set every pilot to 26 weeks (D-134); pilotReadiness refuses any other length. That is 182 days, two past the kit’s 90–180; the code’s rule holds. |
| LK-TERM-03 | Scope | Named cohort, modules, environments, integrations and roles only. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — no_cohort, no data plan → refused<br>[`supabase/gtm.check.sql`](../supabase/gtm.check.sql) — the database refuses a pilot without the §6.2 elements<br>[`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) — included and excluded lists | Modules are not enumerable per tenant; the scope names features, not entitlements. |
| LK-TERM-04 | Purpose | Validate a defined outcome, not general unlimited use. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — a workflow, a baseline and 3–5 metrics each with a baseline<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held | Held in code. |
| LK-TERM-05 | Fees | A paid pilot; invoice schedule and taxes stated; credit toward an annual licence only if specified. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — minimum pilot ACV $15k (proposed); pilot credit capped at 50%; implementation fee waived only as capped credit<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held | Proposed defaults, not a price book; no invoice can be issued (COM-001). |
| LK-TERM-06 | Cohort | A defined covered population and an enrollment cap. | building | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — cohort required<br>[`docs/PAID-PILOT-FRAMEWORK.md`](PAID-PILOT-FRAMEWORK.md) — 10–200 students, as a checklist item | The 10–200 bound is a checklist line, not code. |
| LK-TERM-07 | Data | Minimum necessary; an approved data map; nothing outside it. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — a minimum-necessary read-only data plan; sandbox until production data is approved<br>[`app/src/lib/gtm/campaign.ts`](../app/src/lib/gtm/campaign.ts) — education-record, aid, health, disability and conduct fields refused by name<br>[`app/src/lib/gtm/campaign.test.ts`](../app/src/lib/gtm/campaign.test.ts) — held | The forbidden classes are enforced for campaigns; the pilot data plan is free text. |
| LK-TERM-08 | Customer authority | The institution retains official authority for registration, degree audit, aid, discipline, accommodations, health and final decisions. | tested | [`app/src/site/platform.ts`](../app/src/site/platform.ts) — AUTHORITIES and BOUNDARIES, shown at /platform/system-boundaries/<br>[`app/src/site/site.test.tsx`](../app/src/site/site.test.tsx) — the page renders them<br>[`app/src/lib/governance/module-privacy.ts`](../app/src/lib/governance/module-privacy.ts) — DECISION_RIGHTS<br>[`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) — §26: no production, grade or registration authority before written approval | Held publicly and in data; not yet in agreement language. |
| LK-TERM-09 | AI | No general-purpose training on production data by default; approved provider and data use only. | tested | [`app/src/lib/trust/ai-training-policy.ts`](../app/src/lib/trust/ai-training-policy.ts) — DEFAULT_RULE<br>[`app/src/lib/trust/ai-training-policy.test.ts`](../app/src/lib/trust/ai-training-policy.test.ts) — held to the privacy page’s promise<br>[`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) — no secondary use or training, unchecked until provider terms are accepted<br>[`docs/trust/PROVIDER-TERMS.md`](trust/PROVIDER-TERMS.md) — the providers’ published terms, verbatim; none signed | A draft for counsel; provider terms are recorded as published, and none is accepted or signed. |
| LK-TERM-10 | Support | Named contacts, hours, a severity framework, an escalation route, and an explicit non-emergency boundary. | designed | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) — T1–T3 tiers<br>[`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) — the severity model<br>[`app/src/community/governance.ts`](../app/src/community/governance.ts) — NOT_AN_EMERGENCY_SERVICE | No named contact, no hours, no support address separate from a personal mailbox (LAUNCH-DECISIONS item 2). |
| LK-TERM-11 | Success | Baseline, target, method, data owner, review dates, end-of-pilot value review. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — metrics with baseline and target; a midpoint review date; a conversion date near the end<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held<br>[`docs/market-readiness/PILOT_PLAYBOOK.md`](market-readiness/PILOT_PLAYBOOK.md) — success criteria decided before, measured after | No data owner per metric and no method field. |
| LK-TERM-12 | Publicity | No logo, case study, testimonial or outcome claim without written approval. | tested | [`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) — PROOF_RULES: no logo without the institution’s written permission; shown at /proof/<br>[`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — held<br>[`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — quotes: each with the speaker’s written permission | Held as a public rule; not yet a clause. |
| LK-TERM-13 | Conversion | A pre-agreed option and decision date; no automatic conversion. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — pilotVerdict: no signature, no outcome; convert and expand refused while a high-severity issue is open<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held<br>[`docs/PILOT-TO-ANNUAL-CONVERSION.md`](PILOT-TO-ANNUAL-CONVERSION.md) — four outcomes, all real: convert, expand, pause, stop | No explicit no-auto-renewal clause anywhere; the rule is that nothing converts unsigned. |
| LK-TERM-14 | Exit | Export, transition support, deletion or retention, credential revocation, closeout. | building | [`docs/DATA-PORTABILITY-AND-OFFBOARDING.md`](DATA-PORTABILITY-AND-OFFBOARDING.md) — offboarding a school: each student’s own export first, deletion confirmation per category<br>[`app/src/lib/export.ts`](../app/src/lib/export.ts) — student export<br>[`supabase/deletion.check.sql`](../supabase/deletion.check.sql) — deletion empties what it claims<br>[`app/src/lib/revoke.test.ts`](../app/src/lib/revoke.test.ts) — a revoke cannot be undone | Student-level export and deletion are tested; no tenant-wide export job, no deletion certificate, no transition runbook (LEG-004). |

### The eighteen agreement sections, on the outline’s twenty-six

Each section the kit asks for, and the numbered sections of
[`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) that carry it.

| Section | Outline § | Note |
| --- | --- | --- |
| Parties, effective date, definitions | 1 | Order of precedence: MSA, DPA, SOW, SLA. |
| Purpose, scope, cohort, enabled modules, excluded features | 2, 4, 5, 6 |  |
| Implementation plan; customer and Semester responsibilities | 7, 8, 9 |  |
| Fees, invoicing, payment, taxes, optional annual credit | 16 | Usage and AI capacity limits sit in the same section. |
| Service access, entitlement, acceptable use, suspension | **none** | Not in the outline. Acceptable use lives in the student terms draft; suspension rights are nowhere. |
| Data ownership, permitted processing, FERPA school-official duties, minimization, no secondary use | 10, 11 | The DPA checklist carries the clause language. |
| Privacy, DPA, subprocessors, retention, deletion, legal hold, export | 11, 23 |  |
| Security safeguards, incident notification, customer cooperation | 11, 22 |  |
| AI terms: provider and data use, no training by default, policy configuration, limitations, human oversight | 13 | The no-training policy is a draft for counsel. |
| Accessibility: conformance statement, known limitations, feedback route, remediation, customer duties | 14 | No ACR exists to attach. |
| Interoperability: SSO, LTI, OneRoster, API scope, testing, dependencies, rate limits, mapping | 12 |  |
| Support, service objectives, maintenance, status communications, change-freeze periods | 15, 17 | Best-effort with named response times, not a credit-bearing SLA. |
| Intellectual property, customer content, feedback, product improvements | 20, 21 |  |
| Confidentiality | 20 |  |
| Warranties, disclaimers, indemnity, limitation of liability, insurance | **none** | Not in the outline; counsel’s provisions (below). |
| Termination, transition, export, deletion, survival | 23 |  |
| Pilot evaluation, optional conversion, non-binding plan language | 18, 19, 24 |  |
| Governing law, notices, assignment, standard terms | **none** | Not in the outline; counsel’s provisions (below). |

### The pilot statement of work

The kit’s SOW template, field by field, and the `PilotPlan` field in
[`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) that already carries it — the database refuses a pilot without those.

| Field | Carried by | Note |
| --- | --- | --- |
| Pilot name | **none** | A `gtm_pilots` row has an id, not a name. |
| Institution | **none** | The pilot belongs to a `gtm_accounts` row; the plan itself does not name the institution. |
| Pilot period | `startDate, endDate` | Exactly 26 weeks. |
| Population | `cohort` | Free text; no enrollment cap field. |
| Enabled modules | **none** | Modules are flags on the tenant, not a list in the plan. |
| Enabled integrations | `dataPlan` | A minimum-necessary read-only data plan; integrations are not enumerated. |
| Excluded modules | **none** | Nothing records what is out; the outline’s excluded list is prose. |
| Customer responsibilities | `executiveSponsor, operationalChampion` | Two named roles; no content-owner or escalation-contact fields. |
| Semester responsibilities | **none** | docs/operating-model/PILOT-TO-PRODUCTION.md’s RACI, not a plan field. |
| Success metrics | `metrics` | 3–5, each with baseline and target. |
| Review dates | `midpointReviewDate` | One midpoint; the kit asks for kickoff, weeks 2, 4, 10 and the end. |
| Conversion decision date | `conversionDate` | Within end −14 / +30 days. |
| Pilot fee | `annualPriceAgreed` | The annual price is agreed; the pilot fee itself is not a field. |

### Left to counsel

Confidentiality · Intellectual property and feedback · Warranties and disclaimers · Indemnification · Limitation of liability · Insurance · Governing law and venue · Assignment · Force majeure · Notices · Publicity · Export controls and sanctions. None of these is attempted in the tree.

## 5. Module-by-module pricing

The commercial layers: tested 3 · building 2 · designed 0 · not-started 2 · held 1.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-LAYER-01 | Semester Foundation | An annual platform fee by enrollment band or covered population. | building | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — minimum ACV by tier: pilot, department, campus, system<br>[`app/src/site/more.tsx`](../app/src/site/more.tsx) — HowWePrice: cohort size, modules switched on, connected systems, support tier move the price | Tiers by institution size exist; no enrollment bands and no figure per band. |
| LK-LAYER-02 | Domain modules | An annual fee per module by band, population or scope. | building | [`app/src/site/more.tsx`](../app/src/site/more.tsx) — “A module that is off is not billed”<br>[`docs/ENTITLEMENT-RESOLUTION.md`](ENTITLEMENT-RESOLUTION.md) — the order: kill switch → tenant plan → module → usage allowance | Modules are build-time flags with charters; no per-module price, and no tenant can buy one. |
| LK-LAYER-03 | Implementation | One-time fixed scope plus change-order rules. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — implementation fee floor $10k, waived only as capped pilot credit<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held | A floor, not a scope or a rate card. |
| LK-LAYER-04 | Premium support | An annual percentage or a tiered fixed fee. | not-started | [`docs/trust/SLA.md`](trust/SLA.md) — a pilot SLA once it can be offered | No support tiers priced; no premium tier can be staffed (SUP-002). |
| LK-LAYER-05 | AI usage | An included allowance plus transparent overage, or a customer-selected model account. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — a deal without an AI overage policy is refused<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held<br>[`app/src/lib/allowance.ts`](../app/src/lib/allowance.ts) — DEFAULT_MONTHLY_CALLS = 60 per student, metered<br>[`supabase/migrations/20260924163000_intelligence_provider_runtime.sql`](../supabase/migrations/20260924163000_intelligence_provider_runtime.sql) — reserve_ai_budget | Allowance and cap exist; no overage price and no customer-managed model account. |
| LK-LAYER-06 | Storage and large files | An included allowance plus overage or an archival tier. | not-started | [`RETENTION.md`](../RETENTION.md) — what is kept and for how long | No storage allowance anywhere. |
| LK-LAYER-07 | Payments | Pass-through processor fee plus a transparent platform fee, for approved transactions only. | held | [`docs/DECISION-LOG.md`](DECISION-LOG.md) — D-009: billing stays out of the app | Out by decision. |
| LK-LAYER-08 | Custom work | Time-and-materials or a fixed SOW. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — custom work needs the product approver and a scorecard<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held | An approval rule; no rate. |

### The modules

Twelve modules in the kit’s catalogue. None exists as an entitlement; each is read
against the features that would be sold under it: tested 9 · building 1 · designed 1 · not-started 0 · held 1.

| ID | Module | Buyer | Pricing metric | Included value | Guardrail | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LK-MOD-01 | Semester Foundation | Institution, department, program | Enrollment band, covered cohort or campus scope | Identity and context, Today, planning, actions and calendar, source/scope/status, account and data controls, search, notifications | Required for institutional modules | tested | [`app/src/lib/nav.ts`](../app/src/lib/nav.ts) — the five destinations: home, calendar, study, support, me<br>[`app/src/lib/fivedestinations.test.ts`](../app/src/lib/fivedestinations.test.ts) — held<br>[`app/src/lib/source.ts`](../app/src/lib/source.ts) — the five source labels the database enforces<br>[`app/src/lib/mecontrols.test.ts`](../app/src/lib/mecontrols.test.ts) — account and data controls | Built as the product; not sold as an entitlement. |
| LK-MOD-02 | Academic Navigation | Student success, advising, transfer | Covered students or program scope | Plan, advisor agenda, verified service routing, transition workflows | Never represents official audit or registration by default | tested | [`app/src/lib/degree.test.ts`](../app/src/lib/degree.test.ts) — student-entered requirements; nothing official<br>[`app/src/lib/advisor-meeting.test.ts`](../app/src/lib/advisor-meeting.test.ts) — the agenda carries only what the student ticked<br>[`app/src/lib/help-routes.test.ts`](../app/src/lib/help-routes.test.ts) — routes sent only on confirm<br>[`docs/TRANSFER-TRANSITION-HUB.md`](TRANSFER-TRANSITION-HUB.md) — eight workflows: two building, six tested | No module boundary; these are student features on every account. |
| LK-MOD-03 | Learning & LMS | Academic affairs, online learning | Active course enrollments or institution band | Course workspace, content, work completion, Study Studio, course AI policy | Separate high-stakes assessment scope if needed | tested | [`app/src/lib/coursestudio.test.ts`](../app/src/lib/coursestudio.test.ts) — Course Studio<br>[`app/src/lib/studystudio.test.ts`](../app/src/lib/studystudio.test.ts) — Study Studio<br>[`docs/decisions/D-1067.md`](decisions/D-1067.md) — native LMS and gradebook replacement approved | Course rules, guidance and study packs are tested; full modules, files, graded submissions and accessibility UAT remain incomplete. |
| LK-MOD-04 | Assessment & Gradebook | Academic affairs | Active course enrollments or high-stakes scope | QTI, rubrics, delivery, feedback, grade ledger | Sell only with mature support, audit and accessibility controls | tested | [`app/src/lib/gradebook/gradebook.test.ts`](../app/src/lib/gradebook/gradebook.test.ts) — weighted schemes and append-only grade versions<br>[`app/src/lib/gradebook/passback.test.ts`](../app/src/lib/gradebook/passback.test.ts) — authorized passback<br>[`supabase/gradebook.check.sql`](../supabase/gradebook.check.sql) — course scope, moderation, release and registrar export | The native gradebook exists; rubric authoring, batch and anonymous grading, high-stakes assessment delivery and institutional cutover evidence remain incomplete. |
| LK-MOD-05 | Student Life & Community | Student affairs | Institution band or active community users | Clubs, events, mentorship, community and service discovery, moderation controls | Safety and moderation scope must match the staffing model | tested | [`docs/COMMUNITIES-REGISTER.md`](COMMUNITIES-REGISTER.md) — the four blueprints held to the tree<br>[`app/src/lib/communitiesregister.test.ts`](../app/src/lib/communitiesregister.test.ts) — held<br>[`app/src/lib/moderation.test.ts`](../app/src/lib/moderation.test.ts) — moderation | No staffing model exists to match; the register says which pieces are missing. |
| LK-MOD-06 | Student Support Navigator | Student success, basic-needs and transfer offices | Institution band or service-network scope | Resource directory, handoffs, source freshness, referral controls | Sensitive intake requires a restricted workflow and an explicit owner | tested | [`app/src/lib/help-routes.test.ts`](../app/src/lib/help-routes.test.ts) — the support directory routes only on confirm<br>[`docs/BASIC-NEEDS-NAVIGATOR.md`](BASIC-NEEDS-NAVIGATOR.md) — seventeen categories, ten route somewhere<br>[`app/src/lib/basicneeds.test.ts`](../app/src/lib/basicneeds.test.ts) — held | No case-manager role and no restricted intake workflow (MODULE-PRIVACY-MODEL). |
| LK-MOD-07 | Career & Pathways | Career services, experiential learning | Covered students or active career users | Opportunities, portfolio, skills evidence, alumni and employer workflows | No sale of student data or hidden employer targeting | tested | [`app/src/lib/career-evidence.test.ts`](../app/src/lib/career-evidence.test.ts) — portfolio items only from what the student confirmed<br>[`app/src/lib/skills-graph.test.ts`](../app/src/lib/skills-graph.test.ts) — skills evidence<br>[`app/src/lib/gtm/sponsor.test.ts`](../app/src/lib/gtm/sponsor.test.ts) — no student-level data to sponsors | No employer workflow exists. |
| LK-MOD-08 | AI Control Center | CIO, provost, teaching and learning | Institution band plus AI use tier | Policy, provider controls, approved sources, evaluation, governance | Include an allowance, cap or customer-managed model account | tested | [`app/src/lib/aiflags.test.ts`](../app/src/lib/aiflags.test.ts) — AI flags<br>[`app/src/lib/aikillswitch.test.ts`](../app/src/lib/aikillswitch.test.ts) — kill.ai_generation read by everything that generates<br>[`app/src/lib/governance/ai-lifecycle.ts`](../app/src/lib/governance/ai-lifecycle.ts) — the lifecycle gates<br>[`docs/operating-model/AI-ASSURANCE.md`](operating-model/AI-ASSURANCE.md) — the RMF matrix and the 800-1 checklist | Controls are data and flags; no institution-facing control screen, and no AI use tier is priced. |
| LK-MOD-09 | Institutional Control Plane | CIO, IT, security | Institution band | Audit and evidence, integration health, retention and consent, admin controls | Include core security, privacy and accessibility controls | building | [`app/src/lib/control-plane.ts`](../app/src/lib/control-plane.ts) — the control plane<br>[`app/src/lib/control-plane.test.ts`](../app/src/lib/control-plane.test.ts) — held<br>[`ops/operations-console/README.md`](../ops/operations-console/README.md) — the console’s controls as data before the console | No operations console screen (SEMESTER-OPERATING-SYSTEM.md: missing). |
| LK-MOD-10 | Interoperability Pack | CIO, IT | Per integration family or enterprise tier | SSO, SCIM, LTI, OneRoster, APIs, webhooks, data map, sync health | Custom integrations require a separate SOW | tested | [`supabase/identity-provisioning.check.sql`](../supabase/identity-provisioning.check.sql) — SSO and SCIM provisioning<br>[`app/src/lib/lti.test.ts`](../app/src/lib/lti.test.ts) — LTI 1.3<br>[`docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`](INTEGRATION-QUALITY-AND-RECONCILIATION.md) — reconciliation | No live exchange with any institution’s IdP or LMS; no per-family price. |
| LK-MOD-11 | Payments / Transactions | Campus operations | Transaction fee plus operating scope | Approved payments, ticketing, dues, receipts and reconciliation | Later-stage; processor compliance and policy required | held | [`docs/DECISION-LOG.md`](DECISION-LOG.md) — D-009: billing stays out | Out by decision. |
| LK-MOD-12 | Premium Support / Success | Institution | Fixed annual tier or a percentage of the subscription | Named CSM, priority support, office hours, health review, training | Do not promise 24/7 unless staffed and contracted | designed | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) — T1–T3<br>[`docs/PILOT-TO-ANNUAL-CONVERSION.md`](PILOT-TO-ANNUAL-CONVERSION.md) — the quarterly business review | One person; no tier can be staffed (SUP-002, SUP-003). |

### Starting bands

**Hypotheses to test through discovery, not published prices.** Beside each, what
the tree holds: the deal desk’s proposed minimums in [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts)
and the planned student plans in [`app/src/lib/plans.ts`](../app/src/lib/plans.ts). No institutional price exists.

| Scope | Annual software | One-time implementation | Motion | The tree |
| --- | --- | --- | --- | --- |
| Individual student | Free tier; $8–25/month paid | None | Product-led adoption | plans.ts: Free; Plus $7.99/mo or $59/yr; Pro $14.99/mo or $99/yr — planned, not on sale (D-009). |
| Department or program pilot | $10,000–30,000 | $5,000–20,000 | Paid pilot, defined cohort | DEAL_POLICY: minimum pilot ACV $15,000 and department $25,000, proposed; implementation floor $10,000. |
| Small institutional deployment | $30,000–90,000 | $15,000–75,000 | Foundation plus one or two modules | DEAL_POLICY: campus minimum $75,000, proposed. |
| Mid-market institution | $90,000–250,000 | $50,000–200,000 | Multiple modules, SSO, integration, enablement | No band. |
| Large or enterprise university | $250,000–750,000+ | $150,000–500,000+ | Multi-year platform agreement, governance, premium support | DEAL_POLICY: system minimum $200,000, proposed; multi-year discount 3%/year capped at 9%. |

### Price calculator inputs

No calculator exists. Each input, and the register that could feed it.

| Input | Source |
| --- | --- |
| Institution enrollment band | Not modelled; `tenant_plan` carries a tier name, not a band. |
| Covered population or active course enrollments | `PilotPlan.cohort`, free text. |
| Campuses or entities | ADR 0005: multi-campus scoping. |
| Enabled module set | Tenant flags (docs/FEATURE-FLAG-REGISTRY.md). |
| SSO, SCIM, LTI, OneRoster and API families | docs/INTEGRATION-PERMISSION-MATRIX.md. |
| Data migration volume and complexity | docs/DATA-MIGRATION-PLAN.md. |
| Content and source-directory readiness | docs/launch/CONTENT-READINESS-REGISTER.md. |
| AI model, allowance and expected AI volume | `allowance.ts` and `reserve_ai_budget`. |
| Storage and file-processing requirements | Not modelled. |
| Support tier and named-service requirements | docs/market-readiness/SUPPORT_PLAYBOOK.md tiers; none priced. |
| Implementation timeline and staffing | docs/operating-model/PILOT-TO-PRODUCTION.md phases. |
| Security, privacy, accessibility and compliance requirements | docs/market-readiness/PROCUREMENT_CHECKLIST.md. |
| Custom development scope | `deal-desk.ts` customWork, an approval only. |
| Contract length and payment terms | `deal-desk.ts` years; no payment terms. |

### Pricing guardrails

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-GUARD-01 | Foundation is not optional | Foundation is required for any institutional use. | building | [`supabase/migrations/20260928004730_tenant_plan.sql`](../supabase/migrations/20260928004730_tenant_plan.sql) — one current plan per school | No Foundation entitlement distinct from the plan. |
| LK-GUARD-02 | Core controls are not premium | Never price privacy, accessibility, export or security controls as add-ons. | tested | [`app/src/lib/plans.test.ts`](../app/src/lib/plans.test.ts) — ALWAYS_INCLUDED: export, delete, saved plans on every plan | Held for student plans only. |
| LK-GUARD-03 | No implementation discount without scope cut | Do not discount implementation unless scope is proportionally reduced. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — the fee floor is waived only as capped pilot credit<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held | Held by the deal desk. |
| LK-GUARD-04 | No unlimited AI at a fixed price | Never include unlimited AI usage without a cost cap. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — aiOverageDefined required<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held<br>[`supabase/migrations/20260924163000_intelligence_provider_runtime.sql`](../supabase/migrations/20260924163000_intelligence_provider_runtime.sql) — the tenant budget | Held by the deal desk and the tenant budget. |
| LK-GUARD-05 | No student data, audiences or targeting for sale | Never sell student data, advertising audiences or employer targeting. | tested | [`app/src/lib/gtm/sponsor.test.ts`](../app/src/lib/gtm/sponsor.test.ts) — held<br>[`supabase/gtm.check.sql`](../supabase/gtm.check.sql) — held in SQL | Held in code and in SQL. |
| LK-GUARD-06 | No module in contract language before it is owned | Do not promise a module until it has an owner, support model, tested controls and documented scope. | tested | [`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) — every public claim carries a register word and is refused above its floor<br>[`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — held<br>[`app/src/lib/gtm/rfp.test.ts`](../app/src/lib/gtm/rfp.test.ts) — an available claim without evidence is refused | Held for public claims and RFP answers; no contract template exists to hold. |
| LK-GUARD-07 | Pilots priced to cover real work | Price pilots to cover onboarding, support and learning, not merely hosting. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — minimum pilot ACV<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held | A proposed floor; no cost model behind it (maturity FO-09). |
| LK-GUARD-08 | No “free forever” | Refuse free-forever enterprise commitments. | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — freeForever → refused<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — held | Held by the deal desk. |

## 6. The higher-education go-to-market plan

**Market position.** Semester is the unified, source-aware, accessible, governed operating system for the full university journey. For students: Know what matters, what is official, what to do next, and who can help. For institutions: Connect existing systems and services into a secure, interoperable, measurable and student-centered experience without sacrificing institutional authority.

*The tree:* No category statement exists on main. The nearest is rfp.ts ES-1 — “a planning and experience layer over university life, not a system of record” — and the operating-system register lists Company strategy as missing.

### Ideal early customers

Read against [`docs/INSTITUTIONAL-GTM-PLAYBOOK.md`](INSTITUTIONAL-GTM-PLAYBOOK.md).

| Profile | In the playbook | Note |
| --- | --- | --- |
| Transfer-intensive institutions and transfer centers | yes | The playbook’s first profile. |
| Community colleges and regional public universities | yes | The playbook’s first profile. |
| Student-success and advising organizations | yes | The playbook’s third: a private college with a student-success champion. |
| Accessibility-forward institutions | **no** | Absent from the playbook. |
| Institutions with fragmented service and resource landscapes | **no** | Absent as a profile; the pain is the product’s premise. |
| Large gateway-course or academic-support programs | **no** | Absent. |
| Career and experiential-learning teams | yes | The playbook’s second: a career center, library or research office. |
| Institutions formalizing campus AI governance | **no** | Absent. |

### The buyer map

Each offer read against what the tree can show for it, and the buying-committee
role in [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) that names the buyer.

| Buyer | Pain | Message | Initial offer | Committee role | What the tree can show |
| --- | --- | --- | --- | --- | --- |
| VP / AVP Student Success | Students cannot find correct next actions or support | One source-aware student action layer | Academic Navigation / No Wrong Door pilot | `executive_sponsor` | The support directory and help routes are tested; “No Wrong Door” is not a named offer. |
| Transfer Center director | Transfer students lose time, context and confidence across systems | A transfer transition operating system with official-source routing | Transfer Hub pilot | **none** | Two of eight hub workflows are building; no hub screen exists (TRANSFER-TRANSITION-HUB.md). |
| CIO / CISO | Fragmented tools, shadow AI, integration and audit burden | A governed, standards-first, observable platform | Control-plane / AI governance discovery workshop | `cio` | Controls are data; no console screen. |
| Provost / Academic Affairs | Inconsistent learning support and course AI practice | Course-aware Study Studio, work completion, accessibility and policy | Learning / AI pilot | **none** | Study Studio and Course Studio are tested; course AI policy is a flag. |
| Student Affairs leader | Community, clubs, events and services are disconnected | A governed belonging and service-discovery layer | Student Life pilot | **none** | The communities register says which of the four blueprints is missing. |
| Career Services leader | Academic work is disconnected from workforce evidence | Skills evidence, portfolio, opportunities and student-controlled sharing | Career Pathways pilot | **none** | Career evidence and the skills graph are tested; no employer workflow. |

### The 180-day sequence

The tree’s plan is ninety days (`docs/90-DAY-LAUNCH-PROGRAM.md`); the third phase
has nothing to stand on until the first two have run.

#### Market and sales readiness — Days 1–30

tested 2 · building 2 · designed 2 · not-started 2 · held 0.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-P1-01 | Category narrative and messaging | Finalize the category, the ideal-customer profile and buyer-specific messaging. | designed | [`docs/INSTITUTIONAL-GTM-PLAYBOOK.md`](INSTITUTIONAL-GTM-PLAYBOOK.md) — ideal customer profile in order of fit; the buying committee<br>[`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — icp-cohort | No category statement; four of the kit’s eight profiles are absent. |
| LK-P1-02 | Public trust surfaces | Website, Trust Center, accessibility, AI transparency, system boundaries and a pilot landing page. | building | [`app/src/site/platform.ts`](../app/src/site/platform.ts) — BOUNDARIES at /platform/system-boundaries/<br>[`app/src/site/site.test.tsx`](../app/src/site/site.test.tsx) — the public pages render<br>[`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) — POLICIES: accessibility statement and AI-use policy not started | System boundaries, security, privacy, proof and launch-readiness pages exist; no public Trust Center, accessibility statement or AI transparency page. |
| LK-P1-03 | Synthetic demo tenant | A synthetic demonstration tenant and a guided demo script. | tested | [`app/src/data/institutional-preview.ts`](../app/src/data/institutional-preview.ts) — fictional tenants, every record synthetic<br>[`app/src/lib/institutional-preview.test.ts`](../app/src/lib/institutional-preview.test.ts) — held<br>[`app/src/lib/pagesdemo.test.ts`](../app/src/lib/pagesdemo.test.ts) — the /demo/ route | No guided script. |
| LK-P1-04 | Procurement room baseline | Security overview, DPA, privacy policy, subprocessor list, accessibility statement, AI policy, implementation outline. | tested | [`supabase/trust-room.check.sql`](../supabase/trust-room.check.sql) — NDA-first, commit-pinned, expiring grants: 51 checks<br>[`docs/market-readiness/PROCUREMENT_CHECKLIST.md`](market-readiness/PROCUREMENT_CHECKLIST.md) — what is in the packet and what is not | The room is built; the packet lacks a signed DPA, an ACR, insurance, HECVAT and SOC 2 (COM-003). |
| LK-P1-05 | Contract and proposal templates | Pilot agreement, order form, SOW, pricing calculator and proposal template. | designed | [`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) — the outline<br>[`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — charter-drafts | Outlines only; no calculator, no proposal template. |
| LK-P1-06 | Target account list | Fifty to a hundred institutions or programs. | not-started | [`docs/INSTITUTIONAL-GTM-PLAYBOOK.md`](INSTITUTIONAL-GTM-PLAYBOOK.md) — the profiles to target | No list; the `gtm_accounts` table is empty. |
| LK-P1-07 | Discovery interviews | Fifteen to twenty-five structured buyer-discovery interviews. | not-started | [`PILOT.md`](../PILOT.md) — twenty to thirty student willingness-to-pay interviews, planned | No buyer interview script or record; the student interviews are a different question. |
| LK-P1-08 | Design partners | Recruit three to five. | building | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — recruit-beta: institutional design partners<br>[`app/src/lib/governance/release-readiness.ts`](../app/src/lib/governance/release-readiness.ts) — the design_partner stage | No partner; no count. |

#### Sell and launch pilots — Days 31–90

tested 2 · building 3 · designed 2 · not-started 0 · held 0.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-P2-01 | One to three paid pilots | Convert qualified discovery into paid, bounded pilots. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — pilotReadiness<br>[`app/src/lib/gtm/stages.ts`](../app/src/lib/gtm/stages.ts) — sixteen sales stages with exit criteria<br>[`app/src/lib/gtm/stages.test.ts`](../app/src/lib/gtm/stages.test.ts) — held | No pilot has been sold. |
| LK-P2-02 | Readiness workshops | Implementation and readiness workshops with each pilot. | designed | [`docs/operating-model/PILOT-TO-PRODUCTION.md`](operating-model/PILOT-TO-PRODUCTION.md) — phase 0–1<br>[`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) — the playbook | Process on a page. |
| LK-P2-03 | Configure | Source content, roles, accessibility, AI policy and integrations. | tested | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — tenant-flags, identity, content-loaded<br>[`supabase/tenant-rollout.check.sql`](../supabase/tenant-rollout.check.sql) — the lifecycle gates | Never run for a real tenant. |
| LK-P2-04 | Train | Staff, faculty and advisors, student champions, support contacts. | building | [`app/src/lib/launch/checklists.ts`](../app/src/lib/launch/checklists.ts) — first-day checklists per role<br>[`docs/LAUNCH-CONTENT-AND-TRAINING.md`](LAUNCH-CONTENT-AND-TRAINING.md) — training content<br>[`docs/FACULTY-ENABLEMENT.md`](FACULTY-ENABLEMENT.md) — faculty enablement | No session has been given. |
| LK-P2-05 | Launch with hypercare | Communications, onboarding, office hours and hypercare. | building | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — launch-cohort, hypercare: a daily issue log for two weeks<br>[`docs/launch/ANNOUNCEMENT-TEMPLATES.md`](launch/ANNOUNCEMENT-TEMPLATES.md) — the announcements | No cohort has launched. |
| LK-P2-06 | Measure from day one | Activation, clarity, verified-resource discovery, support handoff, accessibility success, implementation effort, stakeholder value. | building | [`ANALYTICS.md`](../ANALYTICS.md) — the three figures, no cell under ten<br>[`app/src/lib/ops/firstyear.ts`](../app/src/lib/ops/firstyear.ts) — first-year measures<br>[`app/src/lib/gtm/kpi.ts`](../app/src/lib/gtm/kpi.ts) — KPI formulas with no rate for an empty cohort | No verified-resource-discovery or accessibility-success measure. |
| LK-P2-07 | Weekly reviews and a 30-day evidence report | Weekly pilot reviews; a 30-day evidence report to each customer. | designed | [`docs/90-DAY-LAUNCH-PROGRAM.md`](90-DAY-LAUNCH-PROGRAM.md) — reviews and escalation<br>[`docs/PROOF-CALENDAR.md`](PROOF-CALENDAR.md) — month by month, 0 of 19 artifacts filed | No report template. |

#### Turn pilots into repeatability — Days 91–180

tested 3 · building 0 · designed 1 · not-started 2 · held 0.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-P3-01 | Midpoint and final value reviews | Conduct them, and decide. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — midpointReviewDate; pilotVerdict<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held<br>[`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — midpoint-report | Nothing to review yet. |
| LK-P3-02 | Convert to annual contracts | With a modular expansion plan. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — convert or expand only signed and with no open high-severity issue<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held<br>[`docs/PILOT-TO-ANNUAL-CONVERSION.md`](PILOT-TO-ANNUAL-CONVERSION.md) — the decision meeting and the annual proposal | No contract to convert to. |
| LK-P3-03 | Standardize implementation | Templates, integration patterns, defaults, training, runbooks, evidence reports. | designed | [`docs/operating-model/PILOT-TO-PRODUCTION.md`](operating-model/PILOT-TO-PRODUCTION.md) — the method<br>[`docs/RUNBOOKS.md`](RUNBOOKS.md) — the runbook index | Nothing has been run once, so nothing is standardized from experience. |
| LK-P3-04 | References only when verified | Case-study approval only with verified results. | tested | [`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) — PROOF_RULES<br>[`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — held | Held in code. |
| LK-P3-05 | Practitioner resources | Academic Friction diagnostic, Transfer Navigation Playbook, Accessible Learning Toolkit, Campus AI Governance Canvas. | not-started | [`docs/SERVICE-EXPANSION-REGISTER.md`](SERVICE-EXPANSION-REGISTER.md) — S26: the Academic Friction Index and the interoperability model, unchecked | None exists. |
| LK-P3-06 | Partner relationships | Higher-ed consultants, accessibility specialists, integrators, standards communities. | not-started | [`docs/INSTITUTIONAL-GTM-PLAYBOOK.md`](INSTITUTIONAL-GTM-PLAYBOOK.md) — the playbook names no partner channel | None exists. |

### Channels

| Channel | Purpose | First action | The tree |
| --- | --- | --- | --- |
| Founder-led outbound | Find and learn from high-fit buyers | A personalized message about transfer, navigation, governed AI or accessibility friction | Nothing; the `target_account` stage exists and no account is in it. |
| LinkedIn | Executive credibility and distribution | Weekly evidence-led posts, short workflow videos, research findings | Nothing. |
| Website and SEO | Convert intent and build trust | Audience pages, Trust Center, pilot call to action, synthetic demo, procurement library | Audience pages, /demo/, /proof/ and the trust room exist (docs/PUBLIC-SITE.md); no public Trust Center. |
| Webinars and clinics | Demonstrate expertise before the sale | Transfer navigation, accessible assessment, campus AI governance, service-content operations | Nothing. `gtm/manager.ts` CHANNELS are a school’s enrollment channels, not Semester’s. |
| Conferences and associations | Reach qualified networks | EDUCAUSE, 1EdTech, NACADA, NASPA, transfer, community-college, accessibility and career communities | Nothing; 1EdTech appears only as a standards reference. |
| Student product-led growth | Create real end-user demand | Free personal planning and study value, clearly non-official, with a privacy boundary | /signup/ starts free with no card; four free public tools at /tools/; the ambassador programme is still to build (EXECUTION-PLAN #8). |
| Partnerships | Extend reach and implementation capacity | Consultants, accessibility partners, integrators, associations | Nothing. |

### The sales process, on the sixteen stages

Each of the kit’s thirteen steps, and the stage in [`app/src/lib/gtm/stages.ts`](../app/src/lib/gtm/stages.ts) it enters, or none.

| Step | Stage |
| --- | --- |
| Target account | `target_account` |
| Personalized problem hypothesis | **none** |
| Discovery meeting | `discovery` |
| Workflow, stakeholder and current-stack map | `qualified` |
| Tailored synthetic demo | `multi_stakeholder_demo` |
| Security, accessibility, AI and integration qualification | `technical_review` |
| Paid-pilot design workshop | `outcome_workshop` |
| Proposal and procurement room | `procurement_legal` |
| Contract | `contracted` |
| Implementation readiness | `implementation` |
| Pilot launch | `live` |
| Midpoint value review | **none** |
| Annual conversion and module expansion | `expansion` |

### Pipeline metrics

Seventeen metrics; 9 have no source at all.

| Metric | Where a figure would come from |
| --- | --- |
| Target accounts contacted | **nowhere** |
| Positive-response rate | **nowhere** |
| Discovery meetings | **nowhere** |
| Qualified opportunities | gtm_accounts rows past `qualified` |
| Pilot-design workshops | **nowhere** |
| Pilot proposals | gtm_accounts rows at `proposal` |
| Pilot win rate | **nowhere** |
| Sales cycle length | **nowhere** |
| Pilot implementation duration | gtm_pilots start and end |
| Pilot activation rate | ANALYTICS.md activation, aggregate only |
| Pilot-to-annual conversion | gtm_pilot_outcomes decisions |
| Annual contract value | ops/firstyear.ts ARR |
| Implementation margin | **nowhere** |
| Gross margin by tenant and module | ops/firstyear.ts gross margin; maturity FO-01 allocation owed |
| Expansion pipeline | **nowhere** |
| Renewal rate | gtm/kpi.ts netRevenueRetention |
| Reference and case-study permission rate | **nowhere** |

## 7. The Product Governance Council charter

The Semester Product Governance Council ensures that every enabled platform capability advances Semester’s mission — a unified, accessible, source-aware, privacy-respecting, interoperable university operating system — while balancing student value, institutional authority, security, privacy, accessibility, AI safety, operational reliability, commercial viability and evidence-based claims.

No council by this name exists. Its accountabilities are already the launch
readiness council’s seats ([`docs/LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md)), every one
vacant; the AI governance board and the portfolio council have charters and no
members. This section holds the charter to those, so that forming one council
means filling seats that already exist rather than drafting a fourth charter.

### Scope

- New platform modules and material features
- High-risk data uses and integrations
- AI models, providers, policies, evaluations and tool actions
- Assessment, grading, integrity and student-record workflows
- Accessibility requirements, known limitations and remediation priorities
- Community, mentoring, moderation, safety and sensitive-support workflows
- Identity, permissions, sharing, retention, deletion and export behaviour
- Institutional configuration and multi-tenant product behaviour
- Major release approval and customer-impacting change
- External product claims, certifications, plan commitments and launch materials

### Principles

- Student agency and dignity
- Institutional authority for official decisions
- Accessibility as core quality
- Source, Scope and Status for material information and recommendations
- Minimum necessary data and privacy by design
- Security and resilience by design
- Human accountability for high-impact outcomes
- Standards-first interoperability and portability
- Evidence before public claim
- One coherent platform, not disconnected tools
- Modular activation with shared foundations
- No dark patterns, hidden surveillance or sale of student data

### Membership, on the seats

| Role | Decides | Seat | Note |
| --- | --- | --- | --- |
| Council chair / product executive | Agenda, prioritization, product strategy, the decision record | `founder` | The founder seat decides risk acceptance and holds the decision log. |
| Engineering leader | Architecture, delivery feasibility, resilience, technical debt | `engineering` |  |
| Security lead | Security risk, access, incidents, supplier requirements | `security` |  |
| Privacy / legal lead | Data use, contracts, FERPA, retention, legal holds | `privacy` |  |
| Accessibility lead | WCAG, ACR/VPAT, disabled-user impact, remediation gates | `accessibility` |  |
| AI governance lead | Models and providers, evaluations, policy, high-risk uses, misuse controls | `trust` | The trust seat chairs the AI governance board. |
| Customer success / implementation lead | Deployability, training, support, customer outcome and change impact | `success` |  |
| Design / research lead | User experience, usability, student, faculty and staff evidence | `product` | Folded into the product seat. |
| Institutional advisory representative | Higher-ed workflow and authority perspective | `champion` | The champion seat must be held at the institution, not at Semester. |
| Student advisory representative | Student clarity, agency, accessibility and lived experience | **none** | No seat. The nearest is the customer advisory board in RISK-GOVERNANCE.md, with no members. |
| Finance / commercial representative | Pricing, entitlement, margin, contract impact | `finance` | The eleventh seat, added on 29 September (D-118); vacant. The deal desk’s finance approver is this seat. |
| Operations / SRE representative | Monitoring, supportability, incident readiness, release readiness | `operations` | The twelfth seat, added on 29 September (D-120); vacant. The master register’s SRE and Support sign-offs are this seat’s. |

### Decision rights

What must come to the council before release, each held to the gate that already asks: tested 8 · building 0 · designed 0 · not-started 0 · held 0.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-RIGHT-01 | New education-record processing | Any feature processing education-record PII or sensitive data in a new way. | tested | [`app/src/lib/governance/config-tiers.ts`](../app/src/lib/governance/config-tiers.ts) — TIER_REVIEWERS: privacy and security review the higher tiers<br>[`app/src/lib/governance/config-tiers.test.ts`](../app/src/lib/governance/config-tiers.test.ts) — held<br>[`app/src/lib/governance/module-privacy.ts`](../app/src/lib/governance/module-privacy.ts) — the launch gates | A reviewer role, not a sitting council. |
| LK-RIGHT-02 | New AI provider, model, tool action or training change | Approval before any of them. | tested | [`app/src/lib/governance/ai-lifecycle.ts`](../app/src/lib/governance/ai-lifecycle.ts) — the lifecycle gates and their evidence<br>[`app/src/lib/governance/ai-lifecycle.test.ts`](../app/src/lib/governance/ai-lifecycle.test.ts) — held<br>[`docs/operating-model/AI-GOVERNANCE-BOARD.md`](operating-model/AI-GOVERNANCE-BOARD.md) — responsibilities | The board has a charter and no members. |
| LK-RIGHT-03 | Grading, integrity, discipline, accommodation, basic-needs, payment, minors, moderation | Any feature touching these. | tested | [`app/src/lib/governance/risk.ts`](../app/src/lib/governance/risk.ts) — DECISION_QUESTIONS and DECISION_RULE: not clearly yes is not launch-ready<br>[`app/src/lib/governance/risk.test.ts`](../app/src/lib/governance/risk.test.ts) — held<br>[`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) — the seats and what each decides | Held as questions; no body sits. |
| LK-RIGHT-04 | New external integration or scope change | Approval before it. | tested | [`app/src/lib/governance/data-contracts.ts`](../app/src/lib/governance/data-contracts.ts) — a connector is chartered by its data contract<br>[`app/src/lib/governance/data-contracts.test.ts`](../app/src/lib/governance/data-contracts.test.ts) — held | Held in code. |
| LK-RIGHT-05 | Retention, sharing, access, export or deletion change | Approval before a material change. | tested | [`app/src/lib/retention.test.ts`](../app/src/lib/retention.test.ts) — RETENTION.md is held to the tables<br>[`app/src/lib/governance/config-tiers.ts`](../app/src/lib/governance/config-tiers.ts) — NEVER: settings no tenant may change | Held by tests, not by a meeting. |
| LK-RIGHT-06 | Critical accessibility, privacy, security or reliability impact | Any release with one. | tested | [`app/src/lib/governance/release-readiness.ts`](../app/src/lib/governance/release-readiness.ts) — promote(): a floor of 60 on every dimension, then the stage threshold<br>[`app/src/lib/governance/release-readiness.test.ts`](../app/src/lib/governance/release-readiness.test.ts) — held<br>[`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) — an open P0/P1 is NO-GO | Held in code. |
| LK-RIGHT-07 | Public claims | Any claim about certification, compliance, security, accessibility, AI safety, outcomes or interoperability. | tested | [`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) — a claim above its register floor fails the build<br>[`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — held | Held in code. |
| LK-RIGHT-08 | Exceptions to gates or thresholds | Any exception. | tested | [`app/src/lib/governance/risk.ts`](../app/src/lib/governance/risk.ts) — reviewException: at most 90 days; no P0 exception without executive, security and legal<br>[`app/src/lib/governance/risk.test.ts`](../app/src/lib/governance/risk.test.ts) — held | Held; zero exceptions open. |

### The decision packet

Each line beside the question or field the tree already asks — [`app/src/lib/governance/charters.ts`](../app/src/lib/governance/charters.ts),
the scope questions in [`app/src/lib/ops/operatingsystem.ts`](../app/src/lib/ops/operatingsystem.ts) that the pull-request template carries, and the gates.

| Packet line | Already asked by |
| --- | --- |
| Problem and target outcome | `charters.ts` problem, jobToBeDone; SCOPE_QUESTIONS “What student decision does it clarify?” |
| Users and affected stakeholders | `charters.ts` primaryUser |
| Customer or institutional owner | SCOPE_QUESTIONS “Who owns it?” |
| Scope and non-goals | `charters.ts` nonGoals; SCOPE_QUESTIONS “What does this replace?” |
| Workflow and user journey | **nothing** |
| Data inventory, classification, source, retention, sharing | `charters.ts` classification, sourceDependency; SCOPE_QUESTIONS “What data does it require?” |
| Permission and tenant-isolation model | ADR 0002: RLS is the authorization boundary |
| Source, Scope and Status behaviour | `source.ts` labels; `ops/claims.ts` register words |
| Accessibility requirements and test plan | `charters.ts` accessibilityAcceptance |
| Security threat model and control plan | **nothing** |
| AI model, provider, policy and evaluation plan | `ai-lifecycle.ts` gate evidence |
| Integration and data-map impact | `data-contracts.ts` |
| Operational support, runbook and incident plan | SCOPE_QUESTIONS “How is it supported?” “How does it fail?”; `charters.ts` owners.support, fallback |
| Commercial entitlement, pricing and implementation impact | `charters.ts` costModel; `deal-desk.ts` customWork |
| Success metrics, leading and lagging | `charters.ts` successMetrics |
| Known risks, residual risk, rollback and disable plan | SCOPE_QUESTIONS “How is it removed if it does not work?”; `charters.ts` killSwitch |
| Required evidence, approvals and release gates | `release-readiness.ts`; `quality-gates.ts` |

### Cadence

| When | The council does | The tree |
| --- | --- | --- |
| Weekly | Product and release readiness triage; risk review | OPERATING-RHYTHM.md weekly; LAUNCH-READINESS-COUNCIL.md weekly during a pilot |
| Monthly | Plan, customer evidence, AI and vendor changes, accessibility backlog, privacy and security findings, operational metrics, commercial impact | OPERATING-RHYTHM.md monthly |
| Quarterly | Risk appetite, policy review, incident learnings, audit evidence, standards progress, customer outcomes, strategy | OPERATING-RHYTHM.md quarterly; AI-GOVERNANCE-BOARD.md quarterly; TRUST-BRAND-AND-LEGAL.md policy review |

### Decision outcomes

| Outcome | The tree’s word for it |
| --- | --- |
| Approved | `governance_decisions.decision` build; `launchreadiness.decide()` GO; `gtm/pilot.ts` approved |
| Approved with required conditions | `launchreadiness.decide()` go-with-conditions: a founder-accepted P2/P3 with a reason, an expiry and a disclosure, listed on the verdict (D-117) |
| Pilot only | `governance_decisions.route` pilot; `release-readiness.ts` stage pilot |
| Deferred pending evidence | `governance_decisions.decision` defer |
| Rejected | `governance_decisions.decision` decline; `route` reject_or_redesign |
| Escalated for executive, legal or customer decision | `risk.ts` escalates(); `gtm/pilot.ts` blocked |

### Release blocks

tested 6 · building 2 · designed 0 · not-started 0 · held 0.

| ID | Item | The kit asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| LK-BLOCK-01 | Open P0/P1 | No release with an open P0/P1 security, privacy, accessibility, grade-integrity or reliability finding. | tested | [`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) — no-blockers: an open P0 or P1 is NO-GO and no acceptance waives it<br>[`app/src/lib/launchreadiness.test.ts`](../app/src/lib/launchreadiness.test.ts) — held | Held in code. |
| LK-BLOCK-02 | No owner or runbook | No release without named product, operational and support owners and a runbook. | tested | [`app/src/lib/governance/charters.ts`](../app/src/lib/governance/charters.ts) — owners and fallback on every charter<br>[`app/src/lib/governance/charters.test.ts`](../app/src/lib/governance/charters.test.ts) — an empty field fails | Owners are role labels; every seat is vacant, and the test cannot tell. |
| LK-BLOCK-03 | Undocumented data flow, permissions or retention | No release without them documented. | tested | [`app/src/lib/retention.test.ts`](../app/src/lib/retention.test.ts) — every table in RETENTION.md<br>[`app/src/lib/tablerls.test.ts`](../app/src/lib/tablerls.test.ts) — every table has RLS | Held in code. |
| LK-BLOCK-04 | Accessibility untested | No release without the required testing passed or an approved alternative. | building | [`docs/accessibility/AT-PASS-PROTOCOL.md`](accessibility/AT-PASS-PROTOCOL.md) — the assistive-technology pass<br>[`app/src/lib/governance/release-readiness.ts`](../app/src/lib/governance/release-readiness.ts) — accessibility is a scored dimension with a floor | No human AT pass has been run; the axe suite is automated only. |
| LK-BLOCK-05 | AI evaluation or provider approval incomplete | No release of AI capability without them. | tested | [`app/src/lib/governance/ai-assurance.ts`](../app/src/lib/governance/ai-assurance.ts) — RELEASE_GATE<br>[`app/src/lib/governance/ai-assurance.test.ts`](../app/src/lib/governance/ai-assurance.test.ts) — held | Four gate lines are carried by nothing (AI-ASSURANCE.md). |
| LK-BLOCK-06 | Integration untested in a sandbox | No integration release without sandbox validation. | building | [`docs/SYNC-SIMULATION-SANDBOX.md`](SYNC-SIMULATION-SANDBOX.md) — the sandbox<br>[`app/src/lib/governance/rollout.ts`](../app/src/lib/governance/rollout.ts) — the pilot-to-production tracker | Designed; no sandbox run recorded. |
| LK-BLOCK-07 | Communications, documentation, pricing or entitlement absent | No release without them. | tested | [`app/src/lib/launch/content.ts`](../app/src/lib/launch/content.ts) — content readiness per item<br>[`app/src/lib/launch/content.test.ts`](../app/src/lib/launch/content.test.ts) — held | Pricing and entitlement are not part of the content gate. |
| LK-BLOCK-08 | Rollback untested for high-risk capability | No high-risk release without a tested disable. | tested | [`app/src/lib/aikillswitch.test.ts`](../app/src/lib/aikillswitch.test.ts) — the kill switch is read by everything that generates<br>[`app/src/lib/rollback.test.ts`](../app/src/lib/rollback.test.ts) — rollback<br>[`ROLLBACK.md`](../ROLLBACK.md) — the procedure | The flags rollback has not been run against production (LAUNCH-DECISIONS item 10). |

### Records the council keeps

| Record | Where it lives | Standing |
| --- | --- | --- |
| Decision records | docs/DECISION-LOG.md (D-001 onward); `governance_decisions`, append-only | current |
| Risk and exception register | docs/operating-model/RISK-GOVERNANCE.md, rendered from `risk.ts`; exceptions: none open | current |
| AI inventory and change log | `ai-training-policy.ts` PROVIDER_INVENTORY; no per-use-case inventory | partial |
| Accessibility issue and remediation register | docs/WCAG-UI-AUDIT-SCORECARD.md; no remediation register | partial |
| Security and privacy evidence register | docs/PROOF-CALENDAR.md: 0 of 19 artifacts filed; docs/evidence/ does not exist | missing |
| Customer-impact release log | CHANGELOG.md; role-based release notes designed | partial |
| Public Trust Center updates | No public Trust Center | missing |

## 8. The first thirty days

The kit’s checklist, each beside the ninety-day task in [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts)
or the owner decision in [`docs/LAUNCH-DECISIONS.md`](LAUNCH-DECISIONS.md) that carries it.

| Item | Carried by | Where it stands |
| --- | --- | --- |
| Select the entity path with counsel and a CPA | LAUNCH-DECISIONS item 4 | Done as an LLC by attestation; counsel not named. |
| Form the entity, banking, accounting, founder IP assignment, cap table, contracting authority | LAUNCH-DECISIONS items 4–5 | Entity attested; the rest not recorded. |
| Engage a broker; bind CGL, cyber and technology E&O | **nothing** | No broker; HECVAT COMP-03 records no policy. |
| Finalize the pilot agreement package and legal review | ninety-day charter-drafts | Outline only. |
| Finalize the Foundation, modules, implementation and support entitlement model | **nothing** | COM-002: no packages defined. |
| Set pilot and annual price floors and a discount approval workflow | `deal-desk.ts` DEAL_POLICY | Proposed defaults awaiting finance. |
| Form the Product Governance Council and assign interim owners | LAUNCH-DECISIONS item 1 | Every seat vacant. |
| Build the procurement room and the synthetic demo tenant | trust room; institutional-preview | Both built. |
| Build the first 50–100 account list | **nothing** | None. |
| Conduct 15–25 discovery conversations | **nothing** | None. |
| Recruit 3–5 design partners and sell the first paid pilot | ninety-day recruit-beta, sign-pilot | None yet. |
| Weekly pipeline, product-risk, customer-readiness and financial review | OPERATING-RHYTHM.md weekly | Scheduled; no record of one held. |

## 9. The operating principle

- Semester sells a unified platform.
- Pilots prove connected outcomes.
- Annual contracts activate modules in governed waves.
- Implementation is repeatable, paid and evidence-led.
- Governance protects the student, the institution and the company.
- Trust, accessibility, interoperability and operational reliability are product features, not marketing claims.

What it takes to make all of this operate — owners, verification, failure
testing, support, implementation capacity, revenue operations and the go-live
dossier — is [`docs/OPERATIONAL-REALITY-REGISTER.md`](OPERATIONAL-REALITY-REGISTER.md).
