# Financial controls for the native platform

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NO CONTROL HERE OPERATES. Designed, not operating.** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`../company/FINANCIAL-CONTROLS.md`](../company/FINANCIAL-CONTROLS.md) (parent, v0.1 draft, effective date to be approved), [`08-FINANCE-CONTROLS-AND-OPERATIONS.md`](08-FINANCE-CONTROLS-AND-OPERATIONS.md) (FC-01 to FC-25, not renumbered here), `docs/security/SECURITY-PROGRAM.md` |
| Claim ceiling | Internal design. Nothing is certified, audited or attested. |
| Prohibited claims | PCI compliance or any attestation; SOC 2 compliance; that any control is operating or tested by a third party. |

> Not accounting, security-assessment or legal advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. How this relates to FC-01 to FC-25

`08` defines 25 operating controls (FC-nn). This document does **not** add to or renumber them: it defines the **technical controls of the native platform** with the prefix **NF-** and says which FC each implements or evidences. FC controls are what people do; NF controls are what the system refuses. A control is "designed, not operating" until it has an owner, a test that was shown red against a revert, and evidence a reviewer can inspect.

Where the existing system already enforces something, the row says FACT with the proof. Where it does not, the row is PROPOSED.

## 2. Required controls from the brief, mapped

| Required control | NF | Where enforced | Status |
| --- | --- | --- | --- |
| Do not store raw card data | NF-01 | No parameter can carry it; schema and free-text refuse card-like digit runs; scan test | Partly FACT: school ledger refuses 13–19 digit runs in browser and database; `payment_events` stores a hash; no `@stripe` or card field in `app/src`. PROPOSED for `payment_methods`, `finance_notices`, `provider_event_inbox` |
| Tokenized payment-method references only | NF-02 | `payment_methods` columns allowlist: provider token, brand, last four, expiry, status | PROPOSED |
| Never expose provider credentials to the browser | NF-03 | Secrets only as Edge Function secrets; a test fails if any rail credential name appears in a `VITE_` variable or in `app/src` | FACT in practice (`SECRETS.md`, `ops/billing/README.md`); the scan test is PROPOSED |
| Idempotency keys for every payment and refund command | NF-04 | Type-level required argument; unique index on the stored key; derived from the aggregate | PROPOSED; today's checkout key and cancel key are FACT (`checkout-v2-…`, `cancel-<id>`) |
| Verify provider webhooks server-side | NF-05 | `adapter.verifyWebhook` on raw bytes, constant time, tolerance, mode match, before parse | FACT for Stripe (`webhook.test.ts`, `stripe.test.ts`, `activation.test.ts`) |
| Immutable ledger and audit records | NF-06 | Append-only triggers, chain, seals, nightly verifier | FACT for the school ledger and `payment_events`, `dunning_actions`; PROPOSED for the billing ledger and approvals |
| Approvals for refunds, credits, write-offs, pricing exceptions, financial-plan changes by threshold | NF-07 | `finance_authority_policies` + `finance_approvals`; fail closed | School side FACT (maker-checker, $1,000 default); product billing PROPOSED |
| Separate product billing state from statutory accounting | NF-08 | Operational ledger exports to the accountant; recognition not computed in the app | PROPOSED |
| Label finance forecasts as forecasts | NF-09 | `finance_forecasts.kind` check; tile and export label; D-1275 refusal of "actual" | FACT in the model tab (tags outputs "forecast"); structural check PROPOSED |
| Reconcile external settlement with internal records | NF-10 | Three-way match; close guard | School side FACT (totals only); product billing PROPOSED |
| Error, dispute, chargeback, retry, cancellation and support flows | NF-11 | [`REFUND_CREDIT_DISPUTE_POLICY.md`](REFUND_CREDIT_DISPUTE_POLICY.md), console workflows | Partly FACT (cancel, dunning); rest PROPOSED |

## 3. Control catalogue

