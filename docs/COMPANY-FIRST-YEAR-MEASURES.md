# Company first-year measures

<!-- Rendered from app/src/lib/ops/firstyear.ts by firstyear.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

What success means in the first twelve months, as measures. "Be the
leader" is directionally useful and cannot be checked; this is the first
version of it that can. Four groups, each measure defined, and for each the
place its number comes from today — or the statement that no such place
exists yet.

## Where it stands

| State | Meaning | Measures |
| --- | --- | ---: |
| measured | A query or document in the repository returns the number today | 3 |
| instrumented | The definition and its shape exist in code; no reading has been taken | 4 |
| defined | Defined here only; the reading needs work that has not been decided | 16 |
| **total** |  | **23** |

**No target is set.** A target is the founder’s decision, recorded in
[`docs/DECISION-LOG.md`](DECISION-LOG.md); a number written here by anyone else is a
number nobody decided. The test refuses a target with no decision behind it.
The measures are defined so that the decision, when it comes, is about a
number and not about what the number means.

**No collection is implied.** [`ANALYTICS.md`](../ANALYTICS.md) holds three marks and
nothing else, and D-005 says a fourth lands with its question and its
migration in the same pull request. A `defined` measure is a definition. It
counts nothing.

## Students

| Measure | Definition | State | Source | Target | Note |
| --- | --- | --- | --- | --- | --- |
| **Active users** | Distinct accounts with an `opened` row in the week, Monday to Sunday; the current week reported as partial | measured | [`supabase/analytics.sql`](../supabase/analytics.sql) | *[DECIDE]* | The weekly-active figure of ANALYTICS.md. Block 0 first, every time, to tell an empty week from a table nothing writes to. |
| **Meaningful actions completed** | Of the accounts first seen in a week, the share that had a course of their own and had answered a card within 7 days of arriving | measured | [`ANALYTICS.md`](../ANALYTICS.md) | *[DECIDE]* | Activation, as the three marks define it. Actions beyond those two — a plan saved, a deadline done — are not counted, and counting them is a D-005 decision. |
| **Path clarity score** | After the usability study’s scenarios, the share of students who can say what they should do next this week and why, unprompted | defined | [`docs/PROOF-CALENDAR.md`](PROOF-CALENDAR.md) | *[DECIDE]* | A survey question, asked in the Month 2 usability study, not a mark. It is a reading taken by a person on a sample, and it stays one. |
| **Return rate** | Of the accounts first seen in a week, the share that opened the app again between 28 and 34 days after their first day; cohorts younger than 34 days excluded | measured | [`supabase/analytics.sql`](../supabase/analytics.sql) | *[DECIDE]* | The 30-day retention figure of ANALYTICS.md. |
| **Trust/source comprehension** | In the usability study, the share of students who correctly say where a shown fact came from and whether the school confirmed it | defined | [`docs/TRUST-CUES-AND-SOURCE-PRESENTATION.md`](TRUST-CUES-AND-SOURCE-PRESENTATION.md) | *[DECIDE]* | The source labels exist and are tested; whether a student understands them is a reading taken with students, in the Month 2 study. |
| **Accessibility task success** | The share of golden-path steps completed by students using assistive technology, without help, in the accessibility baseline and each quarterly review | instrumented | [`app/scripts/accessibility-smoke.mjs`](../app/scripts/accessibility-smoke.mjs) | *[DECIDE]* | The smoke drives the critical journeys with the accessibility tree in a real browser on every change. Success by a person with assistive technology is the Month 1 baseline. |

## Institutions

| Measure | Definition | State | Source | Target | Note |
| --- | --- | --- | --- | --- | --- |
| **Signed departments/institutions** | Institutions or departments with a signed agreement carrying at least one binding commitment | instrumented | [`app/src/lib/ops/commitments.ts`](../app/src/lib/ops/commitments.ts) | *[DECIDE]* | Read from the commitment register, which is empty until the champion seat is held. |
| **Implementation time** | Calendar days from the signed agreement to the cohort’s go-live record | defined | [`docs/operating-model/PILOT-TO-PRODUCTION.md`](operating-model/PILOT-TO-PRODUCTION.md) | *[DECIDE]* | Both dates exist in the lifecycle; nobody has run it. The first pilot sets the first reading. |
| **Pilot-to-annual conversion** | Pilots whose midpoint report led to a signed annual agreement, as a share of pilots that reached the midpoint | defined | [`docs/90-DAY-LAUNCH-PROGRAM.md`](90-DAY-LAUNCH-PROGRAM.md) | *[DECIDE]* | The `midpoint-report` and `annual-proposal` items of the 90-day program are the two ends of it. |
| **Renewal rate** | Annual agreements renewed at term, by count and by value | defined | — | *[DECIDE]* | No agreement has a term yet. Readable from the commitment register once contracts carry dates. |
| **Expansion rate** | Institutions that added a department, a package or a module within the year, as a share of signed institutions | defined | — | *[DECIDE]* | Needs a second package to exist; docs/LAUNCH-DECISIONS.md step 3 lists the four. |
| **Security-review cycle time** | Calendar days from an institution’s first security questionnaire to its sign-off | defined | [`docs/market-readiness/HECVAT_READINESS.md`](market-readiness/HECVAT_READINESS.md) | *[DECIDE]* | The Month 2 HECVAT evidence inventory is what shortens it; the first review is the first reading. |

