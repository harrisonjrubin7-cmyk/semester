# Payment provider adapter architecture

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`NATIVE_FINANCIAL_PLATFORM.md`](NATIVE_FINANCIAL_PLATFORM.md) §3 and §6; `supabase/functions/_shared/stripe.ts`, `billingwebhook.ts`, `billingcheckout.ts`, `billingmode.ts` |
| Claim ceiling | Internal engineering design. Does not say any rail is chosen, contracted, or capable of what is listed. |
| Prohibited claims | PCI compliance of any kind; that a second rail exists; that Semester processes payments. |

> Not legal, accounting, tax or PCI advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 0. Build status

| Action (`NATIVE_FINANCIAL_PLATFORM.md` §14) | State | Where |
| --- | --- | --- |
| 2 Canonical types, error taxonomy, idempotency-key builder, card-number guard | **Built**, Deno-free | `supabase/functions/_shared/payments/types.ts` |
| 3 Contract suite and reference mock rail | **Built**; every clause shown red against a rail built to break it | `app/src/lib/payments/contract.ts`, `contract.test.ts`, `_shared/payments/mock.ts` |
| 4 Stripe adapter | **Built for verify and normalize only**; every other method answers `unsupported` and its capability flag is `false`. Checkout, cancel and the portal still call Stripe directly, unchanged and held | `_shared/payments/stripeadapter.ts` |
| 5 Stripe normalizer | **Built**; parity with `billingwebhook.ts` proven over 28 events, and shown red against three planted bugs | `_shared/payments/normalizestripe.ts`, `app/src/lib/payments/normalize.test.ts` |
| 8 `billing-webhook` reads through the adapter | **Not started.** The handler is unchanged; it still carries its own copy of the helpers the normalizer lifted, and the parity test is what makes removing them safe | |

Nothing here is deployed behaviour: no Edge Function imports the new modules yet.

## 1. Starting point (FACT)

There is no adapter today. `_shared/stripe.ts` is a Stripe utility module (signature verification, status map, form encoding). The four billing handlers call Stripe endpoints directly and know Stripe identifier prefixes (`cs_`, `sub_`, `cus_`, `bpc_`, `txcd_`) and hosts (`checkout.stripe.com`, `billing.stripe.com`). The SQL layer is already provider-neutral in naming (`provider`, `provider_ref`, `provider_event_id`, `provider_session_id`), with five Stripe-shaped spots: `checkout_sessions.provider` defaults to `'stripe'`; `subscriptions.billing_issue` allows only `address_required`; `payment_events.kind` includes `address_required`; subscription statuses mirror Stripe's; and the invoice-precedence functions (`apply_invoice_payment_event_v3`) are built for Stripe's out-of-order invoice snapshots. A second provider therefore needs no column rename, only a seam in code and those five generalizations.

## 2. Principles

1. **One interface, many rails.** Business code (checkout, refund, dunning, reconciliation) imports the interface and `NormalizedPaymentEvent`, never a provider module.
2. **Semester owns the state machine.** A provider reports what happened; Semester decides what it means (payment attempt state, ledger journal, entitlement effect). Provider status strings never reach a database column.
3. **No payment credential crosses Semester.** The interface has no parameter that can carry a card number or bank account number. Collection is a provider-hosted session or field; Semester receives a token.
4. **Every command carries an idempotency key** that Semester derives from its own aggregate (§5). A command without one is a type error.
5. **Verify before parse.** A webhook is authenticated server-side on the raw body before any field is read.
6. **Fail closed.** Unknown event types are recorded as `other` and change nothing. An unknown capability is "not supported", not "assume yes".
7. **Credentials live only in server secrets.** Never in `VITE_*`, never in the browser, never in a log. Live and test credentials are separate rails and a test event is rejected before touching live state (existing `stripeMode` behaviour, generalized).
8. **Behaviour-preserving first.** The first adapter is the existing Stripe code moved behind the seam. The 57 billing tests are the acceptance suite and stay unchanged.

## 3. Rail descriptor

