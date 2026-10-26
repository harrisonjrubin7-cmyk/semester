# System Architecture

| Control | Value |
| --- | --- |
| Status | **CONTROLLED CURRENT-STATE ARCHITECTURE — TARGET OPERATION PARTIAL** |
| Owner | Harrison Rubin — company-side architecture and release authority; backup architect and customer technical authority unassigned |
| Evidence date | 2026-10-03 at repository revision `fb6adc7a` |
| Canonical detail | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) and [`../architecture/README.md`](../architecture/README.md) |

## Current system boundary

Semester is a React/TypeScript single-page application built with Vite. It is device-first: browser storage is the working copy and attached files use IndexedDB. Optional accounts use Supabase Auth and synchronized owned tables. Supabase Postgres row-level security is the server authorization boundary; client role checks are user-interface behavior, not authorization.

Server-side functions and the institution gateway handle capabilities that require secrets, provider exchange, governed actions or institutional context. The browser receives only publishable configuration. Integrations, AI routes and institutional capabilities are gated and must fail closed when configuration, authority or provider evidence is absent.

```text
Person and browser
  -> React/Vite application and service worker
     -> device storage and IndexedDB
     -> optional Supabase Auth/Postgres with RLS
     -> scoped edge functions for server-held secrets
     -> institution gateway and adapters, when explicitly configured
External provider or institution
  <- only through an approved adapter, tenant scope and authoritative readback
```

## Trust boundaries and invariants

- Treat the browser, build-time public variables and publishable key as observable and hostile.
- Store server secrets only in approved server/function environments; never under a `VITE_` name.
- Enable RLS and two-account authorization checks for synchronized tables.
- Add every synchronized client table to the owned-data lifecycle so export and deletion remain complete.
- Version device-stored shapes and provide safe migration or a new key.
- Require preview and explicit confirmation for sends, shares, exports and consequential external writes.
- Label source, freshness, authority and AI involvement at the decision point.
- Keep sensitive institutional capabilities off by default and activate them only for an approved tenant/cohort/role scope.
- Preserve a kill switch, rollback path, audit record and official-system fallback for connected actions.

## Deployment surfaces

| Surface | Purpose | Current evidence boundary |
| --- | --- | --- |
| GitHub Pages application | public individual/beta application and static assets | public smoke evidence exists; not institutional acceptance or broad launch approval |
| Supabase project | optional accounts, Postgres/RLS and edge functions | repository policies/tests exist; exact target configuration and provider operations require readback |
| institution gateway | governed tenant/integration routes | implementation and contract tests exist; no named-customer production activation is evidenced |
| local/CI Supabase stack | migration, auth, PostgREST and RLS rehearsal | test environment evidence only |
| demo/preview modes | synthetic evaluation and sales demonstration | must remain visibly non-production and free of live customer data |

## Evidence state

**Code/config evidence.** Architecture decisions, route/state sources, Supabase migrations/checks, gateway packages, feature controls and deployment workflows establish the repository shape and invariants.

**Operational evidence.** A dated public-site smoke exists. Exact production asset inventory, configuration readback, institutional telemetry, target role/isolation acceptance, recovery exercise and provider ownership are incomplete.

**Missing test/proof.** Reconcile deployed revisions and configuration, produce target data-flow and asset records, exercise role/isolation and degraded paths, run monitored rollback/restore and obtain customer technical approval for any institutional boundary.

## Claim ceiling

Semester may describe the repository architecture as a device-first React application with optional Supabase synchronization, server-side functions and a governed institutional gateway. It may cite exact dated tests and public smoke scope.

## Prohibited claims

Do not claim universal tenant isolation, production-scale operation, live institutional integration, guaranteed recovery, complete asset inventory or enterprise architecture approval from repository structure alone.
