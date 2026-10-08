# Repository audit snapshot

## Identity and claim ceiling

| Field | Value |
| --- | --- |
| Repository | `harrisonjrubin7-cmyk/semester` |
| Starting branch point | `origin/main` |
| Starting SHA | `7b7603e105847e4ac62aeba0097e0f6e0600d6d1` |
| Audit date | 2026-10-08 |

This source/configuration audit does not prove a deployed SHA, named-institution approval, provider activation, UAT, legal approval, staffed operation, live restore, or GA readiness.

## Instructions and active work

- Read root `CLAUDE.md`; no applicable `AGENTS.md` was found.
- Reviewed `README.md`, `FEATURE-INVENTORY.md`, `REGRESSION-CHECKLIST.md`, `DESIGN-SYSTEM-GUIDE.md`, `SEMESTER-MASTER-COMMAND.md`, `SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md`, `BETA_EXIT_CRITERIA.md`, `GO-NO-GO-DECISION.md`, `STAGING.md`, `ROLLBACK.md`, and `SECURITY.md`.
- Preserved unrelated active task files and older integration plans.
- Inspected the latest 30 commits. The tip includes access-saga storage, domain-event/outbox writing, policy changes, component registration, and architecture reconciliation. These are foundations, not permission to duplicate them.

## Snapshot source inventory

The following counts describe the recorded starting SHA, not the later pull-request head. The branch subsequently incorporated `origin/main@32dd82410700680a4759174def31d0c5069f01eb`; a fresh inventory and classification pass against the reviewed tree is required before Phase 1.

| Surface | Count |
| --- | ---: |
| Files under `app/src` | 3,012 |
| Non-test screen TSX files | 119 |
| Non-test component TSX files | 394 |
| App source test files | 1,393 |
| Screen registry entries detected | 95 |
| Navigation rows containing `screen:` | 71 |
| Supabase migrations | 203 |
| Supabase policy declarations detected | 547 |
| Edge Function directories excluding `_shared` | 16 |
| GitHub workflow files | 13 |
| Markdown files under `docs` at base `7b7603e105847e4ac62aeba0097e0f6e0600d6d1` | 1,717 |

Counts describe files/declarations, not completed capabilities. One file can expose several routes, and catalog items can be states or outcomes.

## Stack and authorities

- Node `>=22`; root npm workspace with `app` and `packages/*`; React 19.3, TypeScript 7.0, Vite 8.3, Vitest 5.0, Supabase JS 2.117, OpenAI 7.23.
- Design: `look.ts`, `tokens.css`, `tokenexport.ts`, generated tokens, and contract tests.
- Routing: `route.ts`, `screens.tsx`, `nav.ts`, and `navareas.ts`.
- Persistence: `semester-store`, collection/snapshot/draft/file/history/sync stores, and `semester.v1` rollback/migration behavior.
- Server: Supabase migrations, RLS, capabilities, memberships, service-only functions, saga/outbox/read-model work.
- Delivery: CI, CodeQL, supply-chain, HawkScan, contrast/design, docs, drift, functions, infrastructure, Pages, production-smoke, workflow-lab, Vercel, and StackHawk configuration.

Archive concepts do not establish credentials, approval, or activation. AI/provider work still requires data boundaries, permission, consent, failure/fallback, audit, retention, cost, and untrusted-content proof.

## Reused evidence and blockers

`docs/master/REPO_AUDIT.md` supplies row-level evidence for 589 screens and 319 workflow steps at its older base. The new matrix reuses citations conservatively and adds 84 archive screens without promoting the audit into runtime proof.

The prescribed build/test suite and a current production-screen browser baseline remain unrun; archive route inventories are not normalized; external approvals, providers, UAT, and tenant operation remain separate gates. The bundled runtime supplied Node but no npm executable, so no dependency install was performed in this documentation-only phase. Because the repository advanced after the snapshot, this audit must also be refreshed before its classifications are used for implementation planning.
