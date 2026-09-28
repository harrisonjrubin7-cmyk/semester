# Launch Readiness Council

Who decides whether Semester goes live for a cohort, what each seat decides,
and the rules the decision follows. The decision itself is computed. The seats,
gates and rules below are written as data in
[`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts), and
[`launchreadiness.test.ts`](../app/src/lib/launchreadiness.test.ts) fails if
this document and that data disagree.

**Current verdict: `NO-GO`.** Every seat is vacant, and no gate is met.
[`GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md) lists each open reason.

## Why the council is written as data

The repository already records its readiness in prose:
[`SEMESTER_MARKET_READINESS.md`](../SEMESTER_MARKET_READINESS.md), the
[`market-readiness/`](market-readiness/) set, and the
[`GO_LIVE_CHECKLIST.md`](market-readiness/GO_LIVE_CHECKLIST.md). All of that
prose has been wrong in both directions. The scorecard reported absent six
things that were built. A go/no-go written only as a checklist can fail the
opposite way: someone ticks a box because the work *looks* done.

So the verdict is a function, `decide()`, and it has only one way to return `go`:
every gate met with cited evidence, every seat held and signed, no open P0/P1,
and each of the eight parts of the launch condition satisfied. It has no
override. A risk acceptance can waive a P2 or P3 gap. It cannot waive a P0 or
P1, it must come from the founder seat, and it must carry an expiry date.

## The seats

| Seat | Decides | Holder |
| --- | --- | --- |
| `founder` — Founder / CEO | Risk acceptance, customer commitment, commercial launch | Vacant |
| `product` — Product lead | Golden path and its acceptance criteria | Vacant |
| `engineering` — Engineering lead | Reliability, release, rollback | Vacant |
| `security` — Security / vCISO | Threat model, pen-test findings, access controls | Vacant |
| `privacy` — Privacy / legal | Terms, privacy, DPA/FERPA/COPPA posture, consent | Vacant |
| `accessibility` — Accessibility lead | WCAG/VPAT status, blockers, remediation | Vacant |
| `success` — Customer success | Onboarding, training, support, communication | Vacant |
| `trust` — Trust & Safety | Reporting, escalation, moderation scope | Vacant |
| `data` — Data / integration owner | Source quality, freshness, connector health | Vacant |
| `champion` — Pilot institution champion | Institutional workflow and communications | Vacant; must be someone at the institution |

**Why every seat reads "Vacant", when `ROLLBACK.md` and `RESTORE.md` both name
an owner.** Those documents name the person who can *run the workflows*. They
also call that single person the project's standing problem. A council seat
is an accountability that someone has accepted in writing. Filling all ten
seats with one repository username would make the council look complete when
it is not. [`docs/vanderbilt/incident-routing.md`](vanderbilt/incident-routing.md)
applies the same rule to incident owners: "A repository username is not an
operational on-call assignment."

A person may hold more than one seat. The `champion` seat may not be held by
anyone at Semester. A champion from the vendor side is a sales contact.

## How a seat is filled

1. The person accepts the seat in writing. The acceptance lives in the private
   operations system. It does not go in this public repository, for the same
   reason alert destinations do not (see `incident-routing.md`).
2. Set the seat's `holder` in `launchreadiness.ts` to a role label, such as
   "Founder" or "Vanderbilt Registrar's Office". Do not use a personal email
   address. Change this document's table in the same commit, or the test fails.
3. A holder signs off by adding the seat to `signoffs` for the specific
   decision. A signature is valid only for the decision it was given for. A
   later decision needs a new signature.

## The rules `decide()` enforces

| Rule | Why |
| --- | --- |
| A gate is `met` only with at least one cited file, and every cited file must exist | A tick needs a link. This is the rule from `GO_LIVE_CHECKLIST.md`, now checked by a test |
| A gate cannot be `met` while the matching `GO_LIVE_CHECKLIST.md` line is unticked | Two documents must not give two different answers |
| An open P0 or P1 blocker is a `NO-GO`, and no acceptance can waive it | Stated by the command, and the only safe reading of it |
| A risk acceptance must name the founder seat, the blocker, a reason and an expiry | An acceptance with no end date is a decision nobody reviews again |
| Every seat must be held and must have signed | A vacant seat is an unowned risk |
| All eight parts of the launch condition must be satisfied | See below |

## The launch condition

```
One excellent golden journey
+ one controlled beta
+ one named institutional champion
+ one approved data scope
+ one support and incident process
+ one real trust/accessibility/privacy evidence package
+ one measurable pilot outcome
+ one repeatable implementation path
= launch ready
```

Each part maps to one or more gates in `CONDITION` in `launchreadiness.ts`.
A part is satisfied only when every gate it maps to is `met`.

## Cadence

- **Weekly**, during a beta or pilot: review open blockers, known issues and
  any risk acceptance due to expire. The acceptance log is the agenda.
- **At each decision**: produce a fresh `decide()` result and attach it to the
  decision record. A verdict from last week is no longer valid.
- **On any P0/P1**: the verdict becomes `NO-GO` automatically. No meeting is
  needed to reach it.

## What this document is not

It is not an approval. It does not create a legal body, and it does not make any
compliance claim. Nothing in the repository can make the verdict `GO` on its
own. It becomes `GO` only after named people accept seats and sign.
