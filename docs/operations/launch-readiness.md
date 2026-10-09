# Launch readiness baseline

Status: NO-GO for broad GA or a named institutional launch. Repository-ready components may be used only in bounded, truthful pilots after the relevant gates close.

## Eight-test operational bar

Every capability must pass product, data, trust, operations, commercial, adoption, reliability, and measurement checks, plus have named accountable owners and an approved maturity state. UI and repository tests alone are insufficient.

## Current gate summary

| Gate | State | Evidence / blocker |
| --- | --- | --- |
| Student product | Partial | Broad PWA and workflows exist. The original local assessment recorded lint and suite instability; subsequent exact-SHA PR and post-merge CI passed lint, full tests, shuffled tests, build, CodeQL and HawkScan. Product readiness remains partial because capability-level UAT and the other gates below are still open. |
| Data/source | Partial | Provenance contracts and source labels exist; no live provider registry and no universal source map. |
| Trust/security | Partial | Strong RLS/audit/support foundations; PostgreSQL 17 checks not rerun here; independent review absent. |
| Institution integration | Blocked | Zero live adapters registered; no named tenant credentials, mapping, UAT, or sign-off. |
| Guardian/family | Blocked | Local and sandbox workflows; production relationship/projection/revocation evidence absent. |
| Mobile/offline | Partial | Responsive PWA and browser caching; no native SQLCipher or controlled classified offline store. |
| CRDT collaboration | Not implemented | No general CRDT registry, update log, state-vector sync, or compaction service found. |
| Support/operations | Partial | Runbooks and support access exist; staffed queue, SLO performance and escalation evidence are external. |
| Reliability/recovery | Partial | CI/deploy/status/recovery artifacts exist; current live restore and complete synthetic monitoring evidence not established here. |
| Commercial/legal | Blocked | Pricing and contract material is draft/illustrative; counsel and founder approvals required. |
| Accessibility | Partial | Automated and design evidence exists; independent audit and role-specific UAT remain open. |
| Measurement | Partial | Event taxonomies and analytics ethics exist; production baselines and outcome validity are not shown. |

## Risk register

### P0 — stop activation

| Risk | Trigger | Mitigation / exit |
| --- | --- | --- |
| False live/institution-ready claim | Any capability shown as live without tenant approval and current operational evidence | Central claim gate; default planned-but-not-exposed/institution-controlled; approval evidence with expiry. |
| Cross-tenant or raw guardian disclosure | Any failed isolation/projection negative test | Disable capability; complete PostgreSQL 17 suite and independent security/privacy review. |
| Ambiguous official write presented as success | Registration, grade, payment or submission without provider receipt | Keep writeback off; explicit pending reconciliation; idempotency and authoritative receipt. |

### P1 — release blockers

| Risk | Current evidence | Required exit |
| --- | --- | --- |
| Database/RLS evidence unavailable locally | PostgreSQL 17 absent | Green clean + reapply + negative suites on PG17 and representative restored schema. |
| No live SIS/LMS adapters | Production registry is empty by design | One approved read-only SIS path and one approved LMS/LTI path with mapping, health, reconciliation and UAT. |
| Guardian not production-operational | Local planning and sandbox grants only | Verified relationship, projection service, immediate revocation, audit, support and tenant approval. |
| Offline sensitive-data boundary incomplete | PWA/local stores, no central encrypted classified store | Storage allowlist tests; native key lifecycle before sensitive native offline use. |
| Recovery/support not externally proved | Docs and controls exist | Staffed coverage, current contacts, synthetic checks, restore drill and incident exercise evidence. |

### P2 — pilot quality and scale

| Risk | Exit |
| --- | --- |
| Documentation sources conflict | Canonical index, supersedes metadata, generated registers. |
| Search and AI authorization drift | One server-side authorization contract and parity tests. |
| Bundle/performance growth | Enforce budgets and split largest routes/workers. |
| Notification fragmentation | Unified inbox/delivery state, preference, quiet-hours and privacy-safe preview model. |
| Incomplete ownership | Named product, engineering, design, privacy/security, support, rollback, documentation and commercial owners. |

### P3 — improvement backlog

