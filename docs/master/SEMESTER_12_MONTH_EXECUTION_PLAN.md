# Semester 12-month execution plan

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Window** October 2026 to September 2027 · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** **This is a proposal for the owner to adopt, not a commitment.** The repository's own programme pack sequences by gate, not by date, because "every path begins at a node with no estimate and runs through outside parties" (`docs/program/02-DEPENDENCIES-AND-CRITICAL-PATH.md`). The month windows below are planning targets that assume the outside parties (counsel, an accessibility evaluator, a security assessor, a design partner) can be engaged on the lead times stated. If a gate is not met the window moves; the gate does not. No date here may be quoted publicly.

## Shape

Four quarters, each ending in a **go/no-go review** against evidence. The plan is deliberately narrow in what it builds and wide in what it proves. Of the forty domains it builds, at most, the foundation (Phase 1) plus the one or two domains a named design partner chooses. It does not start the marketplace, native financial aid, native registration, or any domain for which no institution has asked.

```
Q4 2026   MAKE IT PROVABLE        Gate 1 (Phase 1 spine) → PASS or PASS WITH DATED EXCEPTIONS
Q1 2027   MAKE IT CONNECTABLE     First real data path in a sandbox; independent assessments delivered
Q2 2027   MAKE IT PILOTABLE       G-A for one named tenant, if and only if the checklist passes
Q3 2027   PROVE AND REPEAT        Pilot underway for the term; second tenant discovery; first outcome readout planned
```

The academic calendar sets a hard constraint: **academic outcomes need a term**. A pilot that activates in late August 2027 reads out in December 2027, after this window. Within the window the plan can show *operating* evidence (it ran, it reconciled, it was supported), not *outcome* evidence.

## Standing rules

1. A gate review passes only on evidence a person other than the author has read. Until a second person exists (action 4 below), the review records "self-review".
2. No quarter starts a domain build while a P0 in security, recovery or tenancy is open.
3. Every public statement stays inside the claim library.
4. Each quarter ends with a re-rating of the [risk register](SEMESTER_RISK_REGISTER.md) top five.

## Q4 2026 (October to December): make it provable

**Objective.** Close the foundation so that any later claim can be believed. This is Phase 0 closed and Phase 1 steps 0 to 5.

| Month | Work | Backlog | Exit evidence |
| --- | --- | --- | --- |
| Oct | `main` green and protected; second person and independent reviewer named; counsel engaged; accessibility evaluator and security assessor scoped; claims clean-up; real cash entered; ten discovery interviews begun | X-01, X-06, X-07, X-08, X-10, X-11, X-12 | Green `main` on the required checks; ruleset active; an engagement letter; a corrected site |
| Nov | Isolated staging stood up first (Phase 1 step 6, first slice), because steps 2 and 5 change production-visible privileges and the Phase 1 backlog says to run them there first; restore drill into the second project; alert delivery test; BYOK through the kill switch; cross-tenant negative suite (TI-01..TI-12) started in staging; anon grant reduction applied on a branch | X-02, X-05, X-03, X-04, D06-1 | Staging running; restore measured; test page acknowledged; negatives green for the first object classes |
| Dec | Definer hardening; human review of T3+ table classes; tenant AI policy enforced before invocation; ADRs 0001 to 0005 accepted or rejected; register reconciliation; **Gate 1 review** | Phase 1 steps 3, 4, 5; D28-1; X-09; X-14 | Phase gate log updated: Gate 1 PASS or PASS WITH DATED EXCEPTIONS |

**Exit gate (Gate 1).** Cross-tenant isolation negatives per object class; AI policy enforcement; measured restore; grant hardening; privileged-function review; production rollback; audit/outbox coverage on the ten sensitive actions. If any is not met, Q1 repeats it and starts nothing new.

**Not in this quarter.** No new domain surface. No outreach that quotes a price, an uptime or a certification.

## Q1 2027 (January to March): make it connectable

**Objective.** Produce the first real data path, in a sandbox, with recorded evidence, and take delivery of the independent assessments.

| Month | Work | Backlog | Exit evidence |
| --- | --- | --- | --- |
| Jan | Staging proof completed (RLS, grants, definer, API, E2E, accessibility and security suites run there); tenancy source unified; policy gateway adopted on ten actions; accessibility evaluation under way | Phase 1 steps 6, 7, 8; D40-1 | Staging proof record; negative suite green on the unified source |
| Feb | LTI tool registered in a sandbox LMS (launch and passback recorded); OneRoster CSV roster adapter through the factory (run R1); SSO/SCIM dry-run against a test IdP (R3) | D04-1, D27-1, D26-1; migration runs R1, R3 | Three run records under `docs/evidence/migration/`; SAML/OIDC status resolved |
| Mar | Penetration test executed; accessibility evaluation delivered and remediation planned; productivity API mounted in staging with its Postgres integration test; design-partner shortlist and pilot protocol drafted; **review** | D02-1; X-11; PGM-03 | Assessor report received and findings entered; evaluation report; a pilot protocol; Q1 review |

