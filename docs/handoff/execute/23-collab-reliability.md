# Stream 23: Collaboration infrastructure, reliability and database operations

Branch `semester/collab-reliability` from `origin/main`. Depends on streams 01 (platform core) and 02 (identity). Read `handoff/BUILD.md` "Read this first" before starting: **the live repo wins every conflict**; extend its authorization core, schema and design system instead of creating parallel ones.

## Inputs
- Prototype files (acceptance reference, not code to ship): `ui_kits/semester-app/OpsReliability.jsx`
- Source specifications (copy to `docs/specifications/source/`): `Yjs Presence Reliability Platform.pdf + SQLite migration runner PDF`
- Screen list with components: `handoff/prototype/SCREEN-INVENTORY.md` (filter Stream = 23)
- Design rules and tokens: `readme.md`, `SKILL.md`, `styles.css`

## Also
- `#/operations/rebuild` (RbxRebuild) and `#/operations/policy` (RbxPolicy) in `ui_kits/semester-app/RebuildPolicy.jsx`: the official 12-step SQLite rebuild with checkpoint-failure rollback and FK tests; hierarchical RBAC with tenant, ownership, moderation-state rules, explicit-deny precedence and fail-closed. Spec: `Build a TypeScript SQLite migration runner with or.pdf`.

- `#/operations/console/alerts` (AlxAlerts) and `#/studio/offline` (AlxOffline) in `AlertsOffline.jsx`: 11 awareness alert conditions across critical/warning/info with Alertmanager receivers, grouping, wait/interval/repeat, same-region inhibition, resolved notices, confirm-before-enable; offline sync state machine NOT_OPENED → LIVE_SYNCED with OFFLINE_EDITING/BACKOFF_WAIT (full-jitter) and AUTH_DENIED → ACCESS_REVOKED → RECOVERY_EXPORT. Spec: `Alert me on Yjs awareness metrics breaches_Automat.pdf`.

- `#/operations/console/pgtap` (PgxSuite, `PgTap.jsx`): 42-assertion pgTAP suite for `semester.housing_allocations` in 13 groups, fault toggles mapped to the assertions they break, temporary-grant proof that RLS (not privileges) blocks writes, not-covered list. Tabs: Suite, RLS matrix (3-part read decision, write default-deny, 7-identity matrix, pooled-login identity caveat), CI/CD (8-step GitHub Actions + Docker pgTAP pipeline with migration-error and failing-assertion paths). Specs: `PostgreSQL test suite_ build a complete pgTAP test.pdf`, `PostgreSQL RLS security matrix_ default-deny CRUD.pdf`. Ties to `handoff/INDEX.md` test `user/housing_allocations_isolation_tests`.

- `#/operations/console/alertpolicy` (ApxPolicy, `AlertPolicy.jsx`): notification policy tree with inheritance, route tester (alertname/service → matched policy, contacts, grouping, timing), 3 inhibition rules (gateway unavailable, Redis cluster down, stale-GC supersedes orphans), maintenance mute timing, 4 contact points, Secret `alertmanager-yjs-notification-secrets` (observability ns) with 5 keys. Spec: `Alertmanager Configuration.pdf`.

- `#/operations/console/yjsdash` (YjxDash) and `#/operations/console/configmonitor` (YjxMonitor) in `YjsOps.jsx`: Grafana panels (sockets, awareness states + orphan gap, Redis memory, TTL p95, fan-out p95, reconnect failures) with cluster/time filters; 15-minute drift monitor over Grafana/Alertmanager/Prometheus/PagerDuty vs Git and Terraform, 5 change types and routes, activation gated on 5 inputs. Policy tree now has a quiet root, a service=semester-yjs branch and team sub-routes (data-platform, collaboration, persistence). pgTAP gains a Pooled writes tab: transaction-bound capability via SET LOCAL, command-only writes, expired/reused/cross-tenant denials. Specs: `Grafana Policy Tree.pdf`, `Alert me when Yjs cluster alerting configurations.pdf`, `Alerting Change Monitor Confirmed.pdf`, `x-rls-pgtap.pdf`.

- `#/operations/console/alertiac` (IaxDelivery, `AlertIaC.jsx`): PagerDuty 4-tier escalation (5/10/15/20 min, repeat twice) with ack simulation; Terraform package layout under `infra/observability/yjs-alerting/`; 6 CI gates (fmt, validate, plan, manual review on update/destroy of protected resources, 2-approver apply, synthetic post-apply alerts); 5-step import procedure (policy tree last). Pipeline tab: 10-stage GitOps flow (fmt/validate → promtool → plan-JSON policy → sandbox integration → PR approval → prod plan → two-person approval → apply → synthetic route verification → config-hash audit) with failure paths, runbook files, local dry-run checklist. Specs: `Delivery Scope.pdf`, `End-to-End Validation Pipeline.pdf`, `Yjs Alerting Validation Pipeline.pdf`, `CI_CD Gate Pipeline.pdf` (adds sandbox PagerDuty escalation tests under a dedicated staging-test role), `Yjs Terraform Governance Pipeline.pdf` (Policy tab: OPA/Conftest change policy with block-by-default deletes and replacements, bounded override metadata, never-allowed unencrypted/public targets; nightly refresh-only drift job), `x-opa-validation.pdf` (Runs tab: per-gate pass rates, run history, conftest fixture output for YJS-DELETE-001 and YJS-ENCRYPTION-001).

## Screens to build (3)

| Route in prototype | Screen | Prototype component |
| --- | --- | --- |
| `#/operations/presence` | Presence reliability | OprPresence (OpsReliability.jsx) |
| `#/operations/migrations` | Migration runner | OprMigrate (OpsReliability.jsx) |
| `#/operations/guards` | Route guards | OprGuards (OpsReliability.jsx) |

## Behaviors to reproduce
Each bullet is the as-built prototype behavior. Implement it against real data and services; where the prototype simulates (timers, toggles, fake servers), build the real mechanism and keep the toggle as a test fixture.

- **Ops reliability (6 Oct):** OpsReliability.jsx (OPR*): #/operations/presence (clients slider, churn convergence over 30 s, 4 injectable leaks → alert rules firing, 8 workloads, restricted pods), migrations (4 ordered versions incl. table rebuild; checksum-tamper and FK-failure toggles → full-batch ROLLBACK; COMMIT log), guards (deny-by-default route matrix per role, unmapped route refused for all). From Yjs Presence Reliability Platform.pdf + SQLite migration runner PDF.

## Tasks
1. Map each screen to the repo’s routing and layout; reuse existing components from the design system bundle before adding new ones.
2. Define or extend the data model and API for every state the screens show. Server-authoritative for permissions, grades, money and enrollment.
3. Enforce authorization on the server for every read and write (deny by default). Add negative tests.
4. Implement empty, loading, error, offline and permission-denied states shown in the prototype.
5. Write unit, integration and accessibility tests for each behavior bullet. Use synthetic data only.
6. Keep copy and labels from the prototype unless the repo’s content guide says otherwise.

## Exit gates
- [ ] Every screen above reachable from navigation for the right roles and absent for others
- [ ] Every behavior bullet covered by a passing test
- [ ] Typecheck, lint, unit, integration and a11y checks pass (`handoff/verify.sh`)
- [ ] No production data, secrets or remote migrations touched
- [ ] Report written to `docs/execute/23-collab-reliability-report.md` with evidence; PR opened; STOP for human review
