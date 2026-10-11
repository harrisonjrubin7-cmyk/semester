# Configuration

> **Type:** reference · **Audience:** operators, implementers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/platform-reference.test.ts`

This page names every environment variable the edge functions and the university gateway read, what each controls and which code reads it; stop reading if you need a value, a rotation step or the `VITE_` build flags (see [`SECRETS.md`](../../SECRETS.md) and [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md)).

**Status:** PARTIAL — the variables exist and are read as described. Whether any of them is set in a given deployment cannot be seen from the repository, and several features they gate are not released (see the status column of [`EDGE-FUNCTIONS.md`](EDGE-FUNCTIONS.md)).

Names only. This page holds no value, example secret or key shape beyond a documented prefix. [`SECRETS.md`](../../SECRETS.md) is the authoritative inventory of where each secret is stored, who can read it back and how it is rotated; this page does not repeat any of that.

The test reads the source and fails in four cases: a variable is read that is not on this page, a variable is on this page that no code reads, a "Read by" cell names code that does not read it, or a line of this page assigns a value to a variable name.

## Edge functions

Set with the `supabase secrets set` command or in the dashboard, as in [`SECRETS.md`](../../SECRETS.md) ("The four stores"). The three `SUPABASE_*` names are injected by the platform. A function that needs a variable it does not have answers 503 or 501 rather than running open; the per-function behavior is in [`EDGE-FUNCTIONS.md`](EDGE-FUNCTIONS.md).

| Name | Kind | Controls | Required | Default | Read by |
| --- | --- | --- | --- | --- | --- |
| `AI_ALLOWANCE_MICROS_FREE` | config | The shared Anthropic key's monthly dollar allowance for the free plan, in millionths of a dollar. Anything that is not a whole number of at least 0 is ignored and the built-in value applies. | optional | `750_000` ($0.75) | `claude` |
| `AI_ALLOWANCE_MICROS_PLUS` | config | The shared Anthropic key's monthly dollar allowance for the plus plan, in millionths of a dollar. Anything that is not a whole number of at least 0 is ignored and the built-in value applies. | optional | `2_000_000` ($2.00) | `claude` |
| `AI_ALLOWANCE_MICROS_PRO` | config | The shared Anthropic key's monthly dollar allowance for the pro plan, in millionths of a dollar. Anything that is not a whole number of at least 0 is ignored and the built-in value applies. | optional | `4_000_000` ($4.00) | `claude` |
| `ALLOWED_ORIGIN` | config | Comma-separated web origins the browser-called functions answer, in addition to the built-in production origin. Only exact `https://` origins count; `*`, paths and plain `http` are ignored. The strict readers answer only origins named here. `billing-portal` also checks that `CHECKOUT_RETURN_URL` is on one of them. | optional | the built-in production origin only | `billing-cancel`, `billing-checkout`, `billing-portal`, `canvas`, `claude`, `delete-account`, `fetchcal`, `lti`, `productivity-sourcecheck`, `support-reply-notify`, `trust-room` |
| `AI_GATEWAY_API_KEY` | secret | Vercel AI Gateway key for the shared key. When set, `claude` sends through the gateway instead of Anthropic and `ANTHROPIC_API_KEY` is not used. Setting it does not switch the shared key on: see `SHARED_AI_PROVIDER`. | optional | none | `claude` |
| `ANTHROPIC_API_KEY` | secret | Semester's shared Anthropic key. Unset, `claude` answers 501. Setting it does not switch the shared key on: see `SHARED_AI_PROVIDER`. | optional | none | `claude` |
| `BILLING_LIVE_ENABLED` | config | The operations half of the checkout gate: only the exact value `true` counts. `billing-checkout` also holds new checkout off in code, so this alone cannot open it. | optional | unset (off) | `billing-checkout` |
| `CHECKOUT_RETURN_URL` | config | Where Stripe sends the person back. Must be `https`, carry no credentials and be on an allowed origin. | `billing-portal`: yes. `billing-checkout`: no | `billing-checkout` falls back to the calling origin; `billing-portal` has none and answers 503 | `billing-checkout`, `billing-portal` |
| `CORS_ALLOW_DEV` | config | Admits loopback origins (`localhost`, `127.0.0.1`, `[::1]`) when set to `1`, `true` or `yes`. Local development only. | optional | off | `canvas`, `claude`, `delete-account`, `fetchcal`, `lti`, `productivity-sourcecheck`, `support-reply-notify`, `trust-room` |
| `CRON_SECRET` | secret | The bearer token the scheduler sends to `push` and to the scheduled path of `support-reply-notify`. Also held in Vault; rotate both together. | `push`: yes | none; `push` answers 503 while unset | `push`, `support-reply-notify` |
| `LEAD_IP_SALT` | secret | The key the caller's address is HMAC-hashed with before the rate limit sees it. | optional | the service-role key | `lead-intake` |
| `LEAD_NOTIFY_EMAIL` | config | Where the owner's lead notification goes. With `RESEND_API_KEY`, turns the email on. | optional | none (no email is sent) | `lead-intake` |
| `LEAD_NOTIFY_FROM` | config | Sender of the lead notification. `support-reply-notify` uses it when `SUPPORT_NOTIFY_FROM` is unset. | optional | `Semester <onboarding@resend.dev>` in `lead-intake`; none in `support-reply-notify` | `lead-intake`, `support-reply-notify` |
| `LTI_PRIVATE_KEY` | secret | The tool's RS256 key as a JSON Web Key. Signs deep-linking responses and grade-passback assertions; its public half is served at `/lti/jwks`. | for deep linking, passback and `/jwks` | none; those paths answer 503 | `lti` |
| `MONTHLY_CALL_LIMIT` | config | Calls per account per UTC month on the shared key. The value is not validated: one that is not a number makes the comparison false and turns the cap off. | optional | `60` | `claude` |
| `OPS_PROJECTOR_SECRET` | secret | Dedicated bearer token for the manually invoked bounded projection endpoint. It does not enable or create a schedule. | for `ops-projector` | none; the function answers 503 | `ops-projector` |
| `PRODUCTIVITY_SOURCE_HOSTS` | config | Comma-separated exact hostnames allowed as sources besides hosts ending in `.edu`. | optional | none | `productivity-sourcecheck` |
| `RESEND_API_KEY` | secret | The Resend API credential for the two functions that send email. | optional | none | `lead-intake`, `support-reply-notify` |
| `SEMESTER_APP_URL` | config | Where a validated LTI launch sends the browser. Carries a one-use session token, so a wrong value is a leak. | for non-deep-link launches | none; the launch is refused with 500 | `lti` |
| `SHARED_AI_PROVIDER` | config | The deployment half of the shared-key gate: exactly `on`. The other half is the activation record in `_shared/provideractivation.ts`, which is incomplete. Both must hold before `claude` serves anyone. | optional | unset (off) | `claude` |
| `SITE_ORIGINS` | config | Extra company-site origins for `lead-intake`, added to the three built in. | optional | the built-in site origins only | `lead-intake` |
| `STRIPE_API_KEY` | secret | Legacy name for the Stripe secret key, read when `STRIPE_SECRET_KEY` is unset. | optional | none | `billing-cancel`, `billing-checkout`, `billing-portal`, `billing-webhook` |
| `STRIPE_PORTAL_CONFIGURATION_ID` | config | The Stripe billing portal configuration, shaped `bpc_…`. | for `billing-portal` | none; 503 | `billing-portal` |
| `STRIPE_PRODUCT_TAX_CODE` | config | The Stripe Tax code for the software product, shaped `txcd_` and eight digits. | for `billing-checkout` | none; 503 | `billing-checkout` |
| `STRIPE_SECRET_KEY` | secret | The Stripe secret key, preferred over `STRIPE_API_KEY`. Its `sk_`/`rk_` and `live`/`test` prefix sets the payment mode that events and sessions must match. | for all four billing functions | none; 503 | `billing-cancel`, `billing-checkout`, `billing-portal`, `billing-webhook` |
| `STRIPE_WEBHOOK_SECRET` | secret | The signing secret for Stripe's webhook endpoint. | for `billing-webhook` | none; 503 | `billing-webhook` |
| `SUPABASE_ANON_KEY` | injected | The publishable key, used with the caller's own token so row-level security decides what is read. | injected | none | `billing-cancel`, `billing-portal`, `productivity-sourcecheck` |
| `SUPABASE_SERVICE_ROLE_KEY` | injected | The service-role key. It bypasses row-level security. | injected | none | `billing-checkout`, `billing-webhook`, `calendar`, `canvas`, `claude`, `delete-account`, `fetchcal`, `integration-tick`, `lead-intake`, `lti`, `ops-projector`, `push`, `support-reply-notify`, `trust-room` |
| `SUPABASE_URL` | injected | The project URL. | injected | none | `billing-cancel`, `billing-checkout`, `billing-portal`, `billing-webhook`, `calendar`, `canvas`, `claude`, `delete-account`, `fetchcal`, `integration-tick`, `lead-intake`, `lti`, `ops-projector`, `productivity-sourcecheck`, `push`, `support-reply-notify`, `trust-room` |
| `SUPPORT_NOTIFY_FROM` | config | The verified sender for support reply emails. Support email counts as configured only when this (or `LEAD_NOTIFY_FROM`) and `RESEND_API_KEY` are both set. | optional | falls back to `LEAD_NOTIFY_FROM` | `support-reply-notify` |
| `SUPPORT_NOTIFY_ACTIVATED_AT` | config | UTC activation instant for the current approved support-email release, for example `2026-10-08T21:00:00Z`. It is required with vendor approval. The worker deletes still-pending intents queued before this instant, so a parked backlog cannot send after activation. | optional | unset (delivery refused) | `support-reply-notify` |
| `SUPPORT_NOTIFY_VENDOR_APPROVED` | config | The separate vendor-approval gate for support email delivery. Only the exact value `true` counts; credentials and sender configuration cannot bypass it. Setting it does not expose the browser opt-in or start the parked scheduler. | optional | unset (delivery refused) | `support-reply-notify` |
| `SUPPORT_RETURN_URL` | config | The application link in the support reply email. | optional | `https://harrisonjrubin7-cmyk.github.io/semester/` | `support-reply-notify` |
| `VAPID_PRIVATE_KEY` | secret | The private half of the Web Push key pair. | for `push` | none; 503 | `push` |
| `VAPID_PUBLIC_KEY` | config | The public half. The app build needs the same value as `VITE_VAPID_PUBLIC_KEY`. | for `push` | none; 503 | `push` |
| `VAPID_SUBJECT` | config | The contact URI sent with Web Push requests. | for `push` | none; 503 | `push` |

