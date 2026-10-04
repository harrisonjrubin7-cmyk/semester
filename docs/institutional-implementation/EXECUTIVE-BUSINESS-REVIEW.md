# Executive business review (EBR) template

| Control | Value |
| --- | --- |
| Status | **TEMPLATE — NO EBR HAS BEEN HELD** |
| Owner | Customer success manager seat; backup unassigned |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | [phase 10](METHODOLOGY.md#phase-10--optimize); cadence in [`SUCCESS-SYSTEM.md`](SUCCESS-SYSTEM.md#1-cadence) |
| Stored as | one `qbrs` row per review (`held_on`, `summary` 1–4000 characters) under the account's `success_plans` row; the full record in the project folder |
| Not this | the internal weekly review in [`../market-readiness/EXECUTIVE-WEEKLY-BUSINESS-REVIEW.md`](../market-readiness/EXECUTIVE-WEEKLY-BUSINESS-REVIEW.md), which is Semester's own |

An EBR is a meeting between the two executive sponsors to decide things. It is
not a report-out. If nothing is to be decided, hold a working session instead.

## Rules

1. **Evidence, not color.** No status without a linked, current evidence item.
   Say "no change" explicitly; do not hide a quiet quarter.
2. **Bad news first.** Open and unresolved items come before wins.
3. **Observed vs proposed.** Results are shown with population, window, source,
   missingness and caveats. A target is never presented as a result.
4. **No student-level data.** Aggregates at or above the privacy floor only;
   suppressed cells say "suppressed", not zero.
5. **No roadmap promises.** Shipped, in progress, and *not committed* are three
   separate lists; nothing not shipped is sold.
6. **Permission for any attribution.** A logo, quote, case study or reference
   needs separate, explicit, revocable permission, never inferred from the meeting.
7. **Internal posture stays internal.** The customer sees the risks and the
   evidence; the internal [renewal-risk posture](SUCCESS-SYSTEM.md#6-renewal-risk-model)
   is a working aid and is not shown as a score.

## Timeline

| When | Step | Owner |
| --- | --- | --- |
| T-14d | Schedule with both sponsors; confirm the decisions to be asked for | CSM |
| T-10d | Draw the evidence pack from the latest health review and the metric cards | CSM, SL |
| T-7d | Customer validates data and definitions with the champion; fix errors before the meeting | CSM, champion |
| T-3d | Pre-read issued: sections 1–11 below, two pages plus appendix | CSM |
| T0 | 60 minutes; decisions recorded live | both sponsors |
| T+2 business days | Summary stored in `qbrs`; decisions into the register; success plan and stakeholder map updated; owners and dates confirmed in writing | CSM |

## Attendees

Customer: executive sponsor (required), champion, one of {registrar, IT lead,
security/privacy officer} by topic. Semester: executive sponsor, CSM, and the
support or implementation lead if their area is on the agenda. A meeting
without both sponsors is a working session.

## The review

| # | Section | Content | Evidence |
| --- | --- | --- | --- |
| 1 | Decisions and commitments from last time | each item: owner, due, done / not done, why | register |
| 2 | Open issues and risks first | open P0/P1 (none, or detail); exceptions near expiry; risks the success plan lists; what we need from the customer | incident, exception, plan |
| 3 | Outcomes against the success plan | each agreed measure: baseline, target, observed, denominator, window, missingness, interpretation limit | metric cards |
| 4 | Adoption and operator health | the [adoption ladder](SUCCESS-SYSTEM.md#2-adoption-metrics) for the cohort; role coverage; operator seats and backups; access reviews and credential rotations on time | dashboards |
| 5 | Reliability and incidents | incidents with cause, impact and the tested prevention; integration freshness; reconciliation | incident log |
| 6 | Support and known issues | volume by theme, ageing, unresolved list (thresholded); known-issues with owner and date | queue |
| 7 | Trust, privacy, accessibility, rights | open reviews; rights requests handled; accessibility barriers reported and their state; subprocessor changes | registers |
| 8 | What shipped, what is next, what is not committed | three separate lists, each tied to the customer's own requests where relevant | release notes; product decisions |
| 9 | Customer voice | voluntary feedback themes with method, sample and non-response; unresolved requests and their decisions ([feedback loop](FEEDBACK-AND-ESCALATION.md)) | feedback ledger |
| 10 | Commercial | term and notice dates; renewal stage; scope vs order; pending changes; billing status | contracts, renewal record |
| 11 | Decisions requested | the 1–3 decisions the sponsors must make today, each with options, a recommendation and its consequence | — |
| 12 | Next 90 days | owners and dates; the next EBR date | — |

Decisions typically requested: continue / correct / narrow / pause / stop;
expand scope (and what review and capacity it needs); renewal path; exception
extension or closure; sponsor or champion succession; offboarding if the
value case has failed. An honest "stop" is a valid outcome, with the
[offboarding route](OFFBOARDING-AND-EXPORT.md) ready.

## One-page pre-read skeleton

```
Account: ___   Period: ___   Held on: ___   Sponsors: ___ / ___
Where we stand (3 sentences, bad news first):
Open P0/P1: ___   Exceptions near expiry: ___   Overdue decisions: ___
Outcomes: <measure> baseline __ target __ observed __ (n __, window __, caveat __)
Adoption: activation __%, first win __%, weekly planning __% (denominators frozen at launch)
Operator seats with a backup: __ of __   Access reviews on time: __ of __
Reliability: incidents __ (causes ___); integration freshness ___
Support: P0/P1 __, P2 ageing ___, top themes ___
Not committed: ___
Decisions requested: 1) ___ 2) ___
Next 90 days: owner/date ___
```

## Storing the summary (`qbrs.summary`, ≤ 4000 characters)

Plain text, in this order: decisions made (with owner and date); commitments
changed; outcomes status with caveats; open risks; next EBR date. Keep the full
deck and notes in the project record; the stored summary must stand alone for
the next person in the seat. Never store student-level data or private support
content.

## Quality checks before sending

- [ ] Every number has a denominator, a window and a source.
- [ ] Every "Green" has a linked evidence item; every "unavailable" is labeled.
- [ ] Nothing in section 8 promises delivery of an unshipped capability.
- [ ] No cell under the privacy floor is shown.
- [ ] The customer validated the data (T-7d).
- [ ] The decisions requested are real decisions with owners.
- [ ] Counsel reviewed any statement about contract, privacy or legal position.

## Evidence state

**Repository evidence.** The `qbrs` table, success plan, renewal records and the
metric and health definitions exist.

**Operational evidence.** No EBR has been held; no customer has validated a data
pack.

**Missing test/proof.** One EBR run with a real sponsor and a second person
shadowing preparation.

## Claim ceiling

Semester may describe this as its planned EBR format.

## Prohibited claims

Do not claim any customer outcome, adoption, satisfaction or referenceability
from this template.