Replaces the brief's `PaymentRail` type; table `payment_rails` (PROPOSED), no credentials in the row.

```ts
type RailKind = 'card' | 'ach' | 'bank_transfer' | 'wire' | 'wallet' | 'invoice_terms' | 'campus_card' | 'financial_aid';

interface PaymentRail {
  id: string;                       // 'stripe-live', 'stripe-test', …
  provider: string;                 // ^[a-z][a-z0-9_]{1,29}$ (matches today's column check)
  mode: 'live' | 'test';
  status: 'draft' | 'enabled' | 'paused' | 'retired';
  kinds: RailKind[];
  currencies: string[];             // lowercase ISO-3
  countries: string[];
  capabilities: {
    hostedCollection: boolean;      // provider-hosted page or fields produce a token
    authorize: boolean; capture: boolean; refund: boolean; partialRefund: boolean;
    recurring: boolean;             // provider can bill on its own schedule (Mode A)
    offSessionCharge: boolean;      // charge a stored token on Semester's schedule (Mode B)
    installments: boolean;
    tax: boolean;                   // provider can calculate tax
    disputes: boolean; disputeEvidenceApi: boolean;
    settlementReport: boolean;
    webhookSigning: 'hmac_sha256_timestamped' | 'none';
  };
  requiresKyc: boolean; requiresKyb: boolean; externalSettlement: boolean;
}
```

`requiresKyc`, `requiresKyb` and `externalSettlement` describe the rail; they are information for the console and for counsel, not switches Semester flips. **`capabilities` says what Semester has wired, not what the provider can do**: the contract suite holds an adapter to it in both directions (a `false` capability must answer `unsupported`; a `true` one must work), so an adapter cannot claim what it has not built.

## 4. Adapter interface

```ts
interface PaymentProviderAdapter {
  readonly rail: PaymentRail;

  // Collection (no card data in, token out)
  createCollectionSession(i: CollectionSessionInput): Promise<Result<CollectionSession>>;     // hosted page or hosted-field client secret
  getPaymentMethod(i: { token: PaymentToken }): Promise<Result<PaymentMethodSummary>>;       // brand, last4, expiry, status only
  detachPaymentMethod(i: { token: PaymentToken; idempotencyKey: IdemKey }): Promise<Result<void>>;

  // Money commands
  charge(i: ChargeInput): Promise<Result<ChargeResult>>;       // authorize+capture in one call; amount, currency, token, invoiceRef, idempotencyKey
  authorize(i: AuthorizeInput): Promise<Result<AuthorizeResult>>;
  capture(i: CaptureInput): Promise<Result<CaptureResult>>;
  cancel(i: CancelInput): Promise<Result<CancelResult>>;       // void an authorization
  refund(i: RefundInput): Promise<Result<RefundResult>>;       // paymentRef, amount, reasonCode, idempotencyKey; never above captured
  submitDisputeEvidence(i: DisputeEvidenceInput): Promise<Result<void>>;   // only if capabilities.disputeEvidenceApi

  // Provider-billed mode only (Mode A, §6)
  mirrorSubscription?(i: SubscriptionRef): Promise<Result<ProviderSubscriptionSnapshot>>;
  cancelProviderSubscription?(i: CancelSubscriptionInput): Promise<Result<void>>;
  createCustomerPortalSession?(i: PortalInput): Promise<Result<HostedUrl>>;

  // Reads
  getSettlement(i: SettlementQuery): Promise<Result<SettlementReport>>;   // payout batches and lines, gross, fee, net, type, payment ref
  calculateTax?(i: TaxInput): Promise<Result<TaxResult>>;

  // Inbound
  verifyWebhook(i: { rawBody: string; headers: Headers; nowSeconds: number }): Promise<VerifyOutcome>;   // rawBody is the exact text received, never re-serialized
  normalize(e: VerifiedProviderEvent): NormalizedPaymentEvent[];         // pure
}
```

