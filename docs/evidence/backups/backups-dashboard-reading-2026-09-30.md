# Production backups, read off the dashboard, 2026-09-30

**What this is:** the owner's reading of the Supabase dashboard's Database →
Backups page for the production project `lzrqvlugnawcgywkhqlz`, taken on
30 September 2026 and transcribed here as the owner gave it. Nothing in this
repository could read it: backup settings are dashboard state, which no
database connection can see (`RESTORE.md`).

**What this is not:** a restore. No backup was restored, and nothing was
changed on the project. Point-in-time recovery was not enabled, nothing was
bought and nothing was deployed.

## The reading

| | As read on 2026-09-30 |
| --- | --- |
| Project | `lzrqvlugnawcgywkhqlz` (production) |
| Point-in-time recovery | **Off.** The page offers it only as an add-on |
| Scheduled backups listed | **9**, physical |
| Earliest listed | 23 Sep 2026 12:06:40 UTC |
| Latest listed | 30 Sep 2026 12:08:31 UTC |
| Read by | Harrison Rubin, owner |

## What follows from it, and what does not

- **How far back:** to 23 Sep 2026 12:06:40 UTC, the earliest listed backup.
  That is seven days before the latest one, which matches the seven days the
  Pro tier's documentation gives (`RETENTION.md`). The reading does not show
  when the earliest backup expires.
- **Nine listed across eight calendar dates**, 23 to 30 September, is one more
  than one a day. Which date has two was not recorded, and nothing here
  explains it.
- **Worst-case work lost:** with point-in-time recovery off, the newest point
  a restore can reach is the latest daily backup. Up to a day of every
  student's work is exposed. That follows from the schedule; no restore has
  measured it.
- **Not shown:** whether any listed backup restores, how long a restore
  takes, or whether a restored copy keeps `ensure_rls` and row-level security.
  Only the drill in `RESTORE.md` answers those.

## Still pending

- **Engineering access to production Supabase:** not granted. It is the
  owner's to grant (`docs/LAUNCH-DECISIONS.md` item 10).
- **The production restore drill:** not run. A restore into a disposable
  project, timed, per `RESTORE.md`.
- **Point-in-time recovery:** off. Turning it on is a purchase, and the
  owner's decision.
