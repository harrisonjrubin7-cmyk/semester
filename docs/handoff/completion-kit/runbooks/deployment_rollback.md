# Deployment, activation and rollback runbook — proposed

No step below was executed. Resolve target IDs, named operators, approved thresholds and exact commands before activation. Existing repository ROLLBACK.md describes GitHub Pages and separately deployed Edge Functions; do not assume Vercel is the canonical host. Preserve the existing governance evaluator rather than replacing it with this kit.

## Release identity
Record commit SHA, build digest, hosting provider/project/deployment, DB project/region, schema fingerprint, migration set/checksums, functions and workers/version, build-time environment fingerprint (no values), runtime policy/config version, flag version, tenant/cohort/allowed operations, approvers, evidence expiry, predecessor manifest and rollback compatibility.

## Pre-deploy
1. Authorize candidate and target; confirm backups and object copies are restorable.
2. Review every pending migration and automatic deployment path, including Supabase Branching. A source merge can have external side effects even when repo workflows contain no migration command.
3. Expand schema additively; rehearse against production-like authorized data.
4. Test old app/functions/workers with expanded schema and new app against compatible schema. Freeze incompatible contract changes.
5. Keep new flags off. Deploy dark; execute read-only and authorized-write smoke tests in approved target.
6. Verify direct API/worker denial, telemetry, alert receiver, primary and backup.
7. Approve tenant/cohort activation only after evidence matches manifest.

## Rollout
Synthetic/staging -> named operators -> approved small cohort -> approved broader cohort. Advancement uses accepted observations and thresholds, not illustrative percentages. No unapproved official writes. Freeze/hold on missing evidence.

## Stop triggers
Any tenant leak, unauthorized official/financial action, identity disclosure or data corruption: stop impacted operations and incident response immediately. Also stop for failed reconciliation, missing alerts/coverage, revoked approval, excessive accepted error budget, schema drift or AI bypass. Operational numerical thresholds must be approved and populated; blank thresholds block activation.

## Rollback order
1. Declare incident and scope; retain exact release/policy versions and safe audit.
2. Engage server-enforced tenant/operation kill first; global only where incident requires it. Verify direct API and queued dispatch denial. Do not disable the authorized refund/cancellation repair path indiscriminately.
3. Pause affected producers/consumers; checkpoint pending/in-flight transaction IDs. Quarantine uncertain outcomes. Do not delete outbox/DLQ evidence.
4. Disable affected tenant flag/rollout and invalidate policy caches. An old app must still honor current kill state.
5. If needed, engage both client VITE_READ_ONLY build-time hold and server SEMESTER_READ_ONLY runtime hold, then verify coverage including functions/workers/storage. Source says these have not been production-drilled; reverify.
6. Restore known-good compatible page/app, functions and workers independently. A page rollback does not restore database, functions, external source records or object bytes.
7. Reconcile source outcomes before any replay. Preserve committed official writes; correction or compensation requires fresh domain authority.
8. Prefer forward schema repair. Database recovery is a separate incident procedure: isolate restoration, restore matched objects, verify checksums/access/revocation state, reconcile post-backup changes, and obtain authority before production cutover. Do not lose new legitimate writes by blindly restoring a snapshot.
9. Verify content/session/service-worker cache behavior and client-version compatibility; do not wipe personal drafts.
10. Run regression/smoke/negative/privacy tests; confirm support communications and reconciliation.
11. Re-enable only through new scope-bound acceptance. Record measured detection, kill propagation, restore, RTO/RPO and remaining uncertainty.

## Host branches
GitHub Pages: existing pages.yml workflow on approved prior ref; verify actual page and service worker. Edge Functions: existing functions.yml on approved prior ref, independently.
Vercel, if proven target: select known-good deployment and verified rollback operation; environment changes apply to new deployments, not previous builds. Revalidate function/DB/config dependencies separately.
Supabase: inspect actual migration ledger/branch settings; schema is not reverted by app rollback. Storage metadata backups do not contain stored file bytes.

## Required drill assertions
Unknown flag denied; missing target denied; stale/withdrawn/cross-target receipt denied; global and tenant kills take precedence; role/cohort/scope restrictions persist; direct and queued operations stop; in-flight outcomes reconcile; refunds remain authorized; no identity disclosure; old app remains compatible; object restore matches checksums; restored old permissions do not reinstate revoked access.
