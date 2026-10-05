# Semester unified education OS: thesis and current truth

Status: Phase 0 baseline, assessed 2026-10-05 against `origin/main` at `790ebbf`. Method: read-only audit by six parallel readers (foundation, student OS and learning, AI, interoperability and migration, institutional roles, company and platform), each reading code, migrations, check suites and documents. **No test, SQL suite or deployed environment was run for this audit.** "Verified" below means a test or `supabase/*.check.sql` suite exists that asserts the behaviour, not that it was re-run here.

This document sets the thesis and says what is true today. Its siblings in `docs/product/`:

| Document | Answers |
| --- | --- |
| [EDUCATION_OS_PRODUCT_MAP.md](EDUCATION_OS_PRODUCT_MAP.md) | What exists in each layer, with a status and evidence |
| [EDUCATION_GRAPH_ARCHITECTURE.md](EDUCATION_GRAPH_ARCHITECTURE.md) | The twelve graphs and the attributes of every edge |
| [ROLE_EXPERIENCE_MATRIX.md](ROLE_EXPERIENCE_MATRIX.md) | What each role can actually do today |
| [DOMAIN_AUTHORITY_MATRIX.md](DOMAIN_AUTHORITY_MATRIX.md) | Which system is the source of truth for each domain |
| [DOMAIN_REPLACEMENT_MATRIX.md](DOMAIN_REPLACEMENT_MATRIX.md) | The fifteen gates, per domain |
| [CONNECT_REPLACE_OPERATE_STRATEGY.md](CONNECT_REPLACE_OPERATE_STRATEGY.md) | How a domain moves from connected to native |
| [INTEROPERABILITY_AND_MIGRATION_STRATEGY.md](INTEROPERABILITY_AND_MIGRATION_STRATEGY.md) | LTI, OneRoster, Edu-API, SIS, productivity, AI-provider transition |
| [AI_GOVERNANCE_AND_MODEL_ROUTING.md](AI_GOVERNANCE_AND_MODEL_ROUTING.md) | The governed AI layer, as built and as specified |
| [EDUCATION_OS_RELEASE_GATES.md](EDUCATION_OS_RELEASE_GATES.md) | Gates, test strategy, outcome frameworks, launch readiness |
| [EDUCATION_OS_RISK_REGISTER.md](EDUCATION_OS_RISK_REGISTER.md) | New risks the audit found, linked to the three existing registers |
| [EDUCATION_OS_BACKLOG.md](EDUCATION_OS_BACKLOG.md) | Build order, epics, twelve-month plan, team, cadence |

## The thesis

Semester is the unified, AI-native operating system for education: one trusted platform that connects, and progressively replaces by domain, the fragmented tools, portals, learning systems, institutional records, campus services, productivity suites, AI assistants and operating workflows that make education hard to navigate and run.

The doctrine is three verbs, in this order:

1. **Connect first.** Read from the systems of record the institution already runs, with minimum data, a stated purpose and provenance on every field.
2. **Replace by domain.** A domain becomes native and authoritative only when it clears the fifteen gates in [DOMAIN_REPLACEMENT_MATRIX.md](DOMAIN_REPLACEMENT_MATRIX.md) and the institution approves.
3. **Operate as one system.** One identity, one tenant model, one education graph, one policy engine, one audit trail, one AI gateway, one design system; the student sees one path, not which architecture is active behind it.

The product is not narrowed by this. The ambition is the whole list in the brief: student OS, productivity suite, learning platform, LMS replacement, SIS and registrar replacement, record and degree-planning system, advising and student-success system, student accounts, campus super-app, governed AI, search, family consent, career and lifelong learning, institutional control plane, developer ecosystem, company operating platform. What this document does is refuse to let the ambition stand in for evidence.

## Five laws that bind every document in this set

These restate the brief's constraints and the repository's own `docs/product/operating-constitution.md`; they are tested elsewhere in the repo (`app/src/donotbuild.test.ts`, `ops/strategic-boundaries`).

