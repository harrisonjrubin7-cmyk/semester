# Education OS release gates, test strategy, outcomes and launch readiness

Status: Phase 0 baseline and plan, assessed 2026-10-05 at `790ebbf`. This document adds the education-OS layer on top of the existing gate machinery; it does not replace it. Controlling records, in precedence order: `GO-NO-GO-DECISION.md` (2026-10-03, "repository recommendation, not approval"), `BETA_EXIT_CRITERIA.md`, `docs/RELEASE-GATES.md` (G1 to G10), `docs/DEFINITION-OF-DONE.md` (nine questions, rendered from `app/src/lib/launchcompleteness.ts`), `docs/LAUNCH-READINESS-COUNCIL.md`, and the executable evaluator `app/src/lib/governance/release-profiles.ts` (cumulative evidence per motion, fail-closed; generated doc `docs/PILOT-AND-INDIVIDUAL-RELEASE-PROFILES.md`).

## 1. Where the program stands

| Motion | Decision (2026-10-03) |
| --- | --- |
| Individual student acquisition | Conditional go, yellow: invitation-only and unpaid. Broad or paid is no-go |
| Design-partner institutional pilot | Green for non-activation work only: discovery, synthetic demos, evidence exchange, scoping. No live data, tenant activation or logo claims |
| Paid institutional pilot | No-go, red |
| Broad enterprise sale | No-go, red |

`docs/RELEASE-GATES.md` G1 to G10: none MET (G5 restore UNMET; G8 integration "UNMET and correctly off"; G10 policy, checkout and claims UNMET). That document is dated 30 September; counts may lag. `docs/operating-model/RELEASE-CERTIFICATION.md` (generated from code): NOT GO, 38 blockers. Council: 7 of 12 seats held, mostly by the founder acting; none has signed. Test baseline reported by the repository: 19,610 passed, 48 skipped, 1,257 files, 0 failures (`GA_FINAL_VERIFICATION.md`, 2 October; `docs/finalization/P07-VALIDATION-EVIDENCE-2026-10-03.md` records 19,612 passed in both ordered and shuffled runs). Not run: HawkScan, an external pen test, a qualified accessibility review, production restore drills (as of 2 October; the 3 October decision says the review-train PR passed hosted CI, PG17 and HawkScan for its recorded head, which is not target-environment proof).

The ten blocker priorities named in the decision include an immutable published candidate, DAST plus an independent security assessment, a qualified accessibility review, counsel-approved legal paper, entity, pricing, tax and insurance authority, staffed support, restore and rollback drills, named customer scope, baseline and outcome authority, and repeatability.

## 2. Education OS gates

Two layers of gate apply to anything in this set.

**Layer 1: capability exposure** (existing). A capability moves `hidden` to `early_access` to `institution_controlled` to `live` through `app/src/lib/governance/capability-governance.ts` and `rollout-capabilities.ts`, only with target-bound, dated evidence. Repository maturity L0 to L9 is independent of exposure. This stays the gate for features.

**Layer 2: domain authority** (new). The fifteen gates in [DOMAIN_REPLACEMENT_MATRIX.md](DOMAIN_REPLACEMENT_MATRIX.md) decide whether a domain may become authoritative for a tenant. Layer 2 sits above layer 1: a feature can be `live` while its domain is `synchronized`.

**Gate ownership.** Each gate has an owner seat. Today most seats are held by one person (`FR-006` in `LAUNCH-RISK-REGISTER.md`); a gate whose owner is also the author does not count as independent (gates 3, 4, 7, 11, 13 require a second party).

### Gates per release motion

Cumulative: each motion requires everything in the rows above it.

