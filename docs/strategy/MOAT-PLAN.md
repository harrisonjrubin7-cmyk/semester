# Competitive moat plan

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

| Control | Value |
| --- | --- |
| Status | **DRAFT PROPOSAL. Today, nothing in this plan is an evidenced moat; it is a plan to build ones that can be shown** |
| Owner | `founder` seat; each dimension names its owner |
| Evidence date | 2026-10-04, against `origin/main` at `7287ddc` |
| Builds on | [`docs/operating-model/DEFENSIBILITY.md`](../operating-model/DEFENSIBILITY.md) (the original argument and its measures), which this plan extends with kill criteria, dates and honest classification |
| Review | Annual (September), plus whenever a kill criterion's reading is due |

Labels follow [`THREE-YEAR-STRATEGY.md`](THREE-YEAR-STRATEGY.md): **FACT**, **DECISION**, **HYPOTHESIS**, **ASSUMPTION `A-nn`**, **COUNSEL**. Time-to-copy figures are all **HYPOTHESES** (A-16, A-17): no competitor has been researched to a dated standard.

## 1. The honest starting point

A moat is a reason a customer stays that a competitor cannot cheaply reproduce. Competitors can copy features. The repository's own defensibility document already says so. This plan sorts each candidate into one of three classes and puts effort only where the class justifies it.

| Class | Meaning | Investment rule |
| --- | --- | --- |
| **Table stakes** | A buyer expects it; having it earns no preference | Meet the standard; do not market it as differentiation |
| **Differentiator** | Preferred today, copyable within a few quarters | Build, but do not price it as permanent |
| **Candidate moat** | Gets harder to copy as Semester operates; needs operating history to prove | Invest, measure, and keep a kill criterion |

**What is not a moat, stated plainly:** the number of screens or features; access to a frontier AI model (every competitor has it); the volume of student data (education records are institution-owned and consent-bound, so a data-hoarding moat is both legally narrow and a trust liability); native duplication of every module; and lock-in. Portability is deliberately preserved: students and institutions can export in documented formats at any time, because lock-in via data is a trust cost, not a defence (`DEFENSIBILITY.md`).

## 2. Summary

| # | Dimension | Class | Moat hypothesis in one line | Evidence today | Time to copy (HYPOTHESIS) | Proof metric | Kill criterion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Product** | Differentiator | One source-attributed planning loop across courses, deadlines and campus, usable without any integration | Partial: built and tested in the repository, no user evidence | UI: months. Pervasive source lineage retrofitted into an incumbent: 12 to 24 months | S3, S4, S6; lineage coverage | S4 under its line after two iterations |
| 2 | **Data** | Candidate moat, narrow | A consented, tenant-bound, source-attributed context graph that makes AI answers correct and actions safe; privacy-preserving cross-institution benchmarks later | None: no live tenant | 6 to 18 months per institution; benchmarks emerge at 5 or more institutions (Year 4 or later) | Courses with explicit AI policy; sourced-fact accuracy (S9) | No institution consents to benchmark contribution by Year 3 |
| 3 | **Workflows** | Candidate moat | Institutional workflows encoded as configuration with approval gates, audit and pending/confirmed states; the second deployment costs less than the first | Partial: configuration studio and workflow builder built, unvalidated by a customer | 18 to 36 months per workflow family, because institutional validation cannot be shortcut | Implementation time (I4); share of requests met by configuration | More than 20% of delivery effort is custom code across three cohorts |
| 4 | **Integrations** | Table stakes plus candidate moat on quality | Neutral, reconciled, audited connectors that degrade gracefully, with native fallbacks | Partial: catalog, health states and mocks; no live institutional connector | Connector count: quickly. A signed, reconciled, audited connector per institution and system pair: 6 to 12 months each | Integration freshness (P4); reconciliation mismatch rate | A key vendor closes or prices out its API |
| 5 | **Brand** | Weak today | Reputation for being the vendor that never overclaims | Weak: the product name is very likely unregistrable alone ([`IP.md`](../../IP.md) §2) | A reputation: 24 months or more | Claims discipline (P7); references (I9) | One overclaim reaches a customer without withdrawal inside 24 hours |
| 6 | **Customer success** | Differentiator, candidate moat once repeatable | An implementation method proven on live cohorts, with baselines, weekly reviews and honest closeouts | None: no deployment | 18 to 36 months, because it needs live deployments and people | I4, I5, I6, I9 | Implementation time is not falling across three cohorts |
| 7 | **Ecosystem** | Option value, not a moat inside the horizon | Standards conformance, certified partners and practitioner relationships that make Semester the easy thing to integrate with | None | Years | Certified partners or connectors (PROPOSED: 2 by 2029-09-30) | No partner asks to build on the platform by the 2029 reset |
| 8 | **Trust** | Candidate moat; the central bet (B5) | Independent, operated, in-date evidence that shortens every later procurement | Partial: controls and tests documented; nothing independently reviewed or operated | 24 to 48 months of operating history, which cannot be bought | Security-review cycle time (I8); P2, P3, P5, P6 | The third institution's review is not faster than the first |

