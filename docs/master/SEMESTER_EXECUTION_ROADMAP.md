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