**Exit gate.** One recorded launch/passback in a real LMS sandbox; one reconciled roster run; both assessments in hand with findings dispositioned; a named design-partner candidate. Without a candidate, Q2 continues discovery and builds nothing for a pilot.

## Q2 2027 (April to June): make it pilotable

**Objective.** Decide, on the evidence, whether one named tenant can enter a non-record pilot. **G-A is the gate, not the calendar.**

| Month | Work | Exit evidence |
| --- | --- | --- |
| Apr | Close High findings from the assessment; execute DPA and subprocessor review; HECVAT completed against evidence; second restore drill; kill-switch drill in target-like staging | No open High; a DPA draft counsel has approved; a measured second restore |
| May | Pilot agreement and data scope with the design partner; customer-side seven seats named; **G-A checklist review** | The checklist in the [replacement gates](SEMESTER_DOMAIN_REPLACEMENT_GATES.md) complete or a dated list of what remains |
| Jun | If G-A passes: activate one domain for one cohort with approved data; support rota and status page live; claims library updated. If not: continue closing and do not activate | An activation record, or a recorded decision not to |

**Exit gate.** G-A met for one tenant. **If it is not met, the correct output of Q2 is an honest account of why**, and the plan does not slide into activating under pressure from the academic calendar.

## Q3 2027 (July to September): prove and repeat

**Objective.** Operate the pilot, measure what can be measured in the window, and decide on a second tenant.

| Month | Work | Exit evidence |
| --- | --- | --- |
| Jul | Dual-run preparation for the chosen domain (M3 to M4 reconciliation); onboarding materials; staff training | Reconciliation report, clean or accepted |
| Aug | Term start; dual-run begins (M5); weekly pilot scorecard; incident handling exercised for real | Weekly scorecard; incident log |
| Sep | First operating-evidence readout (not outcomes); second-tenant discovery; **12-month review**: re-rate risks; decide Track B, hiring gates, funding | Readout; updated risk register; owner decisions recorded |

## The ten brief phases against the four quarters

| Phase | Brief | Window | What the plan does with it |
| ---: | --- | --- | --- |
| 0 | Establish current truth | Q4 2026 | Complete (this document set); reconcile registers |
| 1 | Identity, tenancy, capability, RLS, audit, classification, consent, retention, integrations, rollout, observability, support | Q4 2026 to Q1 2027 | The core of the plan |
| 2 | Student OS | Q1 2027 onward, narrow | Keep running on device state; server sync for invited cohort; no new surfaces |
| 3 | Learning OS | Q1 to Q3 2027 | Only the LTI path and the one course a partner picks; no native LMS replacement |
| 4 | Student success | Q2 2027 onward | Only if the partner chooses it; advisor interviews first |
| 5 | Academic core | After the window | Read-only SIS adapter at most; no write-back |
| 6 | Campus services | After the window | Handoff and office feeds only |
| 7 | Career and lifelong | After the window | Verified-claim flow design only |
| 8 | Institutional OS | Q1 to Q2 2027 | Policy gateway adoption, rollout controls, offboarding rehearsal |
| 9 | Company OS | All quarters | Real finance numbers; independent reviewer; seats; cadence |
| 10 | Platform ecosystem | Q3 2027 onward | OAuth app model ADR and sandbox tenants; no marketplace |

## Monthly capacity assumptions

| Resource | Assumption | If wrong |
| --- | --- | --- |
| Founder time | Primary reviewer and decision-maker; discovery interviews, counsel and partner conversations | Reviews queue; the gate review slips |
| Engineering | Implementation by agents under human review | Review is the bottleneck; adding agents does not help |
| Outside parties | Counsel, evaluator, assessor engaged by end of October; delivery in 8 to 14 weeks | The evaluator and assessor set the Q1 end date |
| Funding | The finance model's gate G9 (seed closed, discovery programme under way) releases the first hires | Without it, the plan has no second person and the independence gate fails |
| Design partner | One is found by March | Without one, Q2 builds nothing for a pilot |

## Dependencies on outside parties, in order of lead time

| Party | Item | Why first |
| --- | --- | --- |
| Qualified accessibility evaluator | EXT-008 | The queue's long pole; blocks any "accessible" claim and G-A |
| Counsel | EXT-001 to EXT-003 | Blocks public policies, institutional paper, claims |
| Security assessor | EXT-006 | Blocks G-B and many security questionnaires |
| Design partner | PGM-03 | Blocks everything customer-shaped |
| Tax/accounting, insurance | EXT-004, EXT-005 | Blocks invoicing institutions |
| Provider contracts and DPAs | EXT-017 | Blocks subprocessor approval |

## Stop and reassess triggers

The plan stops and the founder reassesses if: no design partner is found by the end of March; a High finding appears and is not closed within 30 days; the independent reviewer cannot be found by end of November; the assessment finds tenant isolation cannot be fixed without a redesign (then Track B starts first); or cash cannot fund the next quarter once real numbers are entered.

## What this plan will not do

- Replace a registrar, SIS, LMS, identity provider, bursar or financial-aid system.
- Run any domain in a mode where a Semester record is authoritative for an institution.
- Open a marketplace.
- Claim security, compliance or accessibility before the evidence exists.
- Hire ahead of the evidence gates.
