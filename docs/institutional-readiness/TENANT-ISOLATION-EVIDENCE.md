# Tenant Isolation Evidence

| Control | Value |
| --- | --- |
| Status | **REPOSITORY-TESTED FOR DEFINED INSTITUTIONAL PATHS — NOT A UNIVERSAL OR TARGET CLAIM** |
| Owner | Harrison Rubin — company-side security/engineering owner; independent tester and customer security approver unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../trust/SECURITY-WHITEPAPER.md`](../trust/SECURITY-WHITEPAPER.md), [`../market-readiness/SECURITY_READINESS.md`](../market-readiness/SECURITY_READINESS.md), and [`../trust/ACCESS-CONTROL-POLICY.md`](../trust/ACCESS-CONTROL-POLICY.md) |

## Boundary under test

Supabase/Postgres row-level security, scoped capabilities and controlled functions form the principal institutional data-layer boundary. Gateway/integration paths add tenant-scoped contracts and authorization. Some older product tables remain account/user-scoped rather than institution-keyed: they can prevent one account reading another without proving an explicit school boundary. Browser/UI filtering is never accepted as isolation evidence.

## Repository evidence map

| Area | Evidence type | Supported statement | Limitation |
| --- | --- | --- | --- |
| public database surface | RLS coverage/event-trigger checks | defined public tables are expected to have RLS and private objects are restricted from client roles | exact deployed schema/grants/configuration need target readback |
| institutional tenancy | tenancy and feature-specific SQL negative suites | selected tenant-keyed records refuse cross-tenant reads/writes | not every legacy/product table is institution-keyed |
| roles/capabilities | capability, membership, grant and RLS suites | selected actions are constrained by capability and scope | target roles/group mappings and effective grants unaccepted |
| integrations | integration RLS/gateway/connection controls | selected metadata, runs and governed records are tenant-scoped | production adapter registry/real provider flows are absent |
| identity/LTI | tenant provider, membership and LTI-binding controls | selected bound paths distinguish tenant/deployment/membership | real IdP/LMS and unbound-path disposition remain open |
| support/privileged access | scoped, expiring grants and audit designs/tests | selected access requires explicit grants and leaves evidence | operated review, staffing and target drill absent |
| AI/source governance | tenant policy/source checks | selected approved-source paths use tenant/course constraints | full live UI-to-provider target trace absent |

## Target isolation test matrix

Use at least two tenants, two ordinary users in one tenant, representative privileged roles, suspended/deprovisioned identities and service/integration identities. Test browser, direct API, database client-role, gateway, background worker, export, logs/search, files, integration, LTI, AI/retrieval, support and admin paths.

For each object/action prove: authorized same-user; authorized same-tenant role/scope; same-tenant wrong user; wrong role; wrong resource; cross-tenant read/write/update/delete/list/count/search/export; guessed identifiers/IDOR; stale/revoked grant; manipulated tenant header/claim/body; bulk/pagination/filter leakage; cached/error/log leakage; background retry/replay; and fail-closed behavior when identity, policy or audit is unavailable.

## Acceptance record

Freeze candidate SHA, migrations/schema/grants/policies, environment/configuration, tenant fixtures, account/role matrix, routes and tools. Store test ID, request path, expected/actual result, sanitized evidence, defect, remediation/retest, residual risk, independent reviewer, customer security acceptance and expiry. Any material schema, authorization, identity, integration or caching change triggers renewal.

## Evidence state

**Repository evidence.** Extensive negative checks support tenant isolation for defined institutional paths and account isolation for other selected paths.

**Operational evidence.** No exact target readback, complete route/data inventory, independent penetration result, deployed two-tenant acceptance, customer sign-off or ongoing isolation monitoring is evidenced.

**Missing test/proof.** Reconcile every target data path to its policy; run the complete two-tenant/role matrix in the release target; independently test IDOR/caching/export/integration/AI/support paths; remediate/retest; obtain customer acceptance.

## Claim ceiling

Semester may say repository tests enforce tenant-scoped access for specifically cited institutional paths and account-scoped access for selected older paths. It must disclose the scope and target-evidence gap.

## Prohibited claims

Do not claim complete tenant isolation, zero cross-tenant risk, independently penetration-tested isolation, production-verified isolation, universal school scoping, customer acceptance or institution readiness from repository suites alone.
