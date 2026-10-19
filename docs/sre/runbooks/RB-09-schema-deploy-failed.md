# RB-09 · Schema deploy failed

Class C1 · role data · alerts `deploy:schema-failed`, `deploy:ledger-drift` · component `pipeline:schema-deploy`.

## Symptom

The `main` branch record in the Supabase dashboard reads `MIGRATIONS_FAILED`, or `migrationorder.test.ts` fails, or production lacks a column the code expects.

## Impact

Production silently stops receiving migrations while the repository stays green. This is the failure that already happened: on 18 September a deploy failed unseen for three days.

## Diagnose

1. Open Dashboard → Branches, the `main` record. It should read as deployed. This takes ten seconds and is the only direct witness.
2. Compare `supabase/ledger.snapshot` with `supabase/migrations`: a migration numbered below the watermark is the usual cause.
3. Read the failing statement in the branch's migration log. Do not retry until you understand it.

## Mitigate

1. Fix forward with a new migration that is idempotent and applies cleanly on the production shape. [ROLLBACK.md](../../../ROLLBACK.md) is the whole history of why.
2. If the failure left production half-migrated, set read-only mode, then repair; restore is the last resort and goes to a new project (RB-12).
3. Never rewrite a baseline migration.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- The `main` record reads as deployed.
- The deploy-against-production-shape rehearsal in CI passes.
- `supabase/ledger.snapshot` is updated with a dated reading.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
