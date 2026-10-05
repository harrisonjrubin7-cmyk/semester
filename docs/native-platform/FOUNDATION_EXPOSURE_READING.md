# Foundation exposure reading

**Read** 2026-10-05, read-only, on project `semester` (`lzrqvlugnawcgywkhqlz`) and, for the drift check only, `Semester2` (`kpuulmnicidgdmwgfngv`). **Branch** `feat/native-foundation-identity-policy-trust`.

> **Claim ceiling.** Policy text and privilege bits are schema. Row counts are planner estimates or `count(*)` totals. No row contents were copied. Nothing here turns a module on, revokes a grant, or switches school enforcement. `database/proposed/anon_grant_reduction.sql` stays proposed.

## 1. Security-definer functions

The advisor lists **207** `public` `SECURITY DEFINER` functions executable by `authenticated`. The sorted-name MD5 of that set is `aee41f8c8aaa2e6a20f7f1d44ee46d35`.

`app/src/lib/definerregister.ts` `FUNCTIONS` has the same 207 names and the same MD5. `definerregister.test.ts` already holds each row's named gate to the winning migration body, and holds the set to `supabase/grants.check.sql`. This reading did not find a function to add or revoke.

| Category | Functions | What the register requires |
| --- | ---: | --- |
| admin | 76 | A capability or admin helper, not identity alone |
| self-service | 60 | `auth.uid()` plus ownership |
| read-helper | 28 | Narrow reads |
| sharing | 19 | Consent, scope, expiry |
| moderation | 15 | A capability check |
| integration | 6 | Signed workflow, no browser service role |
| financial | 3 | No client-controlled final state |

Open items already on that register still stand: DR-01 (`kill_switch_engaged` answers for any tenant), DR-02 (gates are structural, not a proof each check is the right one), DR-04 (anon still holds write grants it cannot use through RLS). DR-04's TRUNCATE half is **no longer true** of the 24 owner-scoped tables checked below: `anon` has no `TRUNCATE` on any of them. `INSERT`, `UPDATE`, and `DELETE` remain. The proposed revoke was not applied.

## 2. Anon policies on the 32 GraphQL-visible tables

`anon` holds `SELECT` on all of them. Row outcome follows the policy, because `auth.uid()` is null for `anon`.

| Outcome for anon | Tables | Why |
| --- | --- | --- |
| No row | `appointments`, `blocks`, `calendar_feeds`, `courses`, `notes`, `push_devices`, `push_queue`, `sittings`, `state`, `tasks`, `usage`, `referral_codes`, `referrals` | `auth.uid() = user_id` |
| No row | `family_grants`, `enrollments`, `groups`, `group_members`, `group_tasks`, `messages`, `message_reactions`, `profiles`, `organizations`, `organization_members`, `reports` | Needs a uid, `verified_student()`, membership, or a capability. `organizations` would show a listed row whose `school_id` is null; the table has 0 rows |
| Read the public catalog | `commercial_plans`, `commercial_prices`, `commercial_products` | Explicit `anon` role, `active` (prices also inside their effective window) |
| Read the definitions | `entitlement_definitions`, `plan_entitlements` | `using (true)` for `anon` and `authenticated` |
| Read an open form | `form_publications` | `accepting` and inside `opens`/`closes`, role includes `anon` |
| Read every school | `schools` | `schools_read` is `using (true)`, written in `20260921170000_schools.sql` so the picker works before sign-in. Writes require `private.is_app_admin()` |

`published_forms` was on the advisor list and is not a table in `public`.

Write grants that remain for `anon`, all with RLS in front: `INSERT`+`UPDATE`+`DELETE` on the owner-scoped tables listed in the first two outcome rows except `organizations` and `profiles` (`DELETE` only) and `reports` (`INSERT`+`DELETE`). A policy that requires `auth.uid()` does not let those grants create a row. They are still broader than the app needs. Closing them is the proposed SQL, which wants owner review and the check suites before it becomes a migration.

## 3. F-01, re-tested

| Fact | Measured |
| --- | --- |
| Schools on `lzrqvlugnawcgywkhqlz` | 0 |
| Schools with `enforce_membership` | 0 |
| Column default | `false`, `20260930185000_school_membership_enforcement.sql` |
| What the switch covers | Course rooms whose key names the school. Not the rest of the schema |
| Who may turn it on | `set_school_enforcement`, after `school_enforcement_readiness` reports how many people would be locked out and the caller passes that count |
| Suite | `supabase/school-membership.check.sql`, `supabase/tenancy.check.sql` |

**Compensating control, not a flip.** There is no school row to isolate. Turning the default to `true` would not create isolation for tables the switch does not cover, and the migration states why the default is false: a claim requirement with no claims empties rooms. The control that must stay is the acknowledgement gate. `app/src/lib/nativefoundation.test.ts` fails if the default stops being false or the acknowledgement parameter disappears. A pilot that inserts a school is still blocked by F-01 until that school is switched on through `set_school_enforcement`, or until the pilot stores no school rows.

Isolation of grades, registration, family, and finance is **not** this switch. Those commands stay capability-gated and unsafe to activate for a tenant.

## 4. Semester2 is a different database

`kpuulmnicidgdmwgfngv`: 19 public tables, RLS on; 2 private tables, RLS **off**.

| Private table | Client `SELECT` / `INSERT` | Estimated rows |
| --- | --- | --- |
| `campus_rate_buckets` | neither `anon` nor `authenticated` | 0 |
| `campus_moderation_audit` | neither | 2 |

Neither name exists in this repository's migrations. Client roles have no table privilege, which is why the missing RLS has not been shown to leak. Enabling RLS there would be defense in depth on a schema this repo does not own. It was not applied.

Public names there (`campus_*`, `connections`, `profiles`, `state`, …) are not the 321-table canonical schema. The live-domain split recorded in `docs/master/SEMESTER_SOURCE_OF_TRUTH.md` is still open.

## 5. Module flags

`app/src/lib/flags.ts` sets `defaultEnabled: false` on every flag. `flags.test.ts` fails if one is on. High-risk flags that cover this branch's list:

| Flag | Default | What it gates |
| --- | --- | --- |
| `module.dining` | off | Dining orders. The functions also refuse without a live partner |
| `writeback.registration_submit` | off | Enrol, drop, withdraw in Semester's ledger. The SIS adapter is not built |
| `integration.sis_read` and the registration hold scope | off | Official windows and holds |
| `integration.erp_bursar_actions` | off | A link only. No amounts |

There is no separate `module.gradebook`, `module.family`, or `module.community` flag. Adding three new flags would be a second switch beside `tenant_module_mode` and the capability checks. Not added. Community, family, and gradebook stay unsafe to activate by the capability and RLS rules, not by a new flag.

## What this reading does not do

- It does not revoke anon DML. That stays in `database/proposed/anon_grant_reduction.sql` until the owner reviews it. The file's TRUNCATE premise is stale; the DML grants are not.
- It does not switch `enforce_membership` on.
- It does not mark any domain ready for a pilot.
