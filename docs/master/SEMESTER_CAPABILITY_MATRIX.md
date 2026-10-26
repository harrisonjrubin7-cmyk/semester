# Semester capability matrix

<!-- Rendered from docs/master/tools/domains.py by docs/master/tools/render.py. Edit the data, then run `python3 docs/master/tools/render.py` from the repository root. -->

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** Everything here is a reading of the repository at origin/main 790ebbf on 2026-10-05, from read-only audits. Nothing was run in production, and no row is evidence of an activated tenant, a customer, or an approved claim. "Verified" means held by an automated test in this repository. It does not mean operating, supported, secure, accessible or approved. The repository's own registers hold the same ceiling ([`PRODUCT-STATUS-MAP.md`](../PRODUCT-STATUS-MAP.md), [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)).

## How a capability is classified

The brief asks for nineteen labels. They are not one scale, so they are held on three axes and a capability carries one label from each of the first and third, and any number from the second.

| Axis | Question | Values |
| --- | --- | --- |
| A. Maturity | What is built? | Not started; Planned; Designed/documented; Native but incomplete; Native and verified; Integrated; Transitional; Pilot-only |
| B. Review gates | What review is owed and not evidenced? | Security; Privacy/legal; Accessibility; Institutional approval; Migration; Reconciliation; Rollback |
| C. Readiness | May it be switched on? | Unsafe to activate; Not ready; Conditional (invitation-only individual validation); Ready for pilot; Ready for production; Ready to become authoritative system of record |

### Mapping to the repository's own ladders

| This matrix | `replaceregister.ts` ladder | Activation register | Master Launch Readiness |
| --- | --- | --- | --- |
| Not started / Planned | not-started | L0 to L1 | not-started |
| Designed/documented | designed | L1 | designed |
| Native but incomplete | building (or tested for its best piece) | L2 | building |
| Native and verified (repo-level) | tested | L3 | tested |
| (nothing yet) | | L4 and above | evidenced, operational, launch-approved |

**Native and verified means held by an automated test in this repository and nothing more.** No domain is rated Native and verified in the first table below because every domain has an open gap its own register names; the label is defined so that it can be earned. Master register: 0 of 142 rows are `operational` or `launch-approved`, and one is `evidenced` (AI-012). "Integrated" means a working, tested connection to an external system exists; the only candidate (LTI 1.3) has zero registrations. "Pilot-only" means exercised only in a sandbox or a single live test.

### Readiness values, defined

| Value | Meaning | Domains today |
| --- | --- | --- |
| Unsafe to activate | A high-risk capability (money, records, grades, safety, family, identity, integration) whose activation profile is not complete. A flag must not be turned on for a tenant. | 11 |
| Not ready | Not approved for a tenant; no known harm in staying off. | 27 |
| Conditional: invitation-only individual validation | `GO-NO-GO-DECISION.md` motion 1 (CONDITIONAL GO / YELLOW): unpaid, invitation-only, device-local use. Not activated. | 2 |
| Ready for pilot | The pilot checklist in the replacement gates is complete for a named tenant, with a signed agreement and approved data scope. | 0 |
| Ready for production | Pilot exit criteria met, evidence current, support and rollback rehearsed. | 0 |
| Ready to become authoritative system of record | All 15 replaceability requirements tested, institutional authority, reconciliation, rollback. | 0 |

## Domain matrix

