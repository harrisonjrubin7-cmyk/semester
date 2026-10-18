# Student account ledger

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN OF EXTENSIONS TO A BUILT-AND-OFF FEATURE — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | D-146, `20260929220000_student_accounts.sql`, `20260929230000_student_payment_plans.sql`, `20260930110000_ledger_chains.sql`, `20260930150000_ledger_chain_seals.sql`, `app/src/lib/finance/accounts.ts`, `docs/MONEY-MODULES-SWITCH-ON.md` (status: blocked) |
| Claim ceiling | The student-account module is built and **off** (`VITE_STUDENT_ACCOUNTS`, default off). No money moves through Semester. This document changes none of that. |
| Prohibited claims | That Semester holds, processes or transmits a student's or school's money; that Semester is a school's general ledger or system of record; that the module is ready (the PIA rates its residual risk HIGH; MONEY-MODULES-SWITCH-ON lists nine preconditions, none met on 2026-10-04). |

> Not accounting, tax, legal or education-records advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. What this is, and the line it must not cross

The student account ledger is the **school's** record of what a student owes it, kept by Semester software for the school (D-146). It is a different thing from the ledger Semester keeps of its own customer billing ([`NATIVE_FINANCIAL_PLATFORM.md`](NATIVE_FINANCIAL_PLATFORM.md) §5). The commercial operations rule is explicit: institutional student-account functionality "is separate from Semester's own customer billing and must not be used as its accounting ledger" (`ORDERING-AND-BILLING-OPERATIONS.md`).

| | School ledger | Semester billing ledger |
| --- | --- | --- |
| Owner of the books | The school | Semester |
| Writer | A person's request plus a *different* person's approval | Posting functions from verified events |
| Money moves through Semester | **Never** (D-146) | Semester's own revenue only, through a rail |
| Statutory record | The school's, in its own system | The accountant's, fed by export |

Nothing in this document gives Semester a role as a school's bursar system of record, a payment processor for tuition, or a custodian. Replacing a school's finance stack module by module is a separate, two-admin-approved, fails-to-Connect decision (D-151, D-152).

## 2. What exists (FACT)

- **Entries** (`student_account_entries`): signed integer cents, positive means the student owes; kinds charge, payment, refund, adjustment_debit, adjustment_credit, aid_credit, reversal, chargeback; categories tuition, fees, housing, dining, books, other, scholarship, waiver, discount, sponsorship; `provider_ref`, `reference_entry_id`, `period` (YYYY-MM), `request_id` unique, `high_value`.
- **Only way in:** `student_account_requests` (proposed → approved, rejected, withdrawn). A definer trigger writes the entry on approval. The requester cannot decide. Whoever put an entry on the ledger cannot approve what answers it. A refund or chargeback must answer a payment and cannot exceed what is left. A reversal is whole-entry, once, never itself reversed.
- **Threshold:** refund, adjustment_debit, adjustment_credit, aid_credit and reversal at or above the school's `high_value_cents` (default $1,000) need `finance:approve_high`.
- **Append-only** for every role including the owner; updates only clear person columns on account deletion; deletes only when the school is gone. A hash chain (`ledger_chain`, nightly verifier, daily HMAC seals) makes a rewrite noticeable. Stated limits: a database owner holding the key could re-sign; no external anchor; entries before the chain are counted, not covered.
- **No card numbers:** 13–19 digit runs refused in `description`, `provider_ref` and `decision_note` by a check and in the browser.
- **Reconciliation** (`student_account_reconciliations`): the browser parses a provider settlement CSV; the recorder's claim (provider total, matched, missing, extra, differing, settlement SHA-256) is stored beside database-stamped ledger totals; `passed` is generated. **Close** (`student_account_closes`) needs a passing latest reconciliation, recorded by someone other than the closer, no provider entries since, and no proposed requests in the period. Closed months refuse entries.
- **Payment plans:** see [`PAYMENT_PLAN_ENGINE.md`](PAYMENT_PLAN_ENGINE.md).
- **Capabilities and roles:** `finance:request`, `finance:approve`, `finance:approve_high`, `finance:close`, `finance:read`; `student_accounts_officer`, `financial_aid_officer`, `business_admin`.
- **Not built (D-146):** a double-entry general ledger, a bank leg in reconciliation, tax configuration, any provider connection, database-held plan standing (computed in the app today), anything sent to students.

## 3. Proposed extensions (each its own pull request, none before the preconditions)

These close gaps the audit found, without changing the ledger's meaning.