1. **No false replacement.** A domain served by an integration is labelled integrated. "Native" requires code plus a test; "authoritative" requires all applicable gates plus institutional approval.
2. **No official-record shortcuts.** Grades, registration, financial records, identity and legal processes move only with formal authority, migration, audit, reconciliation, rollback and approval.
3. **No silos.** A feature is wired to the education graph, the policy engine and the audit trail, or it is not shipped on.
4. **AI is never institutional truth.** AI output is labelled non-authoritative until a human with authority approves it through an audited workflow.
5. **Tenant isolation, student agency, accessibility, privacy and source authority are not traded for speed.**

## Current truth in nine lines

1. **Release decision: NO-GO for general availability.** `GO-NO-GO-DECISION.md` (2026-10-03): individual acquisition is conditional and invitation-only; a design-partner pilot is green for non-activation work only; paid pilots and broad enterprise sale are red. `docs/RELEASE-GATES.md` G1–G10: none met.
2. **Domains replaceable: 0 of 14** (`docs/DOMAIN-REPLACEMENT-REGISTER.md`). Five requirements stop every domain: lifecycle, migration, change, contract, exit.
3. **No real provider has ever been exercised.** `app/server/integration/registry.ts` exports an empty `ADAPTERS`; so do `supabase/functions/_shared/integration/registry.ts` and `app/server/institution/adapters.ts`. The university gateway answers 503 for every real service.
4. **No institution is live.** Named-tenant register: 0 approved, 60 pending. 0 of 69 roles are launch-approved (`docs/ROLE-LAUNCH-REGISTER.md`). Zero customers and zero revenue are evidenced.
5. **The foundation is strong at repository level.** About 321 public tables, all with RLS enabled; 111 `supabase/*.check.sql` suites run in CI; hash-chained ledgers for the academic record and student accounts; hold-gated sweeps; consent-bound support access. Production lags the repository by several migrations (`supabase/ledger.snapshot` ends `20261004123000`).
6. **Much of the institutional core is built in the database and switched off.** Registration transactions, the gradebook of record, the academic-record ledger, dining and student accounts have verified schemas and refuse to run without tenant flags that are off everywhere.
7. **The student surface is mostly device-local.** Files, AI threads, Career, Pathway, the feedback inbox and the learning map never leave the device. Only two flags default to production: `journeyNavigation` and `today_action_center`.
8. **AI is governed on one path only.** The institution gateway enforces identity, tenant, role, course scope, course AI rules, data class and budget. The student's own-key and proxy routes have no server-side policy, and consent is read by no AI path.
9. **Outcomes are defined, not measured.** Three server marks (`opened`, `course`, `studied`) are the whole outcome instrumentation. No faculty outcome framework exists.

## What can and cannot be said

From the repo's own claims discipline (`app/src/lib/ops/claims.ts`: 40 claims, none "available") and the Perplexity-derived positioning in the founding brief:

| Say | Do not say |
| --- | --- |
| "Semester is building the unified operating system for education: one connected platform for the student journey, learning, academic operations, campus services, institutional intelligence and governed AI." | "Semester replaces Canvas, the SIS, the registrar, ChatGPT and Google tomorrow." |
| "It can connect to existing systems during transition and become the authoritative layer for domains an institution chooses to modernize." | "Semester is the system of record" for any domain. |
| For a pilot: "Begin with one measurable workflow, such as registration readiness, then prove value before expanding." | Any outcome, retention, ROI, compliance, accessibility or security-certification claim. None is evidenced. |

## Reconciliation with existing documents

The audit found places where documents and code disagree. These are corrections owed, recorded here so they are not copied forward. Where this set cites a number, it cites the code.

