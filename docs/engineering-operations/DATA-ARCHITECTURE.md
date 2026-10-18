# Data Architecture

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DATA MAP — REPOSITORY MODEL PRESENT; TARGET INVENTORY AND OPERATION PARTIAL** |
| Owner | Harrison Rubin — company-side data architecture, privacy and lifecycle coordination; backup data owner, counsel and customer data authority unassigned |
| Evidence date | 2026-10-03 at repository revision `fb6adc7a` |
| Related control set | [`../trust/DATA-INVENTORY.md`](../trust/DATA-INVENTORY.md), [`../trust/DATA-FLOW-MAP.md`](../trust/DATA-FLOW-MAP.md), [`../trust/DATA-RETENTION-AND-DELETION-STANDARD.md`](../trust/DATA-RETENTION-AND-DELETION-STANDARD.md) |

## Storage and authority layers

| Layer | Typical data | Authority and lifecycle boundary |
| --- | --- | --- |
| browser local storage | plans, preferences and device-first working records | user device is the working boundary; version keys and explicit clear/export behavior required |
| IndexedDB/cache | attached or offline files and cached media | never imply cloud backup; storage/eviction and deletion behavior must be disclosed |
| Supabase Auth | identity/session records | provider and target configuration control; access/session evidence required |
| Postgres public schema | synchronized owned, tenant and operational records | RLS/capabilities are authoritative server controls; tenant, owner, provenance and lifecycle fields required by scope |
| private/server schema | capability/security helpers and protected operations | not exposed directly to the browser; privileged access must be inventoried and reviewed |
| audit/event/outbox structures | security and workflow evidence | privacy-minimized, access-controlled, retained by approved schedule and correlated without hidden profiling |
| provider/institution systems | official records and external content | remain authoritative unless a signed architecture says otherwise; readback required before Semester presents a successful write |

## Data invariants

- Minimize collection and separate sample, student-entered, imported, estimated and institution-verified information.
- Carry tenant/owner and source/freshness/authority metadata wherever a record can affect a decision.
- RLS, server capability checks and scoped grants enforce access; the user interface never substitutes for them.
- Include synchronized stores in export, correction, revocation and deletion mapping.
- Apply aggregate privacy floors and prohibit individual-risk inference or sensitive student scoring.
- Do not send content to AI or external providers without the disclosed purpose, scope, authority and provider terms.
- Preserve auditability for consequential actions without logging secrets, unnecessary content or unrestricted identifiers.
- Treat backup deletion, legal hold, provider retention and institutional records authority as separate decisions.

## Evidence state

**Code/config evidence.** Versioned browser stores, owned-table controls, Supabase migrations, RLS/check suites, provenance types and privacy thresholds implement substantial portions of this architecture.

**Operational evidence.** Repository inventory does not prove the exact live schema, privileged grants, regions, provider retention, backups, deletion propagation, legal holds or named-customer data classification and acceptance.

**Missing test/proof.** Export target schema/grants, reconcile the processing register and provider inventory, run two-account/role isolation, exercise export/deletion/revocation/restore interactions, approve retention/legal-hold decisions and obtain customer data-flow authority.

## Claim ceiling

Semester may describe its device-first storage model, optional synchronized records and repository RLS/lifecycle controls. It may state exact test results with their scope.

## Prohibited claims

Do not claim complete production inventory, data residency, zero retention, universal deletion, FERPA/GDPR compliance, tenant isolation or official-record authority without current target and professional/customer evidence.
