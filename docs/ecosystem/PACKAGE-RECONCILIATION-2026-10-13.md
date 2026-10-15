# Semester ecosystem: package reconciliation (2026-10-13)

Source: `Semester-entire-implementation-package.zip` (refreshed export, 2026-10-13, SHA-256 `636242fead2dbe74cbb94503453b6f9ae53b056d078e9a9a5237f8df5b0b67b4`), read from `implementation/registry.json`, `implementation/CATALOG-RECONCILIATION.csv`, `implementation/MATURITY-REGISTER.csv` and `implementation/EXECUTION-HANDOFF.md`. The ZIP itself is not committed; the hash identifies the export. Repository side: `app/src/data/ecosystem/capabilities.json` (generated 2026-10-06 from `ui_kits/capability-registry/registry.js`).

**Status columns are archive-only.** The `archive_*` columns in the CSV copy the `status` booleans in `app/src/data/ecosystem/capabilities.json`, which is the checked-in copy of the archive registry. They describe the archive model, not this repository's implementation. The current-evidence reconciliation, [`docs/design-system/REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md`](../design-system/REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md), is the source for repository status. In the CSV, `backend` is `unknown` where the source is `null`, not `false`.

Per-capability matrix: [`capability-coverage-2026-10-13.csv`](capability-coverage-2026-10-13.csv) (122 rows).

## What matches

- All 122 capability ids in the package exist in the repository registry. No id is missing on either side.
- The package and the repository agree on 151 commands and 307 records in total.

## What differs

- All 122 entries differ in schema. The package adds acceptance criteria, `activation`, and a six-fact `maturity` block. The repository uses `status`, `perms` and `ws`, and marks commands and records with `exists`.
- Package `maturity`: 732 of 732 facts (122 × six) are `unknown; current evidence required`. Every capability has `activation: disabled`.
- Archive `status` flags in `capabilities.json`: designed 122, data 122, backend 55 true, 15 null, 52 false; implemented, tested and deployed are false for every row. These are archive-only flags. They are not a statement about the repository's implementation state. See the reference reconciliation for row-level repository status.
- Commands: 92 of 151 are marked present in the repository; 51 capabilities have at least one missing command.
- Records: 307 of 307 are marked present (table names only; this does not prove schema or policy).

Both sides describe the ecosystem as specified and partly modelled. Neither package nor archive flags can verify implementation or deployment; use the current-evidence reconciliation for that.

## Per workspace (capabilities)

| Workspace | Capabilities |
|---|---|
| edu | 26 |
| company | 25 |
| inst | 21 |
| ops | 20 |
| shared | 13 |
| public | 10 |
| acct | 4 |
| dev | 3 |

## Not done in this change

- No product code, schema, migration, route, or deployment was changed. The package's own handoff says the next increment begins with reconciliation, not with new features.
- The repository gates (`tsc -b`, lint, tests, build) were not run, because no application code changed.
- Nothing was deployed, pushed to any external service, sent, or written to Supabase.

## Decisions needed before implementation

1. **Authoritative source.** Should the 2026-10-13 package replace `app/src/data/ecosystem/capabilities.json`, or should the repository file stay authoritative and the package be merged field by field? The package states that source namespaces and some workflow mappings need reconciliation, not automatic inheritance.
2. **First vertical slice.** The handoff proposes public inquiry → validated input → approved delivery adapter → durable receipt → CRM queue. Choosing the delivery provider and CRM target is a product and cost decision.
3. **Deployment target.** Name the staging project and approve any Supabase migration before it runs. Production deployment requires explicit approval.
4. **Review.** The package states that accessibility, security and legal review have not been done. Those reviews need named reviewers.

## Next executable step

After decisions 1 and 2 are answered: reconcile the shared identity/membership/audit contract, then build the public inquiry slice with tenant and negative-access tests, a durable receipt, and idempotent submission.
