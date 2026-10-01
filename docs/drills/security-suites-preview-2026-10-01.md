# Security suites on the PR #1028 Supabase preview, 1 October 2026 (T-2)

## Result

**67 of 95 complete suites pass; 28 fail. T-2 remains partial.** No suite was
skipped. A failed suite stops at its first exception, so its later assertions
are not certified.

The full run used commit `8c46dc3725df86925caa0233b7287de4f00cf47a` from
07:56:33 to 08:12:56 UTC: 64 passed and 31 failed. Three test-only fixes in this
commit were subsequently rerun in full and passed: `gradebook`, `grants` and
`scim-gateway`. The table below is the latest result of each suite.

The database is the existing no-data preview `ibprwifagxqvowpanvel` for
`claude/t2-branch-checks`. Production `lzrqvlugnawcgywkhqlz` was not queried or
changed. Preview identity, `with_data: false`, and healthy status were checked
before application.

## Approved repair and migration record

Only these privileges were added:
- `authenticated`: SELECT on `public.profiles`
- `authenticated`: SELECT, INSERT, UPDATE on `public.calendar_feeds`

Both tables retain RLS. Profile INSERT/UPDATE stays column-restricted;
school_id, timestamps and ownership are not made writable. No new DELETE,
anon, service_role, function, sequence, policy or live default grants were
added. Before/after ACL inspection showed the other roles and profile column
ACLs unchanged.

The GitHub integration and direct migration API raced. The same idempotent
grant was recorded under `20261001073607` and `20261001075450`. Both preview
history entries are retained. The repository file uses the second, already
recorded version, which also sorts after main's then-current ledger watermark
`20261001075026`. This is not a claim that the preview ledger exactly equals
the repository manifest: it contains the earlier duplicate as an extra row.
No history row was edited or removed.

The original 142 migration versions are all present. There are now 144 preview
ledger entries, with those two grant records. Before any future general
`db push` or reset, review this documented history difference through the
supported migration workflow rather than rewriting it silently.

## Method and cleanup

Each entire `.check.sql` file ran in one `execute_sql` call. The local
harness's auth.users grants and adult-by-default fixture were inserted after
the suite's BEGIN and before its assertions, inside the same transaction.
Every file ends ROLLBACK; failed calls were followed by cleanup verification.
The minimum-age suite keeps its existing fixture opt-out.

The new catalog-only `explicit-client-grants` suite used BEGIN READ ONLY and
no fixture. No assertion blocks were omitted; in particular, `activity` now
ran in full, including its previously omitted analytics block.

The connector does not return NOTICE output. A pass means the whole call
completed without an error, not a fabricated assertion count.

After the full run and reruns:
- auth.users: 0 rows
- storage.objects: 0 rows
- fixture trigger and fixture function: absent
- private.grants_check_probe(): absent
- public tables: 307, unchanged
- profiles and calendar_feeds: RLS enabled
- authenticated UPDATE on profiles.school_id: denied

Security advisors remained 54 INFO `rls_enabled_no_policy` and 180 WARN
`authenticated_security_definer_function_executable`, with no ERROR result.
Those notices still require their documented dispositions; absence of an
ERROR is not a security certification.

## Test-only fixes

- `gradebook`: capture the fixture passback ID as postgres, then call the
  existing sender RPC as service_role. No direct queue SELECT grant was added
- `scim-gateway`: inspect fixture/audit effects as postgres while keeping
  actual gateway RPCs under service_role, including after a refusal helper
  resets the role
- `grants`: narrowly recognize Supabase's webhook trigger wrapper by exact
  schema, name, zero arguments, trigger return type and platform owner. The
  hostile private-function control remains. Platform privileges were untouched
- `calendar`: an unauthorized DELETE may be denied by its table privilege
  or affect zero rows through RLS. No DELETE grant was added

