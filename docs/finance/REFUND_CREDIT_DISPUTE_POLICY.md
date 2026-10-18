# Refund, credit, dispute and write-off policy

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN AND DRAFT POLICY STRUCTURE — NOTHING HERE IS OPERATING, ADOPTED OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`../legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md`](../legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md), [`../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md`](../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md) §6, [`05-BUDGET-GOVERNANCE.md`](05-BUDGET-GOVERNANCE.md) §4, D-132, D-1019 |
| Claim ceiling | Internal design. **No refund window is stated or granted** (D-1019) and none is created here. Thresholds are proposals from `05`, not adopted. |
| Prohibited claims | Any refund window, guarantee or timeline to a customer (CLM-015); that refunds or disputes are handled today. |

> Not legal, consumer-protection or accounting advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. State today (FACT)

- `credits_refunds` (kind credit, refund, service_credit; status pending, issued, declined; amount > 0) is a **bare register**: no function, trigger or workflow writes it, no immutability, no balance linkage, no provider reference.
- A refund at the rail arrives as `charge.refunded`, which is recorded in `payment_events` as kind `refund` and **changes nothing** else: not the invoice, not `credits_refunds`, not the entitlement.
- A dispute arrives as `charge.dispute.created`, recorded as kind `chargeback`, with the same non-effect. Dispute updated, closed and funds-withdrawn events are not handled.
- Cancellation reaches the rail first, then the record (D-132); there is no resume and no plan change.
- The school-side ledger has refund, reversal and chargeback kinds with a strong maker-checker ([`STUDENT_ACCOUNT_LEDGER.md`](STUDENT_ACCOUNT_LEDGER.md)); this policy is about **Semester's own billing**.
- The live acceptance did not exercise refund, failed renewal or dispute.

## 2. Principles

1. A refund returns money to the **original payment method**, through the rail, against a recorded payment, **never above the amount captured** less what was already refunded.
2. A person requests, a different person approves per the policy, and the system executes exactly once.
3. Credit and refund are different: a credit reduces what the customer owes or will owe; a refund returns cash.
4. Every outcome writes a journal and an audit row, and the customer is told in plain words.
5. **Nothing here suspends export, deletion, or other non-waivable data rights**, whatever the dispute or balance.
6. No promise of a window. The policy states the route and the decision-maker; any time period offered is a commercial decision for the owner and counsel (D-1019).

## 3. Refund workflow (PROPOSED)

```
request (source invoice + payment, reason code, amount)
  → policy check (amount ≤ paid − refunded; in-state; not already disputed)
  → approval per authority policy (maker-checker; fail closed with no active policy)
  → submit: adapter.refund(key = refund:<refund_id>)       [exactly once per refund_id]
  → rail result
       succeeded → journal (refund), invoice balance, entitlement rule, receipt notice, audit
       pending   → wait for webhook refund.succeeded
       failed    → status failed, reason, return to finance queue; customer told what happens next
  → reconciliation: the refund appears on a settlement line (see RECONCILIATION_AND_SETTLEMENT)
```

`credits_refunds` is extended (PROPOSED): `invoice_id`, `payment_attempt_id`, `idempotency_key` (unique), `provider_ref`, `reason_code`, `approval_id`, `requested_by`, `status` in (`requested`, `pending_approval`, `approved`, `submitted`, `pending_at_rail`, `succeeded`, `failed`, `declined`, `cancelled`), `settled_on`. Rows are append-only except status transitions through a function that writes `credits_refunds_history`.

| Reason code | Typical path |
| --- | --- |
| `billing_error` | Refund or credit; finance |
| `duplicate_charge` | Refund; finance; the second charge is the evidence |
| `service_failure` | Service credit or refund; support lead and finance |
| `cancellation_within_policy` | Only if a window is ever adopted; else not available |
| `goodwill` | Credit or refund; the highest-level reason, needs an executive above a limit |
| `chargeback_prevention` | Refund in lieu of dispute; finance |
| `legal_requirement` | Refund; counsel confirms the requirement |

**Entitlement effect**: full refund of the current period ends the paid entitlements of that period; partial refund does not; nothing silently. The rule is in the refund policy and tested.

**App-store purchases** (if any ever exist) follow the store's rules, outside this workflow.

## 4. Credit workflow (PROPOSED)

A **credit memo** is a numbered document linked to an invoice and a reason code; it reduces that invoice's balance or is carried as a credit balance. A **service credit** is a quantity of service (for example usage), not cash. Both need approval per the policy; both post a journal; a credit balance that cannot be applied is an exception the accountant resolves, because unclaimed balances may carry legal obligations **[REQUIRES QUALIFIED REVIEW]**. Credit packs and prepaid balances are not designed here (stored-value questions, see [`EMBEDDED_FINANCE_ROADMAP.md`](EMBEDDED_FINANCE_ROADMAP.md)).

## 5. Dispute and chargeback workflow (PROPOSED)

The network's dispute rail stays with the rail; Semester owns the **case**.

```
dispute.opened → case created (amount, reason code, evidence due date, payment attempt)
  → account flagged (billing only; never data, export or deletion)
  → evidence assembled (invoice, consent record with text version, receipt, usage, support history)
  → submitted via adapter (or the rail's console where no API) before the deadline
  → dispute.won  → funds restored: journal, case closed
  → dispute.lost → journal (loss + any dispute fee), entitlement decision by rule, account follow-up
```

