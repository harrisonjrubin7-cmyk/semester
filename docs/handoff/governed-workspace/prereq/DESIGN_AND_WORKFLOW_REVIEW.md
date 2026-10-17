# Governed course, prerequisite and resource graph

Prepared 2026-10-08. Design and document inspection only: no SQL execution, connector sync, student workflow run, CI results or production replacement verified.

## Extend, do not fork

The SQL is a consolidated design slice in the proposed semester_workspace namespace, not an additive migration to run alongside the prior design. Reconcile definitions with actual repository/schema before implementation. The full earlier workspace design still supplies source bindings, freshness, membership, grants, action approvals, feeds and audit; this slice does not recreate all those controls. Course/section distinctions and typed prerequisite evaluation deepen the shared graph, not introduce a second student database. [file:121][file:109]

## Entities

Courses are catalog-versioned identities. Sections are specific term offerings. Prerequisite rules are approved/versioned requirements targeted at a course and effective interval. Expression nodes encode all/any groups and course/placement/permission/credit leaves. Resources are notes/files/readings/video/datasets/references/practice tied to graph nodes, source facts and rights. Evidence stays student-scoped and refers to approved completion, transfer, placement, permission, current enrollment or waiver facts. Eligibility records pin inputs and rules; they do not grant seats.

Edges connect course to objectives/resources, sections to courses, notes to resources, and evidence to skills. A note link is initially related_to. Only an authorized catalog rule can create prerequisite semantics. Foreign keys preserve tenant consistency; semantic controls must enforce matching node types and prevent edge scope from exposing endpoints or lineage.

## Rule semantics

Use an expression tree instead of a flat course→course prerequisite link. Example, entirely fictional: CS 220 needs (CS 101 completed under an approved grade rule OR approved placement) AND MATH 120 under a concurrent-enrollment policy.
ALL: not_satisfied if any evaluated child is not_satisfied, satisfied if all are satisfied, otherwise unknown.
ANY: satisfied if any child is satisfied, not_satisfied if all are not_satisfied, otherwise unknown.
A missing or stale input is unknown, not automatic denial or permission. Transfer credit counts only through approved applicable equivalency. Waivers apply under institution authorization and expiry, not by adding a note. Grades use institution-defined ordering/conversion; never compare letter grades alphabetically. Concurrent allowance is separate from completed credit. Official enrollment still requires current authority, holds/windows/capacity checks and receipt.

Before rule approval enforce one root, connected acyclic expression tree, group arity, valid leaves, version consistency, effective-date disambiguation and institution review. The SQL enforces at most one root but does not ensure root existence, group arity or absence of longer cycles. Course dependency cycles should be diagnosed, with approved co-requisite bundles handled explicitly rather than blindly rejected as course cycles.

## Privacy and authority

Read only authorized evidence for the requesting student. Student-private resources stay private even if linked to a public course. Sharing a resource does not reveal grades or prerequisite evidence. Deterministic readiness can process institution-authorized records locally/non-provider; do not send them to AI to reason about eligibility. Human review/correction remains available. Source category, confidentiality, verification and freshness are separate fields.

## Source and freshness validation

Authenticate connector/issuer; confirm tenant, course/catalog/term and authorized predicates; resolve canonical source IDs; preserve record/version and transformations; evaluate approved freshness policy; quarantine conflicts. An authentic old catalog is not necessarily the rule for the chosen term. Recompute or mark obsolete previous evaluations after rule/evidence changes; pin historical results rather than overwrite. No ingestion timestamp is substituted for unknown source update time. [file:109]

## Tool migration detail

Notion supports database relations/rollups, but its official help says CSV exports relation properties as plain-text URLs and cannot re-establish the relations by re-importing that CSV. Rebuild from stable page IDs and verified mappings; snapshot values are not live formulas. [web:140][web:142]
Obsidian stores Markdown files in a local vault; internal links produce its note graph. Preserve paths, aliases, headings, attachments and frontmatter. Detect duplicate basenames and unresolved targets; do not execute imported plugins or scripts. A visual note graph is not an official prerequisite graph. [web:152][web:145]
Google Workspace is strongest where existing collaborative documents and managed shared files should remain in their editor. Source permissions and organizational ownership constrain movement; a permitted link is not a right to copy or redistribute. Parent-folder access can dominate child permissions. [web:144][web:139][web:141]

## Migration procedure

Inventory eligible data and ownership → choose link-first vs owned import → authorized export → store source manifest/checksums/IDs → parse → map identities and candidate relations → review loss/ambiguity → reconcile content, relationships, rights and scope → approve limited switch → retain exit/recovery/export. Import as private by default unless accountable source approval supplies another scope. Never certify full parity from file/row counts. Institution-authorized replacement needs reconciliation and approval. [file:108]

## Workflow inspection

Project workflow definitions explicitly include inputs/outputs, capabilities, authority/classification, states/transitions, approvals, audit, support, recovery, accessibility, AI policies and success metrics. [file:122] The attached eight-workflow review translates that design into proposed student scenarios, not evidence those workflows run. Missing proof includes effective per-table access policies, atomic ingestion/actions, connector authorization, validated catalog fixtures, graph traversal tests, assistive-technology review and named support/recovery owners.

## Acceptance test backlog

1. ALL/ANY three-valued truth tables; nested groups and missing input.
2. Unknown/stale course credit, equivalency or rule never treated as satisfied.
3. Grade normalization, repeated course, transfer/placement and waiver validity.
4. Co-requisite timing, section change and term/catalog version selection.
5. Invalid expression arity, disconnected tree, self/long cycle and superseded rule.
6. Tenant A denied B course-private facts, evidence, search and resource files.
7. Faculty denied private student notes without approved sharing.
8. Rule revocation invalidates readiness and exposes explainable next step.
9. Serialized provider payload excludes synthetic protected records across surfaces.
10. Notion relation loss, Obsidian ambiguous links and Drive revoked access produce reviewable exceptions.
11. Sharing/expiry closes future graph, search, feed and file access without false copy-erasure claims.
12. Keyboard/screen-reader planning, resource opening, exception request and error paths.

## Activation gates

Complete missing foundational constraints and policies; independently review schema/type semantics; execute scoped positive/negative/concurrency tests; validate freshness and catalog authority; reconcile imports; test recovery; approve exact student/institution scope. Privileged credentials can bypass RLS and require separate least-privilege checks. No certification, conformance, tested result or deployment is established here.
