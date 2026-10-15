# Logical dump-and-restore rehearsal — 30 September 2026

**What this is:** `supabase/restore.sh` run on the branch `claude/festive-feynman-he763k` after the school-offboarding migration (`20260930200000`) was added, on a throwaway PostgreSQL 17 in a temporary directory. **What it is not:** a restore of the live project's own backups. That drill has never been done (`RESTORE.md`), so release gate G5 stays UNMET.

Run on a sandbox container, one account seeded:

| | |
| --- | --- |
| Schema fingerprints | identical before and after |
| Row counts | identical |
| Seeded contents | identical |
| `ensure_rls` event trigger | survived |
| Row-level security | on for every table (308 tables) |
| Dump | 0.4 s, 2,757,380 bytes |
| Restore | 2.7 s |

Timings are for a database with one account in it and say nothing about production.

Also relevant: the same script runs in CI on every change (`Rehearse a backup and restore`).

**Still owed for G5:** a timed restore of the live project's real backup on a non-production project, by an operator other than the author, filed here.
