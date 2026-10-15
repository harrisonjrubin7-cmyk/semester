# Stream 01 · Anon surface inventory (no behaviour change)

**Date** 2026-10-15 · **Base** origin/main `9b92d67` · **Branch** `semester/platform-core-anon-revoke` · **Scope** what the `anon` role can reach after every migration in `supabase/migrations/` is applied, on Postgres 17 (`supabase/config.toml` `major_version = 17`).

## Verdict

This is an inventory, not a revoke. Nothing in `supabase/`, `app/` or any policy changed. A blanket `revoke ... from anon` was considered and **not** made: several of the grants below are the public surface (published forms, the commercial catalogue, the form-response insert), and removing them would break those pages. Each row needs an owner decision, recorded below, before a migration narrows it.

## How this was measured

A throwaway PostgreSQL 17 cluster was built by `supabase/check.sh`, which applies every migration in order. A probe ran read-only `has_table_privilege` / `has_function_privilege` / `has_schema_privilege` checks as the `anon` role and raised its results as an error message, since the harness reports only failing suites. The probe file was deleted afterwards; the repo has no new files from it.

Reproduce: build the probe below as `supabase/anon-probe.check.sql`, run `supabase/check.sh anon-probe`, and read the `INVTABLES` / `INVFUNCS` text in the output.

```sql
do $$
declare t text; f text; s text;
begin
  select string_agg(c.relname||'='||c.relkind::text||'['||array_to_string(array(select p from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p where has_table_privilege('anon', c.oid, p)), ',')||']', ' ; ' order by c.relname)
    into t from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','v','m','p') and has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE');
  select string_agg(ns.nspname||'.'||p.proname, ' ; ' order by ns.nspname, p.proname)
    into f from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname in ('public','private') and has_function_privilege('anon', p.oid, 'EXECUTE');
  select string_agg(nspname, ',' order by nspname) into s from pg_namespace
    where has_schema_privilege('anon', oid, 'USAGE') and nspname not like 'pg_%' and nspname<>'information_schema';
  raise exception 'INVTABLES % || INVFUNCS % || SCHEMAS %', coalesce(t,'none'), coalesce(f,'none'), coalesce(s,'none');
end $$;
```

(The output above was produced by two separate runs, one for tables and one for functions and schemas, because the harness shows one line of an error.)

## 1. Tables and views the anon role can touch in `public`

| Object | Kind | anon privilege | Status | Owner question |
| --- | --- | --- | --- | --- |
| `commercial_plans` | table | SELECT | Public catalogue (pricing page) | Confirm public. Expected. |
| `commercial_prices` | table | SELECT | Public catalogue | Confirm public. Expected. |
| `commercial_products` | table | SELECT | Public catalogue | Confirm public. Expected. |
| `entitlement_definitions` | table | SELECT | Public plan description | Confirm no tenant or account data. |
| `plan_entitlements` | table | SELECT | Public plan description | Confirm no tenant or account data. |
| `form_publications` | table | SELECT | Published-form index | Confirm it lists published forms only. |
| `published_forms` | view | SELECT | Published forms for public fill-in | Expected. Confirm the view filters on publication state. |
| `form_responses` | table | INSERT | Anonymous form submission | Expected. Confirm no SELECT reaches anon; the insert policy is the only control. |
| `schools` | table | SELECT | School directory | **Open.** Confirm every column is public. A school row may carry contact or identity fields. |

No `UPDATE` or `DELETE` is granted to anon on any `public` object. The probe shows no anon grant on any table in the student-record set listed in `company-roles-student-data.check.sql`; that is a list-level observation, not a row-level proof, and the policies are unchecked here.

## 2. Functions the anon role may execute

`has_function_privilege` returns true for these. PostgREST exposes only `public` by default, so the `private.*` rows matter only where a policy or another function calls them as anon.

**`private.*` (not exposed by the API by default):**

`access_saga_events_guard`, `access_sagas_guard`, `age_cleared`, `classmate`, `community_role`, `form_open`, `group_in_my_class`, `gtm_append_only`, `gtm_attribution_ok`, `gtm_audience_ok`, `gtm_campaign_guard`, `gtm_only_cleared`, `gtm_pilot_guard`, `gtm_placement_guard`, `gtm_prospect_zone_ok`, `gtm_review_guard`, `gtm_send_guard`, `gtm_slug_ok`, `has_capability`, `has_capability_anywhere`, `health_signals_ok`, `holds_role`, `in_class`, `in_cohort`, `in_group`, `in_org`, `is_app_admin`, `mentors`, `opted_into_match`, `org_can`, `room_open`, `room_open_for`, `same_school`, `school_of`, `scope_in_tenant`, `trust_grant_guard`, `trust_request_guard`, `verified_account`, `verified_student`.

Several are trigger guards (`*_guard`, `gtm_*_ok`, `gtm_append_only`). A trigger runs under the role doing the write, so these are candidates for revocation, but only after confirming no policy or grant path evaluates them as anon. The migrations that create these grants have not been traced here.

The authorisation helpers (`has_capability`, `holds_role`, `is_app_admin`, `in_org`, `in_class`, `in_group`, `in_cohort`, `verified_account`, `verified_student`, `same_school`, `school_of`, `scope_in_tenant`, `room_open`, `room_open_for`, `org_can`, `mentors`, `opted_into_match`, `group_in_my_class`, `classmate`, `community_role`, `form_open`, `age_cleared`, `health_signals_ok`) are the ones a policy might call under the anon role. **Do not revoke these** until every policy that touches an anon-visible table has been traced.

**`public.*` (exposed by the API):**

The pgcrypto functions (`armor`, `crypt`, `dearmor`, `decrypt`, `decrypt_iv`, `digest`, `encrypt`, `encrypt_iv`, `gen_random_bytes`, `gen_random_uuid`, `gen_salt`, `hmac`, `pgp_*`). These are the Supabase default for extensions in `public` and carry no tenant data. They are listed for completeness. Revoking them is a defence-in-depth choice, not a fix.

## 3. Schemas the anon role may use

`auth`, `private`, `public`, `realtime`, `storage`.

`auth`, `realtime` and `storage` usage for anon is the Supabase default and is needed by the platform's own clients. `private` usage is what lets anon reach the helpers in section 2; narrowing it is the same decision as narrowing those helpers.

## Decisions needed before any revoke

1. **`schools` (SELECT):** which columns are public? This is the one table in section 1 that could leak identity data without an obvious product reason.
2. **`private.*` helpers executable by anon:** trace every policy on the section 1 tables (and on `form_responses`) and record which helpers it calls under anon. Only then narrow the list.
3. **pgcrypto in `public`:** accept as the platform default, or move the extension to a non-exposed schema.

Until 1 and 2 are answered, no `anon` grant is removed. The next slice is the policy trace for item 2, which needs a decision from the privacy owner on item 1 first.

## Checks run

- `supabase/check.sh anon-probe` on Postgres 17 after all migrations: probe ran and reported the lists above; the probe file was removed.
- No suite was added or changed. No migration was added. No application code changed.