- Native mobile ergonomics beyond the PWA.
- More complete partner/developer ecosystem tooling.
- Longitudinal alumni/credential portability after issuer agreements.
- Deeper localization, cognitive-load modes, and independent usability research.

## First 15 PR-sized milestones

1. Canonical capability-state resolver and claim gate: join the existing capability register, maturity definitions, audience release profiles, DB entitlements and evidence records into one runtime decision; add required exposure status, eight-test evidence, platforms, source, classification, owners, expiry, support and rollback metadata; map all current capabilities and routes.
2. Restore green baseline: fix the 50 lint warnings and exact-commit full-suite failures without weakening checks or increasing timeouts as a substitute for diagnosis.
3. PG17 policy evidence: run clean/reapply migration suites; add a machine-readable report and unresolved-policy register.
4. Authorization context contract: inventory existing helpers, normalize server-derived tenant/person/membership/purpose/request context, and add cross-tenant negative tests.
5. Search/AI authorization parity: one policy-filtered result contract with tenant, purpose, source and freshness labels; negative tests for every role.
6. Read-only integration registry vertical slice: one approved provider adapter behind tenant activation, with credential reference, reconciliation, health, kill switch and no writeback.
7. Guardian projection foundation: verified relationship interface, scoped consent, minimized expiring projection, immediate invalidation and audit; no raw table grants.
8. Classified offline storage policy: central allow/deny classifier, purge hooks and tests proving grades/transcripts/aid/guardian data never persist offline.
9. Notification/inbox foundation: category/channel preferences, quiet hours, delivery state, generic sensitive previews, retry and audit model.
10. Support and recovery evidence: contextual help, JIT support workflow, current escalation roster, synthetic checks, restore drill artifact and release gate integration.
11. Universal state contract: typed states, accessible shared renderers, route mapping, recovery actions and state/claim parity tests.
12. Data quality control plane: provider-scoped contracts, lineage/freshness, discrepancy ownership, safe replay and user correction workflow.
13. Workflow runtime slice: versioned instances and receipts for one reversible internal approval flow before any high-risk migration.
14. Accessibility/content/community assurance: manual assistive-technology matrix, file trust boundary, moderation/safety tabletop and remediation register.
15. Company launch simulation harness: machine-readable run records for all 17 journeys, severity/owner/due-date enforcement and independent retest closure.

## Exact recommended first PR

Title: `feat(governance): resolve capability state across routes, entitlements and claims`

Scope:

- Extend the existing typed capability-governance and release-profile sources instead of creating a second registry.
- Add the six requested exposure states: `live`, `connected`, `pilot`, `early_access`, `institution_controlled`, `planned_but_not_exposed`.
- Implement one pure resolver whose inputs are capability maturity, release-profile verdict, evidence freshness/exact SHA, tenant/cohort entitlement, actor surface and kill-switch state.
- Require product/data/trust/operations/commercial/adoption/reliability/measurement status, web/mobile stance, data source, classification, owner seats, evidence IDs/expiry, support, rollback, and tenant/cohort activation.
- Map all 60 existing capabilities and every navigable route.
- Make absent or expired evidence fail closed to `planned_but_not_exposed` or `institution_controlled`.
- Add tests preventing navigation, marketing copy, AI, and tenant controls from claiming a higher state than the registry permits.
- Preserve all current route IDs, deep links and product planes; the first PR changes metadata/resolution, not the user shell.
- Do not add integrations, database migrations, enable capabilities, or claim operational readiness in this PR.

## Required approvals before launch

- Founder: target offer, pricing authority, budget, staffing, support hours, insurance, and final go/no-go.
- Legal/privacy: Terms, privacy notice, DPA, FERPA/COPPA posture, retention, subprocessors, AI/provider terms, marketplace terms, payments/tax/refunds.
- Security: independent assessment, vulnerability remediation SLA, secrets/key review, incident exercise, access review, production RLS evidence.
- Institution: contract, data map, identity and provider configuration, role matrix, policy, accessibility/UAT, training, incident contacts, and signed go-live authorization.
- Operations/customer success: named implementation owner, on-call/escalation, monitoring, support queue, restore/rollback evidence, adoption plan and renewal ownership.
