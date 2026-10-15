# Tenant contract

> Code: `app/src/lib/contract/tenantcontract.ts` · Decision: D-1019 · **Pure logic and tests. Not wired to any screen, route or table, and no contract is recorded for any school.**

A school signs for some modules, some data, a region, a retention window and an
AI arrangement. Each is a place the running product can drift from the paper.
This is the contract as data, with a decision function, a drift report and a
validator, so that the paper and the configuration can be compared by a machine.

## Three things it does

- **Decides** a request: may this school use this module, run this AI provider
  on these sources, spend these tokens, send this class of data to this
  destination in this region, take this administrator action without a second
  factor. A request outside the contract's term is refused.
- **Reports drift**: given a school's live configuration, every way it differs
  from the contract (`contractViolations`). What it calls a module violation is
  exactly what the decision function would refuse, and a test holds that.
- **Validates** the contract itself (`contractProblems`, `readContract`): an
  unknown module, a module both included and prohibited, no region, a backwards
  retention window, a named support tier with no escalation path, and a data
  route opened that the platform floor keeps shut. A row that is not exactly a
  contract is refused with the reason and never repaired.

## Clauses

| Clause | What it governs |
| --- | --- |
| `term` | The contract is in force: `[effectiveFrom, effectiveTo)`. |
| `modules` | Flag keys the contract includes; anything else is off. |
| `prohibited` | Flag keys that stay off whatever else is configured. |
| `ai.providers` | Which AI providers may run. |
| `ai.sources` | AI only with the school's own sources, or any authorised source. |
| `ai.budget` | Annual token budget, or unmetered. |
| `data` | A class-to-destination route; uses the platform's own `routeAllowed`. |
| `residency` | The regions student data may be held in. |
| `retention` | The retention window, in whole days, a school's configuration must sit inside. |
| `admin.mfa` | Multi-factor authentication for administrator actions. |

## It only narrows

The contract is one more gate after the platform's. `evaluateUnderContract`
asks the contract first and the flag evaluator second and allows only what both
allow. A data route is checked with the platform floor, so a contract can close
a route and cannot open one. Tightening a contract never allows a request that
was refused, and a school with **no contract recorded** is not constrained by
this layer at all: the decision says so in words, and the other gates still
apply. Each of these is a generated-input property, and each was also planted
as a defect in the source and went red.

## What is not built, and the decisions that remain

- **Storage, decided (D-1019).** A contract is a file in this repository,
  `contracts/<tenant id>.json`, and Harrison Rubin, the owner, is the only person
  who writes them: `.github/CODEOWNERS` routes `/contracts/` to him alone. It is
  not in the database because a file needs no migration, is versioned and
  reviewed, and cannot be reached by a school's own administrator, who could
  otherwise widen it. `contracts/` is empty: no school has a contract recorded,
  and one is written from a signed order form, never from a guess. The
  directory is checked on every pull request by `contractfiles.test.ts`, which
  reads each file with `readContract` and fails one that is not sound, is named
  for another tenant, or is not JSON. The cost is that a change needs a deploy;
  moving contracts to the database later is a migration and a new decision.
- **Wiring.** No screen shows a drift report and nothing calls
  `contractViolations` on a schedule. Doing so would add a destination, against
  the complexity budget, and is better as a section of an existing console than
  a new page.
- **Enforcement at the server.** This is client-side logic. A contract a school
  could be held to needs the same checks in the gateway and the database, the
  way `tenant_feature_policy` is, and those are migrations.
- **Whether the contract or the settings win.** Today both must allow. If a
  school's signed terms and its administrators' settings ever disagree, which
  one the customer is told is the owner's and counsel's call.
- **Retention is a window, not a schedule.** The contract records the days; the
  job that deletes is governed separately (see the retention work in progress).
