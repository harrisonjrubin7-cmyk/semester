# Semester complete operating system: the master operating map

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Status** Phase 0 deliverable, proposal for the owner. It records no decision and closes no risk.

> **Claim ceiling.** This set is a reading of the repository from four read-only audits plus the author's spot-checks. **Nothing was run in production, no tenant was activated, and no customer exists.** "Verified" in this set means held by an automated test in the repository. The repository's own verdict stands: launch council `NO-GO`; paid institutional pilot and broad enterprise sale `NO-GO / RED`; 0 of 142 master-register rows `operational` or `launch-approved`; 0 of 14 institutional domains replaceable; 0 of 18 external evidence items closed. If a sentence here reads stronger than those, the sentence is wrong.

## What Semester is

The unified, AI-native operating system for education, in place of the fragmented infrastructure of learning, academic life, student support, campus services, institutional operations, productivity and AI.

**Build everything natively. Integrate responsibly. Replace only with proof. Operate every domain as one system.**

This set does not narrow that thesis. It makes it testable: for every one of forty domains it says what exists, who holds the record, what would have to be true to replace the incumbent, and what comes next. The honest summary of the position is one sentence: **the repository holds an unusually large and disciplined body of native building blocks and governance, and almost none of it has met a real user, a real institution, an independent assessor or a restore.**

## Read this set in this order

| # | Document | Answers |
| ---: | --- | --- |
| 0 | This page | Map, headline truth, architecture, test and release strategy, team, next 25 actions |
| 1 | [Product universe](SEMESTER_PRODUCT_UNIVERSE.md) | What Semester must become; the shared spine; experience requirements |
| 2 | [Domain catalog](SEMESTER_DOMAIN_CATALOG.md) | Forty domains on the 36 required fields |
| 3 | [Role catalog](SEMESTER_ROLE_CATALOG.md) | 69 roles, 84 capabilities, the model |
| 4 | [Capability matrix](SEMESTER_CAPABILITY_MATRIX.md) | Every capability classified on three axes; the 19 labels indexed |
| 5 | [Data authority matrix](SEMESTER_DATA_AUTHORITY_MATRIX.md) | Who holds the record in each domain |
| 6 | [Interoperability matrix](SEMESTER_INTEROPERABILITY_MATRIX.md) | Standards, systems, status, evidence |
| 7 | [Domain replacement gates](SEMESTER_DOMAIN_REPLACEMENT_GATES.md) | When a domain may be replaced |
| 8 | [Migration factory](SEMESTER_MIGRATION_FACTORY.md) | How authority moves, with evidence |
| 9 | [Trust and governance model](SEMESTER_TRUST_AND_GOVERNANCE_MODEL.md) | The sixteen controls; AI controls; findings |
| 10 | [Company operating system](SEMESTER_COMPANY_OPERATING_SYSTEM.md) | Functions, cadence, dashboard, budget, team |
| 11 | [Platform ecosystem](SEMESTER_PLATFORM_ECOSYSTEM.md) | APIs, OAuth, webhooks, sandbox, marketplace |
| 12 | [Outcome measurement and moat](SEMESTER_OUTCOME_MEASUREMENT.md) | Metrics, pilot protocol, kill criteria |
| 13 | [Risk register](SEMESTER_RISK_REGISTER.md) | 32 cross-cutting risks |
| 14 | [12-month plan](SEMESTER_12_MONTH_EXECUTION_PLAN.md) | Four quarters, gate-led |
| 15 | [Master backlog](SEMESTER_MASTER_BACKLOG.md) | P0 to P3, owners, closure evidence |

Five of these (catalog, capability matrix, authority matrix, replacement gates and the generated backlog) are **rendered** from `docs/master/tools/domains.py` by `python3 docs/master/tools/render.py`, so they cannot disagree. The rest are hand-written.

### What it stands on and does not replace

This set is an integrating layer. It links to the registers that already hold the answer rather than copying them.

