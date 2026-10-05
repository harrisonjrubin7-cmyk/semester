# Edge functions

> **Type:** reference · **Audience:** implementers, operators · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/platform-reference.test.ts`

This page lists the 16 Supabase edge functions in this repository, what each accepts, how each decides who is calling, and which environment variables and database functions each uses; stop reading if you want the secrets inventory ([`SECRETS.md`](../../SECRETS.md)) or the deploy steps ([`supabase/DEPLOY.md`](../../supabase/DEPLOY.md)).

**Status:** PARTIAL — each function carries its own word in the table below. Only the functions marked LIVE work for a real user without further owner, provider or university action. This page reads the repository, not the running project: it cannot say what is deployed or which secrets are set.

## How to read this page

- **URL shape.** Every function is served at `https://<project-ref>.supabase.co/functions/v1/<function>`. `<project-ref>` is the Supabase project the deployment belongs to. `lti` also answers four sub-paths (see its section); `calendar` reads its credential from the last path segment.
- **`verify_jwt`.** All 16 functions are `false` in [`supabase/config.toml`](../../supabase/config.toml). The platform check would reject a CORS preflight, which carries no `Authorization` header, so each function does its own check. The **Guard** column is the kind of credential each one answers to, taken from [`app/src/lib/edgeguards.ts`](../../app/src/lib/edgeguards.ts). A function with `verify_jwt = false` and no check of its own would be open; that register is what stops one being added without saying so.
- **Status words** are the vocabulary of [`docs/FEATURE-TRUTH-TABLE.md`](../FEATURE-TRUTH-TABLE.md). Where that table has a row for the function, the section names it. Where it has none, the word is read from the function's own gating and the section says so.
- **Environment variables** are names only. What each one controls, its default and where it is set is in [`CONFIGURATION.md`](CONFIGURATION.md).
- **Deploy state.** [`supabase/DEPLOY.md`](../../supabase/DEPLOY.md) holds a dated snapshot of what the project reported. This page does not repeat it, and the snapshot is not evidence that a function is on today.

## Summary

| Function | Status | Methods | Guard | verify_jwt | Environment variables | RPCs |
| --- | --- | --- | --- | --- | --- | --- |
| `billing-cancel` | IMPLEMENTED_NOT_RELEASED | `POST` | `user-token` | `false` | `ALLOWED_ORIGIN`, `STRIPE_API_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL` | `request_cancellation` |
| `billing-checkout` | IMPLEMENTED_NOT_RELEASED | `POST` | `user-token` | `false` | `ALLOWED_ORIGIN`, `BILLING_LIVE_ENABLED`, `CHECKOUT_RETURN_URL`, `STRIPE_API_KEY`, `STRIPE_PRODUCT_TAX_CODE`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `attach_checkout_session`, `begin_checkout` |
| `billing-portal` | IMPLEMENTED_NOT_RELEASED | `POST` | `user-token` | `false` | `ALLOWED_ORIGIN`, `CHECKOUT_RETURN_URL`, `STRIPE_API_KEY`, `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL` | none |
| `billing-webhook` | IMPLEMENTED_NOT_RELEASED | `POST` | `signature` | `false` | `STRIPE_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `apply_invoice_payment_event_v3`, `apply_payment_event`, `complete_checkout`, `sync_provider_subscription` |
| `calendar` | LIVE | `GET`, `HEAD` | `link-token` | `false` | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `read_feed` |
| `canvas` | PARTIAL | `POST` | `user-token` | `false` | `ALLOWED_ORIGIN`, `CORS_ALLOW_DEV`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | none |
| `claude` | BLOCKED | `POST` | `user-token` | `false` | `AI_ALLOWANCE_MICROS_FREE`, `AI_ALLOWANCE_MICROS_PLUS`, `AI_ALLOWANCE_MICROS_PRO`, `ALLOWED_ORIGIN`, `ANTHROPIC_API_KEY`, `CORS_ALLOW_DEV`, `MONTHLY_CALL_LIMIT`, `SHARED_AI_PROVIDER`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `add_spend`, `ai_usage_spent`, `count_call`, `release_ai_budget`, `reserve_ai_budget`, `settle_ai_budget` |
| `delete-account` | LIVE | `POST` | `user-token` | `false` | `ALLOWED_ORIGIN`, `CORS_ALLOW_DEV`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `erase_account` |
| `fetchcal` | LIVE | `POST` | `user-token` | `false` | `ALLOWED_ORIGIN`, `CORS_ALLOW_DEV`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | none |
| `integration-tick` | IMPLEMENTED_NOT_RELEASED | `POST` | `scheduler-token` | `false` | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `integration_refresh_governance`, `integration_tick_authorized`, `integration_tombstone_references` |
| `lead-intake` | IMPLEMENTED_NOT_RELEASED | `POST` | `public` | `false` | `LEAD_IP_SALT`, `LEAD_NOTIFY_EMAIL`, `LEAD_NOTIFY_FROM`, `RESEND_API_KEY`, `SITE_ORIGINS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `submit_site_lead` |
| `lti` | IMPLEMENTED_NOT_RELEASED | `GET`, `POST` | `flow-state` | `false` | `ALLOWED_ORIGIN`, `CORS_ALLOW_DEV`, `LTI_PRIVATE_KEY`, `SEMESTER_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `lti_launch_entitlement_facts`, `lti_launch_membership`, `lti_passback_decision`, `lti_record_context`, `spend_lti_nonce` |
| `productivity-sourcecheck` | PARTIAL | `POST` | `user-token` | `false` | `ALLOWED_ORIGIN`, `CORS_ALLOW_DEV`, `PRODUCTIVITY_SOURCE_HOSTS`, `SUPABASE_ANON_KEY`, `SUPABASE_URL` | none |
| `push` | IMPLEMENTED_NOT_RELEASED | any | `shared-secret` | `false` | `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | `note_access` |
| `support-reply-notify` | IMPLEMENTED_NOT_RELEASED | `POST` | `user-token`, `shared-secret` | `false` | `ALLOWED_ORIGIN`, `CORS_ALLOW_DEV`, `CRON_SECRET`, `LEAD_NOTIFY_FROM`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPPORT_NOTIFY_FROM`, `SUPPORT_RETURN_URL` | `claim_support_notifications` |
| `trust-room` | IMPLEMENTED_NOT_RELEASED | `POST` | `link-token` | `false` | `ALLOWED_ORIGIN`, `CORS_ALLOW_DEV`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `trust_room_open` |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` are injected by the platform; nobody sets them. These browser-called functions answer a CORS preflight (`OPTIONS`): `billing-cancel`, `billing-checkout`, `billing-portal`, `canvas`, `claude`, `delete-account`, `fetchcal`, `lead-intake`, `productivity-sourcecheck`, `support-reply-notify`, `trust-room`, and `lti` on `/score`. `billing-webhook` refuses any request that carries an `Origin`. `calendar`, `integration-tick` and `push` have no browser caller. `push` has no method check at all: any method with the right bearer token runs it.