| ID | Domain | Maturity | Ladder | SEC | PRIV | A11Y | INST | MIG | REC | RBK | Readiness |
| --- | --- | --- | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| D01 | Student OS | Native but incomplete | tested | ● | ● | ● |  |  |  |  | Conditional: invitation-only individual validation |
| D02 | Workspace and productivity | Native but incomplete | tested | ● | ● | ● |  |  |  |  | Conditional: invitation-only individual validation |
| D03 | Path and degree planning | Native but incomplete + Transitional | building | ● | ● | ● | ● | ● | ● |  | Not ready |
| D04 | Course Studio and LMS | Native but incomplete + Integrated | building | ● | ● | ● | ● | ● | ● | ● | Unsafe to activate |
| D05 | Learning evidence, assessment and gradebook | Native but incomplete | building | ● | ● | ● | ● |  | ● | ● | Unsafe to activate |
| D06 | AI gateway and copilot | Native but incomplete | tested | ● | ● | ● | ● |  |  |  | Not ready |
| D07 | Search and knowledge graph | Native but incomplete | building | ● | ● | ● |  |  |  |  | Not ready |
| D08 | Faculty experience | Designed/documented + Native but incomplete | building | ● | ● | ● | ● |  |  |  | Not ready |
| D09 | Advisor and student success | Native but incomplete + Pilot-only | building | ● | ● | ● | ● |  |  |  | Not ready |
| D10 | Registrar and academic operations | Transitional + Native but incomplete | building | ● | ● | ● | ● | ● | ● | ● | Unsafe to activate |
| D11 | Academic records and grade ledger | Native but incomplete | building | ● | ● | ● | ● | ● | ● | ● | Unsafe to activate |
| D12 | Registration and enrollment | Native but incomplete | building | ● | ● | ● | ● | ● | ● | ● | Unsafe to activate |
| D13 | Student finance, accounts and payment plans | Native but incomplete + Transitional | building | ● | ● | ● | ● | ● | ● | ● | Unsafe to activate |
| D14 | Financial aid and scholarship handoffs | Transitional | building | ● | ● | ● | ● |  |  |  | Not ready |
| D15 | Campus life and services | Native but incomplete + Transitional | building | ● | ● | ● | ● |  |  |  | Not ready |
| D16 | Housing | Transitional + Pilot-only | building | ● | ● | ● | ● |  |  |  | Not ready |
| D17 | Dining | Native but incomplete | tested | ● | ● | ● | ● |  |  |  | Not ready |
| D18 | Events | Native but incomplete | building | ● | ● | ● | ● |  |  |  | Not ready |
| D19 | Community and organizations | Native but incomplete | tested | ● | ● | ● | ● |  |  |  | Unsafe to activate |
| D20 | Accessibility services | Designed/documented | designed | ● | ● | ● | ● |  |  |  | Not ready |
| D21 | Safety and emergency handoffs | Native but incomplete | tested | ● | ● | ● | ● |  |  |  | Unsafe to activate |
| D22 | Library and research | Native but incomplete | building | ● | ● | ● | ● |  |  |  | Not ready |
| D23 | Career, employer and alumni | Native but incomplete + Pilot-only | building | ● | ● | ● | ● |  |  |  | Not ready |
| D24 | Family and guardian grants | Native but incomplete | tested | ● | ● | ● | ● |  |  |  | Unsafe to activate |
| D25 | Institutional governance and configuration | Native but incomplete | tested | ● | ● | ● | ● |  |  |  | Not ready |
| D26 | Identity, SSO and SCIM | Native but incomplete | building | ● | ● | ● | ● | ● |  |  | Unsafe to activate |
| D27 | Integrations, LTI, OneRoster and Edu-API | Native but incomplete + Integrated | building | ● | ● |  | ● | ● | ● |  | Unsafe to activate |
| D28 | Privacy, retention and legal holds | Native but incomplete | tested | ● | ● |  | ● |  |  |  | Not ready |
| D29 | Security, audit and incident response | Native but incomplete | tested | ● | ● |  |  |  |  |  | Not ready |
| D30 | Trust, compliance and HECVAT | Designed/documented + Native but incomplete | building | ● | ● | ● | ● |  |  |  | Not ready |
| D31 | Operations Command Center | Native but incomplete | tested | ● | ● | ● |  |  |  |  | Not ready |
| D32 | Commercial, billing and customer success | Pilot-only + Native but incomplete | building | ● | ● |  | ● |  |  |  | Not ready |
| D33 | Marketing, sales and the company site | Native but incomplete | tested | ● | ● | ● |  |  |  |  | Not ready |
| D34 | Developer platform | Native but incomplete | building | ● |  |  |  |  |  |  | Not ready |
| D35 | Marketplace and partners | Not started + Designed/documented | designed | ● | ● |  | ● |  |  |  | Not ready |
| D36 | Data, analytics and outcomes | Native but incomplete | building | ● | ● | ● | ● |  |  |  | Not ready |
| D37 | Reliability, SLO and release operations | Designed/documented + Native but incomplete | building | ● |  |  |  |  |  | ● | Not ready |
| D38 | People, hiring and company operations | Designed/documented | designed |  |  |  |  |  |  |  | Not ready |
| D39 | Finance, runway and board reporting | Designed/documented | designed |  | ● |  |  |  |  |  | Not ready |
| D40 | Globalization, localization and accessibility expansion | Designed/documented | designed |  | ● | ● | ● |  |  |  | Not ready |

● = the review is required and no evidence of it exists in the repository. SEC, PRIV and A11Y are universal wherever their rule holds (security: every domain through D37; privacy: every domain that holds personal data; accessibility: every user-facing domain), because no independent security assessment (EXT-006), qualified accessibility evaluation (EXT-008) or counsel review (EXT-002, EXT-003) exists for any of them. INST, MIG, REC and RBK are domain-specific.

