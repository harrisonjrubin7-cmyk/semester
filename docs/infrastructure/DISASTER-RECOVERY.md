# Disaster recovery

**Status: targets stated, nothing proven.** [`RESTORE.md`](../../RESTORE.md)
says PITR is "not verified"; this page does not upgrade that.

## Targets (proposed; the first drill replaces them with measurements)

| Asset | RPO | RTO | Mechanism |
| --- | --- | --- | --- |
| Postgres | ≤ 5 min *if* PITR is on; otherwise the daily backup (24 h) | ≤ 1 h to a new project | Supabase backups/PITR → restore into a scratch project |
| Infrastructure definition | 0 | ≤ 1 h to re-stamp an environment | git + versioned state; `terraform apply` on an empty account root |
| Terraform state | 0 (versioned) | ≤ 15 min | object versioning |
| Secrets | — | ≤ 2 h | re-issue per `SECRETS.md` (most are replace-not-recover by design) |
| SPA | 0 | ≤ 5 min | redeploy a commit |

## The state store (a hard requirement, not a preference)

Any S3-protocol bucket that has **versioning, server-side encryption, no public
access, a lifecycle rule that keeps non-current versions ≥ 90 days, native
locking, and a credential scoped to this bucket and nothing else.** State holds
the database password of a created project and every attribute Terraform read.
Losing it makes the repository unable to manage production; leaking it leaks
secrets. It is provisioned once, by hand, and recorded as
`CC-<pr>` with `Kind: standard` and the exact bucket policy — the single
bootstrap step that cannot be Terraform because Terraform needs it first.

## Drill

Quarterly, written up as evidence in `docs/infrastructure/drills/` (create on
first use):

1. Record plan tier, backup retention, PITR on/off (answers R-7).
2. Restore the latest backup to a scratch project; time it.
3. Run `supabase/check.sh` against it; verify the ledger chain.
4. Re-apply deletions made after the backup point (`RESTORE.md`).
5. Rebuild `staging` from nothing with `infra-apply.yml`; time it.
6. Delete the scratch project; record the cost.

A drill that was not timed did not happen.
