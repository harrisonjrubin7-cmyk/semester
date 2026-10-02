# Production physical-backup restore evidence

**Produced:** 2026-10-02
**Owner:** Harrison Rubin
**Source project:** `lzrqvlugnawcgywkhqlz`
**Restored project:** `neykbjfxoxgaxjrprylt` (`semester-restore-drill-2026-10-01`)

This record is a direct reading of the production Supabase backup dashboard,
the completed restore-to-new-project record, and read-only SQL run against the
source and restored projects. It is not a local logical-dump rehearsal.

## Backup and restore observed

- The production Backups page showed completed daily physical backups from
  2026-09-25 through 2026-10-01. The selected backup completed at
  **2026-10-01 12:12:14 UTC**.
- Supabase recorded the restore-to-new-project operation as **COMPLETED** at
  **2026-10-01 16:56:17 UTC**.
- The dashboard did not expose the operation's start timestamp in the view
  available during verification. Therefore this record does **not** invent an
  RTO. The timed-restore release gate remains open until a future exercise
  records both click time and query-ready time.
- The observed daily cadence means the configured backup path can lose up to
  one backup interval. Point-in-time recovery was not established by this
  exercise.

## Read-only verification

Queries were run at 2026-10-02 01:31:08 UTC on the restored project and at
2026-10-02 01:32:22 UTC on production.

| Control | Restored project | Production | Result |
| --- | ---: | ---: | --- |
| Public tables | 317 | 318 | Expected recovery-point drift: production gained one table after the backup |
| Private tables | 29 | 29 | Match |
| Public/private tables without RLS | 0 | 0 | Pass |
| `ensure_rls` event triggers | 1 | 1 | Pass |
| `private.gateway_audit` exists | yes | yes | Pass |
| Gateway audit rows | 0 | 0 | No non-empty row sample existed to compare |
| Gateway intelligence audit rows | 0 | 0 | No non-empty row sample existed to compare |

The physical restore therefore preserved the gateway-journal relation and its
row-level-security guard. Because the production journal contained no rows,
this exercise proves that the journal is included in the backup and restore
path, but it does not demonstrate recovery of a non-empty journal.

## Limits and next exercise

- Storage objects and hosted secrets are outside this database restore and
  were not recovered.
- The restored project was used only for read-only verification. Its cleanup
  is a separate destructive action and is not evidence of restore quality.
- The next drill must record the start time, target RTO, an intentionally
  non-sensitive marker before the backup point, and a non-empty gateway-journal
  fixture. `supabase/gateway-journal-backup-drill.sh` now provides guarded
  `seed` and `verify` phases for that exact fixture: one labelled operational
  audit marker, tied to an explicitly supplied tenant, with no student content.
  It has not yet been run against production or a restored project.
