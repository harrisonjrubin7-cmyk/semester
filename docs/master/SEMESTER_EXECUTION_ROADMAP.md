# Execution roadmap — recommended branch sequence

**As of** 2026-10-05 · **Status** Phase 0 recommendation; nothing started. Each branch is one reviewable change that passes `tsc -b`, `lint`, `check:university`, `test`, `test:shuffle`, `build` and `design-system:check` from `app/`. Before each, run the `CLAUDE.md` main-check for the thing itself.

| # | Branch | Scope | Depends on |
| --- | --- | --- | --- |
| 1 | `audit/semester-master-reconciliation` | this folder (done in session branch) | — |
| 2 | `audit/rpc-exposure` | read the 18 flagged definer functions and anon grants; revoke or fix with a migration test (dev branch first) | 1 |
| 3 | `design/crosswalk-merge` | reconcile with #1304; add the missing TOKEN/COMPONENT/SCREEN/STATE/TRACEABILITY maps as short mappings to existing docs | 1 |
| 4 | `design/component-name-map` | export aliases or documented mapping for the 13 equivalent components; no new component without GOVERNANCE §2 case | 3 |
| 5 | `design/missing-primitives` | TextField, Select, AuthorityBadge, FreshnessBadge, AIResponse/CitationPanel, only where evidence shows the shared ones cannot serve | 4 |
| 6 | `feat/cqrs-projection-foundation` | projection worker, watermark, read-model registry over `domain_outbox_events`; dev branch migration | 2 |
| 7 | `feat/ops-read-models-and-inbox` | `ops_operations_inbox`, `ops_tenant_overview`, `ops_projection_dashboard` with capability checks and freshness | 6 |
| 8 | `design/ops-console-p1` | Tenant directory/360, Pilot, Integration ops tabs on 7 | 7 |
| 9 | `feat/ops-incident-slo-access-review` | incident, SLO, access-review contracts | 7 |
| 10 | `feat/public-company-site-and-trust` | Registration Readiness Pilot and Security pages; verify lead consent/suppression | 1 |

Student P0 screens (Today, Action Center, Path, Plan, Registration, Course, Ask, Support, Privacy) already exist; they are migration targets for the design system, sequenced after 4–5.

Production database changes, deployments, billing and external publishing need the owner's explicit confirmation at each step and are not part of any branch above.

## Reconciliation with the repo's own stream plan (added 2026-10-06)

The repo already carries an execution program: `docs/handoff/execute/00-INDEX.md` and streams 00–13, with reports under `docs/execute/` for streams 00 and 01 (decision `D-1287`). The branch table above is therefore **not a second program**; each row maps onto a stream, and the stream's own rules win (audit before writing, one PR per stream, `design-system:check` passes, a human approves the merge).

| This roadmap | Stream | Note |
| --- | --- | --- |
| 2 `audit/rpc-exposure` | 01 platform core, 09 trust and security | Stream 01 slice 2 already probes student-data reads across 64 tables (`D-1298`); the definer-function audit is complementary |
| 3–5 design mapping and primitives | 00 setup, 12 one place | Open draft PR #1304 holds a handoff-to-repo crosswalk; its counts (589 screens: 260 / 272 / 57; 319 steps: 116 / 128 / 75) agree with `SEMESTER_GAP_REGISTER.md`. It was not merged or edited here |
| 6–7 projection foundation, ops read models | 08 ops command center | Stream 08 requires "business data only" and a test that every `/ops` query fails against student tables; add that test before any `ops_*` contract |
| 8–9 console tabs, incident/SLO/access review | 08 | Same stream |
| 10 company site and trust | 11 company site, 09 | — |

Decisions that bound this roadmap (`D-1287` §4, decided 2026-10-05, reopenable by the founder):

- **Marketplace** is not revived.
- **Company roles** (`ceo`, `cfo`, `comms`, `social`, `people`, `data`) are not added; stream 08 adds what `/ops` needs as capabilities on the existing role model, never as a text `role` column. The PDFs' investor, employer and partner portals and the Finance/People/Board console areas are therefore **not scheduled** here.
- Per-field profile visibility and a campus directory, and a campus events table, are not built.
- The handoff's migrations `010`–`080` are reference only and are not applied.

Count note: `SEMESTER_MASTER_CURRENT_STATE.md` lists the live `public` schema (about 230 tables); `D-1287` cites 353 tables across all schemas. The two were not reconciled.