The table is held both ways by the test: every function directory is a row, every row is a directory, the `verify_jwt` and Guard cells equal `config.toml` and `edgeguards.ts`, and the environment and RPC cells equal what the function's source (its `index.ts` plus every `_shared` module it imports) actually reads and calls.

## Origin rules, in one place

Two readings of `ALLOWED_ORIGIN` exist, both in [`_shared/cors.ts`](../../supabase/functions/_shared/cors.ts). The allowlist is held by [`app/src/lib/functioncors.test.ts`](../../app/src/lib/functioncors.test.ts) and the strict reading by [`app/src/lib/billing/stripe.test.ts`](../../app/src/lib/billing/stripe.test.ts).

| Reading | Used by | Behavior |
| --- | --- | --- |
| Allowlist (`corsHeaders`) | `canvas`, `claude`, `delete-account`, `fetchcal`, `lti` (`/score` only), `productivity-sourcecheck`, `support-reply-notify`, `trust-room` | The production Pages origin is built in. `ALLOWED_ORIGIN` is a comma-separated list that only adds exact `https://` origins. `*`, paths and plain `http` entries are ignored. A loopback origin is echoed only when `CORS_ALLOW_DEV` is `1`, `true` or `yes`. An origin not allowed gets no `Access-Control-Allow-Origin` header. Methods header is `POST, OPTIONS`. |
| Strict (`strictCorsHeaders`) | `billing-cancel`, `billing-checkout`, `billing-portal`, `lead-intake` | An origin is answered only when `ALLOWED_ORIGIN` (or, for `lead-intake`, the built-in site origins plus `SITE_ORIGINS`) names it exactly. Nothing configured, `*`, or no `Origin` header allows nobody. |

## `billing-cancel`

Ends a subscriber's Plus at the close of the period they paid for. **Status** IMPLEMENTED_NOT_RELEASED (truth-table row "Cancellation": no resume or undo, no plan-change path).

