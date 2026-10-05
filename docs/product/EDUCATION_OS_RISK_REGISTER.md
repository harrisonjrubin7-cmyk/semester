# Education OS risk register

Status: Phase 0, assessed 2026-10-05 at `790ebbf`. **Ratings are proposed**, as in `docs/strategy/RISK-REGISTER.md`; a rating becomes authoritative only through a decision file. This register holds only risks the Phase 0 audit surfaced or sharpened. It does not replace, and must not be merged with, the three existing layers:

| Layer | Document | Scope |
| --- | --- | --- |
| Launch | `LAUNCH-RISK-REGISTER.md` v0.2 (2026-10-03), FR-001 to FR-016, P0 to P3 | What blocks a motion today: entity and legal, no named customer, DAST and pen test, tenant authorization, restore drills, single-person operations |
| Strategy | `docs/strategy/RISK-REGISTER.md` | Company and market, likelihood by impact, all open |
| Company | `docs/company/RISK-REGISTER.md` (CR-001 to CR-007), `docs/operating-model/RISK-GOVERNANCE.md`, `app/src/lib/governance/risk.ts` | Operational and financial controls |

**Parallel register on main.** `docs/program/RISK_REGISTER.md` (R-001 to R-036, Phase 0 reconciliation against audit evidence) and `docs/program/COMPLETION_RISK_REGISTER.md` landed while this register was written. They are authoritative for what they cover (for example R-001 no per-class cross-tenant negative suite, R-002 restore never exercised, R-003 browser-written tables, R-014 branch ruleset not applied, R-018 one person holds every seat). Where an `EOR-` row below restates one of those, treat the `R-` row as the record and this row as the education-OS framing; an `EOR-` row with no counterpart is new from this audit.

Scale: Likelihood and Impact 1 to 5; Score = L x I. Bands: 1 to 6 low, 8 to 12 medium, 15 to 25 high. Existing ids are cited where a risk deepens one (for example FR-006).

## Authority and claims

| ID | Risk | Evidence | L | I | Score | Mitigation | Owner seat | Backlog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EOR-001 | A domain is described or sold as native when only a sandbox or mirror exists | Register rows understate and overstate in both directions (thesis correction table); `app/server/institution/*.ts` are SQLite demonstrations | 4 | 5 | 20 | Authority matrix and gate matrix as the only vocabulary; CI check that a matrix mark the register contradicts fails (EOS-202); claims register stays mechanical (`claims.ts`: 0 "available") | Product, Counsel | EOS-201, EOS-202 |
| EOR-002 | Public site and decks outrun evidence | Gap matrix: 24/7 support vs one responder; 6 to 8 week vs 26-week pilot; "SOC 2 index" vs "report not held"; two site stacks with no chosen authority (`company-site/` vs `app/src/site/`) | 4 | 4 | 16 | Claims audit before any M0 widening; pick one site authority | Marketing, Counsel | EOS-901 |
| EOR-003 | Pricing numbers from the founding brief are quoted as facts | No approved price book; in-repo sets conflict (finance model, `launchkit.ts`, site "From $15K/yr"); marketplace take 12% or 15% undecided (D-1236); nine pricing targets appear nowhere in the repo | 4 | 4 | 16 | Treat as hypotheses; one price-book decision before any quote | Founder, Finance | EOS-902 |
| EOR-004 | `rollout-capabilities.ts` marks all 60 capabilities `verified`, read as operational | `docs/product/capability-inventory.md` lists early_access and missing operational tests | 3 | 3 | 9 | Rename the field or add the exposure column to the same type | Product | EOS-203 |

## Foundation and isolation