| ID | Control | Mechanism | Parent FC | Evidence it would produce |
| --- | --- | --- | --- | --- |
| NF-01 | No card data anywhere | Adapter has no card-capable input; 13–19 digit-run check on every free-text column in the finance family; repository scan test for card field names, `loadStripe`-style imports outside the one hosted-field wrapper, and `pk_`/`sk_` literals | FC-23 | Test log; scan result |
| NF-02 | Token-only payment methods | Column allowlist, check constraints; no `pan`, `cvv`, `account_number` column can be added without a failing test | FC-23 | Schema test |
| NF-03 | Credential isolation | Secrets in the function environment; one secret per rail and mode; rotation supports two live signing secrets; no secret in logs (functions never log payloads) | FC-01 | Secret inventory; rotation record |
| NF-04 | Idempotent money commands | Key derived from aggregate stored before the call; unique index; same key on retry; `unknown_outcome` queries by key | FC-24 | Duplicate-submit test; key audit |
| NF-05 | Webhook authenticity | Raw-body HMAC, 5-minute tolerance, mode match, no CORS, size cap, origin refused | FC-24 | Existing tests; contract suite |
| NF-06 | Immutability | Append-only for every role; reversal journals; chain; seals; nightly verification; period locks | FC-14, FC-22 | Verifier log; tamper fixtures |
| NF-07 | Maker-checker with thresholds | Requester ≠ approver; approver of an original ≠ approver of its reversal; approval expires; no approval after signature; **no active policy blocks everything** | FC-02, FC-03, FC-06, FC-13 | Policy version history; approval log |
| NF-08 | Operational ledger vs statutory books | Export only; recognition outside the app | FC-12, FC-14 | Export log; accountant acknowledgement |
| NF-09 | Forecast labelling | `kind` check; label in export | FC-18 | Structural test |
| NF-10 | Reconciliation | Daily automatic, weekly human, monthly bank pass; zero amount tolerance; close guard | FC-10, FC-11, FC-22 | Signed runs |
| NF-11 | Refund and dispute discipline | Never above captured; original method; exactly-once submit; deadline reminders | FC-13, FC-21 | Refund register; case log |
| NF-12 | Test and live separation | Rail per mode; credential prefix compared with every event; test session never attaches to a live account | FC-24 | Existing activation tests |
| NF-13 | Least privilege and access review | Capabilities in the `billing:` namespace; quarterly review; service role only writes | FC-01 | Access-review record |
| NF-14 | Pseudonymous console | Account reference by default; reveal logged with reason | FC-23 | Reveal log |
| NF-15 | Data minimization in the inbox | Allowlist projection; no personal fields; raw payload not retained | FC-23, FC-25 | Projection test |
| NF-16 | Retention and holds | Seven years after year end for individual records (D-132); institutional by contract; legal holds block purges (FACT: holds migration); ledger journals follow the same | FC-25 | Purge check suite |
| NF-17 | Payee and bank-detail change | Call-back verification before remit-to or payout details change; change record with two people | FC-04 | Verification record |
| NF-18 | Fraud and anomaly checks | Duplicate payments, unusual refund patterns by requester, refund-to-capture ratio, many failed attempts per account, large manual journals | FC-21 | Exception log |
| NF-19 | Change control for billing, pricing and payment configuration | Technical, security, finance and legal review; the two checkout-hold constants change together in a reviewed change | FC-24 | Change record |
| NF-20 | Customer-facing language control | Notices and policy text are versioned; no unqualified compliance claims (CLM-010); no refund window (D-1019) | FC-24 | Template version log |

## 4. Billing threat model (the gap `SECURITY-PROGRAM.md` names: "no separate threat model")

