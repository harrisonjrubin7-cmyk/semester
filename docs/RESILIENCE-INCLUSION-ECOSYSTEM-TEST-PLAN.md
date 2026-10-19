# Resilience, inclusion and ecosystem expansion — test plan

The mandatory testing section of the expansion command, mapped onto the gates
this repository already runs. Read with
[`REGRESSION-CHECKLIST.md`](../REGRESSION-CHECKLIST.md), which holds the
baseline figures, and [`CLAUDE.md`](../CLAUDE.md), which says what counts as
proof here.

## The gates every phase runs

From `app/` — the repository root exposes only named platform-control scripts, not the app test suite:

```bash
npx tsc -b
npm run lint
npm test
npm run test:shuffle
npm run test:zones      # Phase 4 especially
npm run build
```

and, for any phase with a migration, `supabase/check.sh` (every `.check.sql`
suite against a throwaway Postgres at production's version) and
`supabase/rehearse.sh` (pending migrations against production's shape). Both run
in CI.

## Three rules from CLAUDE.md, applied here

1. **A guard that has never failed is not known to be a guard.** Every boundary
   test below is run once against a planted violation and seen to go red. The
   pull request says which violation was planted.
2. **Include a control.** A test that finds "no prohibited import" in the
   scoring module must also find the prohibited import when one is added. A test
   that finds "no streak text" must find a planted one.
3. **Structural checks beat runtime probes.** Where a boundary can be stated as
   "this module does not import that one" or "this table has this constraint",
   it is tested that way, because a structural test cannot be fooled by a race
   or a fixture that happens not to exercise the path.

## Existing behaviour

| What | How | Phase |
|---|---|---|
| Routes, navigation, five destinations | `app/src/screens.test.ts` and the browser smokes | every |
| Roles and RLS | `supabase/capabilities.check.sql`, `supabase/grants.check.sql`, `supabase/rolegrants.check.sql`, `supabase/tenancy.check.sql` | every phase with a migration |
| Retention answer for every table | `app/src/lib/retention.test.ts` | every phase with a migration |
| Foreign-key indexes | `supabase/indexes.check.sql` | every phase with a migration |
| Accessibility | `npm run smoke:a11y`, `npm run sweep:contrast`, `npm run sweep:targets` | every phase with UI |
| Documents name real files | `app/src/lib/resilience-docs.test.ts` | added in Phase 0 |

## Boundary tests, by kind

The per-area documents list their tests. These are the ones that hold a hard
boundary, grouped by the technique that proves them.

### Structural: import graph

| Boundary | Area |
|---|---|
| Action scoring imports no grades, bill, accommodation, health, mail or location module | [actions](ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md) |
| My Data's **Not used** list and the scoring module's forbidden imports come from one list | [My Data](STUDENT-DATA-CONTROL-CENTER.md) |
| Only the student's own screens read `student_context` | [pathways](NONTRADITIONAL-LEARNER-PATHWAYS.md) |
| The supporter view has no path to support signals, grades or notes | [supporters](SUPPORTER-FAMILY-PRIVACY-MODEL.md) |
| The financial workspace calls no payment API | [financial](FINANCIAL-READINESS-WORKSPACE.md) |
| The simulation runner accepts only a mock adapter type | [simulation](SYNC-SIMULATION-SANDBOX.md) |

### Structural: database

| Boundary | Area |
|---|---|
| Aggregates below their floor are refused by a check constraint (themes 5, adoption 10) | [faculty](FACULTY-ENABLEMENT.md), [change management](INSTITUTIONAL-CHANGE-MANAGEMENT.md) |
| Tenant isolation for every new table (school A cannot read school B) | all |
| Same-person propose-and-approve refused | [tenant mapping](TENANT-MAPPING-CONFIGURATION.md) |
| Simulated rows invisible to production queries | [simulation](SYNC-SIMULATION-SANDBOX.md) |
| Supporter reads exactly the granted items, and nothing after revocation or expiry | [supporters](SUPPORTER-FAMILY-PRIVACY-MODEL.md) |
| Portfolio items private by default | [career](CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md) |

### Behavioural

| Boundary | Area |
|---|---|
| Stale or estimated data never rendered as official current | [lineage](FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md) |
| Breaking drift degrades a connection; the student sees "Source unavailable", not an empty screen | [drift](SCHEMA-DRIFT-AND-CONTRACT-TESTING.md) |
| Duplicate merge then reversal is lossless | [reconciliation](INTEGRATION-QUALITY-AND-RECONCILIATION.md) |
| Never-queue operations refused offline, leaving nothing pending | [resilient mode](RESILIENT-STUDENT-MODE.md) |
| Airplane mode and 200 ms network flapping converge to a clean sync | [resilient mode](RESILIENT-STUDENT-MODE.md) |
| A support context bundle contains no note text | [reliability](SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md) |
| Read-only mode keeps local edits | [reliability](SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md) |
| Machine-translated policy carries the caveat and the original link | [localization](LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md) |
| Nothing fires in quiet hours; the rate limit holds | [engagement](ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md) |
| No streak, leaderboard or shame text is rendered | [engagement](ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md) |
| A private response is never served to a second user from cache | [performance](PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md) |

### Evaluation

| Boundary | Area |
|---|---|
| Sensitive-data refusal, integrity boundary, financial non-advice, human handoff | [evaluation harness](AI-RECOMMENDATION-EVALUATION-HARNESS.md) |
| A prompt with its bounds removed fails those suites (the control) | [evaluation harness](AI-RECOMMENDATION-EVALUATION-HARNESS.md) |
| No real-looking student data in fixtures or cases (lint, shown to fail once) | [drift](SCHEMA-DRIFT-AND-CONTRACT-TESTING.md), [evaluation harness](AI-RECOMMENDATION-EVALUATION-HARNESS.md) |

## Accessibility and device parity

Every new screen: keyboard only, screen reader names, 400 % zoom reflow,
reduced motion, and the phone, tablet and desktop layouts — the same checklist
[#777](https://github.com/harrisonjrubin7-cmyk/semester/pull/777) writes into its
`RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md`. Screenshots of each, per
`.claude/skills/run`. A dark rectangle is a failure to launch.

## Performance

Budgets are set in Phase 7 from measurement. Until then, each phase reports its
effect on the production bundle (`npm run build` output) in its pull request,
so Phase 7 has a history to set budgets from.
