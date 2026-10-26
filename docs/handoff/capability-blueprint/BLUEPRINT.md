# Semester platform execution blueprint — 20 capabilities

Status: detailed design/handoff, 2026-10-08. No code repository was modified, no tests run, no deployment performed, no provider certification obtained, no cohort results measured and no institutional authority transferred.

## Extend existing plans

The platform scorecard is explicitly design-stage. Education graph roadmap says not built; migration and implementation factories describe proposed workflows; ecosystem plan labels marketplace/developers post-pilot. These are foundations to extend, not verified products or instructions to create duplicate implementations. [file:106][file:109][file:107][file:108][file:111]

## Architecture

Experience surfaces: Student OS, Faculty Course Studio, advisor/registrar/service workspaces, institutional administration, company operations and website.
Shared primitives: account/membership, Action Center, search, workspace, design components, canonical education graph and provenance.
Trust/control plane: tenant/capability policies, sharing grants, deterministic academic rules, approval-bound commands, audit/evidence, classified lifecycle and release flags.
Data/operations plane: adapters, ingestion, mappings, reconciliation, migration orchestration, recovery, observability and portability.
AI plane: one policy-controlled classification/retrieval/routing/egress gateway with bounded tool access and human confirmation. Do not feed student records to providers to personalize answers; keep record-based checks deterministic and local/non-provider, and explain using permitted sources.

## Proposed shared contracts

The JSON Schema defines FactEnvelope, Relationship, SharingGrant and ControlledAction as proposed contracts, not deployed tables or endpoints. Implementations must validate schema plus semantics that JSON Schema alone cannot enforce: tenant binding, endpoint ownership, authority, grant expiry, source freshness, permission, signature/approval integrity and idempotency.

Fact lineage is permission-filtered; exposing provenance must not reveal another user's records or hidden source titles. Grant export does not imply retraction of a downloaded copy. Approval digests require stable canonicalization and bind tenant, domain, target, content, policy/source versions and expiry; hashes are not authorizations. Retention/deletion/hold rules apply to the underlying content and its authorized derivatives.

## Build tracks and activation order

Track A — shared contracts and student experience: authority matrix, graph, provenance, identity, consent, design system, daily journeys.
Track B — trust and engineering: schema-discovered isolation, audit/controlled actions, CI, accessibility, support, monitoring, recovery and Trust Center.
Track C — AI assurance: resolve strict allowed-source policy, classification, approved providers, transport-denial tests, evaluations and incident exercises.
Track D — institution delivery: adapters, mappings, semantic reconciliation, migration rehearsal, tenant templates, training and signed pilot measures.
Track E — evidence and ecosystem: approved real-cohort protocol, renewal evidence, developer sandbox/scoped install, marketplace review and exit.

Run these design/implementation tracks in parallel. Activation depends on exact tenant/domain gates, not a universal sequence or a count of shipped screens. Official-record writes remain SIS/institution-authoritative under current handoff/contracts; native replacement requires separate approved authority and updated applicable agreements. [file:99][file:100]

## First implementable backlog

1. Audit current repository and map each capability to exists/extend/new with actual owners; preserve status evidence separately.
2. Inventory canonical entities, graph relations, displayed facts, existing grants, database objects and external data paths.
3. Agree shared contracts and policy precedence; assign a source owner and freshness rule to critical pilot facts.
4. Build one cross-domain daily journey end-to-end and reuse Action Center/search/workspace semantics.
5. Add schema-discovered CI manifests and two-tenant/role denial tests plus non-database tests.
6. Build classification-to-transport enforcement and synthetic provider-boundary assertions; no forbidden-record bypass for tests.
7. Wire controlled commands to exact previews/approval bindings, idempotency, external receipts and reconciliation.
8. Rehearse a selected domain migration and recovery with critical mismatches seeded.
9. Assemble evidence-backed Trust Center and tenant onboarding/pilot checklist.
10. Authorize cohort measurements and evaluate student preference before making outcome or replacement claims.

## Illustrative prepared-workflow implementation window

A proposed 4–6-week window applies only after signed bounded scope, sponsor, usable source/identity access, legal/security prerequisites and delivery resources exist. It is not an SLA, achieved duration or full-university replacement estimate.
Week 1: tenant/SSO and policy/source inventory; assign blockers.
Week 2: sandbox adapters, mapping and critical fact/relationship validation.
Week 3: source reconciliation, workflow/role tests and accessibility review.
Week 4: training, support/incident/recovery rehearsal and go/no-go.
Weeks 5–6 if necessary: defect remediation, institution approval and staged cohort activation.
Report signature-to-launch elapsed time separately from ready-to-launch time and customer/vendor/security blocked time. Do not hide stalled days.

## Signed pilot measurement appendix

Required proposed fields: sponsor, cohort eligibility, baseline dates, metric definition/numerator/denominator, sources, missingness/attrition, observation window, privacy safeguards, harms/barriers, approved thresholds, limitations, support obligations, decision date, go/extend/remediate/stop/annual criteria and signatures. Numeric thresholds and commercial values remain unfilled until agreed. Do not infer causality from uncontrolled pilot observations. [file:112]

## Universal activation evidence

Each capability has named owners, authority/data scope, versioned contracts, tested tenant/role denial, privacy/accessibility review, applicable AI egress tests, functional/concurrency evidence, monitoring/support, reconciliation/recovery and exact institution authorization. Track designed/implemented/tested/deployed/authorized/enabled separately.
Any critical isolation, prohibited egress, unauthorized official action or record-integrity defect is a no-go. Rollback means safe recovery and compensation where literal undo is impossible. Zero canary leaks means zero observed failures in the defined test scope, not an absolute guarantee.

## Standards and certification boundary

Use version-pinned adapter profiles. Verify Edu-API published status and partner support at activation rather than infer maturity. 1EdTech's official specification page requires membership and the indicated certification process for conformance claims. Semester app-review certification is an internal scoped approval and cannot substitute for external standard certification. [web:115]
Accessibility targets WCAG 2.2 AA with complete-process evidence, not token adoption alone. [web:61]
