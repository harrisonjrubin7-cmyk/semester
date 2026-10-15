# Governed Student Workspace Architecture

Status: proposed architecture and schema, 2026-10-08. SQL has not been executed. No connector, production source or institution authorization was inspected or changed. No replacement readiness is claimed.

## Shared design

Experience: Today, Courses, Plan, Study, Files & Evidence, Support and Sharing. All use one account, Action Center, search and workspace context.
Data: typed nodes/edges plus immutable field-level facts, source bindings, lineage, source versions and freshness policies.
Control: scope/capability authorization, private ownership, institution authority, grants, source verification and exact-bound consequential approvals.
Operations: adapters → staged imports → validation → reconciliation → append → outbox/feed → authorized projections. Event IDs and cursors support idempotency/replay; reconciliation repairs gaps.
AI: permitted-source retrieval and one policy gateway. Official student records stay out of provider payloads, including prompts, OCR, retrieved context, history and tools. Deterministic eligibility checks remain non-provider operations.

## Tenant and ownership model

An individual's personal workspace and each institution are distinct tenant contexts. Global principal IDs identify an actor but do not grant global record access. Institution membership does not imply faculty access to private student work. A student in two institutions has two memberships, not merged academic record authority.
The proposed SQL uses composite tenant foreign keys to prevent ordinary cross-tenant endpoint links. Sharing grants permit scoped recipient access to the owning tenant's resources; they do not create a blanket cross-tenant join. Any future federated link needs explicit identity/source-grant contracts. Public catalogs require approved public classification and policy, not disabled RLS.

## Schema inventory

15 proposed tables: tenants, principals, memberships, access_scopes, nodes, source_bindings, freshness_policies, facts, edges, fact_lineage, sharing_grants, feed_events, workspace_actions, action_approvals, audit_events.
Nodes carry stable identity/type; facts carry content/provenance/version/classification; edges carry meaningful typed relationships and permission scope. Domain-specific assessment/submission/enrollment constraints must be implemented in typed contracts/tables as needed rather than hiding consequential rules in arbitrary JSON.
Node types include course, section, assignment, objective, note, file, task, plan, requirement, credit, evidence, skill, appointment, service and opportunity. Relationship examples: enrolled_in, assigned_in, assesses, studies_for, demonstrates, satisfies, referred_to and derived_from.

## Source authority verification rules

1. Authenticate transport and issuer: use approved connector identity, credentials/signatures where applicable and allowlisted tenant/context. HTTPS or a familiar hostname is not institutional delegation.
2. Check binding: source approval must identify entity kinds, predicates, institution/course/term scope, authorizing principal, policy version and expiry. Canvas can be authoritative for a published assignment deadline without becoming registrar authority for enrollment.
3. Check actor/content scope: instructor publication requires current course/term authority; imported student-authored edits cannot inherit instructor status. Credentials need issuer/evidence validation within their declared scope.
4. Validate identity, schema and version: reject unknown tenant, ambiguous source IDs, replayed/out-of-order revisions, invalid units/timezones and mismatched object context. Observed_at is receipt time, not source_updated_at.
5. Preserve original evidence: source record/version, authenticated receipt, transformation version and content digest. A digest confirms identity, not truth or authority.
6. Assess freshness: evaluate source age and observation age under the approved predicate/domain rule, authority expiry and validity period. If source time is unavailable, explicitly label unknown; do not fabricate it from sync success.
7. Resolve conflicting facts by scoped authority/field rules, not global numeric trust ranking or latest-ingest-wins. Preserve alternatives and conflict status; consequential actions block until accountable resolution.
8. Separate trust dimensions: official vs student/derived is authority; private vs public is confidentiality; verified vs unverified is evidence state; fresh vs stale is time suitability. None implies the others.
9. Derived and AI facts never promote themselves to Official. Keep input lineage and calculation/prompt/model versions; display Estimated or AI. Policy-required human/institution review produces a new authorized assertion, not silent relabeling.
10. Revalidate on execution: membership, grants, source binding, policy/source version, target/content approval and critical freshness must still apply. Revocation invalidates future access and relevant projections/approvals.

Suggested states: unverified → source_authenticated → scope_verified → institution_verified where required; conflicting/revoked are blocking states for relevant actions. A fact can be authentic and fresh but wrong; correction/appeal stays available.

