# Launch Readiness Council

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Who decides whether Semester goes live for a cohort, what each seat decides,
and the rules the decision follows. The decision itself is computed. The seats,
gates and rules below are written as data in
[`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts), and
[`launchreadiness.test.ts`](../app/src/lib/launchreadiness.test.ts) fails if
this document and that data disagree.

**Current verdict: `NO-GO`.** Harrison Rubin is the interim accountable owner
for all twelve seats. The accepted-holder record remains seven held and five
vacant; none has signed and one gate is met. Interim accountability does not
establish professional qualification, institutional representation,
independent review, approval or permission.
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
every gate met with cited evidence, every seat held and signed, nothing open,
and each of the eight parts of the launch condition satisfied. It has no
override. A risk acceptance can waive a P2 or P3 blocker. It cannot waive a P0
or P1, it must come from the founder seat, it must carry an expiry date, and it
must say what pilot users are told. A launch that rests on such acceptances is
`GO WITH CONDITIONS`, never `GO`: the verdict lists each accepted blocker with
its owner, reason, disclosure and expiry, so the decision record says what the
launch proceeds under (D-117).

## The seats

| Seat | Decides | Interim accountable owner | Accepted / appointed holder |
| --- | --- | --- | --- |
| `founder` — Founder / CEO | Risk acceptance, customer commitment, commercial launch | Harrison Rubin | Founder |
| `product` — Product lead | Golden path and its acceptance criteria | Harrison Rubin | Founder, acting |
| `engineering` — Engineering lead | Reliability, release, rollback | Harrison Rubin | Founder, acting |
| `security` — Security / vCISO | Threat model, pen-test findings, access controls | Harrison Rubin | Vacant |
| `privacy` — Privacy / legal | Terms, privacy, DPA/FERPA/COPPA posture, consent | Harrison Rubin | Outside counsel |
| `accessibility` — Accessibility lead | WCAG/VPAT status, blockers, remediation | Harrison Rubin | Founder, acting |
| `success` — Customer success | Onboarding, training, support, communication | Harrison Rubin | Founder, acting |
| `trust` — Trust & Safety | Reporting, escalation, moderation scope | Harrison Rubin | Vacant |
| `data` — Data / integration owner | Source quality, freshness, connector health | Harrison Rubin | Vacant |
| `finance` — Finance / commercial | Price floors, discount and pilot-credit approvals at the deal desk, margin, contract terms | Harrison Rubin | Vacant |
| `operations` — Operations / SRE | Monitoring, on-call, incident readiness, support operations, release readiness | Harrison Rubin | Founder, acting |
| `champion` — Pilot institution champion | Institutional workflow and communications | Harrison Rubin | Vacant; must be someone at the institution |

**Why all twelve seats name one interim owner without filling five vacant
seats.** `interimOwner` records who coordinates the work and owns follow-up.
The separate `holder` field is the readiness input used by existing staffing
checks. It remains unchanged. Naming Harrison Rubin as interim owner therefore
does not assert that he is qualified counsel, a vCISO, an accessibility
assessor or an institutional representative, and supplies no independent
review, approval, operational role or account permission.

A person may own follow-up for more than one seat. The `champion` seat still
requires someone at the institution before it can supply institutional
representation or sign-off. Harrison Rubin's interim ownership does not meet
that requirement; a vendor-side contact is not the institutional champion.

## How a seat is filled

1. The person accepts the seat in writing. The acceptance lives in the private
   operations system. It does not go in this public repository, for the same
   reason alert destinations do not (see `incident-routing.md`).
2. Set the seat's `holder` in `launchreadiness.ts` only when an accepted or
   institution-appointed holder exists. `interimOwner` records follow-up
   accountability separately. Do not use a personal email address. Change this
   document's table in the same commit, or the test fails.
3. A holder signs off by adding the seat to `signoffs` for the specific
   decision. A signature is valid only for the decision it was given for. A
   later decision needs a new signature.

**2026-09-28 — four seats accepted.** On the founder's instruction (decision 1
in [`LAUNCH-DECISIONS.md`](LAUNCH-DECISIONS.md)), the `founder` seat is held
by the founder, and `product`, `engineering` and `success` are held by the
same person, acting, until someone else accepts each — this document allows
one person to hold several seats at pilot scale. The four holders were written
into `launchreadiness.ts` and this table in the same change. Nothing was added
to `signoffs`: there is no decision before the council yet, and a signature is
given for a decision, not for a seat. `decide()` therefore now reads "has not
signed" for these four and "is vacant" for the other eight, and the verdict is
unchanged.

**2026-09-30 — three more seats accepted.** On the founder's word, `privacy`
is held by outside counsel, and `accessibility` and `operations` by the
founder, acting. Role labels, as above. Nothing was added to `signoffs`, so
`decide()` reads "has not signed" for seven seats and "is vacant" for five,
and the verdict is unchanged. The accessibility seat decides WCAG and VPAT
status, but it does not replace an independent audit; that stays owed.

**2026-10-12 — one interim accountable owner for all twelve seats.** At the
owner's direction, `interimOwner` now names Harrison Rubin on every seat. The
accepted `holder` values are unchanged: seven held, five vacant. This replaces
neither specialist qualifications nor the institution's champion, and grants
no independent approval or permission. Nothing was added to `signoffs`; the
same eleven gates remain partial or unmet, and `decide()` still returns
`NO-GO` with 31 reasons.

## The rules `decide()` enforces

| Rule | Why |
| --- | --- |
| A gate is `met` only with at least one cited file, and every cited file must exist | A tick needs a link. This is the rule from `GO_LIVE_CHECKLIST.md`, now checked by a test |
| A gate cannot be `met` while the matching `GO_LIVE_CHECKLIST.md` line is unticked | Two documents must not give two different answers |
| An open P0 or P1 blocker is a `NO-GO`, and no acceptance can waive it | Stated by the command, and the only safe reading of it |
| A risk acceptance must name the founder seat, the blocker, a reason, what pilot users are told, and an expiry | An acceptance with no end date is a decision nobody reviews again; one the affected people are not told about is a surprise, not a condition |
| A verdict with any acceptance in force is `GO WITH CONDITIONS`, and lists them | A go that rests on waivers must not read as a clean one |
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
- **On `GO WITH CONDITIONS`**: each condition's disclosure goes to pilot users
  before the cohort goes live, and each expiry is on the weekly agenda. When
  one expires unfixed, the verdict is `NO-GO` again on its own.

## What this document is not

It is not an approval. It does not create a legal body, and it does not make any
compliance claim. Nothing in the repository can make the verdict `GO` on its
own. It becomes `GO` only after named people accept seats and sign.