## 3. The compounding loop

What makes the combination stronger than its parts, and what breaks it.

```text
operated, in-date trust evidence
        │  shortens procurement and security review
        ▼
more governed deployments
        │  produce operating history and permissioned references
        ▼
a better implementation method and playbook
        │  lowers cost and time to the next go-live
        ▼
capacity to fund more independent assurance and product depth
        └──────────────────────────────────────────────► back to trust evidence
```

**What breaks it:** a single cross-tenant incident; a claim that must be retracted; evidence allowed to lapse; implementation that depends on custom code; the one-person dependency. These are the top entries of the risk register and the first red lines on the scorecard.

## 4. Dimension plans

Each action has an owner seat, a deadline and the evidence that closes it. Owners are seats, not people.

### 4.1 Product

| Action | Owner | Deadline | Evidence |
| --- | --- | --- | --- |
| Measure lineage coverage: the share of facts shown on Today, Calendar and Courses carrying source and freshness | `product` | Method 2027-01-31; at least 95% by 2027-06-30 | Reading from the lineage register and tests |
| Offline conflict tests and visible pending, failed, degraded and reconciled states on the golden path | `engineering` | 2027-03-31 | Test run; screenshots of each state on the golden path |
| Time-to-first-value measured in the invitation cohort | `product` | 2027-06-30 | Median time from sign-up to the first activation action |

**Erosion:** general AI assistants gain calendar and LMS access; LMS vendors ship planners. **Response:** compete on governed context and consequential-action safety (SR-003), not on model quality.

### 4.2 Data

Permissioned context is the asset, not volume.

| Action | Owner | Deadline | Evidence |
| --- | --- | --- | --- |
| Portability: an end-to-end tested export and offboarding path for a student and for a cohort | `engineering`, `privacy` | 2027-05-31 | Drill record |
| "No training on student data" stated in provider terms and in customer paper | `privacy` | With FD-2026-010, 2026-12-15 | Counsel-approved terms (**COUNSEL**) |
| Benchmark governance written *before* any collection: consent basis, minimum cell size of 10, no individual output, institutional opt-in, withdrawal | `privacy`, `data` | 2028-03-31 | Approved policy and a privacy impact assessment |
| Courses with an explicit AI policy configured (a `DEFENSIBILITY.md` measure) | `product` | Reading from the first cohort | Count per term |

**Erosion:** privacy regulation narrowing aggregation; institutions refusing to contribute. **Response:** the benchmark is an option, not a plan dependency.

### 4.3 Workflows

