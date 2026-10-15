# RB-12 · Restore from backup

Class C0 · role data · alerts `recovery:restore-overdue` · components `supabase-db`. The long form is [RESTORE.md](../../../RESTORE.md); this page is the decision and the order.

## Symptom

Rows are gone or corrupted, a migration destroyed data, or a drill is due.

## Impact

Data loss within the recovery point. Provider backup and point-in-time recovery are **not verified**: no provider-backed restore has been timed, so RTO and RPO are unmeasured, and the only restore ever run is a logical rehearsal (`docs/evidence/restore/2026-09-30-logical-rehearsal.md`).

## Diagnose

1. Name what was lost, when, and the last known good time. Without a time there is no recovery point.
2. Read what the project actually has: backup schedule, retention and whether point-in-time recovery is on. Do not assume the plan's marketing.
3. Decide: forward repair (a migration or a targeted fix), selective restore from a new instance, or full restore. Prefer the smallest.
4. Check for legal holds and deletions made after the backup point: a restore must re-apply them and must not resurrect erased data.

## Mitigate

1. Restore **into a new, isolated project**, never over production. Verify markers, row counts, schema fingerprints, RLS, grants, jobs and the critical flows before any cutover.
2. Reconcile the audit, event and journal records; confirm no live integration or notification fired from the restored target.
3. Re-apply the deletions made after the backup point (RESTORE.md, *Re-apply the deletions*).

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`. Restore needs a second person to witness it; today that person does not exist.

## Verify

- Verified markers are present or absent as expected.
- Authorization and RLS invariants pass on the target.
- The elapsed time from declaration to usable service is recorded, and the data-loss interval is recorded separately.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine. File the result under `docs/evidence/restore/` and, if it measured something, fill the class targets in `catalog.ts`.
