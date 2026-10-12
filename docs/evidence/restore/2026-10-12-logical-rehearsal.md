# Logical dump-and-restore rehearsal — 12 October 2026

**What this is:** `supabase/restore.sh` run on the branch `claude/epic-galileo-aq26dg` at the merge of `origin/main` `91cf0ddc` (238 migration files, before this pass added `20261012040000`), on a throwaway PostgreSQL **16** in a temporary directory with `SEMESTER_CHECK_PG_ANY=1`, because the container has no 17 and the live project runs 17.6. **What it is not:** a restore of the live project's own backups, a run on staging (none exists: `docs/infrastructure/ENVIRONMENTS-AND-RELEASE.md`), or a run on production's major. Release gate G5 stays UNMET; Phase 4's "backup restore rehearsal in staging" stays open (`docs/execute/34-phase-4-institutional-operation-report.md`, P4-O2).

Run in the build container, one account seeded:

| | |
| --- | --- |
| Schema fingerprints | identical before and after |
| Row counts | identical |
| Seeded contents | identical |
| `ensure_rls` event trigger | survived |
| Row-level security | on for every table (342 tables) |
| Dump | 0.6 s, 3,679,195 bytes |
| Restore | 7.6 s |
| Whole script, cluster build included | 28.3 s wall |

Against the 30 September run (308 tables, 2,757,380 bytes, restore 2.7 s): 34 more tables and a third more dump; the restore time is the schema being rebuilt, not data, and is on a different machine and major, so the two are not comparable as a trend. Timings are for a database with one account in it and say nothing about production.

The same script runs in CI on every change (`Rehearse a backup and restore`, `.github/workflows/ci.yml`), on 17.

**Read from the live project the same day, read-only:** project `lzrqvlugnawcgywkhqlz`, `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.171, us-west-2, created 3 September 2026; sixteen preview branches exist (one per open pull request, none for this one), two of them `MIGRATIONS_FAILED` (#1464, #1422). The backups endpoint of the management API answered 401 to this session, so the plan tier, backup schedule, retention and PITR state are still **unrecorded** (`RESTORE.md` question 1–3; `DISASTER-RECOVERY.md` drill step 1).

**Still owed for G5 and Phase 4:** a timed restore of the live project's real backup on a non-production project, by an operator other than the author, filed here; the tier, retention and PITR answers read off the dashboard by someone with access; a rollback rehearsed on a staging environment that first has to exist.
