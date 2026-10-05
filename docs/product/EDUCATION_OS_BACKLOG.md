# Education OS backlog, build order and operating plan

Status: Phase 0 plan, assessed 2026-10-05 at `790ebbf`. Items are proposals for pull-request-sized work, **not commitments**; none is started. Estimates are relative sizes (S under 2 days, M under 2 weeks, L over 2 weeks) given one to two engineers. It does not replace `docs/CLAUDE-CODE-BACKLOG.md` (BL-x, old counts) and must not be confused with `COMPLETION-PLAN.md` or `IMPLEMENTATION-PLAN.md` (both historic; do not use them as backlogs). Current planning lives in `docs/90-DAY-LAUNCH-PROGRAM.md`, `docs/PRODUCT-ROADMAP.md`, `docs/PROOF-CALENDAR.md`, `docs/target-architecture/` and `docs/strategy/`.

## Rules for taking an item

1. **Check main for the thing itself before reading or writing code** (`CLAUDE.md`): `git fetch origin main`, `git log --oneline -30 origin/main`, then grep the defect, not the title, and read the recent history of the files you would edit. If it landed, say so and stop; consider the guard nobody wrote.
2. Open the pull request first; a decision is `docs/decisions/D-<pull request number>.md`. The decision log closed at D-160.
3. Every command runs from `app/`: `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`.
4. Every item carries its **revert test**: remove the fix, watch the new test go red, restore.
5. Rebase onto `origin/main` before pushing.
6. A status or gate mark in this document set changes in the same pull request that adds its evidence.

## Branches

The brief's execution branches, with their epics. The environment working this program is limited to one designated branch per session, so epics may be taken on that branch in sequence or on separate branches by separate sessions; the names below are the intended ones.

| Branch | Epic |
| --- | --- |
| `audit/unified-education-os-baseline` | E0 (this document set) |
| `feat/education-graph-foundation` | E1 |
| `feat/student-os-daily-workspace` | E2 |
| `feat/course-studio-learning-os` | E3 |
| `feat/governed-ai-copilot` | E5 |
| `feat/student-success-os` | E6 |
| `feat/registrar-academic-os` | E4 |
| `feat/education-interoperability-fabric` | E7 |
| `feat/campus-life-family-career` | E8 |
| `feat/institutional-control-plane` | E9 |
| `feat/education-platform-ecosystem` | E10 |

## Build order (dependency, not list order)

1. **E0** establish truth (this set; plus fix the doc contradictions below).
2. **E1** graph foundation: identity resolution, org units, one membership view, classification vocabulary, request context, outbox delivery. Everything else resolves people and orgs through it.
3. **E7** interoperability: the first real adapter and the first migration rehearsal are the program's most valuable evidence, and they depend on E1's identity resolution.
4. **E5** governed AI: close the governed-path gap before any new assistant.
5. **E2, E3** student OS and Course Studio: ship what exists to default-on where evidence supports it; server persistence for the highest-value device-only data.
6. **E9** control plane: wire consumers for configuration and workflow so a tenant's settings take effect.
7. **E4, E6** registrar and advising: native paths stay gated off until gates 7 to 13; the work is importers, reconciliation and screens.
8. **E8** campus, family, career.
9. **E10** platform ecosystem: marketplace remains held (D-1236).
10. **E11** company command center, in parallel from the first customer conversation.

## E0: establish truth

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-001 | Land this document set | S | Twelve files merged; paths verified to exist |
| EOS-002 | Correct the stale documents listed in [the thesis](SEMESTER_UNIFIED_EDUCATION_OS_THESIS.md) | M | Each document changed in the pull request that fixes the code truth it cites; `ROLE-PERMISSION-MATRIX.md` re-rendered with `npm run registers` |
| EOS-003 | Correct `replaceregister.ts` rows for registration, LMS gradebook, dining, legal hold, portal flags, `r-lifecycle`, `r-approvals`, `r-exit` | M | Register re-rendered; `replaceregister.test.ts` green; each changed row cites the migration and check suite |
| EOS-201 | Map the fifteen gates in the [replacement matrix](DOMAIN_REPLACEMENT_MATRIX.md) onto the register's `r-*` requirements | M | A table in `replaceregister.ts` data; `replaceregister.test.ts` fails when a requirement has no gate |
| EOS-202 | CI check that a gate mark in the matrix the register contradicts fails | M | Test reads both; control: a seeded contradiction is flagged |
| EOS-203 | Add an exposure field next to `currentState` in `rollout-capabilities.ts`, or rename `verified` | S | A reader cannot take `verified` as operational; `capability-inventory.md` agrees |
| EOS-004 | Point `docs/INTEROPERABILITY-ROADMAP.md`, `SYNC-SIMULATION-SANDBOX.md`, `LTI-1.3-LAUNCH-RUNBOOK.md` at the code | S | Doc claims match the cited files |

