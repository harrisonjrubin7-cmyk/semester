# Data migration plan

Baseline `origin/main` `c029822`. How the unified-platform work changes stored
data, on the device and in Postgres, without losing anything a student already
has. Phase 0 changes no data. This plan governs Phases 1–6.

## What exists and must survive

| Store | Where | Versioning today | Guard |
|---|---|---|---|
| Main device store | IndexedDB `semester-store` (`app/src/state/persist/`), with `localStorage` `semester.v1` kept as a rollback copy | `lib/migrate.ts` `SCHEMA = 6`, forward-only `STEPS`; a newer payload is left untouched | `persist/shape.test.ts`, `persist/index.test.ts`, `REGRESSION-CHECKLIST.md` §E |
| Device libraries | `semester.<name>.v1[:account][:term]` via `lib/device-library.ts` | Key suffix `.v1`; validator on read; a failed parse refuses writes and offers a recovery download | Per-library tests |
| Registration | `semester.registration.v1`, `semester.registration-day.v1` | Separate keys; #762 added a new key rather than changing the old one's shape | `registration*.test.ts` |
| Degree / scenarios | `semester.graduation.v1`, degree state in the main store | — | `graduation.test.ts`, `degree.test.ts` |
| Files | IndexedDB `semester-files` | Never synced | §E |
| Cloud copy | Supabase `state`, `courses` + feature tables in `OWNED_TABLES` (`lib/cloud.ts:836`) | Field-by-field merge | `lib/privacy.test.ts` |
| Schema | 59 migrations, `supabase/ledger.snapshot`, `schema.snapshot.sql` | Timestamped, forward-only; production applies on merge through Supabase Branching | `migrationorder.test.ts`, `supabase/check.sh`, `supabase/rehearse.sh` |

**Rules inherited, not invented here:**
- `REGRESSION-CHECKLIST.md` §Q: no deleting or renaming routes, storage keys or model fields.
- `ROLLBACK.md`: the schema cannot be rolled back, so every migration must stay readable by the previous app version.

## Planned changes by phase

| Phase | Change | Device | Postgres | Backfill | Rollback |
|---|---|---|---|---|---|
| 1 | Canonical actions | New key `semester.actions.v1:{account}`, holding actions + history. Derived actions (from deadlines, path, registration) are **computed, not stored**; only the student's lifecycle choices (snooze, dismiss, complete, correct) are stored, keyed by a stable derived id | None in Sprint 1 | None: nothing old to convert | Delete the key. Derived actions regenerate |
| 1 | Source labels | A type, no stored change. Existing `TicketSource` values map 1:1 | Already enforced on `term_plan_courses` / `registration_time_tickets` | None | Revert code |
| 1 | Onboarding fields (program, target term, credit target, goals) | New optional fields in a new device library `semester.path-profile.v1:{account}`; `semester.v1` is untouched | Later: `student_context` / `profiles` columns (#762 tables) with a check suite | None; absent means "not entered" | Delete the key |
| 1 | Advisor agenda | `semester.agenda.v1:{account}:{term}` | None until a time-bound share table exists | None | Delete the key |
| 1 | Term plan to cloud (optional, flagged) | Existing `semester.registration.v1` stays the working copy | Write `term_plan_courses` (exists, RLS + `expansion.check.sql`). Add it to `OWNED_TABLES` in the same PR | One-way upsert from the device on first sign-in with the flag on; idempotent on `(user_id, term_code, course_code, section)` | Flag off. Rows stay and are deletable via Delete everything |
| 1 | Clarity answer | Local | Reuse `feedback` (kind `other`, or a new `clarity` kind via a check-constraint migration) | None | Revert. Old app ignores the new kind |
| 2 | Membership | `semester.membership.v1` (display only) | `subscriptions` table only after billing approval (D-009) | — | — |
| 2 | Account erasure (S-2) | — | Server function deletes `auth.users` after owned rows | — | Function disabled; the client path stays |
| 5 | Tenant feature flags | — | Extend `tenant_feature_policy` (exists) with cohort/role scope | Default rows = current env flags | Additive columns only |
| 6 | Integration inbox | — | `integration_events` (event id unique, source version, received/processed at) | — | Additive |

## Procedure for any schema change

1. Write the migration **additively**: new tables and nullable columns. No
   drops or renames in the same release as a code change that stops reading
   them.
2. Same PR: RLS policy, a `.check.sql` suite walking two accounts, a
   `RETENTION.md` entry, `OWNED_TABLES` if the client writes it, and an update
   to `ledger.snapshot` / `schema.snapshot.sql`.
3. Run `supabase/check.sh` and `supabase/rehearse.sh` locally (disposable
   Postgres only).
4. The previous app build must still load against the new schema (the
   `ROLLBACK.md` rule).
5. **Production apply needs owner approval.** Merging to main applies through
   Branching, so that approval is the merge.

## Procedure for any device-shape change

1. New key with a new version suffix. Never mutate an old key's shape.
2. Read the old key if the new one is absent; never delete the old key in the
   same release.
3. Validator on read. On failure show empty, refuse writes, and offer a
   recovery download (the `device-library.ts` pattern).
4. Include the key in the backup format (`lib/export.ts` `semester.backup.v1`,
   `lib/workspace-backup.ts`) and in "Erase from this device".