| Document | Says | Code says |
| --- | --- | --- |
| `docs/DOMAIN-REPLACEMENT-REGISTER.md` (data: `app/src/lib/replaceregister.ts`) | Registration is "sandbox only … no rules engine, no registrar override" | `supabase/migrations/20260929300000_registration_transaction.sql` enforces prerequisites, clashes, credit ceiling, holds, waitlist, idempotency and registrar override; `supabase/registration_transaction.check.sql` walks it. Gated by `writeback.registration_submit` (off); no SIS feed. |
| same | LMS has "no gradebook of record" | `20260929310000_gradebook.sql`, `app/src/lib/gradebook/`, `supabase/gradebook.check.sql` (93 checks). Gated by `writeback.lms_grade_passback` (off). |
| same | Dining is "sandbox only … no balances of record" | `20260929330000_dining.sql` (ledger in integer cents), `supabase/dining.check.sql` (137 checks). Gated by `module.dining` and a card-office connection that does not exist. |
| same | Account deletion "checks no hold" | `20260930140000_erase_respects_holds.sql`; `supabase/legal-holds.check.sql` |
| same | Action Center and five destinations are "flagged off" | `app/src/lib/experience-flags.ts`: both default to `production` |
| `docs/ROLE-PERMISSION-MATRIX.md` | 84 capabilities, 157 grants | About 96 capabilities in migrations; `config:*`, `workflow:*`, `hold:*`, `override:*`, `guardians:manage` missing. Re-render. |
| `docs/INTEROPERABILITY-ROADMAP.md` | LTI 1.3 "Planned" | Built and tested against synthetic platforms (`supabase/functions/lti/index.ts`) |
| `docs/LTI-1.3-LAUNCH-RUNBOOK.md` | Membership join "logged but not acted on" | `sessionDecision` and `placementDecision` enforce it |
| `docs/SYNC-SIMULATION-SANDBOX.md` | "Nothing here is built yet" | `app/src/lib/integration/simulate.ts` and `private.integration_simulation_runs` exist |
| `docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` | "Nothing here is built yet" | 15-case deterministic set in `app/src/lib/governance/model-quality.ts`; filed 21-case run |
| `docs/ai-governance/README.md` finding 5; `RP-02` | Data-class gate not on the server | D-1260 added a field-level T2 ceiling on the gateway and shared-key function |
| `docs/CONFIGURATION-STUDIO.md` | Workflow Builder "not started" | `app/src/lib/workflow`, `workflow_versions`, `supabase/workflow-builder.check.sql` |
| `docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md` | Supporter features unbuilt; flag `me.supporter_sharing` | Share codes and shared items built (`20260928306000`, `20260928307000`); the flag exists nowhere in code |
| `docs/FEATURE-TRUTH-TABLE.md` | Customer portal planned | `supabase/functions/billing-portal/index.ts` exists |
| `docs/API-PLATFORM.md` | "Nothing is mounted" | `app/api/productivity/[...path].ts` mounted 2026-10-04, off by default |
| `FEATURE-INVENTORY.md` | 52 destinations, 260 test files | 63 destinations plus nested screens; about 1,340 test files |
| `docs/DATA-INVENTORY-AND-LINEAGE.md` | 302 public tables | About 321 in migrations, 319 in production |
| `docs/ROLE-LAUNCH-REGISTER.md` line 134 | `business_admin` holds no capability | Same page lists four `finance:*` capabilities for it |
| `app/src/lib/rollout-capabilities.ts` | All 60 capabilities `currentState: 'verified'` | `docs/product/capability-inventory.md` lists early_access and missing operational tests. Treat `verified` as plan inventory. |

## How to use this set

- **Path convention:** a path with a leading `app/`, `supabase/`, `packages/` or `docs/` is repository-relative. A bare `lib/...`, `ai/...`, `components/...`, `state/...` or `intelligence/...` is relative to `app/src/`; a bare `_shared/...` is relative to `supabase/functions/`; a bare `integration/...` is relative to `app/src/lib/` (tests) or `app/server/` as the surrounding text says.

- Start with the [product map](EDUCATION_OS_PRODUCT_MAP.md) for what exists, then the [authority matrix](DOMAIN_AUTHORITY_MATRIX.md) before touching any record domain.
- Before changing a status in any of these documents, change the code or test that earns it and cite the path.
- Do not duplicate: the existing registers remain the executable sources (`replaceregister.ts`, `rollout-capabilities.ts`, `rolelaunch.ts`, `claims.ts`). This set adds the cross-domain view, the gates and the plan.
- Per `CLAUDE.md`: check `origin/main` for the thing itself before starting any item from [the backlog](EDUCATION_OS_BACKLOG.md). Several sessions work this repository at once.
