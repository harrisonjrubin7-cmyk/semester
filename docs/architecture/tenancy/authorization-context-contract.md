# Server authorization context contract

Status: repository implementation evidence. This page does not prove a live tenant, production configuration, institutional approval, or broad cross-tenant isolation.

## Canonical boundary

`packages/platform/src/tenancy/context.ts` owns the immutable `RequestContext`. A server surface must derive it from a verified identity and untrusted request metadata before policy evaluation or tenant-scoped repository access. A client may supply a tenant hint only as a consistency check; it never selects the tenant.

| Context field | Trusted source | Untrusted input handling |
| --- | --- | --- |
| Person and actor type | Verified token/service credential plus the server membership resolver | Never accepted from URL, body, role claim, or tenant header |
| Tenant and verification method | Active membership, bound service credential, SSO issuer, or LTI deployment | `X-Tenant-Id` must match or the request fails with `tenant_mismatch` |
| Memberships, roles, capabilities | Current server-side identity and grant records | Client role/capability claims are ignored |
| Purpose | Validated request metadata, then checked against the action policy | Missing purpose defaults only for ordinary service delivery; sharing still requires an explicit allowed purpose |
| Correlation and request ids | Correlation is validated or replaced; request id is minted by the host | A client-supplied request id is never echoed as authority |
| Idempotency key | Validated bounded header or domain command id | A malformed key is refused, not silently dropped |

The returned context and its arrays are frozen. Policy, repository scopes, events, audit rows, cache keys, and queue messages must read the tenant and actor from this object rather than re-parsing the request.

## Adoption inventory

| Surface | Producer | Consumer state | Evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| Institution gateway | `app/server/institution/context.ts` after token and membership verification | `AdapterContext.request`; gateway refresh rebuilds it after sensitive identity refresh | `app/server/institution/context.test.ts`, gateway tests | Adapters are still migrating from optional to required context |
| Productivity API | `ProductivityService.context` bridges the verified legacy principal through `buildRequestContext` | All policy decisions, repository scopes, audits, and events use the normalized immutable context | `app/server/productivity/http.test.ts`, `service.test.ts`, `runtime.test.ts` | Remove the legacy principal bridge only after the HTTP authenticator returns `TrustedIdentity` directly |
| Platform command/policy primitives | Callers supply `RequestContext` | Required by policy, command, idempotency, audit, and tenant-scope APIs | `packages/platform/src/tenancy/tenancy.test.ts`, policy and gateway suites | Production adapters remain incremental |
| Supabase browser/RLS paths | JWT plus database membership/policy helpers | Database session context and RLS, not the TypeScript object | PostgreSQL policy suites | Requires the separate table-by-table isolation register and restored-schema evidence |
| Edge functions and older APIs | Surface-specific authentication helpers | Mixed | Existing surface tests | Adopt the same generated contract/envelope without importing Node-only runtime code into Deno functions |

## Abuse cases held by tests

- A signed-in person sends another tenant in `X-Tenant-Id`: deny before a tenant-scoped repository call and write no data event.
- A matching tenant hint: continue, proving the control does not reject all hints.
- A malformed idempotency key: return a bounded `invalid_request`, never execute as a non-idempotent request.
- An unverified tenant: fail at context construction, before a policy can interpret roles or capabilities.
- The same person or record id exists in two tenants: repository scope remains the verified context tenant.
- A shared read has no explicit purpose: deny; the default service-delivery purpose does not widen consent sharing.

## Claim boundary and rollback

This slice normalizes context for two server surfaces and adds negative evidence. It does not activate a provider, change database grants, prove every service query carries a tenant filter, or certify FERPA compliance. Rollback is the code commit; there is no migration, production data change, entitlement change, or capability activation.
