# Verified static source findings
1. Outer title is Semester — Capability registry. The apparent empty text reader was a packaging limitation, not evidence that the attachment contains no source.
2. Bundler manifest embeds 14 assets: one SVG, six WOFF2 fonts and seven JavaScript assets. This source package preserves their decoded bytes and hashes.
3. Registry has 122 capabilities across eight workspace families. Data catalog contains 235 tables and 127 function entries with 120 unique qualified names; seven names repeat and must be reconciled using signature and migration lineage, not blindly deduplicated.
4. There are 24 distinct migration labels across reference entries. Labels do not prove migrations were applied.
5. Metadata exposes 75 design components. Separate original source files are not automatically recoverable merely from their declared paths.
6. All 122 design references resolve through the local KIT_ENTRY dictionary, but that only proves a declared target filename. It does not prove the target page is embedded, available, implemented or deployed.
7. The only unique table-reference mismatch is auth.users, a source-assumed external Auth table.
8. 58 unique command names referenced by capabilities do not exactly match the function-name catalog. Some may be application functions, workers or provider adapters; classify against actual repository code before treating them as build gaps.
9. The source explicitly sets implemented/tested/deployed false because repository/deployment evidence is needed. This package records unknown for current external maturity: source false flags do not prove absence in the live repository.
10. shared.events.outbox references outbox.publish; the original command-row heuristic accepts a dotted non-api name without an exact catalog match. A displayed exists marker must not become backend evidence.

## Reconciliation authority
Live repository types inspected 2026-10-13: packages/platform-control/types.ts, blob db17565d12234a3273618f9a7e71a348fbbdfb1e. Canonical stages: designed, schema, policies, api, user_interface, e2e_tested, staged, production_ready, tenant_activated, monitored. Required mappings include risk, data classification, owner, role access and evidence. The HTML cannot supply trustworthy role grants or these missing approvals.
