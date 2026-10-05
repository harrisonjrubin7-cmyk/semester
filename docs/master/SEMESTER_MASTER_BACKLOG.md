# Semester master backlog

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** Everything here is a reading of the repository at origin/main 790ebbf on 2026-10-05, from read-only audits. Nothing was run in production, and no row is evidence of an activated tenant, a customer, or an approved claim. "Verified" means held by an automated test in this repository. It does not mean operating, supported, secure, accessible or approved. The repository's own registers hold the same ceiling ([`PRODUCT-STATUS-MAP.md`](../PRODUCT-STATUS-MAP.md), [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)).

## How to read this

One backlog for the company and the product. An item is **closed only by evidence**: a passing test in the path named, and a dated file under `docs/evidence/` that a person other than the author has read. An item with only a document closes nothing (`docs/program/05-ACCEPTANCE-AND-EVIDENCE.md`). It does not duplicate the existing sequenced lists; it links to them:

| Existing list | Holds |
| --- | --- |
| [`docs/program/PHASE_1_EXECUTION_BACKLOG.md`](../program/PHASE_1_EXECUTION_BACKLOG.md) | The ten Phase 1 steps (security, tenancy, recovery, platform spine); not started |
| [`docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md`](../finalization/EXTERNAL-EVIDENCE-QUEUE.md) | EXT-001 to EXT-018, items only an outside party can close; 0 of 18 closed |
| [`docs/decisions/DECISION_BACKLOG.md`](../decisions/DECISION_BACKLOG.md) | 25 proposed ADRs |
| [`docs/program/03-RAID.md`](../program/03-RAID.md) | Risks, assumptions, issues, outside dependencies, decisions awaiting an owner (PDR-01 to PDR-07) |
| [`CLAUDE-CODE-BACKLOG.md`](../CLAUDE-CODE-BACKLOG.md) | Engineering tasks queued for agents |

## Priorities

| Priority | Rule |
| --- | --- |
| P0 | Without it no claim, activation or further trust is defensible. Do before anything below |
| P1 | Needed to earn the first design-partner pilot |
| P2 | Needed once a pilot is signed |
| P3 | Deliberately deferred; the entry says what would change that |

## Rules for the backlog

1. **Evidence before breadth.** No new domain build starts while a P0 in security, recovery or tenancy is open, because every new surface multiplies the unproven isolation.
2. **Customer-led.** From P1, a domain build needs a named design partner who asked for it. The 15 domains with no customer are deferred, not cancelled.
3. **One owner, one reviewer.** A seat's holder cannot review their own item. Until X-06 closes, every review is a self-review and the item records that.
4. **No claim ahead of the row.** A public statement may not exceed the lowest of product state, evidence freshness, tenant activation and approval (`docs/PRODUCT-STATUS-MAP.md`).
5. **Smallest safe solution.** Prefer a handoff to a build; prefer a build to a platform; prefer a platform to a marketplace.

## Generated backlog

<!-- Rendered from docs/master/tools/domains.py by docs/master/tools/render.py. Edit the data, then run `python3 docs/master/tools/render.py` from the repository root. -->