## E1: graph foundation (details in [the graph](EDUCATION_GRAPH_ARCHITECTURE.md))

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-101 | `person_alias` and resolution that never matches by email | L | Advisor share, support share and `classmates.sql` resolve through it; a test shows two people with the same email-like alias never merge |
| EOS-102 | One `SourceState` type (the eight states in the [authority matrix](DOMAIN_AUTHORITY_MATRIX.md)) used by freshness and source labels | M | `freshness.ts` and `source.ts` share it; a mirrored value always carries state and age |
| EOS-103 | `tenant_rollout` becomes an enforcement input for enabling write modes | M | A write flag cannot be enabled for a tenant whose rollout state lacks the gate; negative check suite |
| EOS-104 | `org_unit` and scope foreign keys; deprovision revokes every scope kind | L | A department-scope grant for a deprovisioned person is revoked; `has_capability` can show inheritance; check suite |
| EOS-105 | `tenant_id` on `family_*` | S | FK to `schools`; backfill refuses ambiguous rows; `family.check.sql` extended |
| EOS-106 | One classification vocabulary and mapping | M | Mapping table plus test over all four vocabularies; column-level class on education-record tables |
| EOS-107 | Request-context contract adopted by gateway and productivity service | M | Both emit `correlationId`, `policyVersion`; audit rows carry them |
| EOS-108 | Outbox publisher, tenant-verifying consumer and retention sweep | L | `published_at` set by code; consumer refuses cross-tenant events; sweep respects holds |
| EOS-109 | Probe-based readiness; wire and delivery-test the P0 alerts | M | `monitoringConfigured` from a probe; a test alert is received |
| EOS-110 | Real-adapter isolation conformance for cache, queue, object store and search | L | `packages/platform/src/testing/conformance.ts` passes against real adapters; the 7 leaky controls still fail |
| EOS-111 | Review and apply the `anon` grant reduction; decide FORCE RLS | M | Decision file; production catalog read shows the new grants |
| EOS-112 | Apply the three repo-only safety migrations to production after review; add drift alert | S | `ledger.snapshot` shows them applied |
| EOS-113 | Capability mapping dot-to-colon and parity test | S | Mapping table; comparison test runs |

## E2: student OS and daily workspace

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-210 | Server persistence for files, AI threads and career library (opt-in, classified, exportable, erasable) | L | Round trip across two devices; `export_my_data()` and erase reach them |
| EOS-211 | Direct tests for notes merge; conflict surface | S | `notes` slice tested; union merge conflict shown to the student |
| EOS-212 | Action Center: per-item freshness, dismiss reasons, variable snooze | M | Tests held; no new server mark without its decision |
| EOS-213 | Server-authorized search index shared with AI | L | Results respect role, tenant and course; every result labelled with source state |
| EOS-214 | Hide what is off instead of dead-ending | M | The 15 "not switched on" screens either disappear or explain with an action |
| EOS-215 | Calendar external write preview-and-confirm with audit | M | A write shows its diff; the confirmation is logged |
| EOS-220 | Role homes (student first, then the roles in the [role matrix](ROLE_EXPERIENCE_MATRIX.md)) | L each | Screenshot per role differs and shows that role's next action |

## E3: Course Studio and learning

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-310 | Apply and verify `20260928309000` and `20260929310000` on staging; one faculty pilot of rules, guidance and packs | M | Applied-status evidence filed; faculty run recorded |
| EOS-311 | Faculty course home and syllabus publication with outcomes | L | A faculty member publishes outcomes; the student course hub shows them |
| EOS-312 | Course-scoped source approval (the function the design lists and the migration lacks) | M | Faculty can approve a source at course scope; check suite for cross-course and cross-school refusal |
| EOS-313 | Course discussions | L | Course-scoped threads with moderation reuse |
| EOS-314 | Wire `rubricengine.ts` and `itembank.ts` to a faculty screen | L | A faculty member builds a rubric and an item bank; QTI export |
| EOS-315 | Faculty learning aggregates, n>=10 | M | Defined measures only; none on the forbidden list |
| EOS-316 | Gradebook gaps: student-view preview, anonymous and group grading, mastery scales | L | Each with check cases |