| Concern | Controlling document |
| --- | --- |
| Motion decisions | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) |
| Domain replacement ladder | [`docs/DOMAIN-REPLACEMENT-REGISTER.md`](../DOMAIN-REPLACEMENT-REGISTER.md) |
| Launch readiness (142 rows, 9 rungs) | [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](../MASTER-LAUNCH-READINESS-REGISTER.md) |
| Capability activation (L0 to L9) | [`docs/CAPABILITY-ACTIVATION-REGISTER.md`](../CAPABILITY-ACTIVATION-REGISTER.md) |
| Row-level capability state | [`docs/program/CAPABILITY_TRACEABILITY_MATRIX.md`](../program/CAPABILITY_TRACEABILITY_MATRIX.md) |
| Program roadmap and critical path | [`docs/program/`](../program/README.md) |
| External evidence queue | [`docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md`](../finalization/EXTERNAL-EVIDENCE-QUEUE.md) |
| Constitution | [`docs/PLATFORM-CONSTITUTION.md`](../PLATFORM-CONSTITUTION.md) |
| Company controls | [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md) |
| Product requirement text | [`SEMESTER-MASTER-COMMAND.md`](../../SEMESTER-MASTER-COMMAND.md) (sections 46 to 63, 86 to 128, 226 to 300 supplied) |

The `docs/master/` directory is not under a governed documentation directory (`app/src/lib/docs/card.ts`), so its pages carry no card and no review clock. **A person must review each page against the code before relying on it**, and the first review should be by someone who did not write it.

## Method, and what was and was not checked

Four read-only audits ran in parallel on 2026-10-05 against origin/main 790ebbf: application code by domain; database, edge functions, server and CI; company, GTM, trust, security, SRE and finance documents; and the repository's own governance registers. They read headers, status lines, flags, file sizes and test presence. **They did not run tests, a build, SQL or the app**, and they did not inspect any deployed environment.

