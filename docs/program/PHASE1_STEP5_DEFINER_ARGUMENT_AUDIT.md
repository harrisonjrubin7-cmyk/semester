# Phase 1, step 5 — do definers trust a caller-supplied tenant or owner id? (read-only audit, first pass)

**Date:** 2026-10-05 · **Repository:** `origin/main` @ `4b81c24` · **Status:** READ-ONLY, FIRST PASS. No code changed. It states what a script and a reading of the migrations showed. It is not a security assurance, and it does not replace the catalog sweep (`supabase/definer-sweep.check.sql`) or the forged-input tests that step 5 asks for.

## Method (and its limits)

A Python scan of `supabase/migrations/*.sql` (184 files; 642 `create function` bodies parsed by regex), run twice:

1. Definers with an argument named `p_tenant|p_school|p_institution|p_owner|p_user|p_actor|p_student*`: **11**.
2. Definers granted to `authenticated` that take a text or uuid argument and whose body shows none of `auth.uid()`, a membership/role helper, a JWT read, or a `private.`/`app_private.` call: **3**.

Limits: the scan reads migration text, not the production catalog, so later `alter`/`revoke` outside migrations and drift are invisible (E-2 in the scorecard stays open). Argument names outside the patterns, `plpgsql` bodies that gate through a helper the regex does not know, and functions redefined in a later file can be missed. A clean result is a statement about the probe. No control was run against a deliberately weakened function, which step 5's exit criterion requires.

## Result 1 — id-taking definers that are service-role only (8 functions, no finding)

`public.count_call`, `public.add_spend`, `public.productivity_commit`, `private.productivity_commit`, `public.productivity_tx_state`, `public.productivity_get`, `public.productivity_list_tasks`, `public.productivity_list_events`, `public.productivity_changes`.

Each has `revoke all … from public, anon, authenticated` and `grant execute … to service_role` (V: for example `20260921142822_usage_atomic.sql:56-57`, `20261004170000_ai_spend_meter.sql:98-99`, `20261004180000_productivity_reads.sql:220-230`). They trust `p_tenant` / `p_owner` by design, so they are only as safe as the server callers that pass the ids. The productivity caller derives both from verified membership (see `PHASE1_STEP7_TENANT_CONTEXT_TRACE.md` rows 11–12). The other callers (`count_call`, `add_spend`) were not traced here. **Open:** trace their callers.

## Result 2 — three authenticated-callable functions with no caller gate

| Function | Defined in | Kind | What a signed-in user can do | Reading |
| --- | --- | --- | --- | --- |
| `public.kill_switch_engaged(want_switch, want_tenant)` | `20260927170000_integration_control_plane.sql:155-170` | `security definer`, `stable` | Ask whether any switch is engaged for **any** tenant id | Reads `feature_kill_switch` past RLS. The answer is one boolean. Low sensitivity, but it is a cross-tenant read of operational state that nothing ties to the caller's school (V: body and grant; N: whether `feature_kill_switch` has a stricter RLS policy intended to hide it) |
| `public.effective_module_modes(want_tenant)` | `20260930010000_module_mode.sql:193-208` | `security invoker` | Returns `killed` for any tenant through the call above. The mode and frozen columns come from `tenant_module_mode` under the caller's RLS | The same one-boolean leak, via the definer it calls. The mode rows themselves stay behind RLS (V: invoker; N: the RLS policy on `tenant_module_mode` was not read) |
| `public.course_demand(want_term)` | `20260928305000_course_demand_forecasting.sql:245-268` | `security invoker` | Nothing cross-tenant is evident: `course_demand_snapshots` has `revoke all … from anon, authenticated` at `:1124` | Probably returns an error or nothing to `authenticated` (a function-level grant with no table grant). That is a functional question, not an isolation one. **Open:** confirm with a test |

None of the three is shown to expose an education record. The first two should still be decided: either derive the tenant from the caller's membership, or record in the register that platform switch state is meant to be readable by any signed-in user.

## What this changes in the registers

- **PR-04 (`COMPLETION_RISK_REGISTER.md`) / R-006 (`RISK_REGISTER.md`):** the service-role half is narrowed (grants verified; callers partly traced). A small authenticated-callable residue is named above. Severity is not changed by this page.
- **No P0.** Nothing here shows a path to another tenant's records. That is a statement about 3 + 8 functions out of 642 parsed, not about the 510 definers in the register.

## Next, in step 5's own terms

1. Run `supabase/definer-sweep.check.sql` against a catalog and diff its list against these 11 + 3 (closes the migration-text blind spot).
2. Write forged-argument tests for the highest-risk categories (records, finance, grants, export) and show them red against a weakened function, then green.
3. Owner decision on `kill_switch_engaged` and `effective_module_modes` (tenant-scoped or platform-readable). It takes `docs/decisions/D-<PR number>.md` once a PR exists.
4. Trace the callers of `count_call` and `add_spend`.
