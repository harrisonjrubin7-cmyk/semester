# Semester — Market Readiness Scorecard

The single index of what is true about this repository's readiness for a real
university deployment. Every status below is a claim about code that exists in
this tree, and every `READY` carries the evidence that earned it.

**Audited at:** `7abcee4` · 2026-09-21 · revised as work landed

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
| **Security** | `IN_PROGRESS` | RLS-as-security with 18 policy suites, 367 checks, all passing (`supabase/check.sh`). One real finding fixed today — see below. Gateway validates tokens over the network and reads roles from `app_metadata`, which no client can write (`app/server/institution/auth.ts`). No HTTP security headers; no DB-level admin audit log. |
| **Privacy** | `IN_PROGRESS` | `RETENTION.md` exists; `app/src/lib/privacy.test.ts` guards some visibility. No formal data classification, no export/deletion workflow. |
| **Accessibility** | `IN_PROGRESS` | Real infrastructure: `app/src/a11y/` covers focus, labels, landmarks, modal, motion, dragging, title, type — each with tests. Lint runs a label audit that passes. No WCAG 2.2 AA audit against the critical workflows; no ACR. |
| **Performance** | `NOT_STARTED` | No SLOs defined, no measurements recorded. Build is clean and fast; that is not a performance claim. |
| **Reliability** | `IN_PROGRESS` | `ROLLBACK.md` exists. Gateway journal survives restart and refuses to guess (`app/server/institution/journal.ts`), and `/health` now reports whether it can still record — 503 when it cannot. No uptime monitoring, no tested restore. |
| **Integrations** | `IN_PROGRESS` | Strongest area. `@semester/institution` defines 37 service areas and a validated transport contract; `app/server/institution/` implements the gateway, adapter registry, two-phase action and journal, with per-area modules and tests. **The adapter registry is deliberately empty** — no real institution is reachable. |
| **Data** | `IN_PROGRESS` | 35 migrations, versioned, above-watermark discipline documented in `MIGRATION-HISTORY.md`. No tested restore, no migration playbook. |
| **AI** | `IN_PROGRESS` | An AI surface exists (`app/src/lib/claude.ts`, `openai.ts`, `app/src/ai/`, `keygate.ts`). No central AI gateway, no per-tenant cost controls, no model routing abstraction. |
| **Administration** | `IN_PROGRESS` | `app_admins` + `private.is_app_admin()` is a single global admin bit, guarded by `admins.check.sql` (25 checks). No per-university admin, no role model beyond it. |
| **Observability** | `IN_PROGRESS` | Corrected — the earlier `NOT_STARTED` was wrong. `lib/diagnose.ts` + `Watching.tsx` + `Boundary.tsx` are a consent-based local diagnostic log: ring buffer, trimmed stacks, user content scrubbed, exported by a button. Third-party error reporting is **deliberately refused**, with the reasoning written down. Missing: any signal that reaches an operator. |
| **Support** | `NOT_STARTED` | No support playbook, no incident process. |
| **Implementation** | `NOT_STARTED` | No onboarding, pilot or migration playbook. |
| **Documentation** | `IN_PROGRESS` | Unusually strong internal documentation. `SECURITY.md`, `SECRETS.md`, `RETENTION.md`, `ROLLBACK.md`, `MIGRATION-HISTORY.md`, `docs/UNIVERSITY_CONNECTIONS.md`. Nothing university-facing. |
| **Procurement** | `NOT_STARTED` | No procurement pack, no security questionnaire responses. |

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