The author re-checked these headline figures directly: 182 migrations; 353 unique `create table` names; 354 `enable row level security` statements; 0 `force row level security`; 2,882 TypeScript files under `app/src`; 1,340 test files; 111 `supabase/*.check.sql` files; 16 edge functions; and the findings register (2 High, 8 Medium, 5 Low, which corrected an audit report that said 5 Medium). Everything else is reported as the audit or a named register states it. Where sources disagreed, the disagreement is listed in the [capability matrix](SEMESTER_CAPABILITY_MATRIX.md#known-disagreements-between-the-repositorys-registers) and not resolved here.

Per `CLAUDE.md`, `origin/main` was checked before starting: nothing named `docs/master` or a master operating map existed, and the recent merges (Phase 0/1 programme pack, ADR programme, screen inventory, productivity route) were read so this set links to them. The repository's gates (`tsc -b`, lint, tests) were not run because this change is documentation and one Python renderer; the docs-structure tests that scan `docs/` are run and reported in the pull request.

## Headline truth

| Question | Answer | Source |
| --- | --- | --- |
| Is there a customer, pilot, champion or revenue? | No. One live $7.99 Stripe test (2026-10-03) | `ops/customer-commitments/README.md`; billing acceptance record |
| Is any domain replaceable? | 0 of 14 | Replacement register |
| Is anything `operational` or `launch-approved`? | No: 0 of 142 | Master register |
| Is a tenant activated? | No | Activation register; GO-NO-GO |
| Does any external assurance exist? | No pen test, SOC 2, ISO, HECVAT, ACR, executed DPA | EXT queue; trust docs |
| Has production been restored? | No | `RESTORE.md` |
| Does an alert reach a person? | No | F-08 |
| Is tenant isolation on? | Off for every school; course rooms only | F-01 |
| How many people? | One, in every seat | Owner matrix |
| Is `main` healthy? | 26 of the last 30 runs failed; no ruleset | CI diagnosis |
| What is strong? | Test discipline (1,340 test files, 111 SQL suites, shuffle and time-zone runs), a schema with RLS on every table, append-only ledgers, kill switches, a claims register, honest self-assessment | The repository |

**Ratings across the 40 domains:** Native but incomplete 33; Designed/documented 8; Transitional 6; Pilot-only 4; Integrated 2; Not started 1; Native and verified 0. Readiness: Unsafe to activate 11; Not ready 27; Conditional (invitation-only individual validation) 2; Ready for pilot, production or system of record: 0. Authority: 0 domains hold an authoritative institutional record natively.

## 1. Complete architecture map

### Today (as built)

```
 Browser / device                       Hosting                      Backend (Supabase project)
 ┌───────────────────────┐       ┌──────────────────┐        ┌─────────────────────────────────────┐
 │ React SPA (Vite)      │       │ GitHub Pages     │        │ Postgres 17: 354 objects, RLS on all │
 │ ~100 screens, no URL  │──────▶│ (static; no      │        │  (forced on none), ~640 definer fns  │
 │ router, state.screen  │       │  security headers)│       │ Auth · Storage · pg_cron + Vault     │
 │ device state (local   │       └──────────────────┘        │ 16 edge functions (verify_jwt off,   │
 │ storage / IndexedDB)  │                                    │  each self-authenticates):           │
 │ optional account sync │────────────────────────────────▶   │  claude · billing-* (4) · lti ·      │
 │ encrypted offline vault│                                   │  calendar · fetchcal · canvas · push │
 └───────────────────────┘                                    │  integration-tick · delete-account ·  │
         │                                                     │  lead-intake · trust-room ·           │
         │ (institution only; off unless enabled)             │  support-reply-notify ·               │
         ▼                                                     │  productivity-sourcecheck             │
 ┌──────────────────────────────┐                             └──────────────┬──────────────────────┘
 │ Vercel (Node)                │      ┌──────────────────────────┐          │
 │  /api/institution/* gateway  │─────▶│ Sandbox adapters (SQLite)│          ▼
 │  /api/productivity/* service │      │ real adapter list EMPTY   │   Stripe · Resend · Anthropic ·
 │  SCIM (off) · AI routes      │      └──────────────────────────┘   OpenAI · map tiles · LMS (LTI)
 └──────────────────────────────┘
 packages/ (private TypeScript): contract · institution · offline-sync · platform (engines, 0 app importers)
 CI: GitHub Actions (ci, codeql*, hawkscan†, supply-chain, functions, pages, production-smoke, infra*, drift*)
     * conditional   † needs a key not present   Terraform written, nothing applied
```

### Trust boundaries

| Boundary | What crosses | Control | Gap |
| --- | --- | --- | --- |
| Student device ↔ cloud | Account-owned data | Auth JWT; RLS; export/erase | Tokens in `localStorage` (F-02); local data not cleared at sign-out (F-03) |
| Tenant ↔ tenant | Nothing should | `tenant_id` columns; RLS; membership-derived context | Isolation off per school (F-01); no negative suite |
| Semester ↔ institution systems | Connector data under approved scope | Integration control plane; adapters | No adapter; sandbox only |
| Semester ↔ AI provider | Prompts and citations under policy | Policy layers; kill switch; classification ceiling | BYOK bypass (F-04); gateway fence (F-05) |
| Semester ↔ payment provider | Hosted checkout only; no card data | Stripe-hosted | One live test |
| Operator ↔ customer data | Support and break-glass access | Time-limited grants; audit | One operator; platform-scoped outbox read (F-11) |
| Partner ↔ platform | API calls | Principal model (proposed) | Not built |

### Target (the shape Track B proposes, not built)

Twelve modules over a policy-decision-point command path (`auth → tenant → PDP → validation → idempotency → transaction → audit+outbox → response`), one membership-derived tenant context, forced RLS with non-bypass runtime roles, an event outbox feeding projections and webhooks, staged environments (sandbox, staging, production) per tenant, and a native-first `Core` vs `Connect` module mode per tenant (`tenant_module_mode`). See `docs/target-architecture/` (proposed; waves C0 to C7; M0 to M7). **A decision on whether Track B starts is PDR-05 and is the founder's.**

### Data flow principles

1. A fact enters with a **source** and a **freshness**; it keeps both.
2. Writes to an institution's record go through a **command path** with idempotency and audit, never from the browser.
3. Derived data (search, analytics, AI context) is **scoped** by tenant, class and consent.
4. **Export and erase** are first-class on every store; legal holds override sweeps.
5. **Degraded sources** are shown as degraded.

## 2. Complete domain catalog, capability matrix, role matrix, data authority

See documents 2 to 5. Counts in one place: 40 domains; 52 named capabilities rated; 69 roles and 84 capabilities in the database; authority classes S 15, X 18, S+X 2, C 5 (see the authority matrix for the per-domain assignment).

## 3. Integration and migration factory

Documents 6 and 8. The only built, tested external-facing standards are LTI 1.3 (zero registrations), SCIM 2.0 (off), QTI 3 (library) and ICS. The migration factory is eight stations (M0 to M8) with a run record, a reconciliation report and a signed change record; it has never run on real data.

## 4. Domain replacement gates

Document 7: four stages (G-A pilot-ready, G-B production-ready, G-C authoritative system of record, G-D repeatable), the twenty release gates, and the fifteen replaceability requirements. Never replaced: emergency response, identity provider, payments (hosted only), health records, legal processes. Handoff only: financial aid.

## 5. Security, privacy, accessibility and control model

Document 9, with the sixteen non-negotiable controls, the AI controls, 15 findings and the compliance posture table. **Accessibility** deserves a separate line: automated tests exist and a self-assessment was published, but no qualified human evaluation exists, so the product may not be called accessible or WCAG-conformant, and the gating item is EXT-008.

## 6. Company operating system

Document 10. One person; seats listed; functions mapped; cadence; fourteen dashboard tiles; the commercial model; capacity.

## 7. Platform ecosystem plan

Document 11. Integrations, then extensions, then a curated directory; the marketplace is deferred.

## 8. Outcomes and moat plan

Document 12. 22 metrics, a pilot protocol, kill criteria; the moat candidates with their proofs.

## 9. 12-month roadmap

Document 14. Four quarters, gate-led; the first quarter makes the foundation provable, the second decides whether one tenant can pilot.

## 10. P0 to P3 backlog

Document 15. 72 items: see the totals there.

## 11. Required team and ownership model

The twelve council seats are the owner model; each domain card names its seat. **The model works only with a second person.** Minimum structure: an independent reviewer for security, privacy and release; counsel; a qualified accessibility evaluator; a second operator; and the customer's seven seats. Hiring follows the ten gates in `docs/finance/12-GATED-HIRING-SCHEDULE.md` (gate G9 first). Roles are defined in the [company operating system](SEMESTER_COMPANY_OPERATING_SYSTEM.md#required-team-and-ownership-model).

## 12. Required external systems

| System | Why | State |
| --- | --- | --- |
| Counsel (corporate, education privacy, contracts) | Entity, public policies, institutional paper, claims | Not engaged |
| Qualified accessibility evaluator | ACR; "accessible" claim | Open (EXT-008) |
| Independent security assessor | Penetration test; assessment | Assessor, scope, date open (EXT-006) |
| SOC 2 auditor | Report | Not engaged |
| Tax, accounting, insurance | Invoicing, runway, cover | Open (EXT-004, EXT-005) |
| Supabase second project and PITR | Restore drills; recovery | Second project exists per drill script; PITR unverified |
| Hosting that can send security headers | CSP, HSTS | GitHub Pages cannot (F-06); decision LAUNCH-DECISIONS item 6 |
| Monitoring, alerting, paging and status page | Detect and respond | None (F-08) |
| DAST (StackHawk key) | Runtime scanning | Key absent (EXT-007) |
| A sandbox LMS (Canvas, Brightspace) and a test IdP (Entra, Okta, Google) | First real integrations | Not set up |
| A SIS vendor sandbox | Read-only adapter | Chosen by the first design partner |
| Payment provider (Stripe live, tax) | Individual billing | Live-mode test done; tax unexercised |
| Email provider (Resend) and company-owned mailboxes | Support, security contact | Personal mailboxes (F-13) |
| AI providers with accepted commercial terms and a retention setting | Shared key | Blocked pending five items |
| CRM and accounting systems | Pipeline and books | None (CRM tables only) |
| 1EdTech membership | LTI/OneRoster certification | Not pursued |
| A design partner | Everything customer-shaped | None |

## 13. Test strategy

What exists is strong at the repository level. What is missing is exactly what a customer will ask for.

| Layer | What exists | Gap to close |
| --- | --- | --- |
| Unit | `vitest`, 1,340 test files; ordered and shuffled runs; non-UTC time-zone runs; `rootunmount.test.ts` guards React teardown | |
| Database | 111 `supabase/*.check.sql` suites run on PostgreSQL 17 in CI; load and restore rehearsals | **Cross-tenant negative suite per object class (TI-01..TI-12)**; per-function definer tests |
| Contract | OpenAPI test; schema drift and contract testing docs; table-classification test | Institution gateway contract; webhook contract |
| Integration | `account-sync` job (local Supabase, two devices); `postgres.integration.test` | Real SIS/LMS sandbox; staging |
| End to end | Playwright cold routes, accessibility smoke, golden path | Per-role journeys against staging |
| Accessibility | axe in tests; contrast sweep daily | **Assistive-technology testing; qualified evaluation** |
| Security | Secret scan; `npm audit`; supply-chain attestations; CodeQL (conditional) | DAST run; penetration test; threat record per feature |
| AI | Live tests with keys; injection red-team set (one run) | Held-out evaluation per role; run on every model or prompt change |
| Performance | Budgets in CI; load harness | Registration-day load at 5x a partner's peak |
| Reliability | Hourly public production smoke | Measured restore; chaos in staging; alert tests |
| Production | One public smoke observation | Retained, accepted smoke history |
| Drills | Kill switch 3 of 3 (synthetic account); offboarding rehearsal (synthetic) | Target-environment drills (EXT-011) |

**Rules.** A guard that has never failed is not known to be a guard: revert the fix under the new test and watch it go red (`CLAUDE.md`). Include a control. A clean reading is a claim about the probe too. Look at the screenshot for anything visual.

## 14. Release strategy

| Stage | Today | Proposed |
| --- | --- | --- |
| Integration | Merge to `main`; CI on every change | Ruleset requiring `build`, `account-sync`, `secrets` and one code-owner approval (written, not applied) |
| Candidate | None frozen | Tag a candidate from a green `main` SHA; hosted CI on that exact SHA; PDR-01 |
| Environments | Production only; staging "never run" | Isolated staging first (Phase 1 step 6) |
| Schema | Supabase Branching on `supabase/`; no workflow applies migrations | A change record per migration; apply to staging first; read back |
| Functions | `functions.yml` deploys changed functions after CI | Keep; add post-deploy smoke |
| App | `pages.yml` deploys after CI success | Move to a host that sends headers |
| Exposure | Every flag default off (`journeyNavigation` and `today_action_center` default on with an off rollback); `feature_state` off/preview/sandbox/production per tenant | Same; staged by cohort |
| Rollback | `ROLLBACK.md` (code); flags and kill switches | Rehearse; add canary and automated rollback |
| Evidence | `docs/evidence/` | Each release names its exact SHA, its CI run and its evidence files |
| Approval | One person | An independent reviewer before any tenant-facing change |

Release gates are the twenty in the replacement gates document. A release that touches a high-risk domain (money, records, grades, safety, family, identity, integration) additionally needs its activation profile (agreement, data map, authorisation, accessibility, integration, recovery, operations, rollout, claims) complete for the tenant.

## 15. Budget and capacity

Document 10. The model is a hypothesis; opening cash is a $0 placeholder; the first act is to enter real numbers. The one hard constraint is that the plan needs a second person and outside assessors, and neither is funded in evidence.

## 16. Risk register

Document 13. Top five: no demand evidence (25); one person (20); a one-person vendor cannot be a system of record (20); scope (20); and the four 16s (no alert, unreviewed paper, claims above evidence, no accessibility evaluation).

## 17. The next 25 actions, in order

Order is by dependency and evidence value, not by size. Each has an owner seat, a first step, and the evidence that closes it. "Founder" means the person holding that seat today.

| # | Action | Owner seat | First step | Closed by |
| ---: | --- | --- | --- | --- |
| 1 | Review this set and correct it | founder | Read the capability matrix's ten disagreements first; a second reader | A review note; corrected pages |
| 2 | Fix the two causes of the `main` CI red | engineering | Read `docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md`; fix stale generated counts (`npm run registers`) and the load timing gate | Green `main` on three consecutive merges |
| 3 | Apply the `main` ruleset | operations | Apply `.github/rulesets/main.json` and read it back | `docs/evidence/` readback |
| 4 | Name a second person: independent reviewer, backup, second operator | founder | Decide the candidate; amend the owner matrix | Matrix updated; the person has console access |
| 5 | Enter real cash, costs and one price book | finance | Fill `docs/finance/13-REAL-NUMBERS-INTAKE.md` | Runway computed from real cash |
| 6 | Engage counsel | founder | Send `docs/COUNSEL-BRIEF.md`; ask for entity, public policies, paper | Engagement letter |
| 7 | Scope and book the accessibility evaluation | accessibility | Request quotes from qualified evaluators | Dated engagement (EXT-008) |
| 8 | Scope and book the penetration test | security | Request quotes with the scope in `docs/trust/PENETRATION-TEST-PLAN.md` | Assessor, scope, date (EXT-006) |
| 9 | Fix or withdraw the 15 over-evidence site statements; verify the deployed revision | founder | Work C-01 to C-15 in `docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md` | A live check recorded |
| 10 | Run the restore drill into the second project | operations | Follow `docs/program/STEP_1_RESTORE_DRILL_RUNSHEET.md` with a non-author witness | Measured time in `RESTORE.md` |
| 11 | Deliver one alert to a person | operations | Wire the cost alert and a synthetic failure to a pager | A recorded acknowledgement |
| 12 | Route the BYOK path through the AI kill switch | engineering | Write the failing test first (F-04) | Test green; drill repeated |
| 13 | Stand up isolated staging | engineering | Second project or branch per `STAGING.md` | Migrations applied there; suites run |
| 14 | Write the cross-tenant negative suite TI-01..TI-12 in staging | security | One object class first | CI job red-then-green on a deliberate break |
| 15 | Apply the anon grant reduction | security | Run `database/proposed/anon_grant_reduction.sql` on a branch | Catalog readback; suites green |
| 16 | Human-review the table classes, T3 and above first | data | Take `database/schema/table-classification.json` | Reviewed flag per table; a reviewer who is not the author |
| 17 | Record ten design-partner discovery interviews | founder | Use the discovery script | `docs/pilot/DISCOVERY-EVIDENCE-LOG.md` has findings |
| 18 | Decide Track B; accept or reject ADRs 0001 to 0005 | founder | PDR-05; `docs/decisions/ADR_INDEX.md` | Decisions recorded as `D-<PR>.md` |
| 19 | Reconcile the ten register disagreements and regenerate | product | `npm run registers` from `app/`; compare | Zero disagreements, or each recorded |
| 20 | Resolve SAML and OIDC status | security | Check Supabase SSO config and code | Evidence file stating the path |
| 21 | Register Semester as an LTI tool in a sandbox LMS | engineering | Stand up a Canvas or Brightspace sandbox | Launch and passback recorded |
| 22 | Run the first migration-factory runs R1 to R3 | engineering | OneRoster CSV roster in the sandbox | Three run records |
| 23 | Adopt the policy gateway on ten sensitive actions; one tenancy source | engineering | Phase 1 steps 7 and 8 | Command path in code with tests |
| 24 | Mount the productivity API in staging with its Postgres integration test | engineering | Phase 1 step 9 | Integration test green in staging |
| 25 | Choose the design-partner profile and draft the pilot protocol | founder | Use the metric dictionary and `PILOT-SCORECARD.md` | A protocol a partner can sign |

Actions 1 to 12 take no new engineering capability; they are decisions, engagements and fixes. Actions 13 to 25 are the Phase 1 spine and the first real data path.

## 18. Traceability

| From | To | How |
| --- | --- | --- |
| A domain card | Code | `ev` paths in `domains.py` (each is a repo path) |
| A domain card | Tests | `tests` field |
| A backlog item | Domain, owner seat, closing evidence | Rendered row |
| A rating | A register row | The mapping table in the capability matrix |
| A claim | The claim library | `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` |
| A decision | `D-<PR>.md` | Per `docs/decisions/README.md`; **this PR records none** |
| An evidence file | A run id | The run record schema in the migration factory |

To change a rating: edit `docs/master/tools/domains.py`, run the renderer, and cite the evidence path. Raising a rating above `tested` needs a current artifact under `docs/evidence/` (the repository's own rule for `evidenced`, `operational` and `launch-approved`).

## 19. Things deliberately not done

- No production-impacting change. No flag, migration, deployment, secret or tenant was touched.
- No decision record. A decision takes its pull request's number (`CLAUDE.md`); adopting this set, the plan or the sequencing is the owner's decision and gets its own `D-<PR>.md` when taken.
- No existing register was edited. Disagreements are listed, not silently resolved.
- No new claim. Nothing here lifts a claim ceiling.
- No "100% complete" or "ready" language anywhere.