**Differences from the brief's sketch, and why.** `createPaymentMethod(input)` becomes `createCollectionSession`: an input that could carry card fields must not exist. `charge` is added because most recurring collection is one call. `getSettlement` returns reports, not a status. `normalize` is separate from `verifyWebhook` so it is pure and testable against fixtures. Provider-billed methods are optional, so a rail that cannot bill on its own schedule is still a valid adapter.

`Result<T>` is `{ ok: true, value } | { ok: false, error: PaymentError }`. Adapters never throw across the seam.

### Error taxonomy

| Code | Meaning | Retry | Customer sees |
| --- | --- | --- | --- |
| `declined` | Issuer or bank refused | No automatic retry; dunning decides | Plain reason class (not enough funds, expired, declined), update-method route |
| `requires_action` | Authentication needed (e.g. 3-D Secure) | After customer action | Native "confirm with your bank" step |
| `invalid_request` | Semester bug or bad input | No | Generic; alert |
| `auth_failed` | Rail credential rejected | No | "Payments are paused"; page the finance owner |
| `rate_limited` | Provider throttle | Yes, backoff | Nothing |
| `unavailable` | Timeout or provider 5xx | Yes, same idempotency key | "Nothing was charged yet" until confirmed |
| `unknown_outcome` | Request sent, no answer | **Never re-send without the same key**; query by key | "We are confirming" |
| `unsupported` | Capability not on this rail | No | Alternative method |

`unknown_outcome` is the dangerous one: the only correct recovery is to ask the rail about the idempotency key (or wait for the webhook), never to charge again with a new key.

## 5. Idempotency keys

Derived from Semester's aggregate, so any retry, any replica and any replay produces the same key. Format `<command>:<aggregate_id>:<attempt_no>`.

| Command | Key | Notes |
| --- | --- | --- |
| Collection session | `collect:<checkout_id>` | Matches today's one open checkout per account and price |
| Charge | `charge:<invoice_id>:<attempt_no>` | `attempt_no` increments only when Semester deliberately retries after a recorded `declined` |
| Refund | `refund:<refund_id>` | `refund_id` is created at request, before approval; submission is at most once per id |
| Cancel authorization | `void:<attempt_id>` | |
| Dispute evidence | `evidence:<dispute_id>:<version>` | |
| Subscription cancel (Mode A) | `cancel:<subscription_id>` | Same as today (`cancel-${sub.id}`) |

Rules: the key is stored on the `payment_attempts` or `credits_refunds` row **before** the call; a unique index refuses a second row with the same key; the adapter passes it to the rail's idempotency mechanism where one exists, and where a rail has none the adapter must make the call safe itself (lookup-then-act under an advisory lock) or declare `unsupported`. Inbound webhook idempotency is separate: `(provider, provider_event_id)` unique, as today.

## 6. Who owns the billing schedule

This is the real seam between today and "native".

| | **Mode A: provider-billed (today)** | **Mode B: Semester-billed (stage 2)** |
| --- | --- | --- |
| Subscription clock | Stripe Billing renews and invoices | Semester's subscription engine decides each renewal |
| Invoice | Created by the rail; Semester mirrors it | Created by Semester (`invoices`, lines, number, tax) |
| Collection | Rail charges its own invoice | Semester issues `charge(token, invoice)` through the adapter |
| Dunning | Rail retries and emails; Semester mirrors | Semester retries on its schedule and sends its own notices |
| Tax | Rail's engine inside its invoice | `calculateTax` adapter call, stored on the invoice |
| Portal | Rail's hosted portal | Semester's own billing screens |
| Rail needed | Recurring + invoicing + tax | `hostedCollection` + `offSessionCharge` only |

Both modes write the same canonical records: `invoices`, `payment_attempts`, `ledger_journals`, `payment_events`. Mode B is chosen **per rail** by the `recurring` / `offSessionCharge` capability flags, and per customer cohort by a setting, so a cohort can move one at a time and move back. Mode B is a stage-2 gate (FRG-15) because Semester then owns renewal timing, failed-payment retry and the consumer-protection disclosures that go with auto-renewal **[REQUIRES QUALIFIED REVIEW]**.

## 7. Webhook pipeline

