# Security suites on the PR #1028 Supabase preview, 1 October 2026 (T-2)

## Result

**T-2 remains partial. The last completed full run was 67/95 suites passing.**
After the next approved permission repair, the expanded strict catalog suite
passes, but the full hosted fixture rerun is blocked by expired connector
approval requests. The historical 67/95 is not a result for the new grants.
No assertions from failed suites are certified.

The full run used commit `8c46dc3725df86925caa0233b7287de4f00cf47a` from
07:56:33 to 08:12:56 UTC: 64 passed and 31 failed. Three subsequent test-only
fixes were rerun in full and passed: `gradebook`, `grants` and
`scim-gateway`. The table below records that historical result of each suite.

The database is the existing no-data preview `ibprwifagxqvowpanvel` for
`claude/t2-branch-checks`. Production `lzrqvlugnawcgywkhqlz` was not queried or
changed. Preview identity, `with_data: false`, and healthy status were checked
before application.

## Approved repairs and migration record

The first approved repair added authenticated SELECT on profiles and
SELECT/INSERT/UPDATE on calendar_feeds. Profile INSERT/UPDATE remains
column-restricted; school_id, timestamps and ownership were not made writable.

A second, separately approved repair is recorded as
`20261001095206_explicit_current_caller_grants.sql`. It adds exactly 105
table/column privilege atoms in 30 GRANT statements across 19 tables:
- authenticated access used by enrollment, blocking, messages/reactions,
  groups/membership/tasks, course/state sync and push callers
- authenticated family-grant reads/revocation, organization/membership reads,
  report reads/submission and school-list reads
- anon school-list reads
- bounded service-role identity-provider/membership reads, mapping updates,
  and integration-sync-run SELECT/INSERT/UPDATE

The migration's executable SQL exactly matches the approved proposal.
Fresh before/after catalogs establish 105 additions, zero removals and zero
unexpected changes. All 498 RLS policies and table RLS flags are unchanged,
as are function ACLs, default privileges and sequence ACLs. The expanded
catalog suite validates every approved privilege, exact column/CRUD limits,
grant-option denials, RLS/policy presence, profile pins and 32 intentionally
client-inaccessible tables. It failed on missing enrollments SELECT before
this migration and passed afterward at 09:55 UTC.

The earlier integration/direct-API race recorded the first repair twice.
After separate action-time approval, a guarded transaction removed only
redundant history row `20261001073607`, retaining `20261001075450`.
Both complete records were backed up and matched before removal; exactly one
row was removed. Table/column ACLs and every policy were unchanged by that
metadata repair. Restoration of the removed record requires manual repair.

The second repair used only the GitHub integration, with no competing direct
application. It appears exactly once in the preview ledger. The original
142 versions plus the two canonical grant migrations are present: 144 entries.

## Post-repair verification limit

The 95-suite rerun was started after the strict catalog pass. Its first
fixture suite, academic-record, received `Invalid or expired requestState`;
one retry received the same connector error. Neither is a SQL assertion
failure or a completed suite. The batch was stopped rather than counting
them as executed. Read-only cleanup after both attempts found zero auth users,
zero storage objects, and no fixture function/trigger.

The next step is to resume the complete fixture-suite run through an approved,
working connector request. The remaining historical failures below may now
advance to later assertions; they cannot be marked fixed from catalog checks.

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

## Caller correction after the run

Reactions and group joins now request duplicate-ignore insertion rather than
merge-upsert. Their tables intentionally have no UPDATE policy. The real
Supabase request builder sends `resolution=ignore-duplicates` with the same
payloads and conflict keys. Three focused tests pass, including repeated
requests and a real error response; removing the change makes both header
assertions fail. These are request-level tests with intercepted transport,
not an additional hosted-suite pass. The file is registered in the isolated
mock-test project.

The profile save path now uses duplicate-ignore INSERT returning user_id, then
an owner-filtered UPDATE of only handle/about when that insert conflicts.
It no longer requests UPDATE on pinned user_id. A missing row after the second
request is reported as a failed save rather than silently recreating a deleted
profile. The response/error contract and handle normalization are retained.

Real SDK transport tests cover first creation, edits, simulated concurrent
creation, a deleted/refused row, insert/update failures and network failure.
Restoring the old merge-upsert makes six of the thirteen write tests fail;
the corrected file passes all thirteen and the focused related set passes
139 tests. Independent review and type/lint/gateway/build checks pass. These
are request-level controls, not a hosted PostgREST or concurrency certification.
Course/state sync already uses insert/data-only update paths and needed no
source or permission change.

## Preview integration and main divergence

The duplicate-ledger integration blocker was reconciled as described above;
the integration successfully applied the new grant migration. No unrelated
migration was merged into this preview.

The earlier main snapshot `2d67754317a991f47baaa177105c07a7cb30591f`
contains twelve migration files beyond this preview's original snapshot,
including guardian creation and a forward-repair stub. The preview lacks
`schools.edition`. This record is not a K–12 or current-main certification.
CI's merge tree can include newer main changes; that is distinct from running
those migrations on the hosted preview.

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

## Historical whole-suite results before the second grant repair

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

This is not a penetration test. The 28 historical failures need a full rerun;
their later blocks are untested, and this preview has no production data. Normal
PostgreSQL concurrency, full PostgREST caller behavior and all production
deployment properties are separate checks. The profile caller correction is transport-tested; its user_id write pin was
not loosened, and actual hosted conflict behavior still needs the blocked rerun.

The normal local harness could not open a Unix socket in the diagnostic
workspace. Socket-free PostgreSQL 17.11 checked migration SQL and ACL deltas,
including a failing revert control, but that mode bypasses normal RLS and was
not counted as policy verification. The hosted results above are the actual
security-suite evidence.