| ID | Risk | Evidence | L | I | Score | Mitigation | Owner seat | Backlog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EOR-010 | Cross-tenant exposure through a layer the database suites do not cover (cache, queue, object store, search, analytics, AI retrieval) | Non-DB isolation proven only on in-memory adapters (`packages/platform/src/isolation`); `docs/platform/ISOLATION.md` admits no real adapter | 3 | 5 | 15 | Real-adapter conformance run; cross-tenant negative suite over every tenant-scoped table | Platform | EOS-110 |
| EOR-011 | `anon` retains row privileges (SELECT, INSERT, UPDATE, DELETE) on 32 public tables, protected by policy alone; default privileges for `supabase_admin`-created tables still grant all eight to both client roles | `database/GRANT_ALLOWLIST.md`; `database/TENANT_ISOLATION_MATRIX.md` (2026-10-04). **Partly closed 2026-10-05:** TRUNCATE, TRIGGER, REFERENCES and MAINTAIN revoked in production (`20261005000000`, `supabase/client-privileges.check.sql`) | 2 | 4 | 8 | Review and apply the remaining `anon` reduction; close the `supabase_admin` default-privilege gap; FORCE RLS decision | Platform, Security | EOS-111 |
| EOR-012 | Production lags the repository on safety fixes | `supabase/ledger.snapshot` ends `20261004123000`; repo-only: hold coverage on the last three sweeps (`20261004150000`), guardian-restriction export fix (`160000`), audit-copy scrub (`190000`) | 4 | 4 | 16 | Apply in order after review; add a drift alert (docs/SCHEMA-DRIFT-AND-CONTRACT-TESTING.md) | Platform | EOS-112 |
| EOR-013 | Identity resolved by email in shared surfaces | Gap audit (`SECURITY-GAP-AUDIT-2026-09-30.md`): advisor shares, support shares, `classmates.sql`; no canonical person table | 3 | 4 | 12 | `person_alias` and resolution that never matches email | Platform | EOS-101 |
| EOR-014 | Grants outlive deprovisioning | `20260930210000` revokes only `school` scope; organization, course, department and office grants are left | 3 | 4 | 12 | `org_unit` and revoke across scope kinds | Platform | EOS-104 |
| EOR-015 | `family_*` tenant is free text | `family_grants.institution_id`, `family_invites.institution_id` have no FK to `schools` | 2 | 4 | 8 | `tenant_id` FK with backfill that refuses ambiguity | Platform | EOS-105 |
| EOR-016 | Four classification vocabularies produce inconsistent decisions | T0 to T6, C0 to C4, `ResourceClassification`, table classes | 3 | 3 | 9 | One vocabulary with a mapping table and a test | Platform, Privacy | EOS-106 |
| EOR-017 | `tenant_rollout` is believed to gate access and does not | No data-access policy consults it | 3 | 4 | 12 | Make it an enforcement input, or rename it a status record | Platform | EOS-103 |
| EOR-018 | Audit gaps leave sensitive events unrecorded | Streams fragmented; no shared correlation id; AI refusals largely unaudited; outbox has no publisher, consumer or sweep | 4 | 3 | 12 | Request-context contract; outbox delivery half | Platform | EOS-107, EOS-108 |
| EOR-019 | Monitoring is asserted, not measured | `SEMESTER_MONITORING_READY==='1'` is self-asserted; 33 alerts: 6 wired, 0 delivery-tested (`docs/sre/generated/ALERTS.md`); one owner, no rota | 4 | 4 | 16 | Probe-based readiness; wire and delivery-test the P0 alerts | SRE | EOS-109 |
| EOR-020 | Capability vocabulary mismatch blocks the platform policy engine | Platform uses dot form; database uses colon form; no mapping | 3 | 2 | 6 | Mapping table and parity test before phase 2 of `docs/platform/MIGRATION.md` | Platform | EOS-113 |

## Student OS and learning

| ID | Risk | Evidence | L | I | Score | Mitigation | Owner seat | Backlog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EOR-030 | Student data lost with a device | Files (IndexedDB), AI threads, Career, Pathway, Family, Support, feedback inbox, learning map are device-only | 4 | 3 | 12 | Server persistence for the highest-value items with the same classification and export rules | Product | EOS-210 |
| EOR-031 | Local state and server state diverge | Field-wise merge, union merge for notes and tasks (`app/src/lib/merge.ts`); notes have thin direct tests | 3 | 3 | 9 | Add direct tests for notes merge; conflict surface | Product | EOS-211 |
| EOR-032 | Role experiences are indistinguishable | `docs/screenshots/README.md`: nine non-student roles pixel-identical; 15 dead-end "not switched on" screens | 4 | 3 | 12 | Role homes (epics E3 to E9); hide what is off instead of dead-ending | Design | EOS-220 |
| EOR-033 | Course Studio and gradebook are unproven live | Flags off at every school; applied status of `20260928309000` and `20260929310000` unasserted | 3 | 4 | 12 | Apply-and-verify on a staging database; one faculty pilot | Product | EOS-310 |
| EOR-034 | Faculty cannot trust or verify AI behaviour in their course | Consumer path is prompt-level only; no integrity jailbreak suite | 4 | 4 | 16 | Gateway default for governed builds; RT-07 suite | AI | EOS-501, EOS-509 |
| EOR-035 | Documents contradict each other on gradebook and Course Studio | Learning register intro vs L10 and L11; design doc lists `approve_course_source` not found in the migration | 3 | 2 | 6 | Correct docs; build or strike the function | Product | EOS-312 |

## AI