| Action | Owner | Deadline | Evidence |
| --- | --- | --- | --- |
| Implementation playbook v1 written from cohort 1, v2 from cohorts 2 and 3 | `success` | v1 2027-12-31; v2 2028-09-15 | Versioned playbook; implementation-time reading |
| Three workflow families productised as configuration templates (candidates: transfer transition, registration preparation, advising handoff) | `product`, `success` | 2029-03-31 | Templates deployed at two units without custom code |
| Share of customer requests met by configuration, not code | `engineering` | Reading from cohort 1 | At least 90% by Year 3 (PROPOSED, *new* metric) |

**Erosion:** SIS vendors adding workflow engines; custom-code creep making Semester a services business. **Response:** the kill criterion; reprice or narrow rather than absorb.

### 4.4 Integrations

Depth and neutrality over count, per `DECISIONS.md` §1: Brightspace is the first institutional adapter.

| Action | Owner | Deadline | Evidence |
| --- | --- | --- | --- |
| Brightspace read adapter through the two-phase confirm and audit-journal path | `data` | After a signed data agreement (entry step V5) and G2 | Agreement, adapter, reconciliation report |
| Reconciliation and freshness readings per connector, with connector recovery time | `data` | From the first live connector | P4 readings; runbook exercised |
| Standards conformance (for example LTI 1.3, OneRoster) for the adapters that exist | `data` | After each adapter, never ahead of it | Conformance record |
| Degraded-mode UX tested for each connector (the native fallback works while the connector is down) | `engineering` | Before each connector's activation | Test run |

**Erosion:** vendors restricting or pricing APIs. **Response:** student-side and export-based paths remain; no investment in a vendor that closes the door.

### 4.5 Brand

Brand here is restraint made visible.

| Action | Owner | Deadline | Evidence |
| --- | --- | --- | --- |
| House mark and name decision, before any raise (FD-2026-017) | `founder` with trademark counsel | 2027-01-31 | Decision record and clearance search (**COUNSEL**) |
| Public Trust Center page containing only in-date artifacts | `trust` | 2027-06-30 | Page live; evidence-expiry check green |
| Known-limitations list and roadmap-communication standard published | `product` | 2027-03-31 | Published page ([`docs/institutional-readiness/INSTITUTIONAL-ROADMAP-COMMUNICATION-STANDARD.md`](../institutional-readiness/INSTITUTIONAL-ROADMAP-COMMUNICATION-STANDARD.md)) |
| Monthly claims audit against the register | `privacy` | From 2026-11-30 | Audit log; scorecard P7 |

**Erosion:** one overclaim; a naming collision. **Response:** withdraw within 24 hours and log; rename before the first public campaign if clearance fails.

### 4.6 Customer success

| Action | Owner | Deadline | Evidence |
| --- | --- | --- | --- |
| Charter template with a baseline, 3 to 5 measures, a stop option and a decision date, used for every pilot | `success` | 2027-04-30 | Template in use |
| Weekly business review and a midpoint and closeout report with denominators | `success` | From go-live | Reports on file |
| Customer health score live | `success` | 2028-03-31 | Score computed for each live cohort ([`docs/commercial/CUSTOMER-HEALTH-SCORE.md`](../commercial/CUSTOMER-HEALTH-SCORE.md)) |
| Reference program with claim-specific written permission | `founder` | First reference 2028-06-30 | Permission letter on file |
| Faculty enablement and change-management plan for each unit | `success` | Before each go-live | [`docs/FACULTY-ENABLEMENT.md`](../FACULTY-ENABLEMENT.md) applied |

**Erosion:** delivery depends on one person; support understaffed. **Response:** first hire (FD-2026-009) and the support rota are gate conditions, not afterthoughts.

### 4.7 Ecosystem

Deliberately late. The plan builds the standards and relationships that keep the option open and defers the program.

