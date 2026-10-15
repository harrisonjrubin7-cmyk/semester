# Unified education graph

Status: Phase A architecture contract; existing implementation is partial.

## Purpose

Semester should present one educational journey while preserving the authority of institutional systems. The graph is an authorization and provenance model, not a reason to copy every record into one database.

## Canonical nodes

| Node | Key scope | Authority |
| --- | --- | --- |
| Person | Global opaque person ID | Semester identity service |
| Identity | Provider + provider subject | Identity provider; linked to a person after verified proof |
| Organization/tenant | Tenant ID | Semester provisioning + institution agreement |
| Membership | Tenant + person + role + lifecycle | Institution/approved provisioning path |
| Relationship | Tenant + two people + relationship type | Verified source; does not itself grant data access |
| Consent | Tenant + subject + recipient + purpose + fields + expiry | Student/data subject plus institution policy |
| Course/section/enrollment | Tenant + source connection + external ID | SIS/LMS as applicable |
| Assignment/submission/receipt | Tenant + source connection + external ID | LMS for LMS-owned work |
| Personal work | Tenant/person + Semester ID | Student/Semester |
| Opportunity/listing | Tenant/partner + source + lifecycle | Verified institution/partner/Semester workflow |
| Credential | Issuer + subject + credential ID | Issuer; Semester wallet is a holder, not issuer by default |
| Capability activation | Capability + tenant/cohort + version | Semester and institution approval workflow |
| Evidence/audit event | Tenant + actor + purpose + request/correlation ID | Append-only Semester control plane |

## Repository-to-canonical map

The target names below are logical contracts, not a direction to rename 171 migrations in one release. Existing tables should be adapted behind stable views/services, then consolidated incrementally.

| Canonical contract | Existing repository sources | Gap / convergence action |
| --- | --- | --- |
| Person + identity | `auth.users`, `profiles`, identity/provisioning code | Separate login identity from durable person; prohibit email-only linking; add verified link lifecycle. |
| Tenant + organization | `schools`, `organizations`, institution membership/configuration tables | Define one tenant boundary and organization hierarchy; keep school/provider aliases as typed organization roles. |
| Membership + role | `institution_membership`, course/community/support membership records | Normalize lifecycle, source, role, scope and effective dates; all authorization resolves through one policy decision interface. |
| Relationship | `family_grants`, `guardian_links`, advisor/faculty/course and alumni records | Relationship is evidence only. Converge family and K-12 guardian paths without preserving two permission engines. |
| Consent + projection | family invitations/grants/shared items, consent migrations, support grants | Add one purpose/field/expiry consent contract and materialized/minimized projection boundary for family and partner sharing. |
| Academic graph | courses, registration/enrollment/requirements schemas, `canonical_entity_references` | Establish canonical term/course/section/enrollment/assignment/submission IDs with provider aliases and provenance. Do not overwrite source authority. |
| Journey timeline | tasks, plans, calendar, pathway, career/application and credential concepts | Add one typed event/timeline contract with source, classification, visibility and lifecycle; keep domain payloads in owning services. |
| Opportunity + partner | `opportunities`, publishers/scopes, sponsor/listing concepts | Add verified partner, listing authority, application, disclosure snapshot, delivery receipt and retention contract. |
| Capability + entitlement | `rollout-capabilities.ts`, capability governance, release profiles, DB capability grants | Resolve these into one decision result for route visibility, tenant activation, claims, AI tools, support and rollback. |
| Evidence + event | `audit_event`, `private.domain_outbox_events`, telemetry/event contracts | Standardize actor, tenant, purpose, subject/resource, policy version, request/correlation ID, classification and retention. |

Exact target tables such as `people`, `identities`, `tenants`, `relationships`, `guardian_consents`, `guardian_data_projections`, `device_installations`, `mutation_queue`, `academic_terms`, `degree_requirements`, `marketplace_partners` and `opportunity_applications` do not currently exist under those names. Their absence does not mean the domains are empty; it means the repository has fragmented equivalents and should converge through compatibility layers rather than a destructive rewrite.

## Required edge semantics

- `person has identity`: verified link; revocable; never inferred from matching email alone.
- `person has membership`: tenant-scoped, time-bounded, source-labeled, and lifecycle-aware.
- `person relates to person`: relationship evidence only; no data access implied.
- `consent authorizes projection`: purpose, category, fields, expiry, source policy version, and revocation state are mandatory.
- `membership holds privilege`: scoped resource and purpose; deny when context is absent.
- `record came from source`: source connection, external ID, source timestamp, ingest timestamp, sync run, freshness, classification, and lifecycle are mandatory.
- `derived record uses record`: derivation version and input versions are retained.
- `capability enabled for cohort`: entitlement, policy, evidence, owner, rollback, and support state must all resolve.

## Read path