```
HTTP POST → size limit → origin refused → adapter.verifyWebhook (raw body, constant-time, tolerance, mode match)
          → provider_event_inbox row (minimized projection, status=received)
          → adapter.normalize → NormalizedPaymentEvent[]
          → apply in ONE transaction: attempt transition + ledger journal + invoice/subscription effect
                                       + entitlement effect + finance_notice enqueue + audit row
          → inbox status=applied → 2xx
```

| Step | Rule |
| --- | --- |
| Verify | Raw bytes, never re-serialized JSON. Wrong secret, stale timestamp, missing header: one indistinguishable 4xx. Test-mode event on a live rail rejected before any state change (today's behaviour, kept). |
| Inbox | Stores a **minimized allowlist projection** (ids, type, amounts, currency, status, timestamps) and the payload hash. No name, email, address, or any field that could hold a card number. Raw payload is not retained; replay re-fetches the object from the rail by id where the adapter supports it. This closes today's "not replayable" gap without keeping personal data **[privacy review]**. |
| Normalize | Pure function; unknown type becomes kind `other`. |
| Apply | Single transaction so a half-applied event cannot occur. The inbox row and the effect commit together (the existing "apply last" trick is replaced by atomicity plus the unique key). |
| Out of order | Each canonical state has a rank (below). An event whose rank is lower than the attempt's current rank is recorded and **does not move state backward** (today's snapshot-rank idea, generalized beyond invoices). An event for an aggregate that does not exist yet is **parked** with `retry_after`, not answered 500 indefinitely; after N attempts or a day it dead-letters and alerts. |
| Failure | Apply failure returns 5xx so the rail retries; the inbox row records attempts and last error code (a code, never a message that could echo input). |
| Dead letter | Visible in the console, with a replay action requiring `billing:operate` and recorded as an audit event. |
| Never | Never log a payload, never put a payload in an error, never answer with CORS headers, never accept a browser origin. |

### Canonical events

| Canonical event | Meaning | Effect |
| --- | --- | --- |
| `payment.requires_action` | Customer must authenticate | Attempt `requires_action`; native prompt |
| `payment.authorized` | Funds reserved | Attempt `authorized` |
| `payment.captured` | Funds captured at the rail | Attempt `captured`; journal; invoice allocation; entitlement on (if first) |
| `payment.failed` | Declined or errored | Attempt `failed`; failure code normalized; dunning rule |
| `payment.settled` | Appears on a settlement line | Attempt `settled`; reconciliation input (usually derived from `getSettlement`, not a webhook) |
| `refund.created` / `refund.succeeded` / `refund.failed` | Refund progress | Refund status; journal on success; notice |
| `dispute.opened` / `dispute.evidence_due` / `dispute.won` / `dispute.lost` / `dispute.closed` | Dispute progress | Dispute case; journal; reminders |
| `checkout.completed` | A hosted checkout finished and named Semester's checkout id | Existing `complete_checkout` semantics (mode A) |
| `payment_method.attached` / `detached` / `expiring` | Token lifecycle | `payment_methods` status; renewal-risk flag |
| `subscription.synced` | Mode A mirror of the rail's subscription | Existing `sync_provider_subscription` semantics |
| `tax.location_required` | Rail cannot calculate tax without an address | Generalizes `address_required`; no dunning |
| `settlement.available` | A payout report is ready | Triggers ingestion |
| `other` | Anything unknown | Recorded only |

### Mapping from today's Stripe handling (FACT) to canonical

| Stripe event | Canonical |
| --- | --- |
| `checkout.session.completed` | `checkout.completed` (Mode A; `other` when it is not a Semester subscription checkout) |
| `customer.subscription.updated` / `.deleted` | `subscription.synced` (status mapped by the adapter) |
| `invoice.paid`, `invoice.payment_succeeded` | `payment.captured` |
| `invoice.payment_failed` | `payment.failed` |
| `invoice.finalization_failed` + `requires_location_inputs` | `tax.location_required` |
| `invoice.finalization_failed` otherwise | `other` (recorded tax outage; never starts dunning) |
| `charge.refunded` | `refund.succeeded` (**new effect**; today only recorded) |
| `charge.dispute.created` | `dispute.opened` (**new effect**; today only recorded) |
| not handled today: `charge.dispute.updated/closed/funds_withdrawn`, `refund.updated/failed`, `payment_intent.requires_action`, `payment_method.*`, `payout.*` | corresponding canonical events (**new**) |