| Action | Owner | Deadline | Evidence |
| --- | --- | --- | --- |
| Practitioner relationships through the associations the advisors belong to | `founder` | Ongoing from 2027 | Interview log (scorecard I1) |
| Partner and extension certification criteria published | `data`, `trust` | Not before two institutions are live (2029) | Published criteria ([`docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md`](../PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md), [`docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md`](../EXTENSION-ECOSYSTEM-GOVERNANCE.md)) |
| Two certified partners or connectors | `data` | 2029-09-30 (PROPOSED) | Certification records |

**Erosion:** platform vendors building closed ecosystems. **Response:** interoperability and portability as the stance; no reliance on ecosystem for the revenue plan.

### 4.8 Trust

The central bet and the longest lead time. Every item produces an artifact that is dated, independent where it can be, and removed when it expires.

| Action | Owner | Deadline | Evidence |
| --- | --- | --- | --- |
| G2 evidence set: independent penetration test with clean rescan; target isolation test; qualified accessibility report and approved statement; operated restore and incident drills; counsel-approved data-processing terms | `security`, `accessibility`, `operations`, `privacy` | 2027-05-31 (drills 2027-03-31) | Reports and drill records in the evidence register |
| HECVAT-style response completed from the evidence | `security` | 2027-02-28 draft; refreshed at G2 | [`docs/institutional-readiness/HECVAT-QUESTION-BANK-RESPONSE-DRAFT.md`](../institutional-readiness/HECVAT-QUESTION-BANK-RESPONSE-DRAFT.md) |
| Independent assurance report (SOC 2 Type I or the equivalent chosen in FD-2026-012) | `security` | 2028-06-30 | Report |
| Type II or the equivalent | `security` | 2029-06-30 | Report |
| Annual AI red-team (prompt injection, exfiltration, cross-role leakage) with published summary | `product`, AI safety advisor | First by 2027-05-31, then annually | Report ([`docs/trust/AI-GOVERNANCE-PROGRAM.md`](../trust/AI-GOVERNANCE-PROGRAM.md)) |
| Incident transparency policy: what is told to customers, how fast, and by whom | `trust`, `privacy` | 2027-03-31 | Counsel-reviewed policy |
| Evidence-expiry enforcement stays on; nothing out of date is cited | `security` | Standing | Scorecard P6 |

**Erosion:** one serious incident; lapsed evidence; a sub-processor failure. **Response:** the red-line table in [`SCORECARD.md`](SCORECARD.md) §5.

## 5. Protection

The legal protections that keep the moat Semester's, all subject to counsel (**COUNSEL**).

| Protection | Rule | Status |
| --- | --- | --- |
| Ownership of the work | Written university determination first; no university-administered money before it (FD-2026-003) | Request sent September 2026; reply open |
| IP assignment | Every employee and contractor signs invention assignment before first commit ([`IP.md`](../../IP.md), `DEFENSIBILITY.md`) | To be executed after entity formation (FD-2026-002) |
| Trade secrets | Evaluation sets and ranking rules in access-controlled storage, never in public artifacts | Standing rule |
| Trademark | Composite or house mark; clearance before campaigns | FD-2026-017 |
| API versioning | Breaking changes need at least one academic term's notice | Standing rule |
| Competitive intelligence | Primary, public, dated sources only; no scraping of non-public material | Standing rule |

## 6. Moat review

Each September the moat is re-scored on four questions per dimension, 0 to 3. A score is recorded with its evidence; a score without evidence is 0.

| Question | 0 | 3 |
| --- | --- | --- |
| Is it evidenced by an operated, independent or customer-permissioned artifact? | None | Several, in date |
| Would a competitor need more than 12 months to match it? | No | Yes, with a reason |
| Did a customer cite it unprompted as a reason to choose or stay? | No | Repeatedly (logged in the discovery or win/loss record) |
| Has any kill criterion fired? | Yes | No, and the reading is current |

A dimension scoring 4 or less after two annual reviews is moved to table stakes and its investment is reduced to the standard required. The reduction is recorded as a decision, not allowed to happen by neglect.
