# When a school leaves

Full-beta gate G3, decision D-1021. Written 30 Sep 2026. **Built, not used:** the base case migration is present in production; the export-generator migration is repository-only. No school has been offboarded and no offboarding case has been run in production.

A school row is never deleted. `delete from schools` now fails with a message pointing here, for every role including the platform operator's own, because 125 tenant tables reference `schools` with `on delete cascade` and one statement would have silently taken all of them. A school leaves through a **case**, in steps, and every step but the last is undone by one call.

Everything is a function called with a signed-in account (`supabase/migrations/20260930200000_school_offboarding.sql` and `20261026150000_offboarding_export_package.sql`). There is no screen: an offboarding is a rare, contractual event with two named people, and a screen would be a way to do it by accident. The suite that walks the refusals and synthetic export path is `supabase/school-offboarding.check.sql`.

## The steps

| # | Call | Who | Refused unless |
| --- | --- | --- | --- |
| 1 | `propose_offboarding(school, reason, 'school' or 'operator')` | the school's administrator (`tenant:configure`), or a platform operator | you hold that side; one open case per school |
| 2 | `offboarding_preflight(case)` | either side | takes the **dependency inventory**: every public table with a tenant or school column and its row count, members, live grants, live connections, live legal holds. The audit record is left out — it is kept, not returned |
| 3 | `approve_offboarding(case)` | **the other side, and a different person** | the inventory exists. A school-side proposal is approved by an operator; an operator-side proposal by the school's own administrator |
| 4 | `record_offboarding_notice(case, date)` | either side | the date is not in the future. Records that students were told to take their own export; **sends nothing** |
| 5 | `disable_school_access(case)` | operator | the notice is recorded. See below |
| 6 | `generate_offboarding_export(case, idempotency_key)`, `record_generated_offboarding_export(case, generation, delivered_to)`, then `verify_offboarding_export(case)` | generator/recorder and verifier are different operators | generation is operator-only and case-scoped; exact-key replay is actor-bound and byte-identical, while changed tenant data returns a visible refusal and requires a reviewed new key. Delivery binds the immutable generation receipt. Verification still requires current counts for every tenant table. `record_offboarding_export` remains only for a counsel-approved external generator |
| 7 | `archive_school(case, retain_days)` | operator | the export is verified; at least 30 days (default 90) |
| 8 | `authorize_school_purge(case, reason)` | an operator who neither proposed nor approved | archived, the window has run, **no live legal hold**. It records the authorization and **deletes nothing** |

`cancel_offboarding` closes a case at step 1–3 (before anything has been taken). `school_purge_eligibility(case)` answers "why not yet" at any time.

### What disabling access does — and does not

Does: revokes every school-scoped role grant (each remembered); disconnects every integration connection and clears its credential *pointer* (status and pointer remembered; **the secret itself must still be rotated at the provider — that is a person's job**); ends the sessions of the people who held those grants; suspends the school's roll-out record (`tenant_rollout`, restored later with remediation evidence); and, while the case is open, refuses a new grant, a new member and a re-activated connection.

Does not: touch a student's own session or account, delete or edit any record, or change any other school. Students keep their accounts and can export their own data at any time.

## Restoring

`restore_school(case, reason)` — from any of steps 5–7, by an operator **other than the one who disabled access**, with a reason. It gives back exactly the grants and connections in `school_offboarding_undo`, resumes the roll-out to where it stood, and closes the case as `restored`. It refuses after a purge has been authorized. Sessions that were ended stay ended; people sign in again.

## Legal holds and retention

- Archiving keeps everything, so the retention sweeps continue to run on their normal clocks (`RETENTION.md`); offboarding neither speeds nor stops them.
- Generation stores only an immutable receipt (case, operator, time, counts and hashes), not the package rows. The caller is told to use the approved encrypted delivery channel and remove its temporary copy after receipt. The receipt stays with the never-deleted offboarding case and audit evidence.
- A live legal hold on the school (or a platform hold) blocks purge eligibility. Holds are read from `public.legal_holds` (on `main` since #1012): any unreleased hold placed over this school or one of its accounts, and any platform hold, counts. The reader still tolerates the table being absent, and the suite runs against the real table. **Before any purge is authorized, still confirm with counsel that no matter covers this school** — a hold nobody placed protects nothing. Whether a school's departure ends a hold is counsel's decision, not the database's.
- A hold does not silently block portability. Its observed count and preserve-only effect are written into the generated manifest; generation performs no deletion and grants no purge authority.
- The retention window (90 days default, 30 minimum) is a placeholder. Counsel sets the real length, and whether a former school's student work is kept, returned or destroyed (D-124 "no deletion ledger" may be reopened).

## What is not built

- **The purge itself.** Deleting a school's records category by category, with a confirmation per category, does not exist. The trigger on `schools` therefore refuses *every* delete, including after `authorize_school_purge`. Building the purge is a separate piece of work needing its own authorization.
- A delivery job, archive/container format, operator screen, customer receipt workflow and target-environment acceptance. The database now returns a deterministic JSON package with per-table, manifest and package hashes and explicit credential/security/privileged-field exclusions, but does not write, retain, encrypt, transmit or deliver a file. The synchronous preview refuses packages above 100,000 tenant rows and points the operator to a separately reviewed chunked generator; that generator does not yet exist.
- Notifying anyone. Step 4 records that it happened.
- Any screen, and any offboarding from a school-set-up that predates a `tenant_rollout` row (the roll-out step is skipped when there is no row).
- Department-, office- and course-scoped grants inside the school are not revoked; only `school`-scoped ones are. The grant that gives an administrator power over a whole school is school-scoped, so their authority ends; a course instructor's course-scoped grant does not, and reaches only that course's own records.

**Done once, by the author:** a compact rehearsal on a hosted Supabase preview database with synthetic data (`docs/evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md`). It does not replace the rehearsal below by a second person.

## Rehearsal before first use

1. On a Supabase **preview branch**, never production, propose a case for a throwaway school with two administrators.
2. Walk steps 1–7, then `restore_school` as a second operator. Check the grants and connection are back.
3. File the output in `docs/evidence/` with the date and the operators' roles.
4. Only then is G3 MET for a real school, and only for the steps tested.