## E4: registrar and academic operations

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-401 | Rehearsal of a registration mirror on a design partner's non-production extract | L | A filed run under `docs/evidence/migration/`; gate pass or fail with reason |
| EOS-402 | Academic-record importer and a student read screen | L | Counts and semantic checks reconcile; "Not an official transcript" retained |
| EOS-403 | Catalog authoring, approval, catalog-year versioning | L | Registrar publishes a catalog year; students see the right year |
| EOS-404 | Degree-audit requirement import | L | Requirements from a source, certified by a registrar; estimates remain labelled |
| EOS-405 | Offboarding export generator, purge, screen | L | One exercised offboarding on rehearsal data |
| EOS-406 | Transfer evaluation screen over `articulation_rules` | M | Registrar approves a rule; student sees the estimate |
| EOS-420 | Student accounts: provider and finance-owner preconditions | L | Nine preconditions tracked; none skipped; stays off until met |

## E5: governed AI (details in [AI governance](AI_GOVERNANCE_AND_MODEL_ROUTING.md))

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-501 | Governed default; consumer routes off in tenant builds | M | A build with `VITE_UNIVERSITY_GATEWAY_URL` cannot reach `api.anthropic.com` or `api.openai.com` from the browser; tripwire test extended to SDK use |
| EOS-502 | Kill switch reaches every route; provider incident drill | M | `KILL_REACH` lists all routes; a drill filed |
| EOS-503 | Read consent in the decision order | M | `consentIds` populated from `consent_record`; a revoked consent refuses |
| EOS-504 | Registration guide with the official-source pattern | M | Cannot state an enrollment outcome; always links the official screen |
| EOS-505 | Reproduce and fix the saved-source versus `approved_source` mismatch | S | A reproduction test first |
| EOS-506 | Complete the five owner decisions for the shared key or remove the surface | S | Decisions recorded; `docs/evidence/vendors/` populated |
| EOS-507 | Per-user cap and tenant dashboard on the spend ledger | M | GW-12 closed |
| EOS-508 | Institution-route red-team and a source size bound | M | Filed run, all `followed:false` |
| EOS-509 | Integrity jailbreak suite (RT-07) | M | Pass threshold agreed with faculty and filed |
| EOS-510 | Audit every refusal with correlation id and policy version | M | Each refusal code writes one row |
| EOS-511 | Provider and model registry, routing, disclosed fallback, evaluation gate | L | Three duplicated model lists replaced; a model cannot be `approved` without a filed run |
| EOS-512 | Purpose allow-list; enrollment check on source reads; per-source classification | M | Unlisted purpose refused; non-enrolled student refused |

## E6: advising and student success

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-601 | Advisor reply and sources and freshness on the shared agenda | M | The advisor can respond; each item carries its source state |
| EOS-602 | Case model, caseloads, success plans (design with a partner; no risk scores) | L | A review confirms nothing on `FORBIDDEN` is computed |
| EOS-603 | Signal model for "missed task to support" that is explainable and student-visible | L | A student sees why a nudge appeared and can turn it off |
| EOS-610 | A test that no screen reads through `guardian_may_read` until counsel clears | S | Test fails if a reader appears |

## E7: interoperability fabric (details in [the strategy](INTEROPERABILITY_AND_MIGRATION_STRATEGY.md))

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-300 | One design-partner sandbox connection (first non-empty `ADAPTERS`) | L | Adapter registered in all three registries; first real freshness reading |
| EOS-301 | OneRoster CSV Phase A with mapping-version registry wired | L | Valid and broken fixtures; counts reconcile |
| EOS-302 | LTI AGS idempotency ledger, retry, read-back, failed-write queue | L | L3 and L4 tests |
| EOS-303 | `lti_launch_audit` | S | L1 test |
| EOS-304 | Resolve launch to tenant, course and term for policy and consent | M | L8 test |
| EOS-305 | OneRoster Phase B REST read sync and scheduled reconciliation | L | Against a sandbox or conformance server |
| EOS-306 | NRPS-or-OneRoster roster decision | S | Decision file |
| EOS-307 | Edu-API read adapter after a partner names an SIS | L | Shares the OneRoster staging |
| EOS-308 | Google and Microsoft calendar acceptance against real providers; write preview | M | Filed run |
| EOS-309 | Picker-based file import; Microsoft To Do and Markdown notes import | M | Round trip |
| EOS-320 | Live SAML acceptance with tamper tests; OIDC decision; SCIM health and deprovision notice | L | Filed run |
| EOS-321 | Extract and load executor for the migration tooling; call `parallel-run.ts` | L | One rehearsal passes the gate |

