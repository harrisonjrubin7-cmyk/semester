# Semester — Market Readiness Scorecard

The single index of what is true about this repository's readiness for a real
university deployment. Every status below is a claim about code that exists in
this tree, and every `READY` carries the evidence that earned it.

**Audited at:** `8649a63` · 2026-09-22 · corrected six times; read *How this document has been wrong* before trusting a gap

## How to read a status

| Status | Means |
| --- | --- |
| `NOT_STARTED` | No implementation exists. Not a criticism — most of this list is ahead of us. |
| `IN_PROGRESS` | Partial implementation in the tree, not yet usable end to end. |
| `BLOCKED` | Cannot proceed without something external. The blocker is named. |
| `TESTING` | Implemented, under verification, not yet evidenced. |
| `READY` | Implemented, verified, evidence cited. |

A status may never be raised without changing the Evidence column in the same
commit. "It looks done" is not evidence; a passing named test, a measured
figure, or a cited file is.

## Scorecard

| Area | Status | Evidence / gap |
| --- | --- | --- |
| **Product** | `IN_PROGRESS` | 1,330 TS/TSX files, 601 test files, 11,880 tests passing. Breadth is real; institutional readiness is the gap, not features. |
| **Security** | `IN_PROGRESS` | RLS-as-security, 20 policy suites under `supabase/check.sh`. One real finding fixed (#682). Gateway validates tokens over the network and reads roles from `app_metadata`, which no client can write. **A full CSP exists** — `app/index.html`, browser-verified against a control, guarded by `lib/csp.test.ts` both ways round, with `frame-ancestors` and `report-uri` named as unreachable from a meta tag rather than glossed. Gaps: no DB-level admin audit log; header-only protections wait on a host that can set headers. |
| **Privacy** | `IN_PROGRESS` | Stronger than first recorded. `lib/privacy.ts` holds `CLAIMS` — the disclosure written **as data so it can be checked**, with `privacy.test.ts` failing when it drifts from the code. Export (`lib/export.ts`), device erasure (`lib/erase.ts`) and account deletion (`cloud.ts deleteEverything`) all exist. `RETENTION.md` answers per table and names what has no answer. Gap: no field-level classification vocabulary, and no FERPA-facing document a university's counsel could read. |
| **Accessibility** | `IN_PROGRESS` | Real infrastructure: `app/src/a11y/` covers focus, labels, landmarks, modal, motion, dragging, title, type — each with tests. Lint runs a label audit that passes. No WCAG 2.2 AA audit against the critical workflows; no ACR. |
| **Performance** | `IN_PROGRESS` | Corrected — the earlier `NOT_STARTED` was wrong about half of it. Measurements exist and are recorded: `lib/timing.ts` keeps how many times, the last, the slowest and the total per name, shown under **How fast** on the Data screen, with `timing.test.ts` failing on any line that stores or syncs a reading. Driven in Chromium over the four shipped courses: first paint 620–684 ms, worst screen draw 259 ms, catalogue build 0.20 ms (`COMPLETION-PLAN.md` §7.1). Gaps: no SLOs, and the readings are per device and in memory — nothing aggregates them, by design. |
| **Reliability** | `IN_PROGRESS` | `ROLLBACK.md`; gateway journal survives restart and refuses to guess; `/health` reports readiness, 503 when the journal cannot record (#704). On-device snapshots and workspace backup exist (`lib/snapshots.ts`, `lib/workspace-backup.ts`). Gaps: no uptime monitoring, and **no restore of the production database has ever been performed** — see `DISASTER_RECOVERY.md`. |
| **Integrations** | `IN_PROGRESS` | Strongest area. `@semester/institution` defines 37 service areas and a validated transport contract; `app/server/institution/` implements the gateway, adapter registry, two-phase action and journal, with per-area modules and tests. **The adapter registry is deliberately empty** — no real institution is reachable. |
| **Data** | `IN_PROGRESS` | 35 migrations, versioned, above-watermark discipline documented in `MIGRATION-HISTORY.md`. No tested restore, no migration playbook. |
| **AI** | `IN_PROGRESS` | `public.usage` already meters per account per month — `calls`, `input_tokens`, `output_tokens`. Models are configurable per provider. `lib/context.ts` is a single declared boundary for what leaves. Gaps: metering is **per user, not per tenant**, so a university cannot be given a bill or a cap; model choice is a setting rather than routing by task; no source citation on answers. |
| **Administration** | `IN_PROGRESS` | `app_admins` + `private.is_app_admin()`, guarded by `admins.check.sql`, and `app/scripts/grant-admin.ts` is the provisioning route (service key, with its own test). Gap: one global bit — no per-university administrator. A nineteen-role `role_grants` model is in flight (#703). |
| **Observability** | `IN_PROGRESS` | Corrected — the earlier `NOT_STARTED` was wrong. `lib/diagnose.ts` + `Watching.tsx` + `Boundary.tsx` are a consent-based local diagnostic log: ring buffer, trimmed stacks, user content scrubbed, exported by a button. Third-party error reporting is **deliberately refused**, with the reasoning written down. Missing: any signal that reaches an operator. |
| **Support** | `IN_PROGRESS` | Corrected — "no incident process" was wrong. `SECURITY.md` is the incident-response process (what is stored where, what the access log can and cannot tell you, and what an incident note may honestly claim), written in September; `docs/market-readiness/INCIDENT_RESPONSE.md` and `SUPPORT_PLAYBOOK.md` define the tiers and the runbook. Gaps: nothing has exercised either, no monitoring exists to trigger the process, and there is no operator or support address a university could be given. |
| **Implementation** | `NOT_STARTED` | No onboarding, pilot or migration playbook. |
| **Documentation** | `IN_PROGRESS` | Unusually strong internal documentation. `SECURITY.md`, `SECRETS.md`, `RETENTION.md`, `ROLLBACK.md`, `MIGRATION-HISTORY.md`, `docs/UNIVERSITY_CONNECTIONS.md`. Nothing university-facing. |
| **Procurement** | `NOT_STARTED` | No procurement pack, no security questionnaire responses. |

## How this document has been wrong

Six of its claims have been false, in the direction that matters most: it
reported things as **absent that were built**. A scorecard that under-reports
sends a security reviewer looking for work already done, and tells the next
session to build a second copy of it — which is the failure mode this
repository already has, from a different cause.

| Claimed | Actually |
| --- | --- |
| Observability `NOT_STARTED`, "no error monitoring anywhere in the tree" | `lib/diagnose.ts` + `Watching.tsx` + `Boundary.tsx`: a ring buffer, trimmed stacks, user content scrubbed, exported by a button. Third-party reporting **refused on the record**, not omitted |
| "No HTTP security headers" | A full CSP in `app/index.html`, browser-verified against a control, guarded by `lib/csp.test.ts`, with the meta-tag limits named |
| "No export/deletion workflow" | `lib/export.ts`, `lib/erase.ts`, `cloud.ts deleteEverything`, and `CLAIMS` in `lib/privacy.ts` written as data so a test can catch it drifting |
| "No per-tenant cost controls" *(read as: no metering)* | `public.usage` meters calls and tokens per account per month. The real gap is narrower: it is per **user**, not per tenant |
| Performance `NOT_STARTED`, "no measurements recorded" | `lib/timing.ts` records render and build time and the Data screen shows it; `COMPLETION-PLAN.md` §7.1 holds the figures. What is absent is an SLO, not a measurement |
| Support `NOT_STARTED`, "no incident process" | `SECURITY.md` is the process, and `docs/market-readiness/INCIDENT_RESPONSE.md` beside it. Never exercised, and nothing triggers it — which is the row's real content |

### The method that produced them

Each came from grepping a keyword across a few directories and reading silence
as absence. That fails here for three reasons, and all three are properties of
this repository rather than accidents:

1. **The surface names are not the concept names.** Nothing is called
   `telemetry` or `monitoring`; the module is `diagnose`. Nothing is called
   `dataClassification`; the list is `CLAIMS`.
2. **The tree is wider than `app/src`.** `app/server/`, `app/scripts/`,
   `packages/`, `supabase/functions/` each hold things the scorecard is about.
   The first sweep missed the entire institution gateway.
3. **Deliberate refusals read as absences.** The two most misleading rows were
   both cases where this repository *considered* the thing and declined it in
   writing. A grep cannot tell "not built" from "argued against and rejected",
   and the difference is the whole meaning of the row.

### What a gap claim now requires

Before writing that something does not exist: name the file you would expect
it in and show it absent, search the whole tree rather than `app/src`, and
check the adjacent documentation for a refusal. A gap is a claim about the
probe as much as about the code — the same rule `CLAUDE.md` applies to
measurement, applied to auditing.

## Multi-tenancy — the release blocker

The spec calls tenant isolation a release blocker. Its current state deserves
stating precisely, because the half that exists is easy to mistake for the
whole.

**What landed (#664, `ec92abd`, 2026-09-21):**

- `public.schools` — slug id, name, `email_domains[]`
- `profiles.school_id`, intended to be unwritable by the account it describes
  — **the statement it used for that did nothing**; see below
- `public.claim_school(want)` — a definer function that reads the address
  **the server confirmed**, not the one the row claims, and raises
  `insufficient_privilege` rather than failing quietly
- `private.school_of()` and `private.same_school(other)` — null-safe, so two
  students who have claimed nothing are not thereby classmates

**What does not exist:**

- **No policy calls `same_school()`.** The helpers are written and guarded by
  `app/src/lib/schoolclaim.test.ts`, and nothing reads them yet.
- ~~No screen calls `claim_school()`.~~ **Done (#688):**
  `app/src/components/SchoolClaim.tsx`, wired into the Account screen. It reads
  the column back rather than trusting the call's return, and says plainly that
  claiming protects nothing yet.
- **No cross-tenant security test existed.** `app/src/isolation.test.ts` is
  about Vitest worker isolation, not tenants. `supabase/tenancy.check.sql`
  now covers the foundation — 13 checks.

**And the pin did not hold.** Writing that suite found it. `20260921170000`
closed the column with

```sql
revoke update (school_id) on public.profiles from anon, authenticated;
```

which is a no-op against a table-level grant, and Supabase's default privileges
give `anon` and `authenticated` `all on tables`. Measured on the applied schema:

```
tableacl = {… authenticated=arwdDxt/postgres …}   -- w is UPDATE
colacls  = (none)                                 -- nothing was written
has_column_privilege(authenticated, profiles.school_id, UPDATE) = t
```

INSERT was open by the same mechanism, and the client creates this row with an
upsert, so closing UPDATE alone would have moved the hole rather than shut it.
`20260921211500_pin_profile_school.sql` replaces both blanket grants with
explicit column lists. Both halves are proven by revert.

So today a confirmed address of any domain can enter any school's course room.
That is the documented, deliberate state — `20260901000300_classmates_schools.sql`
chose it over refusing every non-Vanderbilt student outright, and said so — but
it is not multi-tenant isolation and must not be described as such.

**The sequence #664 named, which is the one to follow:**

```
schools table lands         ← done (#664), pinned for real (#682)
an admin adds the schools   ← operational: a service-key insert. No UI, and
                              none needed — the decision of which universities
                              and which domains is the blocker, not the tooling
the screen offers the claim ← done (#688)
rooms' members claim        ← waits on the step above
policies tighten to same_school()  ← the actual isolation, still not written
```

Tightening the policy before people can claim would empty every room, which is
exactly the failure the earlier migration was written to end. The order is not
optional.

## What the architecture assumes, and what it is

Worth stating plainly because it governs most of the remaining work: the app
ships as a **static SPA to GitHub Pages** talking directly to Supabase, with a
separate Node gateway (`app/server/institution/`) for institutional actions.

Several readiness items assume a general backend tier that this shape does not
have — HTTP security headers, background jobs, API versioning, a central AI
gateway. The gateway process is where the ones that need a server go, and the
first of them has landed: `/health` now reports readiness rather than a pair of
constants. Each is reachable, but through either the
existing gateway process or host configuration, not by adding middleware to a
server that isn't there. The plan must say which, per item, rather than
assuming a conventional three-tier deployment.

## Control center

Detail lives in `docs/market-readiness/`. This file is the index; those are the
working documents.