| Rule | Detail |
| --- | --- |
| Deadline | `evidence_due_at` from the rail; reminders at 7, 3 and 1 day; a missed deadline is an incident review item (FC-21) |
| Owner | Finance owns the case; support supplies facts; counsel only where law or contract demands |
| Evidence | Only records Semester legitimately holds; no card data exists to include; student education records are **not** attached without privacy review **[REQUIRES QUALIFIED REVIEW]** |
| Journals | Opened: move the amount to a disputed receivable. Won: reverse that. Lost: expense the loss and the fee |
| Accounting of fees | From the settlement line, not typed |
| Repeat disputes | An account with a lost dispute is flagged for review; no automatic ban |
| Rail penalties | The rail's monitoring thresholds (dispute rate) are tracked as a metric with an alert; the thresholds are the rail's, not guessed here |

`disputes` (PROPOSED): `payment_attempt_id`, `provider_ref` unique, `reason_code`, `amount_cents`, `currency`, `opened_at`, `evidence_due_at`, `status` (`opened`, `evidence_submitted`, `won`, `lost`, `closed`, `missed`), `outcome_journal_id`. `dispute_evidence_items`: kind, hash of the stored document, added_by, added_at.

## 6. Failed payments, retries and dunning (extends the existing worker)

FACT: failure opens one dunning case, 14-day grace, a reminder after three quiet days, a final notice naming the exact restriction date three days before grace ends, restriction of paid entitlements only, recovery on payment. Notices that reach the customer today are the rail's.

PROPOSED:

1. **Native notices** through `finance_notices` (receipt, payment failed with the update route, final notice with the exact date, restriction, restored, refund issued, dispute opened if it concerns the customer). Versioned templates, one per event, idempotent, never containing a card number, and in plain language.
2. **Retry schedule is data**, not code (HYPOTHESIS: the rail's smart retries in Mode A; Semester's own bounded schedule in Mode B); each retry is a new attempt with a recorded outcome, never a silent re-charge.
3. **Never charge twice** on `unknown_outcome`: look up by key.
4. **Update-method route** from every failure notice.
5. **A tax outage never starts dunning** (existing rule; keep).
6. **Grace is configurable** per plan within finance-approved bounds.

## 7. Cancellation (extends D-132)

| Item | Rule |
| --- | --- |
| Self-serve cancel | At period end; reaches the rail first, then `request_cancellation()`; if the rail refuses nothing is recorded |
| Resume | New: undo before period end |
| Immediate cancel with refund | Only through the refund workflow; no window implied |
| Institution | By contract notice terms; `renewal_notice_days`; the renewal calendar |
| Data | Export and deletion available in every state |
| Record | `cancellation_requests` (channel self_serve, support, dunning) stays |

## 8. Write-offs (PROPOSED)

A write-off moves a receivable to `uncollectible` after the collections ladder, with reason and approval, posting bad debt (or against an allowance, per the accountant). It is a ledger event, not a status flip by the service role (the current practice). Proposed bands from `05`: CFO up to $5,000, CEO+CFO above, board informed above $25,000; trigger a receivable over 120 days or insolvency. **PROPOSED, not adopted.** Allowance method and tax deductibility are **[REQUIRES QUALIFIED REVIEW]**.

## 9. Authority (PROPOSED; every number from `05`, none adopted)

| Item | Proposed approver band |
| --- | --- |
| Individual-student refund or credit | Agent up to $25; support lead up to $100; finance up to $1,000; CFO above |
| Institutional credit or refund | CFO up to $10,000; CEO + CFO above |
| Write-off | CFO up to $5,000; CEO + CFO above; board informed above $25,000 |
| Dispute evidence submission | Finance |
| Refund policy change | Counsel + finance + owner (FC-24) |

Until the owner adopts a matrix, `finance_authority_policies` has no active row and **every refund, credit and write-off request blocks**. With one person in every seat (R-018) the maker-checker cannot be independently satisfied; compensating review applies (FC-03), and D-1154 names Bramm Rubin as the second approver.

## 10. Support flows

| Customer says | Route |
| --- | --- |
| "I was charged twice" | Support opens a `duplicate_charge` request with the two attempt references; finance approves |
| "I did not authorize this" | Treated as a potential dispute: support gives the consent record, finance offers a refund to avert a chargeback if the facts warrant |
| "I cancelled but was charged" | Check `cancellation_requests` and the rail's subscription state; refund if Semester's error |
| "My school said they would pay" | Check the funding account; refund to the original method if the student paid in error |
| "I cannot pay" | Update-method route; a hardship decision is the owner's, not a default |

Support never asks for, receives or records a card number; the no-card pattern check applies to every free-text field.

## 11. Tests and proofs

Refund above paid refused; double submit is a no-op (same key); no approval means no submit; self-approval refused; expired approval refused; refund event posts a balanced journal and replay posts nothing; entitlement rule per refund type; dispute deadline reminder fires once; won and lost post the right journals; every guard shown red against a faithful revert.

## Evidence state

- **Repository evidence:** `20260929070000_commercial_core.sql` (`credits_refunds`), `20260929080000_commercial_automation.sql` (`apply_payment_event`, `run_dunning`), `billingwebhook.ts` (`charge.refunded`, `charge.dispute.created`), `FEATURE-TRUTH-TABLE.md` (refund/dispute PARTIAL).
- **Operational evidence:** none for refund, failed renewal or dispute.
- **Missing proof:** the whole workflow.

## Cannot be completed from source code

Any refund window or guarantee; consumer-protection treatment by jurisdiction; adoption of the authority matrix; the rail's dispute rules and fees; accounting treatment of loss, fees and allowance.
