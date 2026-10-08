# RPC exposure classification — read-only, live project

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Project** `lzrqvlug…` · **Status** Phase 0 evidence; closes gap #2 in [`SEMESTER_GAP_AND_STATUS_REGISTER.md`](SEMESTER_GAP_AND_STATUS_REGISTER.md), which listed these as leads because "grants and function bodies were not read".

> **Claim ceiling.** Catalog `SELECT`s only (`pg_proc`, `has_function_privilege`, `pg_get_functiondef`); nothing was written and no migration applied. A body that *contains* a gate is not proof the gate is *correct*; this page reads for presence and for the helper it calls, not for logic errors. Not a penetration test, not a security certification.

## What was measured

| Measure (public schema, `SECURITY DEFINER`, functions only) | Count |
| --- | ---: |
| Definer functions | 279 |
| Executable by `anon` | **0** |
| Executable by `authenticated` | 207 (matches the advisor) |
| …with no `auth.uid()` / `auth.jwt()` / capability / role / `assert_` / `require_` / `raise exception` in the body (heuristic) | 4 |
| Without a pinned `search_path` | **0** |

The heuristic is a regular expression over `prosrc`, so a gate hidden behind a helper with an unusual name reads as "no visible check". That is why the 4 were then read by hand.

## The 7 sensitive RPCs sampled

| RPC | How it authorizes in-body | Read as |
| --- | --- | --- |
| `console_act(want_request, want_correlation)` | `auth.uid()`; loads `approval_request` and `console_duty`; raises on mismatch | gated |
| `decide_approval(want_request, want_decision)` | `auth.uid()`; duty and party checks; raises | gated |
| `request_approval(want_duty, want_tenant, …)` | `auth.uid()`; duty lookup; raises | gated |
| `trust_room_grant(want_request, …)` | opens with a `private.has_…` capability test; raises | gated |
| `approve_offboarding(want)` | null `auth.uid()` raises `42501`; capability gate | gated |
| `authorize_school_purge(want, why)` | `private.offboarding_operator()` = signed in **and** `private.is_app_admin()`, else `42501` | gated (platform operator only) |
| `registrar_grant_override(...)` | `private.registration_registrar()` = `private.has_capability('registration:administer','school',school)`, else `insufficient_privilege` | gated (the heuristic missed it: the gate is in the helper) |

## The 4 with no in-body gate

| RPC | What it returns | Scope comes from | Read as |
| --- | --- | --- | --- |
| `my_beta()` | caller's beta program, cohort, flags | `private.beta_my_membership()` (caller's own row) | self-scoped |
| `beta_known_issues_for_me()` | published known issues for the caller's cohort | same helper | self-scoped |
| `community_session_counts(want_community)` | session ids and participant counts | `private.community_role(want_community) is not null` | membership-scoped |
| `kill_switch_engaged(want_switch, want_tenant)` | boolean | **none**: any signed-in user can probe any switch key and any tenant id | **lead** (below) |

## Live set against the repo allowlist (2026-10-05)

`supabase/grants.check.sql` is a whole-schema allowlist: every function in `public` a client can call must be named there with a written reason. It is the control this page should have started from.

| Comparison (by function name, extension functions excluded) | Result |
| --- | --- |
| Callable by `authenticated` on the live project, not in the allowlist | **0** |
| In the allowlist (220 names), absent from the live `public` schema | **0** |

Limits: matched on name, so an overload that differs only in its arguments would not show; the allowlist proves the surface is the one the repo decided, not that each body is correct. D-1306 says the matching change for `anon` is not yet applied to production, so `anon` was checked separately above (0 executable definer functions) and not through this allowlist.

## Findings

| # | Finding | Severity (judged) | Next action |
| --- | --- | --- | --- |
| R-1 | No confirmed unauthenticated or cross-tenant access path among the 11 functions read. | — | none |
| R-2 | `kill_switch_engaged(text, text)` lets any authenticated user learn whether a named switch is engaged for an arbitrary tenant id. **Correction (2026-10-05):** this is a documented, deliberate grant. `supabase/grants.check.sql` names it and says it "answers a boolean about a switch key and a school and returns no row". The first version of this page called it a lead without having read that file. What is left is narrow: a user can still probe which switch keys and tenant ids exist. | low; accepted by design | Only if the owner wants the probe closed: restrict `want_tenant` to the caller's own tenants. Needs a migration test on a dev branch first. |
| R-3 | The first pass said 268 of 279 definer bodies were unread. **Narrowed (2026-10-05):** the live set callable by `authenticated` equals the allowlist `supabase/grants.check.sql` enforces, with no drift either way (see below). Bodies are still not read in full. | unknown for bodies; none for reachability | Read the bodies, helper first, if a body-level claim is needed. |
| R-4 | 63 `rls_enabled_no_policy` tables (30 `private`, 33 `public`) remain unverified as reached only through definer RPCs. | unknown | Join the 33 public ones against `pg_policies` and the REST/GraphQL grants. |

Human review items: R-2's fix changes behavior a client may rely on, so engineering decides; none of this is a security sign-off.

## Reproduce

Run read-only from any SQL console on the project; the first measure is:

```sql
select count(*) total_definer,
       count(*) filter (where has_function_privilege('anon', p.oid,'EXECUTE')) anon_exec,
       count(*) filter (where has_function_privilege('authenticated', p.oid,'EXECUTE')) auth_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef;
```
