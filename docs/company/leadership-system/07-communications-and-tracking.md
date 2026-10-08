# 8 · Executive communications, meeting cadence, decision log and initiative tracking

> **PROPOSED — NOT ADOPTED.** Consolidates and trims the cadence in [`OPERATING-RHYTHM.md`](../../operating-model/OPERATING-RHYTHM.md) and [`COMPANY-OPERATING-MODEL.md`](../COMPANY-OPERATING-MODEL.md#operating-system) rather than adding to it. The rule inherited from the operating rhythm applies to everything here: **a meeting with no written output gets cancelled.**

## Communication principles

1. **Written first.** Decisions, updates and asks are written before they are discussed. A meeting is for the part writing cannot do: disagreement, judgment, and a decision.
2. **One source.** Every number and decision lives in one place and is linked everywhere else. A pasted copy is a stale copy.
3. **No surprises.** Bad news travels to the people who need it within 24 hours (the triggers are in [01](01-board.md#reporting-cadence)).
4. **One voice outside.** Public, customer and press statements go through one named writer and the claims register.
5. **Say what we do not know.** `UNKNOWN` is allowed; unlabelled guessing is not.

## Communications map

| Audience | Vehicle | Cadence | Owner | Rule |
| --- | --- | --- | --- | --- |
| **The team** | Weekly written update: what shipped, what is at risk, what is decided, what is needed | Friday | Founder | Max one page; links, not copies |
| **The team** | Monthly company note: scorecard, OKR confidence, what we stopped, one thing learned from students | Monthly | Founder | Candid; includes misses |
| **The team** | Quarterly all-hands (or founder-and-team session at small size) | Quarterly | Founder | Shares the QBR outputs |
| **Advisors / board** | Monthly note; quarterly packet ([01](01-board.md#board-packet)) | Monthly, quarterly | Founder | No-surprises notice inside 24 hours |
| **Design-partner prospects and pilots** | Weekly pilot review with the customer's champion once a pilot is live; otherwise a short status after each meeting | Weekly during a pilot | Implementation | Only what the signed scope and the claims register allow |
| **Individual students** | In-product notices; release notes; support replies | Per release | Product / support | Plain language; consistent with the claims register; accessible |
| **Public** | Website, social, press | As approved | Claim owner | Every claim from the library, with an expiry |
| **Counsel / CPA / broker** | Monthly status and a standing question list | Monthly | Founder | Questions in writing, answers filed |
| **During an incident** | Per [`INCIDENT-COMMUNICATIONS.md`](../../operating-model/INCIDENT-COMMUNICATIONS.md) and [`CRISIS-COMMUNICATIONS-TEMPLATE.md`](../CRISIS-COMMUNICATIONS-TEMPLATE.md) | As the incident requires | Incident commander | Facts only; counsel on notification duties |

## Meeting system

The founder's recurring meeting load is a budget, set in the [README](README.md#design-rules). Every meeting passes the four-question test: what it decides, what it consumes, who is accountable, when it ends.

| Meeting | Decides | Inputs | Output | Length | Who | Cancel when |
| --- | --- | --- | --- | ---: | --- | --- |
| **Weekly operating review** | Priorities for the week; escalations; items aged past their decision clock | Scorecard exceptions, trust ledger, initiative register, support themes, pipeline | Top three issues with owners; decisions logged | 45–60 min | Founder; function owners | Nothing is red, aging or escalated: do it in writing |
| **Trust Review** | Critical changes; exceptions; claim withdrawals | The trust ledger | One line per item with owner and date | 30 min | Founder; advisor/counsel on call | No ledger change |
| **Per-release council** | GO, GO WITH CONDITIONS, NO-GO | Immutable candidate, test and scan results, rollback, support readiness | Release decision | 20–30 min | Engineering, product, trust, support | Standard class releases are decided by the DRI and gates |
| **Pilot review** (during a pilot) | Continue, constrain, pause, convert, offboard | Pilot scorecard, UAT, issues | Joint decision with the customer | 30–45 min | Implementation; customer sponsor/champion | Pilot not live |
| **Monthly company review** | Resource and risk decisions; stage check | Scorecard, budget vs actual, runway, vendor and legal calendar | Decisions; the monthly note | 60–90 min | Founder; leads | The monthly note answers everything |
| **Monthly advisor note** | — | Scorecard, asks | Written note (not a meeting) | — | Founder | — |
| **QBR** | Motion decisions; next quarter | [03](03-okrs-planning-metrics.md#quarterly-business-review) | Locked OKRs; stop list | 90 min–3 h | Per [03](03-okrs-planning-metrics.md#quarterly-business-review) | Never skipped; shortened if nothing changed |
| **Quarterly trust and access review** | Re-justify or revoke privileged access; vendor review; exercise results | Role-grant audit; vendor register | Evidence filed | 60 min | Founder; security; privacy | — |
| **Annual strategy and governance review** | The plan; org; this system itself | Strategy memo; evidence | Plan, org, deletions | Half to full day | Founder; advisors/board | — |
| **1:1s** | — | Written agenda from the report | Notes and actions | 30 min weekly or fortnightly | Manager; report | At pre-seed with no reports |

**Meeting budget:** governance meetings at pre-seed should total about 4 hours a week including the weekly review, Trust Review and 1:1s `[HYPOTHESIS]`. When the budget is exceeded for a month, the next review deletes a meeting.

**Protected time:** no recurring meetings during declared exam and deep-work windows ([09](09-calendar.md)); the weekly update and the Trust Review shift to writing in those weeks.

**Meeting hygiene:** agenda and pre-read at least a day before; decisions and owners recorded in the meeting; actions in the register, not in a doc nobody opens; no meeting without a named decider.

## Decision log

The repository already fixes the rule for product and engineering decisions and a template for company decisions. This section reconciles them so there is no ambiguity about where a decision goes.

### Two stores

| Store | What goes here | Why | Form |
| --- | --- | --- | --- |
| **`docs/decisions/D-<pull request number>.md`** | Product, engineering, architecture, repository-recorded decisions; adoption of this system | The decision log numbered in turn and collided; the pull request number is unique and known when the pull request opens ([`docs/decisions/README.md`](../../decisions/README.md)). The log is closed at D-160 | `## D-<N> · <the decision, as a sentence>`, then **Decided <date>.**, what and why, and what is not done |
| **`FD-YYYY-NNN` records in a controlled system** | Legal, financing, compensation, personnel, privileged, customer-confidential and security-sensitive decisions | A public repository must not hold them ([`CORPORATE-GOVERNANCE-CHECKLIST.md`](../CORPORATE-GOVERNANCE-CHECKLIST.md#evidence-register)) | [`FOUNDER-DECISION-LOG-TEMPLATE.md`](../FOUNDER-DECISION-LOG-TEMPLATE.md) |

Where each lives for a given decision is `[DECIDE: F9]`. Until a controlled system exists, the default is the founder's private store with a **non-sensitive one-line pointer** in a `D-` record where the decision touches the repository.

### What must be logged

Any Class A decision; any decision in the [reserved matters](01-board.md#reserved-matters); any decision that reverses an earlier one; any exception or risk acceptance; any decision where someone dissented; any decision that changes a published commitment or claim. Class B only if it crosses functions. Class C only if surprising.

### Required fields (beyond the existing templates)

| Field | Why |
| --- | --- |
| **Class** (A/B/C) | Review and clock |
| **Decider and consulted** | Names, not teams |
| **Options and recommendation** | Shows the alternative that was not chosen |
| **Dissent** (name, reason, what evidence would change the mind) | Required on Class A |
| **Evidence and its status** | Fact, hypothesis, assumption, counsel-reviewed |
| **Reversal trigger** | The observation that would reopen it |
| **Review date** | Decisions expire; they are re-affirmed or retired |

### Discipline

- Written within **2 working days** of the decision.
- A decision is not effective for others until it is written down and linked.
- **Quarterly decision review:** sample five decisions; was the outcome as predicted; was the class right; what would we decide differently. This is how the decision classes are calibrated.
- Open question to resolve in review: whether the `D-` store should carry a class field. A change to the record form is itself a decision.

## Initiative tracking

An initiative is a bounded piece of work with an outcome, an owner and an end. A project that is a routine is not an initiative.

### Stages

| Stage | Question | Gate |
| --- | --- | --- |
| **Shape** | Is this the right problem, and what outcome would count? | One-pager exists; owner named; linked to a key result or risk |
| **Commit** | Do we have capacity and a stop condition? | Capacity named; **work-in-progress limit** respected; kill criteria written |
| **Build** | Is it on track? | Weekly confidence |
| **Prove** | Did it work, and where is the artifact? | Outcome measured against the key result; evidence filed |
| **Scale or Kill** | Keep, extend, hand to operations, or stop | Decision recorded; stopped work names what was learned |

### Rules

- **Limit.** At most **three company-level initiatives** in Build at any time (pre-seed). A fourth must displace one.
- **One owner.** One accountable person per initiative.
- **Green needs an artifact.** Status is green only with a linked artifact or measurement; otherwise it is unknown, shown as such.
- **Dependencies are named**, including any dependency on a third party, counsel or a customer, with the date the answer is needed.
- **Kill criteria are written at commit time**, so stopping is not a failure of will.
- **Capacity is explicit.** An initiative states hours or people per week; the sum cannot exceed stated capacity ([03](03-okrs-planning-metrics.md#annual-planning-process)).
- **Review.** Weekly: exceptions only. Monthly: one initiative in depth. Quarterly: Scale or Kill for each.

### Register fields

| Field | Content |
| --- | --- |
| ID | Short, stable |
| Name and outcome | One sentence: what changes for whom |
| Owner and backup | Named; backup per the owner matrix rule |
| Linked key result or risk | The reason it exists |
| Stage | Shape / Commit / Build / Prove / Scale-or-Kill |
| Confidence | Red / amber / green, with the evidence link |
| Capacity | Hours per week or people |
| Dependencies | With dates |
| Kill criteria | Written at commit |
| Next decision and date | What is decided next and when |

A one-pager is in [templates](templates.md#initiative-one-pager). **One home:** the register lives in one place, either a rendered doc under `docs/` or the team's tracker; copies are links `[DECIDE]`.

## What to delete

A weekly update nobody replies to for a month becomes a monthly note. An initiative with no key result is cut or attached to one at the next review.