| Threat | Example | Mitigation | State |
| --- | --- | --- | --- |
| Webhook forgery | Fake `invoice.paid` grants entitlement | NF-05; signature before parse | FACT |
| Replay | Same event twice | `(provider, event_id)` unique; idempotent apply | FACT |
| Out-of-order events | Paid then stale failure | Rank; never move state backward | FACT for invoices; PROPOSED generally |
| Test event on live state | Test-mode event sets live entitlement | NF-12 | FACT |
| Entitlement tampering | Client claims a plan | Entitlements server-side; presentation-only `my_entitlements()`; AI gateway reads the database | FACT |
| Client price tampering | Browser sends an amount | Price from catalog row or price book; the client sends only a price id | FACT (checkout) |
| Double refund | Two clicks, two agents | Key per refund id; unique; state machine | PROPOSED |
| Insider refund fraud | An agent refunds to a friend | Original method only; approval bands; anomaly checks; maker-checker | PROPOSED |
| Single seat | One person holds every seat | Compensating review; second approver named (D-1154); visible badge | Open (R-018) |
| Invoice and bank-detail fraud | Fake remit-to change | NF-17 | PROPOSED |
| Ledger rewrite | Database owner edits a journal | Append-only, chain, seals; known limit: key holder could re-sign; external anchor is a candidate | Partly FACT |
| Credential leakage | Secret in a bundle or log | NF-03 and scan tests | Partly FACT |
| PII in logs or inbox | Email in a stored payload | NF-15; functions never log payloads | Partly FACT |
| Enumeration | Guessing invoice ids | RLS by account; UUIDs; contact scoping | FACT |
| Support social engineering | "Refund me, I lost access" | Verify by account; refund only to original method; no card data requested | PROPOSED |
| Provider outage | Backlog, unknown outcomes | Inbox, replay, `unknown_outcome` rule, status page route | PROPOSED |
| Tax outage | Finalization failure | Never starts dunning; recorded | FACT |
| Race on period close | Entry lands during close | Advisory locks per period | FACT (school); PROPOSED (billing) |
| Dunning as coercion | Restricting data on unpaid | Paid entitlements only; data rights never touched | FACT |

## 5. Segregation of duties

| Duty | Roles that must differ |
| --- | --- |
| Request ↔ approve | Always |
| Approve ↔ submit to rail | Where staffing allows; otherwise compensating review |
| Reconcile ↔ close | Always (existing on school side; extend) |
| Request a policy ↔ activate it | Always; board where FC-02 requires |
| Verify a tax exemption ↔ submit it | Always |
| Change bank details ↔ verify the change | Always (NF-17) |

When one person holds every seat the system still records the roles distinctly and flags the action as single-seat so a later reviewer can find them.

## 6. Monitoring and alerting

Existing: SRE catalog and `billing:webhook-lag` alert. Proposed signals: dead-lettered events above zero; parked events older than an hour; reconciliation exception count and age; refund and dispute rate; failed-attempt rate; `auth_failed` from any rail; drift between ledger and invoices above zero; approvals waiting past their expiry; chain verification failure; a period open past business day 10. Each routes to a named owner in `INCIDENT-PLAYBOOKS` (billing has a playbook entry today; extend it for refund error, double charge, rail outage, ledger drift).

## 7. Evidence

Per control: owner, test name, last run, and the revert check. A single register (`docs/finance/` or the existing control-evidence register) lists NF-01 to NF-20 with those four fields. Controls with no evidence are listed as "designed, not operating" in the release scorecard and block the gate that depends on them ([`FINANCE_RELEASE_GATES.md`](FINANCE_RELEASE_GATES.md)).

## Evidence state

- **Repository evidence:** webhook, activation, checkout, cancel and portal tests; `student-accounts.check.sql`; `ledger-chains.check.sql`; `financial-retention.check.sql`; `commercial.check.sql`; `SECURITY-PROGRAM.md`; `08`.
- **Operational evidence:** none for the proposed controls.
- **Missing proof:** all PROPOSED rows.

## Cannot be completed from source code

Adoption of the parent controls document and the authority matrix; named owners per control; any third-party assessment; the accountant's and security assessor's views.