| ID | Risk | Evidence | L | I | Score | Mitigation | Owner seat | Backlog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EOR-040 | Ungoverned AI routes carry T3 data and ignore tenant policy | Own-key and proxy `ask()` read no policy, kill switch or consent; grade and attendance lookups still sent unless `aiOff` | 4 | 5 | 20 | Governed default; route removal under tenant builds | AI | EOS-501 |
| EOR-041 | Consent never gates AI | `consentIds: []` hard-coded; gateway never reads `consent_record` | 4 | 4 | 16 | Read consent in the decision order | AI, Privacy | EOS-503 |
| EOR-042 | A bad model or provider cannot be stopped everywhere | Kill switch does not reach own-key, OpenAI or proxy routes; one drill, predating the activation gate | 3 | 5 | 15 | Reach every route; quarterly drill | AI, SRE | EOS-502 |
| EOR-043 | Shared AI key activated before decisions are made | Five owner decisions `pending-owner`; no `docs/evidence/vendors/` | 3 | 4 | 12 | Keep 501 until complete; record decisions | Founder | EOS-506 |
| EOR-044 | Prompt injection through source bodies | Gateway fences with `SOURCE_DATA_RULE` and strict schema; filed red-team covers consumer builders only; source bodies unbounded | 3 | 4 | 12 | Institution-route red-team; size bound | AI | EOS-508 |
| EOR-045 | AI spend runs away or margin goes negative | Allowances are proposals (D-1231); gateway reserve is a constant; no per-user cap | 3 | 3 | 9 | Per-user cap; price-book decision | AI, Finance | EOS-507 |
| EOR-046 | Governed client path breaks against the gateway | Student's saved-source ids vs `approved_source` ids; not traced | 3 | 3 | 9 | Reproduce first | AI | EOS-505 |

## Interoperability and migration

| ID | Risk | Evidence | L | I | Score | Mitigation | Owner seat | Backlog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EOR-050 | The first real integration breaks assumptions made on mocks | `ADAPTERS` empty in all three registries; everything synthetic | 5 | 4 | 20 | A design-partner sandbox run is the first milestone, before more building | Integrations | EOS-300 |
| EOR-051 | Grade passback duplicates or loses scores | No idempotency key, one POST, no retry, no read-back, no failed-write queue | 3 | 5 | 15 | L3 and L4 before enabling | Integrations | EOS-302 |
| EOR-052 | Migration tooling passes synthetic data and fails on real | Never run against an institution; no extract and load executor; `parallel-run.ts` unused | 4 | 4 | 16 | Rehearsal on a non-production extract | Implementation | EOS-401, EOS-321 |
| EOR-053 | OneRoster is claimed before it exists | Staging SQL only, four entities, no connector; roadmap says "Planned", readiness says "not implemented" | 3 | 4 | 12 | Keep the claim ceiling; build Phase A | Integrations | EOS-301 |
| EOR-054 | Launch audit is not persisted | LTI refusals go to `console.error` | 3 | 3 | 9 | L1 | Integrations | EOS-303 |
| EOR-055 | A SAML or SCIM defect is found only in a customer's IdP | Tested with fakes; no assertion tamper test with a real IdP | 3 | 4 | 12 | Acceptance run; OIDC decision | Integrations | EOS-320 |
| EOR-056 | Offboarding cannot return a customer's data | `school_offboarding`: no export file generator, no purge, no screen; window is a counsel placeholder | 3 | 5 | 15 | Build the export generator and exercise once | Platform, Counsel | EOS-405 |

## Institutional and commercial

| ID | Risk | Evidence | L | I | Score | Mitigation | Owner seat | Backlog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EOR-060 | Configuration is believed to take effect and does not | `effectiveConfig` called only by the studio; Workflow Builder has no consumer; Control + Trust tab applies nothing | 4 | 3 | 12 | Wire consumers one domain at a time, or mark preview in the UI | Product | EOS-230 |
| EOR-061 | Money modules switched on early | Student accounts and dining ledgers verified in DB; nine unmet preconditions; no provider; no finance owner | 2 | 5 | 10 | `MONEY-MODULES-SWITCH-ON.md` stays the gate; two-approver rule | Finance, Counsel | EOS-420 |
| EOR-062 | K-12 guardian features activated before counsel answers | `guardian_may_read` unused; P-04 and P-06 open; no staff screen | 2 | 5 | 10 | Keep `UA`; add a test that no screen reads through guardian links | Counsel | EOS-610 |
| EOR-063 | No institutional billing | All six institutional prices quote-only; nothing charges an institution | 3 | 4 | 12 | Design after the price-book decision | Finance | EOS-903 |
| EOR-064 | Company seats concentrated in one person (deepens FR-006) | One person primary on nearly all seats; backups unassigned | 5 | 4 | 20 | Name backups; see team plan in the backlog | Founder | EOS-904 |
| EOR-065 | No customer and no revenue make every commercial plan hypothetical | Customer-commitments register empty; no entity confirmed (FR-001) | 4 | 5 | 20 | One named design partner is the program's first gate | Founder | EOS-900 |
| EOR-066 | Marketplace opened before it is safe | D-1236 held; G-OWN, G-DATA, G-TERMS, G-QUEUE unmet; Class E prohibited; licensed processor required | 2 | 5 | 10 | Keep held; test that no route exposes it | Product, Counsel | EOS-701 |

## Standing controls

- A risk is closed only by the change that earns it plus the test that holds it; closure cites both.
- Review at the weekly program review ([cadence](EDUCATION_OS_BACKLOG.md)); any score of 15 or more is read aloud.
- New risks arrive from: audit findings, incident reviews, red-team results, and sponsor feedback.
- A doc-versus-code contradiction is a risk of its own (EOR-001) until corrected.
