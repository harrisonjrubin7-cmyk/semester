# Phase 1 step 1 — restore drill runsheet

- **Status:** `NOT RUN — RUNSHEET ONLY`. No measured RTO or RPO exists; risk R-002 in [`RISK_REGISTER.md`](RISK_REGISTER.md) stays open and Gate 1 stays NO-GO ([`PHASE_GATE_LOG.md`](PHASE_GATE_LOG.md)).
- **Why this file exists:** the drill needs credentials and a destructive write to the second project (Semester2) that only the owner can give. This lists what has to be supplied and what the script cannot answer, so the run is one sitting.
- **Procedure of record:** [`RESTORE.md`](../../RESTORE.md) and [`supabase/restore-drill.sh`](../../supabase/restore-drill.sh). Nothing here replaces them.

## Owner supplies

| Input | Where from |
| --- | --- |
| `SOURCE_DB_URL` | live project `lzrqvlugnawcgywkhqlz`, Dashboard → Connect, direct string (not pooler) |
| `TARGET_DB_URL` | Semester2 `kpuulmnicidgdmwgfngv`, direct string |
| Authorisation to drop `public` and `private` and replace `auth.users` on Semester2 | `DRILL_WIPE_TARGET=kpuulmnicidgdmwgfngv` |
| Backup tier, PITR on/off, retention, oldest restorable point | Dashboard → Database → Backups |
| A witness who is not the person running it | Step 0d; named in the evidence file |
| `pg_dump`, `pg_restore`, `psql` at major 17 or newer | local |

## Run

```bash
SOURCE_DB_URL='…' TARGET_DB_URL='…' DRILL_WIPE_TARGET=kpuulmnicidgdmwgfngv DRILL_CLEANUP=1 \
  supabase/restore-drill.sh
```

Keep the full output. The script is read-only on the source and refuses a target that is the live project.

## What the script answers, and what it does not

| Backlog asks for | Script | Still needed |
| --- | --- | --- |
| RTO | recovery time of a **logical** restore | the physical-backup / PITR restore time is a different number; measure it separately or say it is unmeasured |
| RPO | no | read from Dashboard → Backups; write the figure and its source |
| Schema, policies, fingerprints, `ensure_rls`, RLS enforced | yes | — |
| Row counts per table in `public` and `private` | yes | — |
| Audit integrity | row counts only | compare the audit tables' counts and the newest row's timestamp source vs target by hand; a count match is not chain verification |
| Files | **no** — storage objects are not copied | state that storage was not tested, or test it separately |
| Scheduled jobs (`cron`), Vault secrets, sessions | **no**, by design | state them as not restored |
| App behaviour against the copy | no | one read and one write through the app pointed at Semester2, or say not done |
| Recurrence | no | a dated schedule and an owner |

## Evidence file when it is run

`docs/evidence/restore/<date>-live-drill.md`, registered in `app/src/lib/ops/evidence.ts` and `npm run registers` (as the 0b diagnosis was). It must state: date, who ran it, witness, source ref, target ref, script output, backup tier/PITR/retention, the RTO and RPO each with how it was measured, what was not tested (list above), and that Semester2 was cleared afterwards. Only then update `RESTORE.md`'s result rows, R-002, and the gate log.

## Guard to add with the run

A drill that cannot fail is not known to be one ([`CLAUDE.md`](../../CLAUDE.md)). Before accepting the result, delete a few audit rows in a scratch copy (or on Semester2 after restore) and confirm the row-count comparison goes red; record that control in the evidence file.