- **Request.** `POST` with `Authorization: Bearer <Supabase access token>` and JSON `{"subscription_id": "<uuid>"}`. Body limit 512 bytes.
- **Order of work.** The subscription is read as the caller (row-level security, individual billing account only, status in `trialing`, `active`, `past_due`, `grace`, plan not `free`). Stripe is told `cancel_at_period_end=true` with idempotency key `cancel-<subscription id>`. Only then does `request_cancellation` record it, again as the caller. If recording fails after Stripe agreed, the function still answers 200 and the Stripe webhook brings the record into line.
- **Responses.** 200 `{"ends_at": <period end>}` (also when it was already set to cancel); 400 no valid `subscription_id`; 401 no token; 403 origin not allowed; 404 not the caller's own live paid subscription; 405; 409 the subscription has no Stripe `sub_` reference, so it cannot be cancelled online; 413; 500; 502 Stripe did not answer, nothing changed; 503 no Stripe key.
- **Gating.** 503 until `STRIPE_SECRET_KEY` (or the legacy `STRIPE_API_KEY`) is set. No service key is used.
- **Source.** [`index.ts`](../../supabase/functions/billing-cancel/index.ts), [`_shared/billingcancel.ts`](../../supabase/functions/_shared/billingcancel.ts), [`cancel.test.ts`](../../app/src/lib/billing/cancel.test.ts).

## `billing-checkout`

Starts a Stripe-hosted checkout for a catalog price after recorded consent. **Status** IMPLEMENTED_NOT_RELEASED, and BLOCKED for live charges (truth-table row "Hosted Checkout"). **In the code today it cannot open at all:** `individualPaidAcquisitionApproved` is the constant `false` in `index.ts`, so `liveEnabled` is false whatever the environment says.

