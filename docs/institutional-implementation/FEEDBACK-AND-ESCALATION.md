# Customer feedback intake and product escalation loop

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PROCESS — NO INTAKE REPOSITORY, NO CLOSED LOOP, NO DECISION HISTORY** |
| Owner | Customer success manager seat; product owner seat decides; both have unassigned backups |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | every phase; central to [phase 10](METHODOLOGY.md#phase-10--optimize) |
| Builds on | [`../commercial/FEEDBACK-AND-VOICE-OF-CUSTOMER-PROGRAM.md`](../commercial/FEEDBACK-AND-VOICE-OF-CUSTOMER-PROGRAM.md) (its consent and research rules bind here), [`../decisions/README.md`](../decisions/README.md) |

One rule makes this loop matter for the whole method: **a request the product
cannot express is never a one-off build for one customer.** It becomes a
recorded product escalation with an owner and a decision — so that the method
stays repeatable and the product stays one product.

## 1. What counts as an input

| Source | Examples | Consent / handling |
| --- | --- | --- |
| Support case | defect, confusion, missing capability | handled under the support loop; themes only leave support |
| Implementation | a workbook row nothing can express; a gate that fails for a product reason | raised by the implementation lead |
| Success review | EBR, working session, health review | recorded in the decision register |
| Voluntary feedback | in-product prompt, interview, survey | per the VOC program: purpose-limited, optional, no effect on access or price |
| Operator report | administrator, IT or help desk | as support |
| Accessibility or rights report | barrier, request | **not** feedback — routed to its own owner immediately |
| Exit and offboarding | reason taxonomy, optional detail | voluntary, limited taxonomy |

Participation is voluntary and never conditions access, support, services, price
or renewal. Never collect unnecessary student content or sensitive categories.
Never build individual sentiment, engagement or risk scores.

## 2. The intake record

One row per item in the customer-request ledger (a controlled spreadsheet or table
the product owner can read; tenant ids, no student identifiers).

| Field | Rule |
| --- | --- |
| Id, date, tenant, source | |
| Reporter role (not name, where avoidable) | |
| Statement in the customer's own words | quoted; no editorializing |
| Underlying job to be done | one sentence, filled at triage |
| Class | `defect`, `gap` (capability missing), `request` (enhancement), `policy` (the institution's rule, not ours), `rights`, `safety`, `accessibility`, `commercial`, `other` |
| Severity | P0–P3 for `defect`/`safety`/`rights`/`accessibility`; otherwise impact: blocks a design item / degrades / nice-to-have |
| Evidence | case ids, correlation ids, support themes (aggregate), workbook row |
| Workaround | verified, with scope |
| Owner seat and date | no item without one |
| Status | `new`, `triaged`, `routed`, `decided`, `scheduled`, `shipped`, `declined`, `closed-loop` |
| Decision record | link |

## 3. Triage

| Cadence | Who | Rule |
| --- | --- | --- |
| Immediate | support lead | P0/P1, `rights`, `safety`, `accessibility` skip the queue and go to incident process or the owning seat |
| Twice weekly | CSM, SL, IL | acknowledge and class new items; attach evidence; set an owner and date |
| Weekly product review | product owner, CSM, engineering lead | decide routed items; read recurring themes across tenants |

Internal objectives (unapproved; not for customers): acknowledge within 2
business days; decide or give a reasoned status within 10 business days;
close the loop with the reporter within 5 business days of any decision.

## 4. Routing

| Class | Goes to | Outcome expected |
| --- | --- | --- |
| `defect` | engineering via support escalation | fix with test, or a known issue with owner and date |
| `gap` | product owner | build / schedule / decline / workaround |
| `request` | product owner | same; weighed against the roadmap and the do-not-build list ([`../DO-NOT-BUILD.md`](../DO-NOT-BUILD.md)) |
| `policy` | the customer's own governance; Semester documents its own position | no Semester code to override an institution's policy |
| `rights` | privacy owner under the rights runbook | per runbook |
| `safety`, `accessibility` | incident owner / accessibility lead | stop-the-line where warranted |
| `commercial` | CF and CSM | order change or decline |

## 4a. The escalation ladder (time-critical)

| Level | Who | When |
| --- | --- | --- |
| 1 | support seat | every case |
| 2 | engineering on-call or domain owner | P1; repeated cohort impact; unsafe workaround; unknown cause after the agreed time |
| 3 | incident commander | any P0; data loss; isolation, privacy or rights risk; monitoring blind spot |
| 4 | Semester executive sponsor | a rollback trigger met; customer escalation to executives; a decision that changes scope or contract |
| 5 | counsel | any legal question, notification duty, or contract position — Semester states no conclusion |

A missed update, an unowned case or a customer asking for the next level is
itself an escalation trigger. Customers can always ask for the next level
without justification.

## 5. The product escalation loop

1. **Detect** — an input arrives and is recorded (section 2).
2. **Qualify** — is it new, a duplicate, a misunderstanding, a policy matter or
   a real gap? Link duplicates; one item per underlying job.
3. **Evidence** — attach what shows the need: how many tenants, how many cases
   (aggregate), what the workaround costs, which design item it blocks. Recurrence
   across tenants is **a signal, not a mandate**; a single critical blocker is a
   decision on its own.
4. **Decide** — the product owner records one of: *build now*, *schedule*,
   *workaround accepted*, *decline with reason*, *not ours (policy)*. If the
   decision changes the repository's behavior or documents, it is recorded as a
   decision file `docs/decisions/D-<pull request number>.md` (open the pull
   request first); the log is closed at D-160.
5. **Commit carefully** — a customer-facing statement is limited to *what was
   decided and what is not committed*. A date, a feature or a price is promised
   only through an order or change that counsel has seen. No roadmap delivery
   is promised from a meeting.
6. **Build and prove** — through the repository's normal gates (types, lint,
   gateway typecheck, suite, shuffle, build), with a guard that fails when the
   fix is reverted.
7. **Tell** — the reporter and the champion hear the outcome in plain words,
   including when the answer is no.
8. **Verify** — after release, the tenant confirms the problem is gone; if not,
   reopen. Only then `closed-loop`.
9. **Learn** — a fix that belongs in a workbook, training module or in-product
   requirement updates that template, so the next tenant gets it without asking.

## 6. Escalating a gap that blocks an implementation

When a design row cannot be satisfied:

1. Check the capability register: is it `EXISTS`, in flight, or excluded?
2. If excluded, the design lists it as an **exclusion** and the order says so.
3. If a customer needs it to proceed, the implementation lead opens an escalation
   with the workbook row, the blocking effect on the dates, and the options
   (descope, workaround, wait). The sponsors decide; nobody builds around it.
4. The implementation `status` becomes `at_risk` or `blocked` while the decision is
   pending, with the decision date in the register.

## 7. Governance of feedback itself

- Raw verbatims restricted to the owners; reported themes are de-identified, with
  small cells suppressed.
- Retention and withdrawal honored per the VOC program; a withdrawn item is
  removed from analysis, not hidden.
- Quote, logo, case-study or reference use needs separate, explicit permission.
- Bias review: whose voices are missing (students, faculty, staff, accessibility
  services, non-English speakers) is recorded beside every theme report.

## 8. Measures of the loop

Report: share of items acknowledged and decided inside the objectives; age of
open `gap`/`request` items; share closed-loop; repeat themes after a fix;
representation of roles in the feedback. Do **not** report satisfaction alone or
any individual's sentiment.

## Evidence state

**Repository evidence.** Feedback and help surfaces, the VOC program, support
tickets with access controls, the decision-record convention and the repository's
test gates exist.

**Operational evidence.** None: no ledger, no triage meeting, no decision made
from a customer request, no closed-loop item.

**Missing test/proof.** Stand up the ledger; run the weekly review for one pilot;
close the loop on at least one item; show a template changed because of one.

## Claim ceiling

Semester may invite clearly voluntary, purpose-limited feedback under an
approved protocol and describe this as its planned loop.

## Prohibited claims

Do not claim customer demand, validation, product-market fit or satisfaction from
any request, comment or support case; do not promise a roadmap item.