| Motion | Adds | Evidence that exists | Evidence missing |
| --- | --- | --- | --- |
| M0 Individual, invite-only, unpaid | Student OS on, device-local by default, honest source labels, `today_action_center` and `journeyNavigation` | Test suites; claims register; a11y smoke | Qualified accessibility review; staffed support; restore drill |
| M1 Individual, paid | Billing live for the monthly plan; refund, failure, dispute, tax paths exercised | Monthly acceptance (`docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md`) | Annual, refund, failed renewal, dispute, jurisdiction tax; entity and price authority |
| M2 Design-partner pilot, synthetic | Demo tenant; sandbox integrations; evidence exchange | `app/server/institution/sandbox.ts`, sandbox flows | none required beyond honest labels |
| M3 Pilot with real tenant, read-only | Real SSO (SAML), SCIM optional, read-only roster and catalog, mirror source states, flags per module, no writes | Foundation suites | A live IdP acceptance; a real adapter (`ADAPTERS` non-empty); freshness and reconciliation running; named customer scope; counsel-approved DPA; support rota; pen test; accessibility review |
| M4 Pilot with controlled writes | One workflow (for example registration readiness handoff) with idempotency, rollback and audit | Registration and gradebook DB suites | Gates 6, 8, 13 evidenced for that workflow; institution approval; reconciliation passing |
| M5 Domain replacement (per domain) | Gates 1 to 15 | Mechanisms only | Everything operational |
| M6 Multi-campus and enterprise | Hierarchy resolver in runtime; system console; contract recorded | Policy trigger | Resolver consumer; `contracts/` populated; support SLA |

## 3. Test strategy

The repository already argues from measurement (`CLAUDE.md`), so tests here follow its standard. Every command runs from `app/`.

### Layers

