# Endpoint manifest

Generated inventory: `endpoint-manifest.json` via `scripts/build_endpoint_manifest.mjs`. Coverage is enforced by `app/src/lib/endpointmanifest.test.ts`.

## HTTP request entry points

| Surface | Caller/authentication | Authorization / tenant source | Service role | Rate/replay posture | Primary tests |
| --- | --- | --- | --- | --- | --- |
| `billing-cancel` | signed-in user JWT | caller-owned subscription via RLS | no | ownership + provider/database record | `billing/cancel.test.ts` |
| `billing-checkout` | signed-in user JWT | validated user passed to `begin_checkout` | yes | checkout journal + provider key | `billing/checkout.test.ts` |
| `billing-webhook` | Stripe signature | verified provider event | yes | timestamp/signature + provider-event uniqueness | `billing/webhook.test.ts` |
| `calendar` | bearer calendar token | token resolves one account | yes | read-only; access log | `calendarserver.test.ts` |
| `canvas` | user JWT + Canvas token | authenticated user; host/path allowlist | yes | bounded read, redirects refused | `canvasproxy.test.ts` |
| `claude` | user JWT or user provider key | account quota/policy | yes | monthly quota | `claudeserver.test.ts` |
| `delete-account` | user JWT | subject derived from token | yes | single subject-bound erasure | `deletion.test.ts` |
| `fetchcal` | user JWT | URL validation | yes | bounded read | `fetchcal.test.ts` |
| `integration-tick` | Vault scheduler token | connection row supplies tenant | yes | durable inbox/event keys | integration tests |
| `lead-intake` | strict production origin | public route allowlist | yes | HMAC-IP sliding limit | `leadintake.test.ts` |
| `lti` | OIDC state/nonce + signed token; JWT for score | issuer/audience/deployment/role/tenant checks | yes | nonce spend, idempotent line items | LTI tests/checks |
| `productivity-sourcecheck` | user JWT | public `.edu` or configured host | no | **shared limit missing; DNS rebinding gap** | dedicated handler test missing |
| `push` | cron bearer secret | scheduler only | yes | bounded oldest-first queue | `pushchain.test.ts` |
| `trust-room` | expiring procurement token | grant-scoped artifact | yes | read-only, one-minute URL | `room-server.test.ts` |
| `/api/institution/[...path]` | user JWT | server-derived actor/tenant + capability | yes | shared limiter, action journal, mutation keys | gateway/transport tests |

## PostgREST and privileged SQL surface

- **216 authenticated RPC signatures.** Membership comes from the allowlist in `supabase/grants.check.sql`, whose schema sweep fails on both unexpected and missing grants. Each signature is an individual object in `endpoint-manifest.json`, with definition evidence and discovered SQL tests.
- **81 explicit service-role operations.** These are parsed from grants in migration history and listed individually. They are privileged operations, not public endpoints; the owning Edge Function, gateway, scheduler, or worker must authenticate and derive tenant/subject before calling them.
- **Direct tables/views/storage.** The database contract is enforced by RLS/grant/storage check suites rather than represented as hundreds of synthetic URLs. `SECURITY-TEST-MATRIX.md` maps actors and adversarial cases. `supabase/grants.check.sql` additionally sweeps writable views, invoker-view status, public function grants, and private-definer grants.

## Regeneration

Run the generator after changing an Edge Function, Vercel route, RPC grant, or service-role operation, then run `vitest run src/lib/endpointmanifest.test.ts`. A generated entry with “function-specific” fields is inventory coverage, not completed human review; fill exact policy metadata as that bounded context is activated.