### Totals

| Maturity label | Domains carrying it |
| --- | ---: |
| Not started | 1 |
| Designed/documented | 8 |
| Planned | 0 |
| Native but incomplete | 33 |
| Native and verified (repo-level) | 0 |
| Integrated | 2 |
| Transitional | 6 |
| Pilot-only | 4 |

## Index by requested label

Every one of the nineteen labels in the brief, and the domains that carry it today.

| Label | Count | Domains |
| --- | ---: | --- |
| Native and verified | 0 | none |
| Native but incomplete | 33 | D01, D02, D03, D04, D05, D06, D07, D08, D09, D10, D11, D12, D13, D15, D17, D18, D19, D21, D22, D23, D24, D25, D26, D27, D28, D29, D30, D31, D32, D33, D34, D36, D37 |
| Integrated | 2 | D04, D27 |
| Transitional | 6 | D03, D10, D13, D14, D15, D16 |
| Pilot-only | 4 | D09, D16, D23, D32 |
| Designed/documented | 8 | D08, D20, D30, D35, D37, D38, D39, D40 |
| Planned | 0 | none |
| Not started | 1 | D35 |
| Requires security review | 37 | D01, D02, D03, D04, D05, D06, D07, D08, D09, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, D29, D30, D31, D32, D33, D34, D35, D36, D37 |
| Requires privacy/legal review | 37 | D01, D02, D03, D04, D05, D06, D07, D08, D09, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, D29, D30, D31, D32, D33, D35, D36, D39, D40 |
| Requires accessibility review | 31 | D01, D02, D03, D04, D05, D06, D07, D08, D09, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D30, D31, D33, D36, D40 |
| Requires institutional approval | 30 | D03, D04, D05, D06, D08, D09, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, D30, D32, D35, D36, D40 |
| Requires migration | 8 | D03, D04, D10, D11, D12, D13, D26, D27 |
| Requires reconciliation | 8 | D03, D04, D05, D10, D11, D12, D13, D27 |
| Requires rollback | 7 | D04, D05, D10, D11, D12, D13, D37 |
| Unsafe to activate | 11 | D04, D05, D10, D11, D12, D13, D19, D21, D24, D26, D27 |
| Ready for pilot | 0 | none |
| Ready for production | 0 | none |
| Ready to become authoritative system of record | 0 | none |

## Capability register (named capabilities)

Domain ratings are the lowest honest reading of their capabilities. The repository's row-level register is [`docs/program/CAPABILITY_TRACEABILITY_MATRIX.md`](../program/CAPABILITY_TRACEABILITY_MATRIX.md) (105 rows: 60 `CAP-001` to `CAP-060` plus 45 proposed). This table is the cross-domain view of the capabilities that decide the ratings above; it adds none that the audits did not read in code.