Rendered from `domains.py` (each domain's `nxt` list) and the cross-cutting list in `render.py`. 72 items.

| Priority | Items |
| --- | ---: |
| P0 | 26 |
| P1 | 24 |
| P2 | 15 |
| P3 | 7 |

### P0: blocks any claim, any activation, or any further trust

| ID | Item | Owner seat | Closed when | Domain |
| --- | --- | --- | --- | --- |
| D04-1 | Register Semester as an LTI tool in one sandbox LMS and record a launch/grade passback run as evidence | `product` | Test in `supabase/*.check.sql (lti suites)` and an evidence file under `docs/evidence/` | D04 Course Studio and LMS |
| D06-1 | Route the BYOK path through the kill switch and add the regression test (finding F-04) | `engineering` | Test in `app/src/ai/*.test.ts` and an evidence file under `docs/evidence/` | D06 AI gateway and copilot |
| D06-2 | Enforce tenant AI policy before invocation on every route (ADR-0005; Phase 1 step 3) | `engineering` | Test in `app/src/ai/*.test.ts` and an evidence file under `docs/evidence/` | D06 AI gateway and copilot |
| D21-1 | No activation without a signed escalation agreement and a rehearsed handoff | `trust` | Test in `community crisis tests` and an evidence file under `docs/evidence/` | D21 Safety and emergency handoffs |
| D25-1 | Phase 1 step 8: adopt the policy gateway on ten sensitive actions | `product` | Test in `app/src/lib/governance/*.test.ts` and an evidence file under `docs/evidence/` | D25 Institutional governance and configuration |
| D26-1 | Phase 1 step 7: one membership-derived tenancy source (ADR-0002) | `security` | Test in `app/server/institution/*.test.ts` and an evidence file under `docs/evidence/` | D26 Identity, SSO and SCIM |
| D27-1 | Build the first read-only roster adapter (OneRoster CSV) end to end in the sandbox and stage it | `engineering` | Test in `app/src/lib/integration/*.test.ts` and an evidence file under `docs/evidence/` | D27 Integrations, LTI, OneRoster and Edu-API |
| D28-1 | Human review of the 354 table classes, starting with T3+ (data steward) | `privacy` | Test in `supabase retention/legal-hold check suites` and an evidence file under `docs/evidence/` | D28 Privacy, retention and legal holds |
| D29-1 | Write the cross-tenant negative suite per object class (risk R-001) | `security` | Test in `supabase/*.check.sql (111)` and an evidence file under `docs/evidence/` | D29 Security, audit and incident response |
| D29-2 | Alert delivery to a person with a test page (F-08) | `security` | Test in `supabase/*.check.sql (111)` and an evidence file under `docs/evidence/` | D29 Security, audit and incident response |
| D29-3 | Apply anon grant reduction (database/proposed/anon_grant_reduction.sql) after staging proof | `security` | Test in `supabase/*.check.sql (111)` and an evidence file under `docs/evidence/` | D29 Security, audit and incident response |
| D30-1 | Close or withdraw the 15 over-evidence public statements (C-01..C-15) | `trust` | Test in `app/src/lib/trust/*.test.ts` and an evidence file under `docs/evidence/` | D30 Trust, compliance and HECVAT |
| D33-1 | Fix or withdraw C-01..C-15 on the deployed site and record the live check | `founder` | Test in `app/src/lib/companysiteconversion.test.ts` and an evidence file under `docs/evidence/` | D33 Marketing, sales and the company site |
| D37-1 | Fix main CI red and apply the main ruleset (Phase 1 step 0a/0b) | `operations` | Test in `supabase/restore.sh in CI` and an evidence file under `docs/evidence/` | D37 Reliability, SLO and release operations |
| D37-2 | Run the restore drill into the second project and record the measured time (step 1) | `operations` | Test in `supabase/restore.sh in CI` and an evidence file under `docs/evidence/` | D37 Reliability, SLO and release operations |
| D38-1 | Name an independent reviewer and a backup for security, privacy and release | `founder` | Test in `app/src/lib/launchreadiness.test.ts` and an evidence file under `docs/evidence/` | D38 People, hiring and company operations |
| D39-1 | Enter real cash and costs into 13-REAL-NUMBERS-INTAKE.md | `finance` | Test in `docs/finance/tools parity checks` and an evidence file under `docs/evidence/` | D39 Finance, runway and board reporting |
| X-01 | Fix `main` CI red (stale generated counts after merges; load timing gate) and apply the `main` ruleset requiring `build`, `account-sync`, `secrets` | `operations` | 26 of the last 30 `main` runs failed (docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md) | cross-cutting |
| X-02 | Run the restore drill into the second project; record measured RTO/RPO in `RESTORE.md` and `docs/evidence/restore/` | `operations` | Never done on production; gate G5 UNMET | cross-cutting |
| X-03 | Write the cross-tenant negative suite per object class and run it in CI | `security` | Risk R-001; F-01 | cross-cutting |
| X-04 | Apply the anon grant reduction after staging proof; write the `authenticated` allowlist | `security` | `anon` holds DML on 32 public tables; 24 carry TRUNCATE | cross-cutting |
| X-05 | Deliver one alert to a person and record the test (F-08) | `operations` | No alerting exists | cross-cutting |
| X-06 | Name a second person for security, privacy and release review; assign a backup for every seat | `founder` | One person holds every seat; every backup UNASSIGNED | cross-cutting |
| X-07 | Close or withdraw the 15 over-evidence public statements and verify the deployed company-site revision | `founder` | docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md C-01..C-15 | cross-cutting |
| X-08 | Engage counsel for entity facts, public policies and institutional paper | `founder` | EXT-001..003 OPEN | cross-cutting |
| X-09 | Reconcile the ten register disagreements listed in the capability matrix | `product` | Docs drift | cross-cutting |

### P1: needed to earn the first design-partner pilot

| ID | Item | Owner seat | Closed when | Domain |
| --- | --- | --- | --- | --- |
| D01-1 | Flip the seeded semester to an explicit sample banner everywhere (SampleMark coverage test) | `product` | Test in `app/src/domains/today/*.test.ts` and an evidence file under `docs/evidence/` | D01 Student OS |
| D01-2 | Server-side sync of Today inputs for signed-in students with a restore test | `product` | Test in `app/src/domains/today/*.test.ts` and an evidence file under `docs/evidence/` | D01 Student OS |
| D02-1 | Mount /api/productivity in a staging deployment and run postgres.integration against it (Phase 1 step 9) | `product` | Test in `app/server/productivity/*.test.ts (incl. postgres.integration)` and an evidence file under `docs/evidence/` | D02 Workspace and productivity |
| D03-1 | Deterministic rules-engine spec with effective dates and policy versions (ADR-0019 input) | `product` | Test in `app/src/lib/degree*.test.ts` and an evidence file under `docs/evidence/` | D03 Path and degree planning |
| D04-2 | Course shell + roster model ADR (OneRoster import as the first roster source) | `product` | Test in `supabase/*.check.sql (lti suites)` and an evidence file under `docs/evidence/` | D04 Course Studio and LMS |
| D05-1 | Dual-control rule for grade change and release (ADR-0010) enforced in the database | `product` | Test in `app/src/lib/gradebook/*.test.ts` and an evidence file under `docs/evidence/` | D05 Learning evidence, assessment and gradebook |
| D06-3 | Evaluation harness with a held-out set per role; run on every model/prompt change | `engineering` | Test in `app/src/ai/*.test.ts` and an evidence file under `docs/evidence/` | D06 AI gateway and copilot |
| D07-1 | Accept ADR-0021 (search/storage/queue/cache/vector boundaries) before building a server index | `product` | Test in `app/src/lib/search*.test.ts` and an evidence file under `docs/evidence/` | D07 Search and knowledge graph |
| D08-1 | Five faculty discovery interviews recorded in docs/pilot/DISCOVERY-EVIDENCE-LOG.md before building more screens | `product` | Test in `app/src/lib/rolelaunch.test.ts` and an evidence file under `docs/evidence/` | D08 Faculty experience |
| D09-1 | Advisor interviews (three) with a named office before extending the case model | `success` | Test in `app/src/lib/advisor*.test.ts` and an evidence file under `docs/evidence/` | D09 Advisor and student success |
| D19-1 | Safety-escalation tabletop with a named campus contact before any activation | `trust` | Test in `app/src/community/*.test.ts` and an evidence file under `docs/evidence/` | D19 Community and organizations |
| D20-1 | Commission the qualified accessibility evaluation (EXT-008) for the product itself | `accessibility` | Test in `supabase accommodation check suites` and an evidence file under `docs/evidence/` | D20 Accessibility services |
| D24-1 | Counsel review of the consent model (EXT-003) before activation | `privacy` | Test in `supabase family check suites` and an evidence file under `docs/evidence/` | D24 Family and guardian grants |
| D26-2 | Reconcile SAML/OIDC status against code and Supabase config; record the result in docs/evidence/ | `security` | Test in `app/server/institution/*.test.ts` and an evidence file under `docs/evidence/` | D26 Identity, SSO and SCIM |
| D28-2 | Counsel-reviewed retention schedule | `privacy` | Test in `supabase retention/legal-hold check suites` and an evidence file under `docs/evidence/` | D28 Privacy, retention and legal holds |
| D31-1 | Name a second operator for two-person controls (Phase 1 step 0d) | `operations` | Test in `app/src/lib/console/*.test.ts` and an evidence file under `docs/evidence/` | D31 Operations Command Center |
| D32-1 | One authoritative price book decision (founder) and a test that site, plans.ts and finance model agree | `finance` | Test in `app/src/lib/billing/*.test.ts` and an evidence file under `docs/evidence/` | D32 Commercial, billing and customer success |
| D36-1 | Metric dictionary with definition, source, freshness and cohort rule for every metric | `data` | Test in `app/src/lib/institution-ops.test.ts` and an evidence file under `docs/evidence/` | D36 Data, analytics and outcomes |
| D40-1 | Independent accessibility evaluation (EXT-008) precedes any 'accessible' claim | `accessibility` | Test in `app/src/a11y/*.test.ts (axe)` and an evidence file under `docs/evidence/` | D40 Globalization, localization and accessibility expansion |
| X-10 | Enter real cash and costs; replace the $0 placeholder; set one price book | `finance` | docs/finance/13-REAL-NUMBERS-INTAKE.md | cross-cutting |
| X-11 | Commission the qualified accessibility evaluation and the independent security assessment | `accessibility` | EXT-008, EXT-006 OPEN | cross-cutting |
| X-12 | Run ten design-partner discovery interviews and record them | `founder` | docs/pilot/DISCOVERY-EVIDENCE-LOG.md holds no findings | cross-cutting |
| X-13 | Decide Track B (target-architecture conversion): start or not, and its T0 | `founder` | PDR-05 | cross-cutting |
| X-14 | Accept or reject the 25 proposed ADRs by priority; start with 0001 to 0005 | `engineering` | All Proposed; owner review due 2026-11-04 | cross-cutting |

### P2: needed once a pilot is signed

| ID | Item | Owner seat | Closed when | Domain |
| --- | --- | --- | --- | --- |
| D01-3 | Source-freshness cards on (module.source_freshness_cards) behind a tenant gate | `product` | Test in `app/src/domains/today/*.test.ts` and an evidence file under `docs/evidence/` | D01 Student OS |
| D02-2 | File sync design (tenant-prefixed keys, quarantine, retention) accepted as an ADR before any build | `product` | Test in `app/server/productivity/*.test.ts (incl. postgres.integration)` and an evidence file under `docs/evidence/` | D02 Workspace and productivity |
| D02-3 | Turn on offline_engine_tasks for the invited cohort with a conflict-rate readout | `product` | Test in `app/server/productivity/*.test.ts (incl. postgres.integration)` and an evidence file under `docs/evidence/` | D02 Workspace and productivity |
| D03-2 | Audit-agreement harness against a de-identified degree-audit export | `product` | Test in `app/src/lib/degree*.test.ts` and an evidence file under `docs/evidence/` | D03 Path and degree planning |
| D04-3 | Question bank and rubric levels on the QTI 3 model | `product` | Test in `supabase/*.check.sql (lti suites)` and an evidence file under `docs/evidence/` | D04 Course Studio and LMS |
| D05-2 | Learning-evidence model: objective-to-assessment alignment on the competency map | `product` | Test in `app/src/lib/gradebook/*.test.ts` and an evidence file under `docs/evidence/` | D05 Learning evidence, assessment and gradebook |
| D10-1 | Build one read-only SIS adapter against a vendor sandbox (first design partner decides which) | `product` | Test in `app/src/lib/registrar.test.ts` and an evidence file under `docs/evidence/` | D10 Registrar and academic operations |
| D11-1 | Immutability and restore proof for the ledger (hash chain verification in CI) | `data` | Test in `app/src/lib/record/*.test.ts` and an evidence file under `docs/evidence/` | D11 Academic records and grade ledger |
| D12-1 | Registration-day load test at 5x a named design partner's peak, in staging | `product` | Test in `app/src/lib/enrollment/*.test.ts` and an evidence file under `docs/evidence/` | D12 Registration and enrollment |
| D13-1 | Dual-control for approve_high and close proven in database check suites | `finance` | Test in `app/src/lib/finance/*.test.ts` and an evidence file under `docs/evidence/` | D13 Student finance, accounts and payment plans |
| D15-1 | Office action feed for one office with a named owner | `product` | Test in `app/src/lib/support*.test.ts` and an evidence file under `docs/evidence/` | D15 Campus life and services |
| D23-1 | Verified-claim issuance flow with faculty approval | `product` | Test in `app/src/lib/career*.test.ts` and an evidence file under `docs/evidence/` | D23 Career, employer and alumni |
| D34-1 | OAuth client + scope model ADR, then sandbox tenant provisioning | `engineering` | Test in `app/server/productivity/openapi.test.ts` and an evidence file under `docs/evidence/` | D34 Developer platform |
| X-15 | Sandbox tenant provisioning for partners and implementers | `engineering` | SEMESTER_SANDBOX_INSTITUTION exists for the gateway only | cross-cutting |
| X-16 | Metric dictionary and an outcome baseline protocol | `data` | EXT-015 blocked on a named customer | cross-cutting |

### P3: deliberately deferred

| ID | Item | Owner seat | Closed when | Domain |
| --- | --- | --- | --- | --- |
| D14-1 | Keep as handoff; revisit native only after counsel and a named aid partner exist | `product` | Test in `app/src/lib/basicneeds.test.ts` and an evidence file under `docs/evidence/` | D14 Financial aid and scholarship handoffs |
| D16-1 | Hold; no build until a design partner asks for it | `product` | Test in `app/src/lib/housing.test.ts` and an evidence file under `docs/evidence/` | D16 Housing |
| D17-1 | Partner-connection acceptance test when a partner exists | `product` | Test in `app/src/lib/dining/*.test.ts` and an evidence file under `docs/evidence/` | D17 Dining |
| D18-1 | Event feed import with source label | `product` | Test in `none specific` and an evidence file under `docs/evidence/` | D18 Events |
| D22-1 | Library discovery integration after a partner library asks | `product` | Test in `app/src/lib/research.test.ts` and an evidence file under `docs/evidence/` | D22 Library and research |
| D35-1 | Do not build; revisit when D34 has 3 certified integrations | `founder` | Test in `none` and an evidence file under `docs/evidence/` | D35 Marketplace and partners |
| X-17 | Marketplace: do nothing until D34 has three certified integrations | `founder` | ADR-0024; D-1236 gates | cross-cutting |
