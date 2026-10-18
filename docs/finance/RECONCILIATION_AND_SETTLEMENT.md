# Reconciliation and settlement

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | `student_account_reconciliations` and `student_account_closes` (school side), [`08-FINANCE-CONTROLS-AND-OPERATIONS.md`](08-FINANCE-CONTROLS-AND-OPERATIONS.md) (FC-10, FC-11, FC-14, FC-22), [`../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md`](../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md) |
| Claim ceiling | Internal design. No settlement has ever been reconciled for Semester's own billing. |
| Prohibited claims | That cash is reconciled; that settlement or payouts are automated; that Semester holds funds. |

> Not accounting advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. State today (FACT)

- Semester's own billing has **no settlement or reconciliation**. `payment_events` records a hash and an amount; nobody compares them with what the rail paid out or what reached the bank.
- The school side has a browser-side reconciliation: a provider settlement CSV is parsed in the browser, only counts, a provider total and a SHA-256 are stored beside database-stamped ledger totals, `passed` is generated, and a month closes only on a passing reconciliation recorded by a different person with no provider entries since and no proposed requests in the period.
- FC-10 (cash application, two-day clearing), FC-11 (bank, card and processor account reconciliation, weekly for the processor, second-person review) and FC-22 (close checklist) exist in `08` as designed, not operating.

## 2. Three records, three sources of truth

| Record | Source of truth for | Never trust it for |
| --- | --- | --- |
| Semester's payment attempts and billing journals | What Semester believes it charged and refunded, and why | What actually settled |
| The rail's events and settlement reports | What the rail processed, fees, net, payout batches | Semester's reason for the charge |
| The bank statement | What cash arrived | Which customer or invoice it belongs to |

Reconciliation proves that the three agree, and treats every disagreement as an exception with an owner. The external records are the source of truth for **cash**; Semester's are the source of truth for **meaning**.

## 3. Settlement ingestion (PROPOSED)

`adapter.getSettlement(query)` returns payout batches and lines. Tables:

| Table | Fields |
| --- | --- |
| `settlement_batches` | `rail_id`, `provider_batch_ref` (unique with rail), `period_start/end`, `currency`, `gross_cents`, `fee_cents`, `net_cents`, `paid_out_on`, `bank_reference`, `source_sha256`, `ingested_at`, `status` (`ingested`, `matched`, `exceptions`, `bank_confirmed`) |
| `settlement_lines` | `batch_id`, `provider_line_ref`, `kind` (charge, refund, dispute, dispute_reversal, fee, adjustment, payout, reserve), `payment_attempt_ref`, `provider_payment_ref`, `gross_cents`, `fee_cents`, `net_cents`, `occurred_at` |

Rules: ingestion is idempotent on `(rail, provider_line_ref)`; for every batch `gross − fee = net` and the line sums equal the batch totals (a batch that fails its own arithmetic is rejected as `source_inconsistent`, never repaired); the source file or response hash is stored; lines are append-only; fees are posted to the billing ledger **from the line**, not typed.

## 4. Matching (PROPOSED)

A pure function `reconcile(attempts, journals, settlementLines, bankLines) → { matched, exceptions[] }`, the same code in the browser fixtures and in the database job, so a recorder's claim can be recomputed (the school side's weakness today).

| Pass | Matches | Key |
| --- | --- | --- |
| 1 Attempt ↔ journal | Each `captured` attempt has exactly one balanced captured journal | `idempotency_key` |
| 2 Attempt ↔ settlement line | Each captured, refunded or disputed attempt appears on exactly one line, amounts agree | `provider_payment_ref` |
| 3 Settlement batch ↔ bank | Each payout appears as one bank deposit of the net amount | `bank_reference` or amount and date window |
| 4 Journals ↔ invoices | Invoice `amount_paid` and `balance` equal the allocations; ledger AR equals the sum of open balances | invoice id |