| Domain | Capability | Maturity | State and limit | Evidence |
| --- | --- | --- | --- | --- |
| D01 | Today / Action Center | Native but incomplete | Default-on with `VITE_TODAY_ACTION_CENTER=off` rollback; runs on device state and a seeded sample; no institution data | `app/src/lib/today-center.ts` |
| D01 | Source-freshness cards | Native but incomplete | Off (module.source_freshness_cards) | `app/src/lib/flags.ts` |
| D02 | Calendar (ICS publish and import) | Native but incomplete | Edge functions `calendar` and `fetchcal` built; capability-token URL | `supabase/functions/calendar/` |
| D02 | Tasks and notes | Native but incomplete | Device-first; sync optional | `app/src/domains/tasks` |
| D02 | Productivity service and API v1 | Native but incomplete | Real service with Postgres repository and OpenAPI; mounted at /api/productivity but off unless a deployment enables it | `app/server/productivity/` |
| D02 | Documents (Write, Sheet, Deck) | Native but incomplete | Office-format import/export tested; files IndexedDB-only, never synced | `app/src/lib/docx` |
| D02 | Mail | Native but incomplete | Drafts only; never sends | `app/src/lib/mailbox` |
| D02 | Offline sync engine | Native but incomplete | Package built; used only behind `offline_engine_tasks` (off) | `packages/offline-sync/` |
| D03 | Degree and graduation planning | Native but incomplete | Client logic over student-entered data; native catalog/audit row not-started | `app/src/lib/degree.ts` |
| D04 | Course Studio authoring | Native but incomplete | Flag `course_studio` off; offered only to designated faculty | `app/src/lib/coursestudio.ts` |
| D04 | LTI 1.3 tool (launch, deep link, AGS, NRPS) | Integrated | Code built; 0 platform registrations exist; Brightspace registration pending | `supabase/functions/lti/` |
| D05 | Gradebook ledger and passback | Native but incomplete | Off at every school; no preview, no stub | `app/src/lib/gradebook/` |
| D05 | QTI 3 import/export | Native but incomplete | Library and tests; no real faculty content migrated | `app/src/lib/assessment/qti.ts` |
| D06 | AI proxy with monthly cap | Native but incomplete | Built; shared Semester key blocked pending provider activation | `supabase/functions/claude/` |
| D06 | AI kill switch | Native but incomplete | One production drill 3 of 3 (2026-09-29); BYOK path bypasses it (F-04) | `docs/evidence/ai/` |
| D06 | AI injection red-team | Native but incomplete | 21 of 21 canaries held; one run, one model | `docs/evidence/ai/` |
| D06 | Institutional AI gateway endpoints | Native but incomplete | Routes exist; whether deployed is UNKNOWN-INVESTIGATE; answers 503 without sandbox | `app/server/institution/intelligence.ts` |
| D07 | Client-side search | Native but incomplete | Over registry, guide and own data; no server index | `app/src/lib/find.ts` |
| D09 | Advisor meeting mode and shares | Native but incomplete | Flag off; shares and events tables built | `app/src/components/AdvisorMeeting.tsx` |
| D10 | Registrar bridge | Transitional | Clipboard-style handoff by design | `app/src/lib/registrar.ts` |
| D11 | Academic record ledger | Native but incomplete | Staff-side, flag off; states it is not an official transcript | `app/src/lib/record/ledger.ts` |
| D12 | Registration transaction | Native but incomplete | Closed at every school; sandbox demo only | `app/src/lib/enrollment/` |
| D12 | Registration-day planner | Native but incomplete | Device-only; flag off | `app/src/lib/registration-day.ts` |
| D13 | Student accounts ledger | Native but incomplete | Built; no payment-provider connection; nothing sent to students | `app/src/lib/finance/accounts.ts` |
| D13 | Individual subscription (Stripe) | Pilot-only | One live $7.99 monthly checkout and cancel executed 2026-10-03; checkout held off by flag | `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` |
| D14 | Aid checklist and handoff | Transitional | Tracker never computes eligibility | `app/src/screens/Opportunities.tsx` |
| D16 | Housing status and handoff | Pilot-only | Sandbox adapter only | `app/server/institution/housing.ts` |
| D17 | Dining service and ledger | Native but incomplete | Behind module.dining; ordering needs a live partner | `app/src/lib/dining/` |
| D19 | Community foundation (feed, circles, moderation) | Native but incomplete | Foundation flags follow preview; high-risk flags refuse production | `app/src/community/` |
| D19 | Volunteer moderation and scoped pseudonymity | Native but incomplete | High-risk; refused in production by design | `app/src/community/flags.ts` |
| D21 | Institutional safety escalation webhook | Native but incomplete | Signed, allow-listed, two-reviewer; off | `supabase/functions/_shared/escalation.ts` |
| D20 | Accommodation passports | Designed/documented | Schema and check suites; no institutional service in code | `supabase/migrations/` |
| D23 | Skills and portfolio | Native but incomplete | Self-reported claims labelled; no employer surface | `app/src/lib/career-evidence.ts` |
| D24 | Family grants and guardian links | Native but incomplete | High-risk activation profile; not activated | `app/src/lib/family.ts` |
| D25 | Configuration Studio, Workflow Builder | Native but incomplete | Staff-side, preview only | `app/src/components/institutional/` |
| D25 | Platform engines (policy, workflow, entitlements) | Native but incomplete | 13 test files; 0 importers from app/src or app/server; `decide()` has one non-test caller | `packages/platform/` |
| D26 | Membership-derived SSO binding | Native but incomplete | Migrations and gateway auth exist; no real IdP connected; SAML code not found outside docs (verify) | `app/server/institution/auth.ts` |
| D26 | SCIM 2.0 | Native but incomplete | Off unless SEMESTER_SCIM is set to on | `app/server/institution/scim.ts` |
| D27 | Integration control plane (scopes, sync, dead letter, drift) | Native but incomplete | Tables, worker and 15-minute tick built; adapter list is empty | `app/server/integration/` |
| D27 | OneRoster / Edu-API | Designed/documented | No client code found; a register concept | `docs/INTEROPERABILITY-ROADMAP.md` |
| D28 | Retention sweeps and legal holds | Native but incomplete | Schema and scheduled sweeps; schedule contents not reviewed | `supabase/scheduler.sql` |
| D28 | Account export and delete | Native but incomplete | Synthetic account exercised 2026-10-01 | `docs/launch/2026-10-01-production-availability.md` |
| D29 | Row-level security | Native but incomplete | Enabled on all 354 objects; forced on none; 33 public and 28 private tables have no policy | `database/TENANT_ISOLATION_MATRIX.md` |
| D29 | Audit log and hash-chained ledgers | Native but incomplete | Tables built; not yet tamper-evident across all audit tables (F-10) | `supabase/migrations/` |
| D30 | Trust room | Native but incomplete | Edge function and private bucket; no customer | `supabase/functions/trust-room/` |
| D31 | Operations console | Native but incomplete | MFA step-up; one operator | `app/src/screens/Console.tsx` |
| D32 | Institutional billing | Designed/documented | DOCUMENTED-UNIMPLEMENTED in the baseline audit | `docs/program/BASELINE_AUDIT.md` |
| D33 | Company site | Native but incomplete | Static; deployed revision unverified; 15 statements over evidence | `company-site/` |
| D34 | Productivity OpenAPI contract | Native but incomplete | The only published API contract | `docs/api/productivity.v1.openapi.json` |
| D35 | Marketplace | Not started | Governance documents only | `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md` |
| D37 | Production restore | Not started | Never done; only a logical rehearsal on a throwaway database | `docs/evidence/restore/2026-09-30-logical-rehearsal.md` |
| D37 | Terraform and drift detection | Designed/documented | Written; nothing applied; drift reports NOT CHECKED | `infra/README.md` |