## E8: campus, family, career

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-801 | Dining staff screen and card-office connection (when a vendor exists) | L | Counter and staff flows tested; stays off until the connection |
| EOS-802 | Organization membership decisions and events tables | M | Screen; check suite |
| EOS-803 | Accessibility passport screens | L | `+REV` first |
| EOS-804 | Housing: scope with a partner | M | Decision file |
| EOS-805 | Server-write verified skills and verification requests; employer search with consent | L | `skill:verify` reachable from a screen; `talent:search` honours the opt-in |
| EOS-806 | Credential issuer, revocation, recipient sharing; Open Badges only when built | L | Do not claim support before this |

## E9: institutional control plane

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-230 | Make Configuration Studio settings take effect, one domain at a time | L | `effectiveConfig` called by the consumer; a changed setting changes behaviour; a rollback restores it |
| EOS-231 | Workflow Builder: a student-facing instance for one workflow | L | A definition runs; the student sees status |
| EOS-232 | Control + Trust tab applies a change with approval | M | `onApply` exists and audits |
| EOS-233 | University-side approvals queue | M | A university admin has one place for pending approvals |
| EOS-234 | AI provider policy admin screen (`ai:configure`) | M | Enforces `web_sources_allowed`, `course_sources_only`, `default_provider`, `retention_days` |
| EOS-235 | Hierarchy resolver consumed at runtime | M | A course resolves its chain; `clamped` list shown |

## E10: platform ecosystem

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-701 | Keep the marketplace held; a test that no route exposes it | S | D-1236 gates tracked |
| EOS-702 | Productivity API: authenticator, scheduled sweep, client queue, production-major run | L | The five gaps in `docs/API-PLATFORM.md` §10.6 closed |
| EOS-703 | Developer portal, API keys, sandbox, SDK | L | Public documentation separated from `docs/developers/` |
| EOS-704 | Extension framework (tables, review, `extension:approve`) | L | Hard-off flags lifted per tenant only with review |
| EOS-705 | Webhooks and file service | L | Specified in `docs/API-PLATFORM.md` |

## E11: company command center and commercial

| ID | Item | Size | Done when |
| --- | --- | --- | --- |
| EOS-900 | One named design partner and a scoped agreement | L | The first real gate; unlocks M3 |
| EOS-901 | Claims audit of the public site; choose one site authority | M | Three named contradictions resolved |
| EOS-902 | Price-book decision (single source of truth) | M | One decision file; code and site read from it |
| EOS-903 | Institutional billing design (invoicing, PO, terms) | L | After EOS-902 |
| EOS-904 | Name backups for every company seat | S | FR-006 closed |
| EOS-905 | Console modules: Revenue Ops, Finance, Executive; authoritative feeds | L each | Per `docs/operations/company-operations-console.md` |
| EOS-906 | Support rota, SLA, exercised runbook | M | Gate 12 evidence |
| EOS-907 | Pen test, DAST on the target, qualified accessibility review | L | Reports filed under `docs/evidence/` |

## Twelve-month plan

Assumes one to two engineers plus the part-time roles below; compressed or stretched by funding. No quarter promises a replacement.