Supabase documents the webhook wrapper in its
[database webhook guide](https://supabase.com/docs/guides/database/webhooks).

## Remaining blockers

Several failures are missing intended client/server permissions. Others are
test assumptions: observing internal tables as service_role, legacy positive
schema contracts no current app caller uses, and Storage fixtures that attempt
direct catalog deletion. No blanket grant was used to make them green.

The Storage safeguard was not disabled or bypassed. `community` tries to
delete an object row and `trust-room` a bucket row; hosted Supabase requires
the Storage API. Those fixture paths need a supported redesign with equivalent
coverage.

The earlier drill's 57 tables without any authenticated SELECT were not 57
grant recommendations: 32 are intentionally client-inaccessible. Another 15
tables without table-level SELECT correctly use column grants.

## Latest whole-suite results

| Suite | Result | First error if failed |
| --- | --- | --- |
| `academic-record` | pass |  |
| `access` | pass |  |
| `activity` | pass |  |
| `admins` | pass |  |
| `advisor` | pass |  |
| `audit-and-subject-requests` | pass |  |
| `beta` | pass |  |
| `calendar` | pass |  |
| `canonical-display` | pass |  |
| `capabilities` | pass |  |
| `classmates` | fail | 42501: permission denied for table enrollments |
| `commercial-automation` | fail | 42501: permission denied for table site_leads |
| `commercial` | fail | 42501: permission denied for table billing_accounts |
| `community` | fail | 42501: Direct deletion from storage tables is not allowed. Use the Storage API instead. |
| `connections` | fail | 42501: permission denied for table blocks |
| `console-approvals` | fail | 42501: permission denied for table customer |
| `console-control-plane` | fail | 42501: permission denied for table council_seat_holder |
| `coursestudio` | pass |  |
| `definer-sweep` | pass |  |
| `deletion` | fail | 42501: permission denied for table enrollments |
| `demand` | pass |  |
| `dining` | pass |  |
| `evidence-graphs` | pass |  |
| `expansion` | pass |  |
| `explicit-client-grants` | pass |  |
| `family` | fail | 42501: permission denied for table family_grants |
| `familyinvites` | fail | 42501: permission denied for table family_grants |
| `familyshare` | fail | 42501: permission denied for table family_grants |
| `feature_cohorts` | pass |  |
| `feedback` | pass |  |
| `financial-retention` | pass |  |
| `forms` | pass |  |
| `gateway-journal` | pass |  |
| `governance` | pass |  |
| `gradebook` | pass |  |
| `grants` | pass |  |
| `groups` | fail | 42501: permission denied for table enrollments |
| `gtm` | pass |  |
| `help-requests` | pass |  |
| `hold-aware-sweeps` | pass |  |
| `hold-gated-sweeps` | pass |  |
| `human-overrides` | pass |  |
| `identity-provisioning` | fail | 42501: permission denied for table institution_identity_provider |
| `indexes` | pass |  |
| `institutional-foundation` | fail | 42501: permission denied for table organizations |
| `integration-control-plane` | pass |  |
| `integration-hardening` | fail | 42501: permission denied for table integration_sync_runs |
| `integration-quality` | pass |  |
| `integration-rls-matrix` | pass |  |
| `integration-tick-auth` | pass |  |
| `intelligence-policy` | pass |  |
| `invites` | pass |  |
| `ledger-chains` | pass |  |
| `ledger-seals` | pass |  |
| `legal-holds` | pass |  |
| `listings` | pass |  |
| `lti-capability` | pass |  |
| `lti-integration` | pass |  |
| `lti-membership` | pass |  |
| `lti` | pass |  |
| `ltiags` | pass |  |
| `ltiidentity` | pass |  |
| `mentor-rosters` | pass |  |
| `migration-center` | pass |  |
| `minimum-age` | fail | P0001: FAILED: a minor may still report — expected false, got true |
| `moderation-audit` | fail | 42501: permission denied for table reports |
| `module_mode` | pass |  |
| `my-capabilities` | pass |  |
| `officeactions` | pass |  |
| `organizations` | fail | 42501: permission denied for table organizations |
| `outbox` | pass |  |
| `rate-limits` | pass |  |
| `records` | fail | 42501: permission denied for table notes |
| `referrals` | fail | 42501: permission denied for table referral_codes |
| `registration_transaction` | pass |  |
| `reports` | fail | 42501: permission denied for table reports |
| `retention-sweeps` | pass |  |
| `rls-coverage` | fail | 42501: permission denied for table notes |
| `role-grant-audit` | pass |  |
| `rolegrants` | pass |  |
| `rooms` | fail | 42501: permission denied for table enrollments |
| `schools` | fail | 42501: permission denied for table schools |
| `scim-gateway` | pass |  |
| `space-availability` | pass |  |
| `student-accounts` | pass |  |
| `student-payment-plans` | pass |  |
| `support-access` | pass |  |
| `support-tickets` | pass |  |
| `supportshares` | pass |  |
| `sync` | fail | 42501: permission denied for table state |
| `tenancy` | pass |  |
| `tenant-plan` | fail | 42501: permission denied for table tenant_plan |
| `tenant-rollout` | fail | 42501: permission denied for table tenant_rollout |
| `tenant-sso-policy` | pass |  |
| `trust-room` | fail | 42501: Direct deletion from storage tables is not allowed. Use the Storage API instead. |

## What is not proven

This is not a penetration test. The 28 failed suites remain unresolved, their
later blocks are untested, and this preview has no production data. Normal
PostgreSQL concurrency, full PostgREST caller behavior and all production
deployment properties are separate checks. The profile conflict-upsert path
also needs an explicit caller test; its user_id write pin was not loosened.

The normal local harness could not open a Unix socket in the diagnostic
workspace. Socket-free PostgreSQL 17.11 checked migration SQL and ACL deltas,
including a failing revert control, but that mode bypasses normal RLS and was
not counted as policy verification. The hosted results above are the actual
security-suite evidence.