| Layer | What it proves | Where | Gate |
| --- | --- | --- | --- |
| Type and style | Contracts | `npx tsc -b`; `npm run lint`; `npm run check:university` (the gateway's NodeNext typecheck; `tsc -b` can be green while it is red) | CI |
| Unit and component | Behaviour | `npm test`; `npm run test:shuffle` (green `test` with red `test:shuffle` means tests depend on each other; fix the earlier file) | CI |
| Database policy | RLS, definers, grants, ledgers | `supabase/*.check.sql` (111), `supabase/check.sh`, run on a throwaway Postgres in CI | CI; local PG17 rerun absent per `capability-registry.md` |
| Structural | Properties a runtime probe can miss | `src/rootunmount.test.ts`; `tableclassification.test.ts`; `donotbuild.test.ts`; retention test | CI |
| Contract | Schema drift | `docs/SCHEMA-DRIFT-AND-CONTRACT-TESTING.md`; OpenAPI held equal to code for the productivity API | CI |
| Conformance (new) | Standards behaviour | LTI launch fixtures exist; add OneRoster CSV and REST fixtures (valid and deliberately broken), and a 1EdTech conformance run when a partner exists | Per adapter |
| End to end | Golden paths | `npm run smoke:golden`, `smoke:cold`, `smoke:a11y`, `smoke:pilot` | Release |
| Isolation (extend) | Non-database layers | `packages/platform/src/testing/conformance.ts` with real adapters (7 deliberately leaky adapters exist as controls) | Gate 5 |
| Load and soak | Capacity | `docs/LOAD-AND-SOAK.md` pgbench harness; `plans` scenario has an intermittent stall | Release |
| AI | Quality, injection, leakage, integrity, tools, crisis, cost | [AI governance](AI_GOVERNANCE_AND_MODEL_ROUTING.md) section 5 | A model's `approved` state |
| Accessibility | WCAG conformance | Automated smoke now; qualified review and assistive-technology walkthroughs owed | Gate 3 |
| Security | DAST, pen test, secrets, supply chain | HawkScan (`stackhawk.yml`), gitleaks, SBOM; external assessment owed | Gate 4 |
| Recovery | Restore and rollback | `RESTORE.md`, `ROLLBACK.md`, `docs/drills/`; runsheet exists, "drill not run, nothing measured" | Gate 13 |

### Rules (from `CLAUDE.md`, applied here)

- **A guard that has never failed is not known to be a guard.** Every new test lands with its revert: remove the fix and watch it go red, restore it.
- **Include a control** in any measurement: a case the probe must flag and one it must clear.
- **A clean reading is a claim about the probe.** Before believing a probe cleared a suspect, find out which signal is lying.
- **Prefer a structural check to a runtime probe** when both could do the job.
- **Look at the screenshot** for visual change (`.claude/skills/run`).
- **Shuffle is weak evidence for timing failures.** A seed fixes order, not the race. Do not report consecutive green shuffle runs as proof of no leak.
- A new `supabase/*.check.sql` case for every new table: second-tenant account cannot read or write; erase and export reach it; a hold blocks its sweep.
- Contrast: `lib/contrast.test.ts` walks the whole ramp for both rungs; a new ground is measured against every surface it has.

### Traceability

Each backlog item carries a requirement id, the graph edge or gate it serves, and the named tests that hold it. `docs/platform/TRACEABILITY.md` is the existing matrix for the platform spine; extend it, do not fork it. A gate cell in the replacement matrix may change only in the same pull request that adds the cited evidence.

## 4. Outcome frameworks (Phase 6)

**Today:** exactly three server marks (`opened`, `course`, `studied`) in `public.activity`, one row per account per day per mark, yield activation, weekly active use and 30-day retention (`ANALYTICS.md`, `supabase/analytics.sql`). `docs/ANALYTICS-EVENTS.md` defines more events (path_created, plan_saved, action_completed, agenda_created and others) and nothing is sent. D-005 requires a fourth mark to land with its question and migration in the same pull request. `docs/COMPANY-FIRST-YEAR-MEASURES.md`: 23 measures, 3 measured, 4 instrumented, 16 defined, no targets. `docs/INSTITUTIONAL-TRUST-SCORECARD.md`: 15 metrics, mostly gray (no baselines). `docs/strategy/SCORECARD.md` proposes a north star, Cohort Weekly Action Rate (CWAR), with a notification-mute guardrail; all proposed. Outcome and ROI claims are prohibited (CLM-014). **There is no faculty outcome framework.**

Ethics constraints, held in code: forbidden metrics (`FORBIDDEN` in `app/src/lib/institution-ops.ts`: risk score, attention, wellbeing, location and others) and a small-cell floor of 10 (`MIN_COHORT`, `cohortfloor.test.ts`). Every framework below respects them and defines its baseline owner before its target.

Each metric lists: definition, instrument (existing or new), baseline authority, and target status. All targets are `[DECIDE]` and need a decision file.

### Students

| Metric | Definition | Instrument | Today |
| --- | --- | --- | --- |
| Action clarity | Share of sessions where the student can name the next action within one screen; survey item plus time to first meaningful action | Survey; `opened` to first action | Not instrumented |
| Meaningful action completion | Actions marked done that the student chose from Today, among those surfaced | New mark `action_completed` (defined in `ANALYTICS-EVENTS.md`, unsent) | Defined |
| Learning progress | Self-reported and course-published checkpoints met | `studied`, `course` marks plus faculty checkpoints | Partial (device) |
| Time and effort efficiency | Median time from syllabus import to a complete plan; weekly planning minutes | Client timing, aggregate only | Not instrumented |
| Support access | Time from help request to first human response; share resolved | `help_requests` timestamps; `support_tickets` | Tables exist, no data |
| Confidence | Pulse survey item, opt-in | Survey | Not instrumented |
| Career readiness | Skills confirmed, evidence items saved, opportunity actions | `career-evidence`, `skill_records` | Device-only; not measurable server-side |

### Faculty

| Metric | Definition | Instrument | Today |
| --- | --- | --- | --- |
| Course clarity | Share of courses with published rules, guidance and a pack; student-reported clarity | Course Studio publications | Flag off |
| Workload reduction | Self-reported minutes saved per week on routine tasks | Survey with baseline | Not defined |
| Feedback cycle | Median days from submission to release | Gradebook entries | Flag off |
| Policy enforcement | Share of AI interactions in a course consistent with its `course_ai_rules`, from the gateway audit | `gateway_intelligence_audit` with course id | Gateway undeployed |
| Learning insight | Which course-level aggregates a faculty member opened and acted on | New | Not started; aggregates only, n>=10 |

### Institutions

| Metric | Definition | Instrument | Today |
| --- | --- | --- | --- |
| Student activation | Share of invited students active in week one | `opened` | Measured only for individuals |
| Retention proxies | 30-day return, term-over-term use; never a prediction about a person | `activity` | Measured |
| Support load | Avoidable contacts deflected, tracked against the institution's own baseline | Institution data | No baseline |
| Workflow completion | Registration readiness checklist completion at the institution's window | `registration-day` events | Device-local |
| Data quality | Reconciliation discrepancy count and age; freshness misses | `reconcile.ts` runs | Never scheduled |
| Vendor consolidation | Systems retired or downgraded with evidence | Institution record | Zero |
| Implementation consistency | Variance in time-to-live across tenants | `tenant_rollout` history | No tenant |
| Operating cost | Institution-reported cost per workflow, before and after | Institution data | None |
| Trust and compliance evidence | Trust scorecard states | `app/src/lib/institutional-trust-scorecard.ts` | Mostly gray |

### Semester

| Metric | Definition | Today |
| --- | --- | --- |
| Platform adoption | Weekly active share among invited | Measured for individuals |
| Renewal, expansion, gross and net revenue retention | Standard definitions over booked institutional revenue | No customer, no revenue evidenced |
| Implementation capacity | Concurrent migrations a team can run; hours per migration | None run |
| Reliability | SLO attainment measured, not asserted (`error-budgets.ts` targets; "no data is not green") | Targets only |
| Security posture | Open findings by severity; time to remediate | Repo-level only |
| AI cost and margin | AI spend per active user against plan allowance | `ai_spend_meter` exists; allowances proposals |
| Migration throughput | Records reconciled per day; rehearsal pass rate | None |
| Partner ecosystem growth | Certified integrations, active partners | Zero; marketplace held |

### Moat evidence

The brief's four moats are claims until evidenced; each names its test.

| Moat | Evidence that would show it | Today |
| --- | --- | --- |
| Education graph | A cross-domain query a competitor cannot answer without Semester's graph, in production, for a customer | Edges mostly device-local or flagged off |
| Policy and trust | AI interactions that carry all thirteen controls end to end, audited | One path, undeployed |
| Migration | A completed migration with reusable field maps and a measured throughput gain on the second | None |
| Outcome | A signed baseline and a measured change with the sponsor | None |

## 5. Launch readiness plan

Launch is per motion, not one date.

1. **M0 hardening (now to day 30):** immutable candidate; accessibility review booked; support rota and runbook exercised once; restore drill on target; claims audit of the public site against `claims.ts` (the gap matrix names three contradictions: 24/7 support versus one responder, 6 to 8 week pilot versus the 26-week pilot, "SOC 2 index" versus "report not held"); the shared AI key activated or removed from the surface.
2. **M2 design-partner (day 15 to 60):** one named partner; synthetic demo; evidence exchange; scoping against the authority matrix; no live data.
3. **M3 read-only pilot (day 60 to 120):** legal paper; DPA; real SAML acceptance; first live adapter; reconciliation scheduled; pen test; baseline frozen with the sponsor.
4. **M4 controlled write (day 120 onward):** one workflow, institution approval, rollback exercised.
5. **M5 per-domain replacement:** only per the fifteen gates; none is planned inside the first year without a design partner who asks for it.

Go and no-go: the existing council and `decide()` in `app/src/lib/launchreadiness.ts` compute the verdict from gate states; this program feeds them evidence and never edits a verdict.