| Exception | Meaning | Default owner | Aging rule |
| --- | --- | --- | --- |
| `missing_settlement` | Captured at Semester, not on any line | Finance | Allowed to age by the rail's stated settlement delay; beyond it, open |
| `missing_internal` | On a line, no attempt or journal | Finance + engineering | Open at once (a charge Semester does not know about) |
| `amount_diff` | Both exist, amounts differ | Finance | Open at once |
| `fee_diff` | Fee on the line differs from the expected schedule | Finance | Open at once |
| `duplicate` | Two internal attempts, one line, or the reverse | Engineering | Open at once |
| `timing` | Not yet settled, within the delay | — | Self-clearing; reported |
| `refund_unmatched` | Refund journal with no refund line | Finance | After the rail's delay |
| `dispute_unmatched` | Dispute line with no case | Finance | Open at once |
| `bank_unmatched` | Deposit with no batch | Finance | Open at once |
| `unapplied_cash` | Payment with no invoice | Finance | Clear within two business days (FC-10) |
| `source_inconsistent` | A report fails its own arithmetic | Finance + the rail | Open at once |

Tolerance is **zero** for amounts. Rounding is integer cents; a one-cent difference is an exception with a reason, not a rounding allowance.

## 5. Runs, cadence and close

`reconciliation_runs` (`scope`, `period`, `started_at`, `finished_at`, `source_hashes`, `matched_count`, `exception_count`, `status`), `reconciliation_items` (per exception, with the pass, the evidence refs and `owner`), `reconciliation_resolutions` (append-only: what was decided, by whom, with a note; a resolution never deletes the item).

| Cadence | What | Control |
| --- | --- | --- |
| Daily, automatic | Passes 1, 2 and 4 on new data; exceptions opened and aged | Alert when open exceptions pass a threshold |
| Weekly, human | Processor account reviewed by a person who did not run it (FC-11) | Signed run |
| Monthly | Bank pass (3), journals to invoices, close | FC-11, FC-22 |

**Period close** extends the school-side guard: `ledger_periods` moves to `closed` only when the latest run for the period is complete, recorded by someone other than the closer, all `unapplied_cash` is cleared, no exception older than its aging rule is open without a CFO-signed note, and no draft journals exist. After close, a correction posts in the open month with a reference. Reopen needs two people and an audit event; it never edits.

## 6. Fees and payouts in the ledger

| Event | Journal (conceptual; accountant owns the chart) |
| --- | --- |
| Settlement line fee | Debit payment processing expense; credit processor receivable |
| Payout received in bank | Debit cash; credit processor receivable |
| Rail holds a reserve | Debit reserve receivable; credit processor receivable **[REQUIRES QUALIFIED REVIEW]** |
| Dispute fee | Debit dispute expense; credit processor receivable |

`processor receivable` should reach zero for any period once all batches settle; a persistent balance is an exception, not a normal state. This is the structural proof that Semester is not holding customer money: the account is money the rail owes Semester.

## 7. School-side reconciliation (kept, strengthened)

The existing school reconciliation remains the school's. Extensions S-3 to S-5 in [`STUDENT_ACCOUNT_LEDGER.md`](STUDENT_ACCOUNT_LEDGER.md) persist settlement lines, match by provider key and recompute on the server. The two reconciliation families share the pure matching function and nothing else; a school's settlement never touches Semester's ledger.

## 8. Reporting and evidence

Daily exception summary; weekly processor reconciliation sign-off; monthly reconciliation packet (runs, resolutions, aging, fee totals, payout totals, bank agreement) retained as a financial record (seven years after year end for individual billing: D-132; institutional by contract); an exports file for the accountant with the journal lines of the period; drift report between ledger and `invoices` during the shadow phase.

## 9. Tests and proofs

One fixture per exception type; a planted mismatch blocks close; a lying recorder (claimed matched count differs from recomputed) is caught; idempotent ingestion; arithmetic-failing report rejected; replay posts nothing; `processor receivable` returns to zero on a full fixture month; the pure function gives identical output in browser and database; each guard shown red against a faithful revert.

## Evidence state

- **Repository evidence:** `20260929220000_student_accounts.sql` (reconciliation and close guards), `lib/finance/accounts.ts` (`reconcileProvider`, `parseSettlement`), `08` (FC-10, FC-11, FC-22).
- **Operational evidence:** none.
- **Missing proof:** all of §3–§6.

## Cannot be completed from source code

The rail's real settlement report format, timing, reserve and fee schedule; the bank's statement format; the accountant's chart and close procedure; whether a reserve is a receivable or a liability.