## University gateway

The gateway in `app/server/institution` has two entrypoints that read the environment: [`start.ts`](../../app/server/institution/start.ts), a standalone Node process on `127.0.0.1` for development and single-host use, and [`runtime.ts`](../../app/server/institution/runtime.ts), the stateless production composition that [`app/api/institution/[...path].ts`](../../app/api/institution/%5B...path%5D.ts) builds from `process.env`. [`scim-route.ts`](../../app/server/institution/scim-route.ts) reads the SCIM switch for the production composition only; `start.ts` does not mount SCIM. A production runtime that cannot be built from its environment answers 503 `The university service is unavailable. Please try again later.` to everything.

Every one of these is server-only. None may carry a `VITE_` prefix, because that would compile it into the browser bundle. The template is [`app/server/institution/.env.example`](../../app/server/institution/.env.example). The institution gateway is MOCK_DEMO without a tenant and has no production adapter (see [`docs/FEATURE-TRUTH-TABLE.md`](../FEATURE-TRUTH-TABLE.md)); these variables configure it, they do not make it live.

| Name | Controls | Required | Default | Read by | In `.env.example` |
| --- | --- | --- | --- | --- | --- |
| `OPENAI_API_KEY` | The provider credential for the governed intelligence routes. Without it the routes stay policy-disabled. | optional | none | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_AI_ESTIMATED_REQUEST_CENTS` | The amount reserved atomically before an AI request. Must not exceed `SEMESTER_AI_MAX_REQUEST_CENTS`. | optional | `0` | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_AI_MAX_REQUEST_CENTS` | The per-request ceiling, in cents. The tenant's monthly cap in the database stays authoritative. | optional | `0` | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_AI_PROVIDERS` | Comma-separated provider and model routes the operator approves, such as `provider:model`. Each must also be allowed by the tenant's policy. | optional | none | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_AI_RUNTIME_STATUS` | `production` labels the runtime `configured-production` in health output; anything else is `configured-sandbox`. It changes labeling, never policy. | optional | sandbox | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_APP_ORIGIN` | The one exact origin the gateway answers. Must be `https`, or `localhost` or `127.0.0.1` over `http`; anything else stops the process. | `runtime.ts`: yes | `start.ts`: `http://localhost:5173`; `runtime.ts`: none | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_AUTH_PUBLIC_KEY` | The publishable key of the Supabase Auth project the client signs in against. Tokens are validated over the network. | `runtime.ts`: yes | none | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_AUTH_SERVICE_KEY` | The service-role key used to resolve current institutional memberships. | `runtime.ts`: yes | none | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_AUTH_URL` | The URL of that Supabase Auth project. | `runtime.ts`: yes | none | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_GATEWAY_PORT` | The port `start.ts` listens on. | optional | `8787` | `start.ts` | yes |
| `SEMESTER_GATEWAY_STORE` | `postgres` puts the journal, rate limiter and AI action store in Supabase, and requires `SEMESTER_AUTH_URL` and `SEMESTER_AUTH_SERVICE_KEY`. Any other value keeps the SQLite journal and in-memory limiter. `runtime.ts` is always Postgres-backed. | optional | SQLite | `start.ts` | yes |
| `SEMESTER_INSTITUTION_NAME` | The name the gateway reports. While the sandbox is on, `start.ts` ignores it and uses the sandbox's own name. | optional | `Your university` | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_INTEGRATIONS_READY` | A readiness input: exactly `1` says integrations are healthy. | optional | not ready | `runtime.ts` | yes |
| `SEMESTER_JOURNAL_KEY` | Thirty-two random bytes as 64 hex characters. Encrypts prepared actions and receipts. Losing it loses the record. | yes | none; the process refuses to start | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_JOURNAL_PATH` | The SQLite journal file for `start.ts`. | optional | `work/university/private/actions.sqlite` | `start.ts` | yes |
| `SEMESTER_MINIMUM_ADAPTERS` | The least number of installed institution adapters for readiness. A negative or non-integer value stops the runtime. | optional | `1` | `runtime.ts` | yes |
| `SEMESTER_MONITORING_READY` | A readiness input: exactly `1` says logs, alerts and an owner have been verified. | optional | not ready | `runtime.ts` | yes |
| `SEMESTER_READ_ONLY` | Read-only mode: the value `on` (trimmed, any case) refuses every `POST` except `/actions/reconcile` after authentication, with 503 `read_only`. Read per request, so no restart is needed. Registered in the flag registry. | optional | off | `start.ts` | no |
| `SEMESTER_REQUIRE_AI` | A readiness input: exactly `1` requires production-status AI for the gateway to report ready. | optional | not required | `runtime.ts` | yes |
| `SEMESTER_SANDBOX_INSTITUTION` | Exactly `1` installs demonstration adapters whose output is not real. | optional | off | `start.ts` | no |
| `SEMESTER_SANDBOX_PATH` | The SQLite file for the sandbox's coursework. | optional | `work/university/private/sandbox.sqlite` | `start.ts` | no |
| `SEMESTER_SCIM` | Exactly `on` mounts SCIM at `/scim/v2` in the production runtime. Off, requests under that path go to the gateway like any other. | optional | off | `scim-route.ts` | yes |
| `SEMESTER_SCIM_PUBLIC_URL` | The public HTTPS address identity providers are given. With `SEMESTER_SCIM` on it is required, and the runtime refuses to build without it. | with SCIM on | none | `scim-route.ts` | comment |
| `SEMESTER_SSO_DOMAIN` | The email domain the gateway offers SSO for. SSO stays disabled unless the database holds exactly one authorized SAML provider covering it. | optional | none | `start.ts`, `runtime.ts` | yes |
| `SEMESTER_SSO_LABEL` | The label shown for that SSO option. | optional | none | `start.ts`, `runtime.ts` | yes |

SSO and SCIM readiness are activated in the order in [`docs/INSTITUTIONAL-SSO-LAUNCH-READINESS.md`](../INSTITUTIONAL-SSO-LAUNCH-READINESS.md).

## Integration worker

`app/server/integration` reads no environment variable. The edge function `integration-tick` hands it a service-role client and the adapter registry, and the worker takes everything else from the database. The test scans the directory and fails if that stops being true.

## Flags and kill switches that gate these variables

These are the controls that sit beside the variables above. The registry is [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md); the build-time `VITE_` flags are listed there and in [`SECRETS.md`](../../SECRETS.md), not here.

| Control | Kind | Read by | Effect |
| --- | --- | --- | --- |
| `SEMESTER_READ_ONLY` | environment variable | the gateway, `start.ts` only | Every `POST` except `/actions/reconcile` is refused with 503 `read_only` after authentication. Not read by the production runtime, so the Vercel runtime has no read-only switch in code. |
| `SHARED_AI_PROVIDER` | environment variable | `claude` | Half of the shared-key gate. The other half is the activation record in [`provideractivation.ts`](../../supabase/functions/_shared/provideractivation.ts); checklist in [`SHARED-PROVIDER-ACTIVATION.md`](../trust/SHARED-PROVIDER-ACTIVATION.md). |
| `BILLING_LIVE_ENABLED` | environment variable | `billing-checkout` | Requested-operations half of the checkout gate; a constant in the function holds new checkout off regardless. Context: [`COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md). |
| `kill.ai_generation` | kill switch (`feature_kill_switch` row) | `claude` | An engaged global row answers 503 before the call is counted. A row that cannot be read counts as engaged. |
| `kill.sharing` | kill switch (`feature_kill_switch` row) | the database, for `trust_room_open` | An engaged global row makes the room answer 404 as for any bad token. |
| `kill.integration_sync`, `kill.connection.<public id>` | kill switch (`feature_kill_switch` rows) | the integration worker | The worker refuses to start a run for a school or connection under an engaged switch. |