### Attempt state machine and rank

```
draft(0) → method_collected(1) → authorization_pending(2) → requires_action(2) → authorized(3)
        → captured(4) → processing(4) → settled(5) → reconciled(6)
failure paths: failed · cancelled · refunded · partially_refunded · disputed · chargeback · written_off · collections
```

`entitlement active` is not an attempt state; it is an effect of `captured` on the subscription. Every transition records, in one row of `payment_attempt_transitions` (append-only): idempotency key, provider event reference, the ledger journal id, the audit event id, the notice rule fired, the entitlement effect, the reconciliation status, and the support path. A transition missing any of these is refused by the guard trigger. This is the brief's "every transition requires" list made a constraint.

## 8. Routing (stage 2)

A pure function `chooseRail(order)` over enabled rails: customer country and currency, method kind, amount, capability need, and an ordered fallback. Rules are data in `payment_rails`, changes need `finance_approvals` (FC-24), and routing never sends a refund to a rail other than the one that captured. A rail that is `paused` accepts no new command and still receives its webhooks, settlement reports and refunds for money already taken.

## 9. Adding a rail (checklist)

1. Capability flags written and reviewed by finance.
2. Adapter implements the interface; `verifyWebhook` has a test against an independent signature vector.
3. Passes the shared contract suite (`app/src/lib/payments/contract.test.ts`): idempotent charge, refund never above captured, unknown event becomes `other`, wrong-mode event refused, no method accepts card-like input, errors never contain input.
4. Fixtures for every canonical event.
5. Settlement report parser reconciles to the rail's own totals on a sample.
6. Subprocessor entry (`lib/trust/subprocessors.ts`), vendor risk register row, DPA countersigned, the PCI path documented by the rail and reviewed **[REQUIRES QUALIFIED REVIEW]**.
7. Test-mode run through [`FINANCE_RELEASE_GATES.md`](FINANCE_RELEASE_GATES.md), then live for the owner's own account only.

## 10. Secrets and environments

| Secret | Where | Notes |
| --- | --- | --- |
| Rail API credential | Edge Function secret, one per rail and mode | Existing `STRIPE_SECRET_KEY` becomes the Stripe rail's entry; the legacy `STRIPE_API_KEY` fallback is retired after the move |
| Webhook signing secret | Edge Function secret, one per endpoint | Rotation supports two live secrets (accepts two `v1` values today) |
| Mode | Derived from the credential's prefix and compared with every event's `livemode` | Generalized as `adapter.rail.mode` |
| Browser | Receives only hosted URLs or a client secret scoped to one collection session | Never a rail secret; `credentials: 'omit'` as today |

## 11. Tests this design owes

Contract suite over every adapter; golden normalization fixtures; the existing billing suite unchanged after the refactor; a chaos case per failure (provider timeout, duplicate event, event before parent, out-of-order, secret mismatch, mode mismatch); a revert check showing each guard red against a faithful revert; the `check:university` gate (code under `supabase/functions/` stays out of anything the gateway imports); and the Deno-free rule for `_shared/payments/*` so vitest can import it.

## Evidence state

- **Repository evidence:** the Stripe coupling points and the SQL neutrality listed in §1, read from `_shared/stripe.ts`, `billingcheckout.ts`, `billingwebhook.ts`, `billingcancel.ts`, `billingportal.ts`, `billingmode.ts` and the commercial migrations.
- **Operational evidence:** one live Stripe monthly charge, 2026-10-03. No second rail has been evaluated.
- **Missing proof:** all of §3–§9.

## Cannot be completed from source code

The choice and contracting of any second rail; a rail's real capability, fees and settlement timing; the PCI path for hosted fields; consumer-law treatment of Semester-run renewals.