## Freshness feed protocol

Connector webhook or scheduled poll → authenticated staged event → schema/context validation → source version check → append fact and lineage → atomically enqueue outbox/feed event → update permission-filtered search/Action Center projections → acknowledge cursor.
Use per-tenant sequence and source event keys, with bounded retries and no exactly-once-network assumption. Consumers dedupe by event key/version. Late older revisions cannot overwrite a newer current projection. Gaps/failed imports produce degraded freshness plus reconciliation work, not silent success.
Events: observed, changed, stale, conflict, authority_revoked, access_revoked and deleted. A feed contains identifiers/reason codes, not raw grades/documents. Authorize every subscription and fetch; filter fact and lineage visibility. Resume cursors cannot reveal existence of forbidden records. Revocation purges eligible cache/search visibility and terminates streams/tokens as needed.
Freshness budgets are approved per field; no arbitrary universal five-minute/one-day limit. Registration uses a live authoritative revalidation when required; a historical course note can be a valid snapshot. “Synced now” must not mean “source content updated now.”

## End-to-end example

A course assignment arrives through an authorized source → section and assessment nodes resolve → published deadline becomes a scoped instructor fact → action origin deduplicates Today → student creates private study plan tied to objective → allowed practice AI uses approved course material only → student drafts submission → exact preview/confirmation → authorized submission → source receipt → completed action. A changed deadline emits a fact version/feed event and invites plan adjustment without deleting manual preferences.

## Replacement and migration boundaries

Notion export supports HTML/Markdown/CSV and attachments but excludes content the exporter cannot access and can be limited by teamspace settings. [web:125] Do not assume relations, formulas, history or ACL parity from a CSV; record gaps and reconcile meaningful links. [web:128]
Canvas course exports use Common Cartridge and do not include backups of student interactions and grades; additional approved extraction is needed. [web:130] Content viewing/import is not authority to replace teaching operations or submit grades. Student offline viewing is limited by institution enablement, locked-content permissions and copyright. [web:132]
Drive allows permitted file downloads; owners may restrict downloading/copying for viewers/commenters. [web:123] Importing files does not reproduce native document collaboration, ownership or sharing history. Link-first and selected owned-copy migration are distinct modes.
Rehearse import → reconcile content/relationships/ownership → student or institutional approval → switch selected workflow → retain recovery/export path. Canvas and institutional Drive retirement require institution authority, not a student's import consent.

## Security and schema limitations

The proposed SQL enables/forces RLS without permissive application policies, making ordinary access deny-by-default. It is intentionally not production-ready. Authenticated principal binding, named application roles, per-table access policies, grants, server commands, append-only controls, semantic triggers and CI execution are not supplied as verified implementation.
RLS alone does not constrain superuser/BYPASSRLS/service credentials. Privileged ingestion must validate tenant/context and use least privilege; no company student-record bypass. JSON arrays/types do not implement permission checks. Lineage cycle detection, typed edges, scope non-expansion, grant ownership, atomic action approval/idempotency and effective policy enforcement require code/tests.

## Acceptance gates

- Two tenants plus personal/institution scopes pass positive and negative access tests across every table and external surface.
- Private note and source lineage stay hidden from faculty without scope grant; revocation removes future search/feed access.
- Fake issuer/instructor and copied official-looking document cannot gain authority.
- Source outage, unknown time, stale hold and conflicting deadline have honest states; registration does not proceed with invalid freshness.
- Out-of-order/replayed feed events do not duplicate obligations or overwrite current facts.
- AI egress tests inspect serialized transport and block synthetic protected canaries across all surfaces.
- Export/import verifies file hashes, relationships, versions, permission intent and unsupported semantics.
- Keyboard/screen-reader complete processes pass all UI states; rollback/compensation and support paths are exercised.

## Existing design grounding

The project graph specifies tenant, owner, authority, classification, permission, retention, versions and provenance. [file:121] Authority labels distinguish Official, Course, Yours, Estimated, AI, External, Community and Verified. [file:56] Derived outputs retain input lineage. [file:55] Workflow definitions include capabilities, sources, states, approvals, audit, support, recovery, accessibility and AI policies. [file:122] These are design references, not a verified deployment.