| Quarter | Theme | Outputs | Exit |
| --- | --- | --- | --- |
| Q1 (Oct to Dec 2026) | Truth and trust | E0; EOS-111, 112, 109; E5 governed default (501, 502, 503, 510); accessibility review booked; claims audit; price-book decision; support rota; restore drill; first design-partner conversation | M0 hardened; design-partner scope drafted; no adapter yet |
| Q2 (Jan to Mar 2027) | Foundation and first connection | EOS-101, 102, 104, 107, 108; EOS-300 and 301; LTI audit and idempotency (303, 302); first rehearsal (401 or 311b) | First non-empty `ADAPTERS`; first filed migration rehearsal; M3 prerequisites tracked |
| Q3 (Apr to Jun 2027) | Pilot read-only | M3 with one partner: SAML acceptance, mirror source states, reconciliation scheduled, pen test; Course Studio pilot; role homes for student and one staff role; control-plane consumers (230) | A pilot running read-only; baseline frozen with the sponsor |
| Q4 (Jul to Sep 2027) | One controlled write | One workflow (the partner's choice, most likely registration readiness handoff or grade passback) through gates 6, 8, 13; AI registry and evaluation gate; server-side search | M4 for one workflow; outcome readings against the baseline |

Domain replacement (M5) is not scheduled in the first year. It begins only if a design partner asks for a specific domain and the gates are in reach.

## Required team roles

The repository shows one person holding nearly every company seat (`FR-006`). The program needs these roles; a person may hold several early, but a gate marked independent needs a second party.

| Role | Why | Hire or contract |
| --- | --- | --- |
| Founder and product owner | Decisions, design-partner relationship | Held |
| Staff engineer, data and platform | Graph, RLS, outbox, isolation conformance | First hire |
| Integrations engineer | OneRoster, LTI, adapters, migration rehearsals | Second hire |
| Applied AI engineer | Gateway, registry, evaluations, red-team | Contract then hire |
| Product designer and accessibility lead | Role homes; accessibility conformance | Contract |
| Implementation lead | Migration rehearsals, institution onboarding | Hire when M3 is near |
| Security and compliance lead | DAST, pen test, HECVAT, SOC 2 readiness | Contract first |
| Counsel | Legal paper, FERPA, minors, DPA | Retained; none assigned today (`LEGAL-REVIEW-QUEUE.md`, Q-01 to Q-13 unassigned) |
| Support and customer success | Rota, SLA, QBRs | Hire at first paid pilot |
| Finance and operations | Entity, tax, insurance, billing | Contract |

## Commercial model (hypotheses, not approved)

The repository has **no approved price book**. Numbers below are what the repository itself proposes, with its own labels, and are not to be quoted outside the company. The founding brief's price points (Student Premium $8.99 monthly or $69 annually, $18 per enrolled student, $30k minimum, $30 per 1,000 AI units, 12 percent marketplace, $35k to $150k implementation, 15 percent premium support, 25 GB storage, $30k to $45k paid pilot) appear nowhere in the repository and are treated as hypotheses.

| Item | In the repository | Status |
| --- | --- | --- |
| Individual Plus | $7.99 per month, $59 per year (D-134); live monthly acceptance 2026-10-03 | Checkout held (`INDIVIDUAL_PAID_ACQUISITION_ENABLED=false`) |
| AI allowance | Free $0.75, Plus $2, Pro $4 per month (D-1231) | Proposal |
| Institutional | Six `commercial_prices` rows, quote-only (`amount_cents` null) | No price |
| Paid pilot | $12k for 26 weeks plus $15k implementation (`docs/finance/02`) | Proposed, not approved |
| Deal-desk tier minimums | Pilot $15k, department $25k, campus $75k, system $200k (`app/src/lib/governance/deal-desk.ts`) | Pure function, not wired to quotes |
| Site | "From $15K/yr" (`company-site/index.html:660`) | Conflicts with the finance model |
| Marketplace | 12 or 15 percent, undecided (D-1236) | Held |

Revenue lines the architecture supports, in the order evidence would permit: individual subscriptions; institutional platform subscription by active or enrolled students (the value metric itself is undecided); implementation and migration services (the migration moat as a product); AI metering above allowance; premium support; marketplace and partner revenue (held). `commercial/READINESS_GAP_MATRIX.md` (2026-10-04) is the standing audit of this gap; link to it, do not redo it.

## Operating cadence

| Cadence | Forum | Inputs | Outputs |
| --- | --- | --- | --- |
| Daily | Merge hygiene | `origin/main` log; CI | Rebased branches; no duplicate work (CLAUDE.md) |
| Weekly | Program review | This backlog; risk register scores of 15 or more; open pull requests | Items taken or dropped; risks re-rated by decision file |
| Weekly | Evidence review | New files under `docs/evidence/` | Gate marks changed only with their evidence |
| Biweekly | Design-partner call (from EOS-900) | Rehearsal results; open reconciliation items | Scope changes recorded |
| Monthly | Council | `decide()` output; blockers; seat holders | Verdict recomputed from evidence, never edited |
| Monthly | AI governance | Evaluation runs; spend; incidents | Model approvals; thresholds proposed as decisions |
| Quarterly | Drills | Restore, rollback, kill switch per provider | Filed drill results |
| Quarterly | Scope and access review | Integration scopes; role grants | Review recorded |
| Per release | Release profile evaluation | `release-profiles.ts` | Cumulative evidence per motion |

## Traceability

Each item above maps to: a graph edge in [the graph](EDUCATION_GRAPH_ARCHITECTURE.md) or a gate in [the replacement matrix](DOMAIN_REPLACEMENT_MATRIX.md), a risk in [the register](EDUCATION_OS_RISK_REGISTER.md), and its tests. When an item merges, update the three in the same pull request.