## Platform

| Measure | Definition | State | Source | Target | Note |
| --- | --- | --- | --- | --- | --- |
| **Critical journey SLO** | For each journey in `JOURNEYS`, good events over eligible events in the month, against its objective | instrumented | [`app/src/lib/governance/error-budgets.ts`](../app/src/lib/governance/error-budgets.ts) | *[DECIDE]* | Targets, not readings: Semester has no measured availability history, and nothing here may be quoted as an achieved figure. |
| **P0/P1 incidents** | Incidents at P0 or P1 in the month, with time to notice and time to resolve | defined | [`docs/trust/APM-RUNBOOK.md`](trust/APM-RUNBOOK.md) | *[DECIDE]* | The severity scale and the runbook exist; the incident log they would fill does not. |
| **Restore success** | Restore drills completed within the recovery objective, as a share of drills run | defined | [`RESTORE.md`](../RESTORE.md) | *[DECIDE]* | The drill is on the proof calendar for Month 1; no drill has been run. |
| **Integration freshness** | For each connector, the share of syncs that met their freshness class in the month | instrumented | [`app/src/lib/integration/catalog.ts`](../app/src/lib/integration/catalog.ts) | *[DECIDE]* | The freshness classes are data and the tick records each run; no connector is live for a customer. |
| **Accessibility blocker rate** | Blocking accessibility findings per released screen, from the scorecard, per quarter | defined | [`docs/WCAG-UI-AUDIT-SCORECARD.md`](WCAG-UI-AUDIT-SCORECARD.md) | *[DECIDE]* | The scorecard scores components with cited tests; a blocker count over releases starts with the quarterly review. |

## Business

| Measure | Definition | State | Source | Target | Note |
| --- | --- | --- | --- | --- | --- |
| **ARR/MRR** | Annualised value of signed agreements in force, and the monthly figure | defined | [`docs/FINANCIAL-READINESS-WORKSPACE.md`](FINANCIAL-READINESS-WORKSPACE.md) | *[DECIDE]* | D-009 keeps billing out of the app; the figure comes from the agreements themselves, in the financial workspace. |
| **Gross retention** | Value renewed at term as a share of value up for renewal, before expansion | defined | — | *[DECIDE]* | No agreement has reached term. |
| **Net retention** | Value renewed plus expansion, as a share of value up for renewal | defined | — | *[DECIDE]* | No agreement has reached term. |
| **Gross margin** | Revenue less hosting, AI and support cost of serving it, as a share of revenue | defined | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) | *[DECIDE]* | The AI cost controls are where the cost side is governed; there is no revenue yet. |
| **CAC payback** | Months of an institution’s gross margin needed to repay the cost of acquiring it | defined | — | *[DECIDE]* | Needs both a cost of acquisition and a margin; neither exists. |
| **Runway** | Months of operation at the current net burn | defined | [`docs/operating-model/OPERATING-RHYTHM.md`](operating-model/OPERATING-RHYTHM.md) | *[DECIDE]* | The monthly review’s first row. The number lives in the financial workspace, not the repository. |

## Setting a target

1. Record the decision as `docs/decisions/D-<n>.md`, `n` being its pull
   request's number, with the number, the date it is judged on, and what
   would change it.
2. Set `target: { value, decision }` on the measure in
   `app/src/lib/ops/firstyear.ts`.
3. Run `npm run registers` from `app/` to rewrite this page.

A measure whose reading needs a new mark goes through D-005 first, and
lands with its question in `ANALYTICS.md` and its migration in the same
pull request.

## How this page is held

[`app/src/lib/ops/firstyear.test.ts`](../app/src/lib/ops/firstyear.test.ts) fails when a measure is missing
or out of the brief’s order, when a source does not exist, when a measured
or instrumented state cites nothing that would return the number, when a
target has no decision, or when this page is stale.
