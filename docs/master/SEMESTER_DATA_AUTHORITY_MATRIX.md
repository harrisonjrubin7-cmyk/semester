# Semester data authority matrix

<!-- Rendered from docs/master/tools/domains.py by docs/master/tools/render.py. Edit the data, then run `python3 docs/master/tools/render.py` from the repository root. -->

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** Everything here is a reading of the repository at origin/main 790ebbf on 2026-10-05, from read-only audits. Nothing was run in production, and no row is evidence of an activated tenant, a customer, or an approved claim. "Verified" means held by an automated test in this repository. It does not mean operating, supported, secure, accessible or approved. The repository's own registers hold the same ceiling ([`PRODUCT-STATUS-MAP.md`](../PRODUCT-STATUS-MAP.md), [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)).

## The rule

> A fact has exactly one authoritative holder per tenant per domain. Every surface says who, and says how fresh. A native Semester record becomes authoritative for an institution's data only by passing the replacement gates and a signed change record. It never becomes authoritative because it is convenient.

Where the repository already states precedence, this matrix uses it: `docs/platform/PRIMITIVES.md` (integration source precedence: institution, then connected, then imported, then native, then AI), `docs/architecture/data-architecture/02-source-of-truth-matrix.md` (which says "precedence is a label, not a rule"), and the seven source states in `app/src/lib/source.ts` and `app/src/lib/integration/freshness.ts` (Institution verified, Imported, Student entered, Estimated, Needs review, Stale, Unavailable).

### Authority classes

| Class | Meaning |
| --- | --- |
| S | Semester is the system of record today, for data it owns: student-owned content, consent, its own audit, usage, tenant configuration, subscriptions |
| X | An external system is the record. Semester reads, plans, explains and hands off. A native candidate may exist but is not authoritative |
| S+X | Split: Semester holds the student-owned part, an external system holds the official part |
| C | Company-internal; no student or institution data |

### Eight things a surface must never blur

From the brief and the platform constitution. Every screen labels which of these a value is.

| Kind | Authority | Example |
| --- | --- | --- |
| Official record | Institution | A grade, a transcript, an enrolment |
| Guidance | Institution or faculty | A policy page, course guidance |
| Recommendation | Semester logic, explained | A suggested next step |
| Student-owned content | Student | A note, a plan |
| Institutional content | Institution | A syllabus the institution published |
| External source | Third party | A calendar feed, a public page |
| AI-generated content | Never authoritative | A summary, a draft |
| Community-generated content | Authors, under moderation | A post |

## Domain authority

