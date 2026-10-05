# Semester — readiness gap matrix (Phase 0)

**Date:** 2026-10-04 · **Registers:** [`COMPLETE_CAPABILITY_REGISTER.md`](COMPLETE_CAPABILITY_REGISTER.md), [`COMPLETION_RISK_REGISTER.md`](COMPLETION_RISK_REGISTER.md) · **Controlling:** [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)

The matrix has four readiness areas. In each, the product must prove one set of things and the company must prove another. A cell is **PROVEN** only with current evidence; **BUILT** means code/tests exist but the proof does not; **ABSENT** means nothing exists.

| Readiness area | The product must prove | The company must prove |
| --- | --- | --- |
| Individual students | Secure account, billing, premium entitlement, core workflows, AI controls, privacy, support, accessibility, mobile responsiveness | Terms/privacy review queue, payment support, customer support, status page, refund process, lifecycle messaging |
| Institutional pilots | Tenant isolation, roles, policies, audit, integrations, implementation workflow, source/freshness labels, staff workspaces | Paid pilot package, security packet, implementation plan, training, named support/escalation, procurement workflow |
| Contracts and renewals | Enforceable plans/entitlements, audit/export/offboarding, SLA support, change management | Counsel-reviewed contract process, DPA review, pricing/deal desk, invoicing/collections, customer success/QBR/renewal operation |
| Mass-user operation | Scale, rate limits, monitoring, rollback, recovery, abuse control, AI budgets, SLOs | On-call staffing, incident command, support capacity, finance operations, vendor management, launch communications, executive metrics |

## 1. Individual students

### Product must prove

| Requirement | State | Evidence | Gap ID |
| --- | --- | --- | --- |
| Secure account | **BUILT** | `lib/cloud.ts`, `delete-account`, RLS 352/352, `account-sync` required check | G-I1 restore unmeasured; no cross-tenant/IDOR negative run |
| Billing | **BUILT, HELD** | `billing-checkout/index.ts:27` hold (V); one live acceptance purchase | G-I2 price conflict; annual/refund/failed renewal/dispute not exercised; tax $0.00 in the only purchase |
| Premium entitlement | **BUILT** (shadow) | `docs/ENTITLEMENT-RESOLUTION.md`; `lib/membership.ts` | G-I3 nothing is gated on `subscriptions` |
| Core workflows | **BUILT, device-first** | `screens/*`; most data client-authoritative | G-I4 only tasks have per-row sync, behind a flag |
| AI controls | **PARTIAL** | `claude/index.ts` clamp + spend meter + global kill | G-I5 BYO-key and proxy paths ungoverned; no redaction (A-02/A-05) |
| Privacy | **BUILT** | export/erase/holds/retention; minors `minimum_age` | G-I6 policies are unreviewed drafts; DSR SLA is a human check |
| Support | **BUILT, UNSTAFFED** | `support_tickets`; 12 articles | G-I7 no staffing, SLA, or response promise |
| Accessibility | **BUILT** (automated only) | `app/src/a11y/`, `smoke:a11y` | G-I8 no manual AT review, ACR/VPAT |
| Mobile responsiveness | **BUILT** | PWA, `RESPONSIVE-CONTRACTS.md` | G-I9 real-device coverage limited (FR-013); no native app |

### Company must prove

| Requirement | State | Evidence | Gap ID |
| --- | --- | --- | --- |
| Terms/privacy review queue | **QUEUED** | `LEGAL-REVIEW-QUEUE.md` L0; `docs/legal/*-DRAFT.md` | G-I10 counsel unassigned |
| Payment support | **ABSENT** | — | G-I11 refund path, disputes, tax adviser |
| Customer support | **ABSENT** (founder only) | `docs/legal/SUPPORT-POLICY-DRAFT.md` "no response time promised" | G-I7 |
| Status page | **PARTIAL** | `app/public/status.html` browser probe | G-I12 hosted, with history |
| Refund process | **DRAFT** | `docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md` | G-I11 |
| Lifecycle messaging | **ABSENT** | only support/lead mail via Resend | G-I13 |

## 2. Institutional pilots

### Product must prove

| Requirement | State | Evidence | Gap ID |
| --- | --- | --- | --- |
| Tenant isolation | **BUILT, UNPROVEN end to end** | 110 `.check.sql` suites (pass in CI `build` on `07c7abb`); `FR-004` open | G-P1 no target-tenant HTTP negative test; FORCE RLS 0 (V); storage cross-tenant test not found (N) |
| Roles | **BUILT** | `role_grants`, `my_capabilities`, `capabilities.check.sql` | G-P2 target role test |
| Policies | **PARTIAL** | PDP in one route family; hierarchy TS-only | G-P3 PDP adoption; SQL enforcement of hierarchy |
| Audit | **BUILT** | chains, `gateway_write_audit_v` | G-P4 mutable financial tables outside chain |
| Integrations | **ABSENT as connectors** | `ADAPTERS=[]` (V) | G-P5 build first adapter (SSO/SCIM + one SIS or LMS) |
| Implementation workflow | **PARTIAL** | `lib/migration/*`; `workflow_versions` no executor | G-P6 |
| Source/freshness labels | **BUILT in UI** | `Disclosure.tsx`; source/status vocab (brief spec unchecked, U-03) | G-P7 |
| Staff workspaces | **BUILT** | `Console`, registrar/gradebook | G-P8 no tenant; offboarding operator-only |