| # | Extension | Why | Proof |
| --- | --- | --- | --- |
| S-1 | **Currency column** on entries, requests and settings (`usd` default, one currency per school) | The ledger has no currency at all, so a school with a second currency cannot be represented | Existing rows backfilled; mixed-currency sum refused |
| S-2 | **Period lock reason** and a `reopen` request that needs `finance:approve_high` and a note, creating an audit event; never an edit | A closed month can only be corrected forward today, which is right, but an honest reopen path with two people is missing | Reopen is itself append-only; chain intact |
| S-3 | **Provider-neutral payment reference format**, validated per adapter (`stripe:ch_…` style prefix), so a settlement line matches an entry by key, not by free text | `provider_ref` is free text; reconciliation compares in the browser | Fixture settlement matches by key; unknown prefix flagged |
| S-4 | **Settlement lines persisted** (`student_account_settlement_lines`), not only a total and a hash | Today only counts and a SHA-256 are kept; an exception cannot be listed later | Totals recomputed from lines equal the stored total |
| S-5 | **Server-side reconciliation** (the same pure function as the browser's, run in SQL or a function) | A browser claim is the recorder's word; the database should recompute | Browser and server agree on fixtures; a lying client is caught |
| S-6 | **Derived plan standing and financial hold in the database** | Computed in the app today; the PIA lists it | Hold derivation proof against the app function |
| S-7 | **Retention schedule** for the school ledger, set by the school's contract, with legal holds respected (the holds sweep already reaches the financial purge) | The PIA lists "no retention schedule set for the school ledger" | Check suite; no purge before the school-configured line |
| S-8 | **Student statement versioning** and delivery record | A statement shown today is computed, not retained | Statement hash stored at issue |
| S-9 | **Aid and sponsor posting rules** (scholarship funding, sponsor invoices) as school-side categories only | Category exists, rules do not | Fixtures; no Semester revenue effect |
| S-10 | **Write-off kind** with approval and reason, school-side only | There is no write-off kind; `uncollectible` is a status flip elsewhere | Maker-checker; threshold; reversal rules |

Not proposed: any code path that creates a ledger entry from a payment webhook, any link between the two ledgers beyond a shared audit vocabulary, any Semester-held balance for a school or student.

## 4. Payments against the school ledger (the question that stays open)

Today a payment entry is typed by a person who records a provider reference from the **school's own hosted payment provider**; Semester sees the settlement file the school downloads. That is the only arrangement D-146 permits. If Semester ever collected tuition through an adapter, the following would all be new and would each need the owner's decision superseding D-146 plus counsel (Title IV, money transmission, merchant of record, E1–E4): who is merchant of record; whose settlement account; who refunds; who answers a dispute; whether Semester is a service provider under federal student-aid rules; whether stored-value or held-funds rules apply. [`EMBEDDED_FINANCE_ROADMAP.md`](EMBEDDED_FINANCE_ROADMAP.md) stage 3 sketches it and stops there.

## 5. Separation of duties, as enforced and as proposed

| Duty | Enforced today | Proposed addition |
| --- | --- | --- |
| Request ≠ approve | Yes | — |
| Approver of an original cannot approve its refund, reversal or chargeback | Yes | — |
| Reconciler ≠ closer | Yes | — |
| High value needs a second capability | Yes | Threshold becomes a school-configurable policy row with audit (it is already a setting) |
| One person holds every seat | Not solvable in code | Compensating review (FC-03); R-018 stays open; D-1154 names a second approver |
| Break-glass | None in this module | Console break-glass with notice, if ever required |

## 6. Privacy and records

The ledger is a school's education-adjacent financial record. The PIA treats amounts owed as sensitive and the student-accounts risk as HIGH residual (owner: the finance seat). Student reads are limited to their own linked account; company roles read no student rows except a written list (D-1294); no payment data is shown to a school beyond what the school's own ledger already holds; export and deletion are never blocked by a balance (`REVENUE-OPERATIONS` §4). Where an account is deleted the entries survive without the person, and the school-removal rule governs deletion.

## 7. Release path

The module's switch-on is governed by [`../MONEY-MODULES-SWITCH-ON.md`](../MONEY-MODULES-SWITCH-ON.md) (status blocked, nine preconditions) and by [`FINANCE_RELEASE_GATES.md`](FINANCE_RELEASE_GATES.md). This document adds no precondition; it lists extensions that make the existing ones easier to satisfy.

## Evidence state

- **Repository evidence:** the migrations and `accounts.ts` above; `student-accounts.check.sql` proves maker-checker, threshold, refund bounds, single reversal, no card numbers, close rules, append-only for the owner, linked-student isolation and survival of account deletion.
- **Operational evidence:** none; the feature has never been on for a school.
- **Missing proof:** S-1 to S-10; the PIA's open items; a retention schedule.

## Cannot be completed from source code

A school's accounting treatment, retention and statutory requirements; the answer to whether any money handling by Semester would be regulated; the school's own policy thresholds.