- **Request.** `POST` with a bearer token and JSON `{"price_id": "<uuid>", "consent": true, "consent_text_version": "plus-v2"}`. Body limit 2048 bytes. Response header `X-Semester-Billing-Contract: plus-v2` on every answer.
- **Order of work.** Consent and the price are recorded by `begin_checkout`, which refuses a quoted or free price and a person who already pays. Then a Stripe Checkout Session is created (subscription mode, automatic tax, `price_data` from the catalog row, idempotency key `checkout-v2-<tax code>-<checkout id>`). The session id is attached with `attach_checkout_session`. The card is typed into Stripe's page, never into Semester.
- **Responses.** 200 `{"url", "checkout_id"}`; 400 not JSON, no valid `price_id`, or consent missing or on the wrong wording; 401 no or invalid token; 403 origin not allowed; 404 price cannot be bought online; 405; 409 already subscribed; 413; 500; 502 Stripe did not answer or the session did not match the key's live/test mode and `checkout.stripe.com`; 503 `Checkout is not available yet.`. A preflight from an allowed origin is answered 204 even while checkout is off.
- **Gating.** 503 unless `liveEnabled` (the constant above and `BILLING_LIVE_ENABLED` equal to `true`), a `sk_`/`rk_` live or test Stripe key, and `STRIPE_PRODUCT_TAX_CODE` shaped `txcd_` plus eight digits.
- **Source.** [`index.ts`](../../supabase/functions/billing-checkout/index.ts), [`_shared/billingcheckout.ts`](../../supabase/functions/_shared/billingcheckout.ts), [`checkout.test.ts`](../../app/src/lib/billing/checkout.test.ts). Product context: [`docs/COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md).

## `billing-portal`

Returns a short-lived Stripe billing portal link (receipts, invoices, payment method) for the caller's own individual billing account. **Status** IMPLEMENTED_NOT_RELEASED. The truth-table row "Customer Portal" still says PLANNED; the code exists, and the code is what this page reports.

- **Request.** `POST` with a bearer token. No body is read.
- **Responses.** 200 `{"url": "https://billing.stripe.com/…"}`; 401; 403; 404 no billing account for the caller; 405; 500; 502 Stripe failed, or the session's live/test mode did not match the key; 503 not configured (no key, no `CHECKOUT_RETURN_URL`, no valid portal configuration id) or the return URL is not an `https` URL on an allowed origin.
- **Gating.** `STRIPE_PORTAL_CONFIGURATION_ID` must look like `bpc_…`. `CHECKOUT_RETURN_URL` must be `https`, carry no credentials, and be on an origin from `ALLOWED_ORIGIN` or the built-in production origin.
- **Source.** [`index.ts`](../../supabase/functions/billing-portal/index.ts), [`_shared/billingportal.ts`](../../supabase/functions/_shared/billingportal.ts), [`portal.test.ts`](../../app/src/lib/billing/portal.test.ts).

## `billing-webhook`

Receives Stripe's events and applies them through service-only SQL functions. **Status** IMPLEMENTED_NOT_RELEASED (truth-table row "Signature-verified, idempotent webhook"; the same row records that events are not replayable and there is no dead-letter queue).

- **Request.** `POST` from Stripe with `Stripe-Signature`. The signature is verified over the raw body before any byte is read, with a 300 second tolerance. Body limit 262144 bytes (checked on `Content-Length` and on the body). A request carrying an `Origin` header is refused.
- **Events handled.** `checkout.session.completed` (`complete_checkout`), `customer.subscription.*` (`sync_provider_subscription`, newer events only), `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.finalization_failed` (`apply_invoice_payment_event_v3`), `charge.refunded`, `charge.dispute.created`. Any other type is recorded as `other`. `apply_payment_event` runs last and is the idempotency key (`provider_event_id`).
- **Responses.** 200 `{"received": true, "outcome"}`; 400 invalid signature (missing, stale and wrong are one answer), not JSON, not an event, or the event's `livemode` does not match the key's mode; 403 request carried an `Origin`; 405; 413; 500 applying failed, or an invoice arrived before its subscription exists (nothing is recorded so Stripe's retry is not a duplicate); 503 `Billing is not configured.`.
- **Gating.** 503 until `STRIPE_WEBHOOK_SECRET` is set and a Stripe key of a known mode is present.
- **Logging.** One line on failure that names no event, body or customer.
- **Source.** [`index.ts`](../../supabase/functions/billing-webhook/index.ts), [`_shared/billingwebhook.ts`](../../supabase/functions/_shared/billingwebhook.ts), [`_shared/stripe.ts`](../../supabase/functions/_shared/stripe.ts), [`webhook.test.ts`](../../app/src/lib/billing/webhook.test.ts). SQL: [`20260929080000_commercial_automation.sql`](../../supabase/migrations/20260929080000_commercial_automation.sql).

## `calendar`

Serves the `.ics` feed a student's device uploaded. **Status** LIVE (truth-table row "Plan: calendar").

- **Request.** `GET` or `HEAD` to `/functions/v1/calendar/<token>`. The token is the last path segment: 48 lowercase hex characters (24 random bytes). There is no other credential; a calendar app cannot send one.
- **Responses.** 200 `text/calendar` with `Cache-Control: private, max-age=3600`, `Referrer-Policy: no-referrer`, `Last-Modified` when known (no body for `HEAD`); 404 with an empty but valid calendar, for a malformed token, an unknown token and a database error alike; 405 for any other method with `Allow: GET, HEAD`; 503 empty calendar when the service credentials are missing. No CORS header is sent, on purpose.
- **Writes.** `read_feed` looks the row up and notes the fetch in the same statement: one `access_log` row per account per day per kind of client, where the kind is one of `apple`, `google`, `outlook`, `browser`, `other` or `unknown` (the table's seventh word, `device`, is what `push` writes), never the user agent, address or token.
- **Source.** [`index.ts`](../../supabase/functions/calendar/index.ts), [`supabase/CALENDAR-REVIEW.md`](../../supabase/CALENDAR-REVIEW.md), [`clientfamily.test.ts`](../../app/src/lib/clientfamily.test.ts).

## `canvas`

Reads a student's Canvas through their own access token, which the browser cannot do directly. **Status** PARTIAL (truth-table row "Canvas": a read-only proxy with the student's own token, a student-side convenience and not an institutional connector).

- **Request.** `POST` with a bearer token and JSON `{"host": "…", "path": "/api/v1/…", "token": "<the student's Canvas token>"}`.
- **Rules.** The host must not be private (loopback, link-local, RFC 1918, carrier-grade NAT, `.local`, `.internal`, `.home.arpa`, IPv6 local ranges). The path must match `/api/v1/…` with no `..` or backslash. The call is `GET https://<host><path>` with `redirect: 'manual'`. Timeout 15000 ms. Response limit 1,000,000 bytes.
- **Responses.** 200 the Canvas JSON (`Cache-Control: no-store`); 400 bad body, missing host or token, private host, or a path outside the Canvas API; 401 no or invalid session, or Canvas refused the token; 405; 413 Canvas answered with more than the limit; 422 the address did not answer JSON; 502 Canvas unreachable, redirected, or answered an error status.
- **Source.** [`index.ts`](../../supabase/functions/canvas/index.ts).

## `claude`

Forwards a signed-in account's request to Anthropic using Semester's shared key. **Status** BLOCKED (truth-table row "Shared AI key activation": five owner decisions, each with evidence under `docs/evidence/vendors/`, and `SHARED_AI_PROVIDER` set to `on`; all five are recorded as pending in [`_shared/provideractivation.ts`](../../supabase/functions/_shared/provideractivation.ts)). Until then every request is answered 501. A student who sets their own key does not use this function. Checklist: [`docs/trust/SHARED-PROVIDER-ACTIVATION.md`](../trust/SHARED-PROVIDER-ACTIVATION.md).

- **Request.** `POST` to Anthropic's messages shape with a bearer token. The body is read and rebuilt by `clampRequest`: the model must be one of `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5-1`, `claude-haiku-4-5`; `max_tokens` must be a whole number and is cut to 16,000; `messages` must be non-empty; the app's own tools pass; web search is kept with at most 5 uses; other tools and fields are dropped. Body limit 25,165,824 bytes (24 MiB).
- **Order of checks.** Method, then the activation gate, then the key, then the key's shape, then the caller's session, then the AI kill switch, then whose account it is (an individual's, or a school's decision), then the body, then the monthly count, then the upstream call.
- **Limit.** `MONTHLY_CALL_LIMIT` calls per account per UTC calendar month, default 60, counted before the call by `count_call` (one statement under a row lock). A refused upstream or a dropped connection still costs a call. Every forwarded answer carries `X-Calls-Remaining`.
- **Responses.** Errors are `{"error": {"message", "code"?}}`. 400 unreadable request, unlisted model, no messages, bad `max_tokens`; 401 no or invalid session; 405; 413 body too large; 429 monthly limit passed; 501 shared key not activated (`code: shared_provider_not_activated`) or no key configured; 502 Anthropic could not be reached; 403 the account belongs to a school that has not turned AI on for it (`code: tenant_managed_account`) or whose monthly budget is spent (`code: tenant_budget`); 503 key cannot be sent as a header, usage could not be counted, a school's membership or policy could not be read, or generation is switched off. Otherwise Anthropic's own status and body are passed through, streaming included.
- **Kill switch.** The global `kill.ai_generation` row of `feature_kill_switch`, and for a school's account that school's row too; a switch that cannot be read counts as engaged.
- **Whose account.** An account with no school (`profiles.school_id` null) is served. A school's account is served only when, read live, the school's `semester_intelligence` feature is `production`, the account is in the release cohort if one is named, has one active `institution_membership` with a permitted role, the school's `ai_policy` allows `anthropic`, and `ai_usage_spent` is under its monthly budget. Anything unreadable is refused. A school's account also draws down the school's monthly budget in step with its own allowance: reserved in whole cents (`reserve_ai_budget`) after the account's reservation and before the call is counted (403 `tenant_budget` if the school has no room, 503 if it cannot be asked), released wherever the account's is, settled to actual cost rounded up to a cent, and settled at the reservation when usage is unreadable or the connection drops. A stream the client abandons runs no settle, so the school's reservation expires and is not charged. Not copied: the gateway's per-request modes, models and course sources. [`_shared/tenantai.ts`](../../supabase/functions/_shared/tenantai.ts), [`tenantai.test.ts`](../../app/src/lib/tenantai.test.ts). See [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md).
- **Source.** [`index.ts`](../../supabase/functions/claude/index.ts), [`_shared/clamp.ts`](../../supabase/functions/_shared/clamp.ts), [`_shared/killswitch.ts`](../../supabase/functions/_shared/killswitch.ts), [`_shared/sharedkey.ts`](../../supabase/functions/_shared/sharedkey.ts), [`claudeclamp.test.ts`](../../app/src/lib/claudeclamp.test.ts), [`aikillswitch.test.ts`](../../app/src/lib/aikillswitch.test.ts).

## `delete-account`

Erases every row about the caller in one transaction, then removes their sign-in. **Status** LIVE when Supabase is configured (truth-table row "Account"; "Privacy / Data / Export" notes that erasure fails closed for staff who wrote to four immutable history tables).

- **Request.** `POST` with a bearer token and JSON `{"confirm": "DELETE"}`. There is no account id in the body; the account is the token's.
- **Order of work.** Who is asking, from the token. Then `erase_account(target)`, which rolls the whole thing back on failure. Then the Admin API deletes the auth user, last, because the token that proves who is asking disappears with it. Repeating the call after a step-3 failure is safe.
- **Responses.** Every answer is `{"erased", "signInRemoved", "message", "removed"?}`. 200 both true; 400 the confirmation word is missing; 401 no or invalid token; 405; 409 the account is under a legal hold (SQLSTATE 55006, nothing deleted, no reason given); 500 with `erased: false` when erasure failed and nothing was deleted, or with `erased: true, signInRemoved: false` when only the sign-in could not be removed; 503 service credentials missing, nothing deleted.
- **Source.** [`index.ts`](../../supabase/functions/delete-account/index.ts), [`_shared/deleteaccount.ts`](../../supabase/functions/_shared/deleteaccount.ts), [`deleteaccount.test.ts`](../../app/src/lib/deleteaccount.test.ts). SQL: [`20260929010000_account_erasure_and_export.sql`](../../supabase/migrations/20260929010000_account_erasure_and_export.sql).

## `fetchcal`

Fetches a calendar link the browser cannot fetch, because calendar servers send no CORS headers. **Status** LIVE (truth-table row "Plan: calendar").

- **Request.** `POST` with a bearer token and JSON `{"url": "https://…"}`.
- **Rules.** `https` only; the host must not be private (the same rule as `canvas`); redirects are followed but the final address is checked by the same rule. Timeout 15000 ms. Response limit 1,000,000 bytes. The body must contain `BEGIN:VCALENDAR` in its first 4096 characters.
- **Responses.** 200 `text/calendar` (`Cache-Control: no-store`); 400 not JSON, not a web address, not `https`, a private host, or a redirect to one; 401 no or invalid session; 405; 413 larger than the limit; 422 the address answered something that is not a calendar; 502 unreachable or an error status.
- **Source.** [`index.ts`](../../supabase/functions/fetchcal/index.ts), [`publichost.test.ts`](../../app/src/lib/publichost.test.ts).

## `integration-tick`

The 15-minute integration sync tick: pulls each approved connection that is due and runs any replay an operator has asked for. **Status** IMPLEMENTED_NOT_RELEASED. No truth-table row names it; the row "SIS / catalog connectors" is PLANNED because `ADAPTERS` is empty in [`app/server/integration/registry.ts`](../../app/server/integration/registry.ts), so every tick reports every connection as unregistered.

- **Request.** `POST` with `Authorization: Bearer <integration_cron_secret>`. No body is read. The caller is the `integration-sync` job in [`supabase/scheduler.sql`](../../supabase/scheduler.sql) at minutes 7, 22, 37 and 52 of every hour, with a 60 second timeout. That job is active in the file; whether it is active in the project is not verified here.
- **Auth.** The token is compared inside the database by `integration_tick_authorized`, against Vault. No copy of the secret is set on the function.
- **Responses.** 200 the tick's counts (no school, connection or person is named); 401 no or wrong token; 405 `POST only.`; 500 the tick failed; 503 service credentials missing or the database could not say whether the token is right.
- **Kill switches.** Syncs stop under the integration kill switches in [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md). The operator steps are in [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](../INTEGRATION-OPERATOR-RUNBOOK.md).
- **Source.** [`index.ts`](../../supabase/functions/integration-tick/index.ts), [`_shared/integrationtick.ts`](../../supabase/functions/_shared/integrationtick.ts), [`integrationtick.test.ts`](../../app/src/lib/integrationtick.test.ts). The worker code is `app/server/integration/` (a generated copy sits in `_shared/integration/`).

## `lead-intake`

The company site's forms, one endpoint for every route in `cta_routes`. **Status** IMPLEMENTED_NOT_RELEASED. No truth-table row names it; the code answers 503 until a salt or the service key is present, and this page cannot see the project's secrets.

- **Request.** `POST` with JSON `{route, name, email, organization?, role?, message?, fields?, page?, website?}`. `website` is a honeypot. Body limit 16384 bytes. Field limits: name 200, email 320, organization 200, role 120, message 5000, page 500, up to 20 extra `fields` (key 40, value 1000 characters).
- **Rules.** The built-in site origins plus `SITE_ORIGINS` are the only origins answered; no `Origin`, or one not on the list, is a 403. A filled honeypot gets the same 200 shape and a decoy reference, and nothing is stored or sent. The caller's address is HMAC-hashed with `LEAD_IP_SALT` (or the service key when unset) and only the hash reaches the database. `submit_site_lead` refuses a sixth submission from one hash within an hour.
- **Responses.** 200 `{"ok": true, "reference"}`; 400 `{"ok": false, "error"}` for unreadable JSON, invalid fields, unknown form or missing organization; 403; 405; 413; 429 with `Retry-After: 3600`; 500; 503 not accepting submissions. The owner is emailed through Resend only when both `RESEND_API_KEY` and `LEAD_NOTIFY_EMAIL` are set; a failure there never fails the submission.
- **Source.** [`index.ts`](../../supabase/functions/lead-intake/index.ts), [`_shared/leadintake.ts`](../../supabase/functions/_shared/leadintake.ts), [`leadintake.test.ts`](../../app/src/lib/billing/leadintake.test.ts). Deploy notes: [`supabase/DEPLOY.md`](../../supabase/DEPLOY.md).

## `lti`

LTI 1.3 launch, deep linking and grade passback for a Brightspace registration. **Status** IMPLEMENTED_NOT_RELEASED, and BLOCKED (truth-table rows "LTI 1.3 (launch, deep link, AGS)" and "LTI 1.3 launch validation": never launched from a real platform, not 1EdTech-certified, needs Brightspace registration, NRPS refused, an unbound registration answers `allowed-unbound`).

The caller is a browser arriving from the LMS, so there is no Supabase session. What authenticates a launch is the platform's signed `id_token`, checked against the keys the registration names and then claim by claim.

| Path suffix | Method | What it does |
| --- | --- | --- |
| `/login` | `GET` or `POST` | Looks up the registration by `iss` (and `client_id` when sent), stores a `state` and `nonce` in `lti_nonce` with a 300 second life, and redirects (302) to the platform's login URL. |
| `/launch` | `POST` | Spends the `state` (`spend_lti_nonce`), verifies the token's header and signature, checks every claim (`checkLaunch`), then either answers a deep-linking request with a signed auto-posting form or provisions or finds the account, records the course (`lti_record_context`) and any grade line item, mints a session link and redirects (302) to `SEMESTER_APP_URL` with `lti_token`, `lti_email` and, for a newly provisioned account, `lti_ticket`. |
| `/jwks` | any | Serves the public half of `LTI_PRIVATE_KEY` with `Cache-Control: public, max-age=3600`. 503 when the key is unset. |
| `/score` | `POST` | Called by the signed-in app with `{code, given, max}`. Looks up the caller's recorded line item, asks `lti_passback_decision` whether passback is allowed, signs a client assertion with `LTI_PRIVATE_KEY`, gets a token from the platform and posts the score. Answers `{"reported": true, "course"}` or `{"reported": false, "reason"}`. |

- **Responses.** A refused launch is an HTML page with a reference code, and the status is 400, 401 (bad header, signature or claims), 403 (not an instructor for placement, or school access not active), 405 (launch not `POST`), 500 or 503. Any other path is a 404 page. `/score` answers 401 without a valid session, 405 for non-`POST`, and 400 for a body that is not JSON; every other refusal is `{"reported": false, "reason"}` with status 200 by default, or 400, 500, 502 or 503 for particular reasons (for example `no-key` is 503 and `token-refused` is 502).
- **Gating.** A first launch provisions an account on a synthesized address that cannot receive mail; attaching an existing account is never automatic and goes through a ticket (`adopt_lti_identity`). Membership and entitlement checks use `lti_launch_membership` and `lti_launch_entitlement_facts`. Passback needs the bound registration's decision to be `allowed` or `allowed-unbound`.
- **Source.** [`index.ts`](../../supabase/functions/lti/index.ts), [`_shared/lti.ts`](../../supabase/functions/_shared/lti.ts), [`_shared/ltiverify.ts`](../../supabase/functions/_shared/ltiverify.ts), [`_shared/ltiags.ts`](../../supabase/functions/_shared/ltiags.ts), [`lti.test.ts`](../../app/src/lib/lti.test.ts), [`ltiags.test.ts`](../../app/src/lib/ltiags.test.ts).

## `productivity-sourcecheck`

Checks that a public `.edu` page is reachable and contains a short excerpt. It is an availability check, never a claim of institutional approval. **Status** PARTIAL. No truth-table row names it; the check exists and the claim it supports is deliberately narrow.

- **Request.** `POST` with a bearer token and JSON `{"url", "excerpt"}`. Raw body limit 5000 characters; `url` at most 2000, `excerpt` at most 1000.
- **Rules.** `https`, port 443, no credentials, no query string, and a host ending in `.edu` or listed in `PRODUCTIVITY_SOURCE_HOSTS`. The host must resolve only to public addresses. Up to four fetches with manual redirects, each target re-checked. Timeout 8000 ms. Page limit 512,000 bytes, HTML or plain text only. Scripts and tags are stripped before the excerpt is searched.
- **Responses.** 200 `{"state": "available", "excerptFound", "url", "checkedAt"}` or `{"state": "unavailable", "status", …}`; 204 to a preflight; 401 sign in; 405; 413 body too large; 400 for any other failure, with the reason in `error`.
- **Source.** [`index.ts`](../../supabase/functions/productivity-sourcecheck/index.ts), [`productivity.test.ts`](../../app/src/lib/productivity.test.ts).

## `push`

Sends due reminders to subscribed devices. **Status** IMPLEMENTED_NOT_RELEASED. No truth-table row names it. The job in [`supabase/scheduler.sql`](../../supabase/scheduler.sql) is written parked (`active := false`) "until the function knows the secret"; its state in the project is not verified here.

- **Request.** Any method, with `Authorization: Bearer <CRON_SECRET>`, from the `push` job every 15 minutes. The app decides what to send and when; the function only reads `push_queue`.
- **Work.** Takes up to 500 due rows, sends each to every device of the owning account with the Web Push protocol, deletes the sent rows, and notes a `push_send` access. A device answering 404 or 410 is marked gone, and removed if it was already marked.
- **Responses.** 200 `{"sent", "devices", "dropped", "marked"}` (only `sent` and `devices` when the queue is empty); 401 wrong bearer; 500 the queue could not be read; 503 `CRON_SECRET` unset or a VAPID key missing. A misconfigured deploy is silent rather than open.
- **Source.** [`index.ts`](../../supabase/functions/push/index.ts), [`push.test.ts`](../../app/src/lib/push.test.ts).

## `support-reply-notify`

Emails a student a generic hint that support replied, without exposing their address or the reply to the staff browser. **Status** IMPLEMENTED_NOT_RELEASED. No truth-table row names it; the `support-reply-notify` scheduler job is parked in the repository and `DEPLOY.md` records the function as pending live evidence.

- **Two callers.** *Staff browser:* `POST` with a bearer token and JSON `{"message_id": "<uuid>"}`. The caller must hold a platform-scope role granting the `support:ticket` capability. *Scheduler:* `POST` with `Authorization: Bearer <CRON_SECRET>` once a minute. It claims up to 100 queued notices and answers counts.
- **Delivery.** The email is generic (it names a `SUP-…` reference and points to the Help screen) and is sent through Resend with idempotency key `support-<message id>`. After the nth failed attempt the row waits `min(60, 2^n)` minutes; the eighth failed attempt dead-letters it. A recipient who opted out cancels the row.
- **Responses (browser).** 200 `{"ok": true, "outcome": "accepted"}`; 202 queued or in progress; 400 invalid body or id; 401 no token; 403 origin not allowed or no support access; 405; 409 cancelled before delivery; 502 the provider did not accept; 503 not configured or not available for delivery. *Scheduler:* 200 `{processed, accepted, retrying, dead_lettered, cancelled}`; 503 with the same body when any row dead-lettered; 503 `Support email is not configured.` when email is not configured.
- **Gating.** Counts as configured only when `RESEND_API_KEY` and a verified sender (`SUPPORT_NOTIFY_FROM`, falling back to `LEAD_NOTIFY_FROM`) are both set.
- **Source.** [`index.ts`](../../supabase/functions/support-reply-notify/index.ts), [`_shared/supportnotify.ts`](../../supabase/functions/_shared/supportnotify.ts), [`supportnotify.test.ts`](../../app/src/lib/supportnotify.test.ts). SQL: [`20261002003000_support_notification_outbox.sql`](../../supabase/migrations/20261002003000_support_notification_outbox.sql).

## `trust-room`

Serves the procurement room's files to a reviewer at a university who has no Semester account. **Status** IMPLEMENTED_NOT_RELEASED. No truth-table row names it.

- **Request.** `POST` with JSON `{"token": "<64 hex characters>", "artifact": "<key>"?}`. Body limit 2048 bytes; unknown keys are a 400. The token is never accepted in a URL.
- **Work.** `trust_room_open` (service key only) says what the token opens. Without `artifact` the answer lists the grant's documents. With one, the answer carries a signed URL for the file in the private `trust-packet` bucket, valid for 60 seconds.
- **Responses.** 200 the list `{packet_commit, expires_at, items}` or one document `{artifact, title, version, source_commit, packet_commit, url, url_expires_in}`; 400 bad request; 404 for a wrong, revoked, expired or uncovered token and when `kill.sharing` is engaged, all the same answer; 405; 413; 500 with no detail; 503 the object could not be signed. Every response is `no-store` and `no-referrer`.
- **Source.** [`index.ts`](../../supabase/functions/trust-room/index.ts), [`_shared/trustroom.ts`](../../supabase/functions/_shared/trustroom.ts), [`room-server.test.ts`](../../app/src/lib/trust/room-server.test.ts). Deploy notes: [`supabase/DEPLOY.md`](../../supabase/DEPLOY.md).

## Scheduled callers

Three functions are called by `pg_cron` jobs defined in [`supabase/scheduler.sql`](../../supabase/scheduler.sql). The file is the intent; it is not evidence of what is running.

| Job | Function | Schedule | State in `scheduler.sql` | Bearer token |
| --- | --- | --- | --- | --- |
| `push` | `push` | every 15 minutes | parked (`active := false`) | Vault `push_cron_secret`, equal to the function's `CRON_SECRET` |
| `support-reply-notify` | `support-reply-notify` | every minute | parked (`active := false`) | the same Vault secret |
| `integration-sync` | `integration-tick` | minutes 7, 22, 37, 52 | active | Vault `integration_cron_secret`, checked in the database |

## Related

- [`CONFIGURATION.md`](CONFIGURATION.md) — every environment variable name.
- [`SECRETS.md`](../../SECRETS.md) — where each secret lives and how it is rotated.
- [`supabase/DEPLOY.md`](../../supabase/DEPLOY.md) — deploy steps and the dated "what is live" snapshot.
- [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md) — kill switches and flags.