1. Authenticate the identity.
2. Resolve person and active tenant membership on the server.
3. Resolve role, relationship, consent, purpose, policy, entitlement, and capability maturity.
4. Apply RLS and field-level projection.
5. Attach source and freshness metadata.
6. Record the policy-sensitive allow or deny event.
7. Return only the minimized view.

Unknown context denies access. Client-supplied tenant, role, relationship, or consent is a request, never authority.

## Write path

Student-owned records may be written through Semester with idempotency, optimistic concurrency, audit, export, and deletion semantics. Institutional writes require a separately approved writeback scope, confirmation, provider receipt, reconciliation, and rollback. Ambiguous provider responses remain `unknown` or `pending_reconciliation`; they are never promoted to success.

## Source-of-truth contract

| Entity/field family | Authoritative source | Semester may own | Failure behavior |
| --- | --- | --- | --- |
| Identity proof/provider subject | IdP/auth provider | Link metadata, recovery state, preferences | Deny protected access; retain an explicit reconnect/recovery path. |
| Tenant membership and institutional role | Institution-approved provisioning/manual authority | Cached projection with source and expiry | Expire/deny on stale or revoked membership; no client-declared role. |
| Academic term, program, enrollment, official grade, transcript, degree certification | SIS/registrar | Student annotations, what-if plans, cached allowlisted display fields | Show stale/source-unavailable state; never convert a plan into an official record. |
| Course materials, LMS assignment and submission receipt | LMS/faculty-authorized source | Personal task, note, local draft and reminder | LMS wins authoritative fields; submission stays pending until receipt. |
| Personal work and productivity content | Student/Semester | Full record subject to export/deletion/retention | Work offline only under the classified-storage contract; preserve conflicts and versions. |
| Campus services, events, maps, dining, housing and athletics | Named campus/public provider by field | Favorites, plans, annotations | Label source/freshness and fall back to official links; do not fabricate live status. |
| Family relationship | Verified relationship source | Verification evidence and lifecycle | Relationship alone reveals nothing; require consent and policy for each projection. |
| Family shared data | Student consent + institution policy | Minimized projection and access history | Revoke immediately; no raw-table fallback. |
| Opportunity/listing | Verified institution/partner/Semester moderation | Student save/apply state | Hide or label stale listing; no partner access to raw academic data. |
| Marketplace disclosure/application | Student-approved immutable snapshot | Delivery state, receipt and audit | No send without consent snapshot; ambiguous delivery is pending reconciliation. |
| AI recommendation/action | Derived by Semester from authorized sources | Prompt/tool decision, provenance, feedback | Deny unavailable sources; lower confidence; require confirmation for consequential actions. |
| Credential | Issuer | Wallet/holder metadata and presentation consent | Preserve issuer status; never imply Semester issued or verified it without evidence. |

## Existing evidence

- Implemented/verified in source: typed institution contract, capability governance, adapter declaration and validation, tenant-bound migrations, audit/outbox foundations, source/freshness UI concepts.
- Partial: identity lifecycle, data rights, integration quality, consent and support access are distributed across multiple schemas and services rather than one canonical graph API.
- Mock/demo: institution sandbox adapters and fixtures demonstrate the intended boundaries.
- Not implemented: a single graph query/service boundary covering the entire journey; production provider mappings; portable credential issuance; unified relationship service.
- External approval required: institution source maps, role matrix, consent policy, retention, data-processing terms, and credential issuer arrangements.

## AI policy and data-access convergence

The repository has meaningful governed-intelligence controls: tenant/person context, allowed modes and sources, model/budget policy, kill switches, confirmation and authoritative-readback patterns. Selected institutional actions also use a centralized pure policy decision. The remaining gap is coverage, not the absence of governance.

Every assistant retrieval or action must use the same canonical decision path as the corresponding direct UI/API operation:

1. Resolve tenant, person, membership, role, purpose, capability state and data classification before retrieval.
2. Apply row/field projection and source freshness before content enters a prompt or tool call.
3. Record model, policy version, source versions, tool decision, confirmation and request/correlation ID without logging protected content unnecessarily.
4. Require explicit confirmation and authoritative receipt/reconciliation for consequential actions; AI may prepare but cannot bypass write authorization.
5. Deny secondary model training, cross-tenant retrieval, raw guardian/partner access and any broader “AI-only” service-role path.
6. Prove authorization parity with generated negative tests for student, family, faculty/advisor, institution, partner, support and operator roles.

Until all AI entry points are covered, AI remains `early_access` for bounded student-owned use or `institution_controlled` for protected institutional data/actions.

## Non-negotiable invariants

- No cross-tenant edge traversal without an explicitly governed platform operation.
- No guardian edge grants raw record access.
- No partner edge grants SIS/LMS access.
- No derived data loses its source versions.
- No AI retrieval path is broader than the equivalent user search path.
- No offline copy expands the online user's scope.
- No capability status overrides a missing authorization decision.