## Known disagreements between the repository's registers

These were found while building this matrix and are not resolved here. Each is a decision for the owner of the named register, or a measurement to take.

| # | Disagreement | Where | Likely resolution |
| ---: | --- | --- | --- |
| 1 | All 60 capabilities read `verified` and L3, while runtime exposure shows 0 `live`, 0 `pilot`, 49 `early_access`, 11 `institution_controlled` | `PRODUCT-STATUS-MAP.md`, `docs/product/capability-inventory.md`, baseline audit R-029 | The status map's value is a register value, not a production check; read it as repository maturity only |
| 2 | Activation register: 22 standard, 33 controlled, 5 high-risk. Status map: 44 standard, 11 controlled, 5 high-risk | `CAPABILITY-ACTIVATION-REGISTER.md`, `PRODUCT-STATUS-MAP.md` | One is stale; regenerate both with `npm run registers` and compare |
| 3 | Student-portal row says the five-destination shell is flagged off; `experience-flags.ts` makes `journeyNavigation` default to production | `DOMAIN-REPLACEMENT-REGISTER.md`, `app/src/lib/experience-flags.ts:90` | Register row is stale |
| 4 | Council seats: seven held (launchreadiness.ts) vs four held (council doc); the security seat is vacant in `COUNCIL` but the owner matrix names the founder as security primary | `launchreadiness.ts`, `LAUNCH-READINESS-COUNCIL.md`, `OWNER-AND-ACCOUNTABILITY-MATRIX.md` | RAID-I02; holding a seat is not signing |
| 5 | Replacement register says SAML only (no OIDC); the code audit found no SAML protocol code outside docs and registers | `DOMAIN-REPLACEMENT-REGISTER.md`, code | Possibly Supabase Auth carries SAML; verify and record in `docs/evidence/` |
| 6 | Subprocessor register says Stripe is not active until keys are set; the live acceptance record shows live-mode keys were used on 2026-10-03 | `SUBPROCESSORS.md`, `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` | Update the register |
| 7 | `docs/launch/2026-10-01-production-availability.md` records "owner confirmed legal and independent reviews complete"; later documents treat all of them as OPEN | that file, `EXTERNAL-EVIDENCE-QUEUE.md` | The note supplies no report; the queue is correct |
| 8 | The truth table says `docs/evidence/` does not exist; it now does | `FEATURE-TRUTH-TABLE.md` | Update the truth table |
| 9 | Domain replacement register's per-section row totals do not sum to the printed total (95) | `DOMAIN-REPLACEMENT-REGISTER.md` | Reconcile against `replaceregister.ts` |
| 10 | `database/README.md` says 106 check suites; there are 111 `supabase/*.check.sql` files | `database/README.md` | Update the count |
