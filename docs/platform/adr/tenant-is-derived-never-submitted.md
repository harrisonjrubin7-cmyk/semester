# The tenant is derived from the verified session, never submitted

**Status:** Accepted for the platform package; **not yet adopted by any route**
(MIGRATION phase 1).

## Decision

A tenant enters the platform through exactly one function,
`buildRequestContext(untrusted, trusted, deps)`. The tenant is read **only** from
the `TrustedIdentity` — a verified membership, SSO issuer binding, LTI
deployment or service credential. A client that also sends `X-Tenant-Id` gets
`tenant_mismatch` when it disagrees; a tenant that is not `active` gets
`tenant_suspended`; a missing actor, missing verification, or unknown
verification kind fails closed. The result is frozen. Every layer below takes a
`RequestContext` or a `TenantScope`, never a tenant string.

## Why

The failure this prevents is the quiet one: a handler that reads `body.tenantId`
works in every test written by someone with one tenant. The audit says it in one
line — "tenant resolved from trusted identity/session, never only user-submitted
headers" — and the existing policy decision point already refuses an unverified
tenant (`tenant_unverified`). This makes that the only door, so there is nothing
to remember per route.

A *disagreeing* hint is refused rather than overridden because the only honest
causes are a client bug or an attack, and quietly using the session's tenant hides
both from the person who could fix them.

## What it was chosen over

- **A tenant header the client must send** (as many multi-tenant APIs do):
  rejected — it makes the client the authority for the one fact the server must own.
- **Quietly preferring the session's tenant:** rejected for the reason above.
- **Resolving the tenant inside each repository from ambient state** (a
  thread-local or session variable only): rejected as the *only* mechanism; the
  SQL contract does set `app.tenant_id` per transaction, but the application layer
  must not depend on remembering to.

## How it is held

`packages/platform/src/tenancy/tenancy.test.ts` — hint mismatch refused, a
matching hint accepted (control), every missing piece fails closed, four tenant
statuses refused, context frozen, no echoed request id.
`packages/platform/src/architecture.test.ts` — the SDK never names a tenant
header. `packages/platform/src/isolation/isolation.test.ts` — the `api` case.

## What this constrains

A route that needs a tenant builds a context first. A handler receives a
`TenantScope` and cannot name another tenant. Adding a way to carry a tenant that
is not one of the four verification kinds is a decision, not a parameter.
