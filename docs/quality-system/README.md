# Semester quality system — QA and Quality Engineering pack

Status: **proposed**, written 2026-10-04 against `origin/main` `dac31c9`.
Author role: QA and Quality Engineering Lead (acting).

Input: the external rebuild audit and its shared preamble ("every part of a
student's educational life works in Semester from day one — natively when
necessary, connected when available, governed everywhere, and supported
operationally") and a read-only survey of this repository. Where the audit and
the repository disagree, this pack says so.

This pack **extends** the controlled documents in
[`docs/engineering-operations/`](../engineering-operations/) and the CTO pack in
[`docs/target-architecture/`](../target-architecture/README.md). It does not
replace either, and it does not start a second ledger of anything.
[§ Relationship](#relationship-to-what-already-exists) says which document wins
where they disagree.

## The answer in ten lines

1. **The repository already tests more than it can prove it tested.** 1,219 test
   files under `app/src` (1,265 vitest files in all), 106 second-account SQL suites, ten `smoke:*` scripts, an hourly
   production probe — and `TEST-COVERAGE-MATRIX.md` records the gap that matters:
   *no single current manifest reconciles all suites and skips for the
   immutable candidate.* The first deliverable is that manifest
   ([05](05-HARNESS-OWNERSHIP-EVIDENCE.md) §4), not more tests.
2. **A journey catalog, held by a test.** 44 journeys cover all 69 roles in
   `rolelaunch.ts` and 15 domains, each naming what proves it and what is owed.
   Status is arithmetic on those two lists, so a row cannot be promoted by
   editing a word. Today: **0 fully proved, 44 partial** — which is the honest
   reading of "partial is not a pass" ([02](02-JOURNEYS.md)).
3. **Seven gates, one evidence record.** commit → pull-request → integration →
   staging → canary → production → tenant-launch. Every gate names its
   commands, its required checks and the evidence it leaves
   ([04](04-GATES-AND-CI.md)). The ruleset *defines* three required checks
   (`build`, `account-sync`, `secrets`), but `BRANCH-PROTECTION.md` records it as
   **not yet applied**; the contrast sweep is scheduled, DAST is not required.
   Applying and reading back the ruleset is the first quality action.
4. **Ten suites, each with a fixture contract and an acceptance criterion**:
   tenant isolation, authorization, RLS, integration, offline/sync, accessibility,
   AI, load, chaos, disaster recovery ([03](03-SUITES.md)). Where a suite exists
   the pack points at it; where it does not it says *owed*.
5. **The pyramid is measured, not drawn.** The base and the top are healthy; the
   *middle* is thin: no contract for our own API (there is no OpenAPI document),
   no PDP↔RLS conformance, real-service tests only for the account lifecycle,
   four of ten smoke scripts that no workflow runs, and a browser matrix that is Chromium only ([01](01-STRATEGY.md) §2, §5).
6. **Test data is synthetic, named and deterministic**: six tenants (five customer-shaped, one internal), a persona
   for every role, a clock you hold ([08](08-REPOSITORY-AND-FIXTURES.md)). No
   production snapshot ever comes down (FERPA; CTO pack 05 §6).
7. **A flaky test is a defect, not a lane.** Required suites have no quarantine:
   root-cause within the SLA or revert the change that introduced it
   ([05](05-HARNESS-OWNERSHIP-EVIDENCE.md) §2). This is stricter than
   `TEST-STRATEGY.md` for required checks and the same as it for live/external
   ones, and the difference is stated.
8. **Coverage is behaviour and boundary, never a percentage.** That is the
   existing claim ceiling. Line coverage is allowed as an *internal* ratchet and
   must never be quoted outside ([05](05-HARNESS-OWNERSHIP-EVIDENCE.md) §3).
9. **Defects use P0–P3**, the vocabulary `ON-CALL-AND-ESCALATION-POLICY.md`
   already defines, plus a class taxonomy and an *escape analysis* that ends in a
   test shown red against the bug ([06](06-DEFECTS-AND-DASHBOARDS.md)).
10. **Production is verified, not assumed.** Hourly public probe exists; the pack
    adds a synthetic tenant, post-deploy verification, and the rules that stop a
    probe from becoming an incident ([07](07-PRODUCTION-VERIFICATION.md)).

## Contents

| Doc | What it delivers |
| --- | --- |
| [01 Strategy](01-STRATEGY.md) | principles, the measured pyramid, test data, environments, device/browser matrix |
| [02 Journeys](02-JOURNEYS.md) | critical journey catalog for every role and domain (held by `journey-catalog.test.ts`) |
| [03 Suites](03-SUITES.md) | tenant isolation, authorization, RLS, integration, offline, accessibility, AI, load, chaos, DR: harness, fixtures, cases, acceptance criteria |
| [04 Gates and CI](04-GATES-AND-CI.md) | the seven gates, required checks, CI job graph and workflow templates |
| [05 Harness, ownership, evidence](05-HARNESS-OWNERSHIP-EVIDENCE.md) | harnesses, flaky-test management, ownership, coverage standard, release evidence manifest |
| [06 Defects and dashboards](06-DEFECTS-AND-DASHBOARDS.md) | taxonomy, severity, triage, escape analysis, quality dashboards |
| [07 Production verification](07-PRODUCTION-VERIFICATION.md) | synthetic monitoring, post-deploy checks, test-in-production safety rules |
| [08 Repository and fixtures](08-REPOSITORY-AND-FIXTURES.md) | where everything lives today and in the target tree, fixture catalog, first pull requests |

## Relationship to what already exists

| Existing document | This pack's relation |
| --- | --- |
| [`TEST-STRATEGY.md`](../engineering-operations/TEST-STRATEGY.md) | **Controls.** Its evidence ladder is reused as is. This pack adds the pyramid with measurements, and stricter flaky-test handling for *required* suites (flagged in 05 §2) |
| [`CRITICAL-FLOW-TEST-PLAN.md`](../engineering-operations/CRITICAL-FLOW-TEST-PLAN.md) | **Controls.** CF-01..CF-10 are the spine of the catalog; every one has a journey, and a test fails if one does not |
| [`TEST-COVERAGE-MATRIX.md`](../engineering-operations/TEST-COVERAGE-MATRIX.md) | **Controls.** Its "Required closure" column becomes the work list; the manifest in 05 §4 is its missing artifact |
| [`DISASTER-RECOVERY-TEST-PLAN.md`](../engineering-operations/DISASTER-RECOVERY-TEST-PLAN.md) | **Controls.** 03 §10 cites it and adds only the acceptance numbers it deliberately leaves UNKNOWN |
| [`RELEASE-GATES.md`](../RELEASE-GATES.md) (G1–G10) | **Controls** the *launch* gates. The seven gates here are *pipeline* gates; the `tenant-launch` gate requires G1–G10 evidence rather than restating it |
| [`LAUNCH-READINESS-TEST-PLAN.md`](../LAUNCH-READINESS-TEST-PLAN.md), [`INTEGRATION-TEST-PLAN.md`](../INTEGRATION-TEST-PLAN.md), [`RESILIENCE-INCLUSION-ECOSYSTEM-TEST-PLAN.md`](../RESILIENCE-INCLUSION-ECOSYSTEM-TEST-PLAN.md), [`LOAD-AND-SOAK.md`](../LOAD-AND-SOAK.md) | **Indexed.** Per-area plans stay where they are; 03 links to the section that holds each case |
| [`operating-model/QUALITY-MANAGEMENT.md`](../operating-model/QUALITY-MANAGEMENT.md) and `governance/quality-gates.ts` | **Controls** Ready / Done / Release. The seven gates are the *mechanism* that checks the Done list |
| [`target-architecture/07-ENGINEERING-STANDARDS.md`](../target-architecture/07-ENGINEERING-STANDARDS.md) §8 | **Controls** the layer list. 03 expands each of its rows into a suite |
| `CLAUDE.md` "proving a change" | **Controls everything.** Revert-red, controls, "look at the screenshot" are the proof standard for every guard here |

## What was and was not verified

- **Verified (read from the repository):** the CI job list and its steps; the
  ruleset's three required checks; the 47 `package.json` scripts; the
  106 `.check.sql` suites; the role register; the CF-01..CF-10 flows; the
  existing evidence directory; the hourly probe. Every path and command named in
  the journey catalog is checked to exist by a test.
- **Not verified:** any production measurement (none is in the repository); the
  workflow templates in [04](04-GATES-AND-CI.md) (templates for the first pull
  requests in [08](08-REPOSITORY-AND-FIXTURES.md) §6, not run on Actions); every
  numeric threshold marked *proposed*; whether the target tooling choices (k6,
  Toxiproxy, Testcontainers) fit the cloud decision P-12.
- **Not decided here:** legal conclusions, accessibility conformance claims,
  pen-test scope — counsel and qualified assessors, per
  [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md).

## Open questions that need a person

| # | Question | Owner | Blocks |
| --- | --- | --- | --- |
| Q1 | Who is the second test owner and second restore operator? Every "backup unassigned" row in the existing plans is this one answer | CEO | any signed acceptance; DR numbers |
| Q2 | Should `contrast`, `hawkscan` and `functions` become required checks, given the ruleset lists three? | CTO | gate `pull-request` ([04](04-GATES-AND-CI.md) §3) |
| Q3 | Is a synthetic tenant inside production acceptable under the first customer's contract? | CEO + counsel | gate `production` ([07](07-PRODUCTION-VERIFICATION.md) §3) |
| Q4 | Which qualified person performs the assistive-technology pass (release gate G6)? | CEO | the accessibility suite's only human step |
