# Frontend/backend contracts

## Contract rule

The frontend renders server-owned facts. It may format, sort, group, and preserve drafts; it may not infer authority, freshness, permission, capability exposure, connector health, financial completion, or operational readiness.

## Existing boundaries

- `@semester/contract` v1 defines nine academic collections with envelope, timestamps, tombstones, and cross-client shapes.
- `@semester/institution` defines the institution gateway, status, connection, record/action, refusal, identity, provisioning, policy, event, and workflow contracts.
- `app/server/institution` implements a typed gateway with adapters, auth, journaling, rate limits, and Vercel transport.
- Supabase provides tenant/RLS functions, role grants, capability/entitlement data, integrations, support, audit, analytics, commercial, console, retention, and other workflows.

These are useful bounded contracts, not yet one frontend read-model program.

## Universal read envelope

Every data-backed read model should include:

```ts
type Authority = 'student' | 'semester' | 'institution' | 'sis' | 'lms' | 'partner' | 'provider' | 'derived';
type OperationalState =
  | 'loading' | 'empty' | 'connected' | 'syncing' | 'stale' | 'offline'
  | 'permission_denied' | 'unavailable' | 'error' | 'pending_approval'
  | 'draft' | 'verified' | 'archived' | 'deleted';

interface ReadEnvelope<T> {
  schemaVersion: string;
  data: T | null;
  state: OperationalState;
  authority: Authority;
  source: { id: string; label: string; kind: string };
  observedAt: string | null;
  verifiedAt: string | null;
  staleAfter: string | null;
  permission: { canRead: boolean; allowedActions: string[]; reasonCode?: string };
  recovery: { action: string; label: string }[];
  supportReference?: string;
  correlationId: string;
  limitations: string[];
}
```

The exact names may evolve, but absence must be explicit. `null` freshness means unknown, not current.

## Action contract

Consequential actions use prepare→confirm→commit:

1. Client requests a prepared action with target version and idempotency key.
2. Server authorizes tenant, actor, role, purpose, consent, policy, entitlement, maturity, and dependency health.
3. Server returns impact, fields changed, destination, approvals, warnings, expiry, and confirmation requirement.
4. Client confirms; server rechecks every condition.
5. Server returns committed/rejected/unknown, destination receipt, audit ID, and reconciliation state.

No client-only toggle enables a server capability.

## Error taxonomy

Errors must carry a stable code, safe message, retryability, work-preservation instruction, recovery actions, support reference, correlation ID, and whether outcome is known. Distinguish validation, authentication, authorization, policy, entitlement, conflict, rate limit, dependency unavailable, destination rejected, and unknown outcome.

## Read-model ownership

| Read model | Server owner | Consumers |
|---|---|---|
| Session/role/tenant context | identity/authorization | every authenticated shell |
| Capability exposure | capability service | navigation, routes, settings, public availability |
| Provenance/freshness | source/integration service | every data-backed screen |
| Notification state | notification service | inbox, settings, operators |
| Support context | support service | student, institution, console |
| Tenant health | operations aggregation | institution and internal console |
| Company health | business operations aggregation | authorized internal roles only |
| Claim evidence | evidence service | public-site build and console |

## Pagination and caching

- Cursor pagination for mutable ordered collections.
- ETag/version for detail records and prepared actions.
- Tenant and permission scope included in cache keys.
- Sensitive/official records default to no-store unless a written policy allows caching.
- Offline writes carry local status; “queued” never renders as submitted/paid/synced.

## Migration plan

Add adapters around existing academic, institution, Supabase, and local-state contracts. Migrate one journey at a time. Keep current routes and persisted data readable. Only remove legacy status fields after usage is zero and parity tests prove the new envelope.