| ID | Domain | Class | Holder today | Native target | Replacement authority needed |
| --- | --- | :-: | --- | --- | --- |
| D01 | Student OS | S+X | Student device state with optional account sync; seeded sample semester by default. | Semester for student-owned planning data; official facts stay with the institution and carry a source label. | None: not a replacement domain. |
| D02 | Workspace and productivity | S | Device (localStorage/IndexedDB); a real productivity service exists but is off unless a deployment enables it. | Semester (student-owned content). Mail and files stay device-local until a sync design is accepted. | None: not a replacement domain. |
| D03 | Path and degree planning | X | Institution degree-audit system (unconnected); student-entered data in Semester. | Semester for planning; the institution keeps the official audit until a catalog/rules engine passes the replacement gates (register: native row not-started). | Institution approves catalog and rule authoring; registrar signs the audit parity report; two-person approval for rule publication. |
| D04 | Course Studio and LMS | X | The institution's LMS (Canvas, Brightspace, Blackboard, Moodle); Semester holds guidance and rules only. | Semester for courses an institution moves to Course Studio; no course shell, roster, submission store or question bank exists yet. | LMS replacement for a course needs: faculty adoption sign-off, assessment/gradebook parity (D05), accessibility evaluation, records retention parity, rollback to LMS. |
| D05 | Learning evidence, assessment and gradebook | X | The LMS gradebook; the student's own arithmetic (device only). | Semester gradebook of record only after the gates in D11 and a term-boundary parallel run. | Institutional authority to hold the gradebook of record; registrar sign-off; immutable version history verified; passback reconciled for a full term. |
| D06 | AI gateway and copilot | S | Student-key (BYOK) and metered shared-key calls through an edge function; institutional gateway routes exist. | Semester (policy, audit, usage); model providers are subprocessors. | None: not a replacement domain. |
| D07 | Search and knowledge graph | S | Client-side search over the app registry, guide and the student's own data. | Semester index per tenant (no server index exists). | None: not a replacement domain. |
| D08 | Faculty experience | X | LMS and email. | Course Studio plus gradebook (D04, D05). | None: not a replacement domain. |
| D09 | Advisor and student success | X | Advising/CRM systems; appointment tools. | Semester for student-controlled shares and case workflow once an institution approves. | Office head approves case workflow; privacy review of notes retention. |
| D10 | Registrar and academic operations | X | SIS (Banner, PeopleSoft, Workday Student, Colleague). | Semester only after the gates in D11/D12; today a clipboard-style handoff. | Institution board or registrar authorises; effective-dated policy versioning; two-person approvals; reconciliation for two terms; rollback rehearsed. |
| D11 | Academic records and grade ledger | X | SIS. | Semester only for records an institution migrates and certifies; the code states it is not an official transcript and issues none. | All 15 replaceability requirements tested; institutional authority; legal review; reconciliation; rollback; named steward. |
| D12 | Registration and enrollment | X | SIS registration; Semester prepares a plan and hands off. | Semester registration transaction only after the gates; closed at every school today. | As D10 plus load evidence and a registrar-run rehearsal. |
| D13 | Student finance, accounts and payment plans | X | Bursar/ERP and a payment provider. | Ledger is built; nothing connects to a payment provider and nothing is sent to students. Raw card data is never stored. | Institutional finance authority; auditor review; reconciliation for a full term; payment-provider contract; rollback. |
| D14 | Financial aid and scholarship handoffs | X | Aid office systems. | Not started; the register says not to claim it until regulatory expertise exists. | Counsel; aid-office authority; regulator-aware controls. |
| D15 | Campus life and services | X | Many office systems. | Semester request routing; each office remains the record owner. | None: not a replacement domain. |
| D16 | Housing | X | Housing system. | Handoff now; native after gates. | Institution authority; partner contract. |
| D17 | Dining | X | Dining partner. | Semester ledger and service built behind module.dining; ordering needs a live partner connection. | Partner contract; institutional approval. |
| D18 | Events | X | Campus event systems; seed data. | Semester event listings; no event backend found. | None: not a replacement domain. |
| D19 | Community and organizations | S | Social platforms and org portals. | Semester (foundation built; high-risk parts refuse production). | None: not a replacement domain. |
| D20 | Accessibility services | X | Disability services case system. | Schema exists; no institutional service found in code. | Institution DS authority; legal review. |
| D21 | Safety and emergency handoffs | X | Institutional protocols. | Handoff only; Semester is never the emergency system. | Never replaces emergency response. |
| D22 | Library and research | X | Library systems. | Semester research workspace. | None: not a replacement domain. |
| D23 | Career, employer and alumni | S+X | Career services platforms. | Semester skills and portfolio; self-reported claims never appear as institution-verified. | None: not a replacement domain. |
| D24 | Family and guardian grants | S | None (new). | Semester (consent ledger). | None: not a replacement domain. |
| D25 | Institutional governance and configuration | S | Per-tool admin consoles. | Semester control plane (staff-side, off by default). | None: not a replacement domain. |
| D26 | Identity, SSO and SCIM | X | Supabase Auth plus school email-domain membership; the institution's IdP once connected. | Semester holds membership and grants; the institution's IdP stays the identity authority. | IdP replacement is not proposed: Semester integrates with the institution's identity provider. |
| D27 | Integrations, LTI, OneRoster and Edu-API | S | Institution systems. | Semester integration control plane; adapters wait on a design partner. ADAPTERS is empty; every service answers 503 unless the sandbox is on. | None: not a replacement domain. |
| D28 | Privacy, retention and legal holds | S | Per-system. | Semester for its own data; institution records follow institution policy. | None: not a replacement domain. |
| D29 | Security, audit and incident response | S | CI checks; one operator. | Semester. | None: not a replacement domain. |
| D30 | Trust, compliance and HECVAT | S | Drafts and readiness matrices. | Semester. | None: not a replacement domain. |
| D31 | Operations Command Center | S | Manual plus console. | Semester. | None: not a replacement domain. |
| D32 | Commercial, billing and customer success | S | One live $7.99 monthly checkout/cancel test; checkout held off by flag. | Semester with Stripe; institutional billing is documented-unimplemented. | None: not a replacement domain. |
| D33 | Marketing, sales and the company site | C | Static site; deployment revision unverified against repo. | Semester. | None: not a replacement domain. |
| D34 | Developer platform | S | One OpenAPI contract (productivity v1); four examples. | Semester. | None: not a replacement domain. |
| D35 | Marketplace and partners | S | None. | Not started; gated by D-1236 (G-OWN, G-DATA, G-TERMS, G-QUEUE). | None: not a replacement domain. |
| D36 | Data, analytics and outcomes | S | Staff studio works on pasted data on the device; no institutional data ships. | Semester. | None: not a replacement domain. |
| D37 | Reliability, SLO and release operations | C | CI gates; one operator; logical restore rehearsal only. | Semester. | None: not a replacement domain. |
| D38 | People, hiring and company operations | C | One person holds every seat; every backup unassigned; no advisor engaged. | n/a (company). | None: not a replacement domain. |
| D39 | Finance, runway and board reporting | C | Hypothesis model; opening cash $0 placeholder; no real runway number. | n/a | None: not a replacement domain. |
| D40 | Globalization, localization and accessibility expansion | C | English; accessibility features present, no external evaluation. | Semester. | None: not a replacement domain. |

