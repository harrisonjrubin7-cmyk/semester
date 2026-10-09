# System and workflow gap analysis

Assessed against `origin/main` at `55adab11` on 2026-10-08.

## System disposition

| System | Repository status | Next missing boundary |
| --- | --- | --- |
| Identity/session/context | Implemented foundation with account, membership and institutional context paths | Universal active-context contract and live IdP/tenant evidence |
| Tenant isolation/RLS | Broad migrations and SQL verification suites | Current PostgreSQL execution evidence for the exact release target and independent review |
| Authorization | Central institution policy and access-saga implementation | Route remaining legacy protected operations through the same enforcement contract |
| Consent/delegation | Product, policy and persistence foundations | Revocation propagation proof across sessions, projections, workflows and connectors |
| Provenance/freshness | Multiple source-aware types and UI patterns | One canonical server record envelope adopted by institutional read models |
| Audit/evidence | Typed events, SQL controls, evidence registers | Production durability/search/export evidence and current retention operation |
| Workflow | Definitions, access saga, state guards and storage migrations | Durable registration-readiness workflow and unified operator task queue |
| Events/outbox | Contracts and database foundations | Consumer coverage, replay evidence and production lag/alerting |
| Integration hub | Adapter/gateway abstractions and sandboxes | Approved connectors, mapping, secrets, health, backfill and reconciliation per tenant |
| Notifications | Product and provider foundations | Delivery ledger, retry/reconciliation and verified channels |
| Documents/sources | Broad upload, source, export and citation functionality | One governed document contract for all institutional/classified artifacts |
| AI gateway | Policy/source/citation foundations and provider controls | Target-approved provider/configuration, evaluation, monitoring and incident process |
| Search | Product search surfaces | Server-authorized shared index with tenant, classification and freshness enforcement |
| Observability | Extensive definitions, checks and operations UI | Live production signals, staffed alerts and observed SLO history |
| Design system | Mature semantic-token and test contracts | Continue adoption; do not create a replacement package/tree |
| Capability/screen registry | 60 typed capabilities plus navigation/exposure governance | Add explicit workflow/system joins without creating a second source of truth |

## Workflow disposition

| Workflow | Current evidence | Repository maturity | Blocking gap |
| --- | --- | --- | --- |
| Registration readiness | Student evaluator/UI, policy relationships, source records and sandbox registration | Partial vertical slice | Governed projection + durable request/evaluation/reconciliation + live SIS approval |
| Registration request | Two-phase sandbox action with receipt, idempotency and reconciliation | Complete demonstration | Approved institutional adapter, tenant mapping, UAT and support |
| Prerequisite override | Policy actions and access saga | Foundation | Cohesive request/approval/execution/reconciliation UI and data path |
| Grade release | Workflow definitions, academic records and policy material | Partial | Faculty/registrar approval path and live SIS/LMS synchronization |
| Advising/referral | Meetings, shares, support/advisor data and controls | Partial | Purpose-limited durable case workflow and caseload queue |
| Consent/delegation | Family/privacy grants and revocation foundations | Partial | Cross-system revocation barrier and access-history proof |
| Financial exception/refund | Finance controls and operational material | Designed/partial | Regulated adapter, separation of duties, ledger and legal readiness |
| Privacy/data request | Export/deletion and audit foundations | Partial | Identity proof, legal-hold integration and fulfillment evidence |
| Incident response | Runbooks, console and governance evidence | Repository-ready | Staffed on-call and recent exercise/production evidence |
| Integration reconnect | Connection and health patterns | Partial | Durable credential rotation/backfill/reconciliation workflow |
| AI escalation | Policy, provider and human-confirmation boundaries | Partial | Operational review queue, evaluation and target-approved provider evidence |

## Registration-readiness target contract

The next implementation slice should expose one versioned projection with:

- actor, tenant, subject, term and correlation context;
- readiness state: `ready`, `blocked`, `needs_review`, `unknown`, `stale` or `reconciling`;
- holds, prerequisites, time ticket, conflicts and planned sections, filtered by policy obligations;
- authority and source references for every fact;
- source freshness, last successful sync and projection version;
- workflow instance, manual-review owner and receipt when applicable;
- a safe fallback pointing to the official system when Semester cannot establish the fact.

The evaluation command must be idempotent, write its domain/audit events transactionally, refuse stale official facts for consequential submission, and never present a request as enrollment before authoritative reconciliation.

## P0 release gate

Repository completion requires focused unit/integration/E2E tests, negative relationship and cross-tenant cases, migration checks, accessibility/responsive coverage, runbook and rollback instructions. Operational activation additionally requires institution approval, credentials and mappings, security/privacy/accessibility review, UAT/sign-off, staffed support and monitoring, live reconciliation and rollback/restore evidence. Those gates must remain distinct.
