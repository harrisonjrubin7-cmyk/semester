# Finance release gates

| Control | Value |
| --- | --- |
| Status | **PROPOSED GATE SET — NO GATE HAS BEEN ADOPTED OR PASSED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`../MONEY-MODULES-SWITCH-ON.md`](../MONEY-MODULES-SWITCH-ON.md) (nine preconditions, none met), [`../../GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) (3 Oct), `docs/program/READINESS_GAP_MATRIX.md`, `docs/FEATURE-TRUTH-TABLE.md`, [`../evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md`](../evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md), `ops/billing/README.md` |
| Claim ceiling | Internal release criteria. Passing a gate here is **necessary and never sufficient**: it does not authorize charging anyone; the owner's decision and the reviewed code change that lifts the hold do. |
| Prohibited claims | That any gate is met; that checkout, refunds, institutional invoicing or any money flow is ready or approved. |

> Not legal or accounting advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. Naming, so these are not confused with other gates

| Set | Prefix | What it gates | Where |
| --- | --- | --- | --- |
| **Finance release gates** (this file) | `FRG-nn` | Technical and finance readiness to move money through the native platform | Here |
| Financial-model go/no-go gates | `A-160` to `A-164` | Whether the *company* may spend, hire, price | `10-GO-NO-GO-GATES.md` |
| Marketplace gates | `G-OWN`, `G-DATA`, `G-TERMS`, `G-QUEUE` | Marketplace, payments, payouts, provider access (D-1236) | D-1236 |
| Money-module preconditions | numbered 1–9 | Switching on the school student-account module | `MONEY-MODULES-SWITCH-ON.md` |
| Readiness gaps | `G-Ixx`, `G-Pxx`, `G-Mxx` | Readiness matrix rows | `READINESS_GAP_MATRIX.md` |

A release needs the FRG gates **and** the others that apply. FRG never replaces them.

## 2. The hold that stays

New individual checkout is held in two places that must change together and are pinned by tests: `supabase/functions/billing-checkout/index.ts:27` (`individualPaidAcquisitionApproved = false`) and `app/src/lib/plans.ts:19` (`INDIVIDUAL_PAID_ACQUISITION_ENABLED = false`). `BILLING_LIVE_ENABLED=true` is necessary and cannot override the code-level hold. Lifting it is a **reviewed code change after the individual-sale decision gates are satisfied** (`ops/billing/README.md`). No FRG gate lifts it, and no implementation action in [`NATIVE_FINANCIAL_PLATFORM.md`](NATIVE_FINANCIAL_PLATFORM.md) §14 touches it. Cancel and billing history remain available to existing subscribers throughout.

## 3. How a gate is scored

Each gate has: **criterion** (a checkable statement), **evidence** (a file, test name, run record or signed note that a stranger can inspect), **owner**, **status** (NOT STARTED, IN PROGRESS, MET WITH EVIDENCE, WAIVED WITH RECORD). A gate is MET only with named-person-verified evidence; "the owner confirmed" without a record does not count (the repository already has one such sentence it does not rely on). A waiver names who waived, why, and the residual risk, and is itself an approval under the policy. **Scorecard is committed to the repository before any release review**, and every unmet gate is named in the review.

## 4. Gates

| Gate | Criterion | Evidence required | Status today |
| --- | --- | --- | --- |
| FRG-01 | Owner decision recorded on the adapter layer and two-ledger boundary; D-146 and D-1236 either unchanged or explicitly superseded for a named capability | `docs/decisions/D-<PR>.md` | NOT STARTED |
| FRG-02 | Counsel, qualified accountant, tax adviser and payments adviser **named and engaged**, or the gates that depend on them explicitly stay closed (D-1154 says none is) | Engagement letters or a recorded "not yet" with blocked gates listed | NOT STARTED |
| FRG-03 | Adapter interface exists; Stripe adapter passes the shared contract suite; the existing 57 billing tests pass unchanged; each new guard shown red against a faithful revert | Test run record; revert log | NOT STARTED |
| FRG-04 | Verified-event inbox; early events parked (not 500 forever); dead-letter; replay; chaos cases for duplicate, early, out-of-order, secret mismatch, mode mismatch, provider timeout | SQL check suite; chaos run | NOT STARTED |
| FRG-05 | Billing ledger in shadow; balance trigger, append-only, reversal and period-lock proofs; chain extended; **zero drift** between ledger, invoices and payment events for the stated period (period set by the accountant) | `billing-ledger.check.sql`; drift reports | NOT STARTED |
| FRG-06 | Authority matrix **adopted** by the owner (and board where FC-02 requires); policy rows active; fail-closed proven; second approver seat staffed or single-seat compensating review recorded | Policy version; fail-closed proof; D-1154 follow-up | NOT STARTED |
| FRG-07 | Refund workflow: test-mode round trip with approval, idempotent resubmit, never above captured; **one real refund** of the owner's own live charge, posted, reconciled | Test log; live evidence file | NOT STARTED |
| FRG-08 | Dispute workflow: test-mode dispute through opened, evidence, won and lost with correct journals; deadline reminders | Test log | NOT STARTED |
| FRG-09 | Reconciliation: settlement ingested; **two consecutive weekly runs** with no unexplained exception; a monthly bank pass; one period close by two people | Run records; close record | NOT STARTED |
| FRG-10 | Live-acceptance gaps closed: annual charge, failed renewal, refund (with FRG-07), dispute (test or live per the owner), **tax collected in a registered jurisdiction** | New evidence file in `docs/evidence/` | NOT STARTED |
| FRG-11 | Read-only Finance console live with role gating, pseudonymous default, audit; support runbook for billing; billing incident playbook extended (refund error, double charge, rail outage, ledger drift) | Screenshots, role-matrix test, playbook | NOT STARTED |
| FRG-12 | Native notices (receipt, failed payment, final notice, refund) live; customer-facing wording reviewed by counsel (no unqualified compliance claim; no refund window); tax setup active; checkout shell stage 1 | Template versions; counsel review | NOT STARTED |
| FRG-13 | Institutional invoicing: contacts, tax profile and exemption workflow, purchase orders, invoice immutability, lines populated; first invoice per customer reviewed by a second person; tax adviser and counsel sign-offs on the order form and invoice format | Check suites; sign-offs | NOT STARTED |
| FRG-14 | **Embedded rail-served card field only if** a qualified person has answered the PCI path in writing | Written determination | BLOCKED (not answered) |
| FRG-15 | Mode B (Semester-scheduled renewals on stored tokens): consumer-law review of auto-renewal and retry; consent for off-session charging; approved retry schedule | Counsel review; consent text version | BLOCKED |
| FRG-16 | AI overage: shadow metering agrees with the spend meter for the stated period; price book line approved; customer opt-in and ceiling; the shared-provider activation gate (`SHARED_PROVIDER`, five requirements) is met | Shadow report; activation record | BLOCKED (activation all `pending-owner`) |
| FRG-17 | Second adapter passes the contract suite; settlement parse reconciles to the rail's own totals; vendor and subprocessor entries; DPA | Test run; vendor record | NOT STARTED |
| FRG-18 | Accounting export accepted by the accountant; chart of accounts adopted; revenue-recognition method adopted in writing | Accountant acknowledgement | NOT STARTED |

## 5. Gate-to-release matrix

| Release | Requires | Plus the other gates that apply |
| --- | --- | --- |
| Shadow and sandbox build steps (all of §14 in the platform document) | None beyond ordinary CI gates | CLAUDE.md gates: `tsc -b`, `lint`, `check:university`, `test`, `test:shuffle`, `build`; `design-system:check` for UI |
| Owner's own account, live, to exercise gaps | FRG-01, 03, 04, 05; FRG-06 for refund | Current live-acceptance rules (explicit owner approval; no checkout enabling) |
| Opening individual paid acquisition | FRG-01 to FRG-12 | Individual-sale decision gates; price decision (D-134 vs D-1154); GO-NO-GO items; counsel on disclosures; a reviewed change flipping both hold constants |
| First paid institutional pilot (invoice, bank transfer) | FRG-01 to FRG-06, FRG-09, FRG-11, FRG-13 | GO-NO-GO blocker "entity, signing, price, tax/accounting, payment and insurance authority"; price authority (G-P9); counsel on the order form |
| Embedded card field | + FRG-14 | PCI determination |
| Semester-scheduled renewals | + FRG-15 | |
| AI overage | + FRG-16 | |
| Second rail | + FRG-17 | |
| Student-account module (school ledger) | Its own nine preconditions | Not an FRG matter; extensions S-1 to S-10 help |
| Marketplace payments, wallet, payouts, financing | Not this file | D-1236 gates and a new owner decision + counsel ([`EMBEDDED_FINANCE_ROADMAP.md`](EMBEDDED_FINANCE_ROADMAP.md)) |

## 6. Standing release checks for any finance-touching pull request

- [ ] Does not change either hold constant unless this is the reviewed lifting change.
- [ ] No card-number-capable parameter, column, log or message was added (NF-01 scan).
- [ ] No rail credential reachable from the browser (NF-03 scan).
- [ ] Every new money command carries a derived idempotency key (NF-04).
- [ ] Every new table has RLS, a grants review, an allowlist update where the repo requires one, a `*.check.sql` and a note in `lib/definerregister.ts` / `lib/edgeguards.ts` / `sre/catalog.ts` where it adds a definer function or an Edge Function.
- [ ] Journals balance (property test) and posting is idempotent.
- [ ] A guard added is shown red against a faithful revert, and a control row (a case that should find a problem) shows the probe is not broken.
- [ ] Copy has no refund window, no price, no PCI or SOC 2 claim.
- [ ] `docs:impact` rules satisfied (functions need `docs/reference/`, `guides/` or `docs/decisions/`; screens need `CHANGELOG.md` or help docs).
- [ ] Change recorded under FC-24.

## 7. Evidence state

- **Repository evidence:** the sets in §1; the hold constants; `FEATURE-TRUTH-TABLE.md` (checkout BLOCKED for live charges; refund/dispute PARTIAL); `READINESS_GAP_MATRIX.md` (billing BUILT, HELD; payment support ABSENT; refund process DRAFT; paid pilot DRAFT, NO-GO; finance ops TEMPLATE).
- **Operational evidence:** one live monthly charge on 2026-10-03; not exercised: annual, refund, failed renewal, dispute, tax in a registered jurisdiction.
- **Missing proof:** every gate in §4.

## Cannot be completed from source code

Whether any gate is met; the owner's go or no-go; counsel, accountant and assessor determinations; the length of the zero-drift and reconciliation periods (the accountant's call).