Why each class was chosen:

- **D01** (S+X): Semester holds the student's own plan; institution facts are labelled imports.
- **D02** (S): Student-owned content.
- **D03** (X): Institution degree audit is official; Semester plan is an estimate.
- **D04** (X): LMS is the course record; Semester holds guidance and rules.
- **D05** (X): LMS gradebook is the grade record; native ledger is a candidate.
- **D06** (S): Semester owns policy, usage and audit; model providers process.
- **D07** (S): Index is derived; each object keeps its owner's authority.
- **D08** (X): LMS and institution for course records.
- **D09** (X): Advising system for case notes; Semester for student-controlled shares.
- **D10** (X): SIS.
- **D11** (X): SIS; native ledger is a candidate and is not a transcript.
- **D12** (X): SIS; native transaction closed.
- **D13** (X): Bursar/ERP and payment provider; native ledger is a candidate.
- **D14** (X): Aid office systems.
- **D15** (X): Each office.
- **D16** (X): Housing system.
- **D17** (X): Dining partner.
- **D18** (X): Campus event systems.
- **D19** (S): Semester holds community content and moderation records.
- **D20** (X): Disability services case system.
- **D21** (X): Institution's emergency protocol; Semester is never the system.
- **D22** (X): Library systems.
- **D23** (S+X): Student-owned evidence; institution-issued credentials are institution-authoritative.
- **D24** (S): Semester holds the consent ledger.
- **D25** (S): Semester holds tenant configuration.
- **D26** (X): Institution IdP is the identity authority; Semester holds membership and grants.
- **D27** (S): Semester holds connection metadata; each source keeps its data.
- **D28** (S): Semester holds its own retention and consent state.
- **D29** (S): Semester holds its own audit.
- **D30** (S): Semester holds its evidence; counsel and assessors hold their opinions.
- **D31** (S): Internal.
- **D32** (S): Semester holds individual subscriptions; institutions hold contracts.
- **D33** (C): Company-internal.
- **D34** (S): Contract and keys.
- **D35** (S): Not started.
- **D36** (S): Derived aggregates; sources keep authority.
- **D37** (C): Company-internal.
- **D38** (C): Company-internal.
- **D39** (C): Company-internal.
- **D40** (C): Company-internal.

## Class totals

- S: 15
- X: 18
- S+X: 2
- C: 5

No domain holds a native record that is authoritative for an institution's data. That is the honest state: the replacement register reads "Today: 0 of 14" domains replaceable.

## Authority transitions

A domain moves from X to Semester-authoritative for one tenant only through this sequence, every step evidenced under `docs/evidence/`:

1. Connect read-only; label every value with its source and freshness.
2. Import with lineage; reconcile (counts, checksums, field-level differences) until the exception queue is empty or explained.
3. Shadow-write in a sandbox; compare outcomes.
4. Dual-run one unit (a course, a window, a term) with the external system still authoritative.
5. Institution signs a change record; two people approve; effective date stated.
6. Cut over; keep the external system read-only for a rollback window.
7. Rehearse the rollback before step 5 and again after.

The generic procedure is [`SEMESTER_MIGRATION_FACTORY.md`](SEMESTER_MIGRATION_FACTORY.md). The gates are [`SEMESTER_DOMAIN_REPLACEMENT_GATES.md`](SEMESTER_DOMAIN_REPLACEMENT_GATES.md).
