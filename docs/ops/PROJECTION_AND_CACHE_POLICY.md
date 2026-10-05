# Projection and cache policy

Policy for Phases 1 to 3. Nothing here exists yet except the outbox tables.

## 1. Ground rules

1. A projection is rebuildable from source tables. If it cannot be, it is not a
   projection; it is a new source of truth and needs its own decision record.
2. No projection is called "live" without a watermark row and a computed
   freshness. No watermark means `unknown`.
3. A failed projection never shows a stale green value. It shows the last value
   with `failed`, both timestamps, and the decisions that must not rest on it.
4. Stale or failed data **disables** high-risk actions and the command RPC
   re-checks the authoritative source anyway (preflight).
5. Projection rows hold sanitized, minimized data only. The projector never
   copies message bodies, names, emails, tokens, raw provider payloads, or
   amounts finer than the read model's banding.

## 2. Freshness classes

| Class | Examples | SLO (proposal) | Stale after | Failed after |
|---|---|---|---|---|
| Decision | approvals, break-glass, kill switch, rollout gate | 30 s | 2 min | 10 min |
| Operational | inbox, support, integration health | 2 min | 10 min | 30 min |
| Management | tenant health, executive, customer 360 | 15 min | 1 h | 6 h |
| Reporting | compliance, trust, revenue | 6 h | 24 h | 72 h |

SLOs are proposals to be confirmed by the founder. Decision-class views read
**source** (authority `source`), not a projection, so their freshness is the
query time.

## 3. Event to invalidation map

Namespaces use `ops:v1:<kind>:<id>:<scope>`. Scope is the caller's scope hash,
**not** a user ID, so two operators with the same scope share a key and nobody
else does.

| Domain event | Invalidates |
|---|---|
| tenant rollout / plan / feature / SSO / integration change | `tenant:{id}`, `rollout:{id}`, `tenant-health:{id}`, `executive` |
| support ticket opened / severity changed | `support`, `tenant-health:{id}`, `inbox`, and `executive` only when severity is material (P0/P1) |
| pilot metric | `pilot:{id}`, `customer:{id}`, `tenant-health:{id}`, `executive` |
| approval requested / decided / executed | `inbox`, `approvals`, target entity, `audit` |
| incident / SLO change | `incident:{id}`, `slo:{service}`, `release`, `executive`, affected `tenant:{id}` |
| compliance / trust change | `compliance:{tenant}:{framework}`, `trust`, `tenant:{id}`, `inbox` |

Rule: an event for tenant A must not invalidate any key that names tenant B.
Tested with an unrelated-tenant case.

## 4. Browser delivery

- The channel carries only: `{namespace, tenantId, customerId, resourceId,
  version, reason, occurredAt}`. No domain rows, no counts, no names.
- **Open question (B-03):** the app has no console realtime today and the only
  published tables are chat. A private, authorized Broadcast channel needs a
  decision on who may subscribe. Until decided, the fallback is polling the
  watermark with a cheap `ops_projection_versions(namespaces[])` RPC every 30 s
  while the view is visible. This is correct and boring, and it leaks nothing.
- On a message the client invalidates only matching query keys, then refetches
  the capability-checked RPC. The message is a hint, never data.

## 5. Browser cache rules

- In-memory query cache only. **Nothing from `ops_*` goes to `localStorage`,
  `sessionStorage`, IndexedDB, the service worker, or the encrypted vault.** The
  vault denies `financial`, `protected_case`, `official_record` and `credential`
  classes already; console data is not added to it. Test: a console session
  leaves all four stores unchanged (extends `console.test.tsx`'s "nothing in
  localStorage").
- Only per-operator preferences (saved views, last tab) persist, through
  `operator_preference`, as today.
- Offline: cached **read-only** view with a visible stale timestamp. Controlled
  actions are disabled. Queueing is allowed only for the low-risk allow-list in
  the permission matrix and only when the RPC accepts an idempotency key.

## 6. Optimistic updates

Snapshot, patch the single authoritative query key, mark `pendingSync`, roll back
on error, reconcile with the server response, then invalidate. Show the
correlation ID on failure. Never applied to approvals, rollout, features, plan,
refund, pricing, integrations, break-glass, offboarding, export/erase, SSO,
permissions, or the kill switch. The UI helper takes an allow-list of action
names and throws on any other.

## 7. Rebuild and parity

- Rebuild = replay `domain_outbox_events` for the projection from event 0, or
  recompute from sources for projections with a source-recompute function.
- Blue/green: build version N+1 into a shadow table, compare to N on a sampled
  and a full diff, require `parity_ok`, then flip the registry pointer in one
  transaction. Keep N until the next successful rebuild.
- Test: full rebuild equals incremental result on a fixture history.

## 8. Retention

The outbox has **no retention sweep today** (`docs/platform/EVENTS-AND-OUTBOX.md`
says so). A sweep is part of Phase 1: published events past a window, receipts
past the same window, dead letters kept until replayed or explicitly purged,
all gated by `legal_holds` the way the audit sweep is. Window is a retention
decision for counsel and the founder; propose 90 days for published events.

## 9. Operability

`ops_projection_dashboard` reports per projection: status, version, lag seconds,
last error class, events behind, dead letters, last rebuild and parity. A
dead-letter or a lag over the failed threshold becomes an inbox item.