### Company must prove

| Requirement | State | Evidence | Gap ID |
| --- | --- | --- | --- |
| Paid pilot package | **DRAFT** | `docs/commercial/PILOT-OFFER`, `PAID-PILOT-FRAMEWORK.md`; paid pilot **NO-GO** | G-P9 price authority, entity, counsel |
| Security packet | **DRAFT** | `docs/trust/SECURITY-QUESTIONNAIRE.md`; HECVAT not filled | G-P10 independent assessment, DAST, evidence |
| Implementation plan | **DRAFT** | `PILOT-GOVERNANCE-CHARTER` etc. | G-P11 named customer |
| Training | **DRAFT** | `docs/commercial/CUSTOMER-ONBOARDING-PLAYBOOK` | G-P12 |
| Named support/escalation | **ABSENT** | `docs/support/internal/escalation-map` | G-P13 staffing |
| Procurement workflow | **DRAFT** | `docs/legal-drafts/*`, `PROCUREMENT` queue | G-P14 counsel, entity |

## 3. Contracts and renewals

| Requirement | State | Evidence | Gap ID |
| --- | --- | --- | --- |
| Enforceable plans/entitlements | **PARTIAL** | `tenant_plan`; entitlement resolver in shadow | G-C1 |
| Audit/export/offboarding | **BUILT, operator-only** | `propose_offboarding`…`restore_school`; no app caller | G-C2 |
| SLA support | **ABSENT** | `docs/trust/SLA.md` NOT_STARTED | G-C3 |
| Change management | **PARTIAL** | `infra/changes/CC-*.md` check in `infra.yml` | G-C4 not a required check |
| Counsel-reviewed contract process | **ABSENT** | `docs/legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK`; no counsel | G-C5 |
| DPA review | **DRAFT** | `docs/legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`; student-data addendum "not-started" | G-C6 |
| Pricing / deal desk | **PROPOSED** | `deal-desk.ts` "proposed defaults" | G-C7 |
| Invoicing / collections (institutional) | **ABSENT** | `REVENUE-OPERATIONS-ARCHITECTURE.md` | G-C8 |
| Customer success / QBR / renewal | **DRAFT** | QBR tables empty | G-C9 |

## 4. Mass-user operation

| Requirement | State | Evidence | Gap ID |
| --- | --- | --- | --- |
| Scale / capacity | **PARTIAL** | pgbench in CI; `sre/capacity.ts` "unproven" | G-M1 HTTP-level load/soak |
| Rate limits | **PARTIAL** | institution gateway only verified | G-M2 Edge Functions |
| Monitoring / SLOs | **MODEL ONLY** | `app/src/lib/sre/*`; no APM | G-M3 |
| Rollback | **BUILT** | `ROLLBACK.md` 76–180 s | G-M4 single owner |
| Recovery | **ABSENT** | `RESTORE.md` unmeasured (V) | G-M5 |
| Abuse control | **PARTIAL** | `SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md`; no queue backpressure code found | G-M6 |
| AI budgets | **BUILT (server paths)** | `ai_spend_meter` | G-M7 BYO-key unmetered |
| On-call, incident command | **ABSENT** | "no rota" | G-M8 |
| Support capacity | **ABSENT** | founder only | G-M9 |
| Finance ops / vendor mgmt | **TEMPLATE** | `docs/finance/*`, `VENDOR-INVENTORY-TEMPLATE.md` | G-M10 |
| Launch comms / exec metrics | **DRAFT** | `docs/COMPANY-FIRST-YEAR-MEASURES.md` | G-M11 |

## 5. Reading the matrix

- **Every institutional and contracts row is blocked by a company fact** (entity, counsel, price authority, staff) *and* by a product proof (target-tenant isolation, one real adapter). Neither side alone moves the gate.
- **Individual students** are closest: the product side is mostly BUILT. The blockers are the held checkout, the unmeasured restore, three policy documents with no counsel, and no support.
- **Mass-user operation** is furthest: nothing on the company side exists, and the product side has no telemetry.

Gap IDs are carried into [`LAUNCH_CRITICAL_PATH.md`](LAUNCH_CRITICAL_PATH.md) and [`../../operations/GO_NO_GO_SCORECARD.md`](../../operations/GO_NO_GO_SCORECARD.md).
