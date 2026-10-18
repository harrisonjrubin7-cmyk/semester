# Architecture — current system and the unified-platform target

Baseline `origin/main` `c029822`. This page is the map. The reasoning lives in
the ADRs in [`docs/architecture/`](architecture/README.md) and in the
source files they point to; this page does not restate either.

## Current system

```
 Browser (React 19 + Vite 8 SPA, hash router, served from GitHub Pages /semester/)
 ├─ localStorage  — the working copy (ADR 0001); keys `semester.*.vN`
 ├─ IndexedDB     — attached files; never synced
 ├─ lib/cloud.ts  — optional sign-in; syncs OWNED_TABLES field-by-field
 └─ publishable Supabase key only (client assumed hostile, ADR 0002)
        │
        ▼
 Supabase Postgres ── RLS is the authorization boundary (ADR 0002)
 │   private.has_capability(), app_roles / role_capabilities / role_grants
 │   schools + profiles.school_id (ADR 0005); expansion tables (#762)
 │   supabase/check.sh → *.check.sql suites against a disposable Postgres
 ├─ Edge functions (ADR 0003): claude (metered AI gateway, ADR 0004),
 │   calendar, canvas, fetchcal, lti, push, _shared
 └─ Institution gateway (app/server/institution, app/api/institution)
     prepare-only adapters: advising, athletics, career, clubs, family,
     housing, money; SSO membership; governed intelligence actions;
     encrypted journal (journal-crypto.ts, postgres-journal.ts)
     shared vocabulary: packages/institution (ActionInput, Receipt, Refusal;
     policy decision point, event envelope and outbox, workflow machines — ADRs 0007–0009)
```

| Concern | Where | ADR |
|---|---|---|
| Framework | React 19, Vite 8, TypeScript 7 (`app/package.json`) | — |
| Routing | `app/src/lib/route.ts` (hash), registry in `app/src/screens.tsx`, navigation in `app/src/lib/nav.ts` | 0006 (search) |
| State | Device-first stores in `app/src/lib/*` + `app/src/state/` | 0001 |
| AuthN | Supabase auth, optional; institution SSO config in `app/server/institution/membership.ts` | 0002 |
| AuthZ | RLS + capabilities; client role gating in `app/src/lib/role.ts` is UX only | 0002 |
| AI | Student's own key, or the `claude` edge-function gateway; `app/src/ai/`, `app/src/intelligence/` | 0004 |
| Feature flags | Env-driven `off / preview / sandbox / production` in `app/src/lib/experience-flags.ts`, `aiflags.ts` | — |
| Design tokens | `app/src/lib/look.ts` (13 grounds, contrast-tested) | — |
| Accessibility guards | `app/src/a11y/*.test.ts`, `scripts/labels.mjs`, `scripts/styles.mjs` | — |

## Target additions (unified platform)

Each addition extends a layer above; nothing replaces one.

| Addition | Layer | Shape | Phase |
|---|---|---|---|
| `SourceLabel` type + `SourceBadge` | Client | The five labels, identical to the DB check on `term_plan_courses.source_label` | 1 |
| Canonical Action (`lib/actions.ts`) | Client, then DB | Pure model: status lifecycle (open, in_progress, blocked, snoozed, completed, dismissed, expired, cancelled), history, priority, source, explanation, primary action with `requiresConfirmation`. Device store first; a `student_actions` table + RLS + check suite only when sync is needed | 1 |
| Advisor agenda (`lib/agenda.ts`) | Client | Built from Path Snapshot + term plan + student questions; export behind preview/confirm | 1 |
| Clarity question | Client + existing `feedback` table | One question, dismissible | 1 |
| Public site (`site/` Vite entry) | Static | Prerendered pages at real paths; shares `look.ts` tokens (D-011) | 2 |
| Membership | Client + later server | Plan UI and placeholders; no billing provider (D-009) | 2 |
| Study Studio | Client + gateway | Extends `study`/`sources`; anchors page/slide/timestamp | 3 |
| Tenancy/flags by tenant·cohort·role | DB | Extend `schools`, `role_grants` scopes; flags table | 5 |
| Integration inbox | Gateway | Durable event inbox, idempotency keys, reconciliation; reuse the journal | 6 |

## Invariants every change must keep

1. The client holds only a publishable key; secrets live in function or
   server environments (`SECRETS.md`).
2. Every new table has RLS on and a `.check.sql` suite that walks a second
   account (ADR 0002). Aggregates keep the n ≥ 10 floor from #762.
3. Any client write to a Supabase table is added to `OWNED_TABLES` in the
   same change, so export and deletion stay complete.
4. Stored device shapes are versioned (`.v1`), and a new shape gets a new key
   rather than mutating an old one (the #762 precedent).
5. Sends, shares, exports, calendar writes and institution-facing writes need
   a preview and explicit confirmation, following the gateway's prepare-only
   pattern.
6. The app stays fully usable signed out (ADR 0001) unless the owner
   reopens that ADR.

## Full-beta target (Milestone 0, 2026-09-30)

Added by the full-beta programme; the plan is in
[FULL-BETA-REQUIREMENTS.md](FULL-BETA-REQUIREMENTS.md) and per-feature status in
[FEATURE-TRUTH-TABLE.md](FEATURE-TRUTH-TABLE.md). It changes nothing above.

Target shape: the same three tiers, with server persistence added only where data is shared,
institutional, billed, consented or file-shaped.

```
 SPA (device-first, ADR 0001) ── Supabase Auth ── Postgres + RLS (tenant_id, has_capability)
        │                             │              ├─ audit_event (common envelope)   [M1]
        │                             │              ├─ record provenance labels        [M2]
        │                             │              ├─ content / search index          [M3]
        │                             │              ├─ study materials + AI history    [M4]
        │                             │              └─ workspace files + share grants  [M5]
        ├─ edge functions: billing-*, claude, lti, lead-intake, …  (each authenticates itself)
        └─ institution gateway (Node/Vercel; SCIM, records, actions) — hosting vs ADR 0003 undecided (C-4)
 Connectors register adapters behind a kill switch; none are registered today (ADAPTERS = []).
```

New invariants for full-beta work, in addition to those above:

7. A record shown from an external or institutional source carries one of the five source labels
   (`institution_verified`, `imported`, `student_entered`, `estimated`, `needs_review`), an owner,
   and a last-review date, or it is not shown as fact.
8. Stripe state changes only from a signature-verified webhook event; the raw body is stored so
   the event can be replayed.
9. Sensitive institutional features default OFF and are enabled per tenant, never by a build flag.
