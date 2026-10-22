# Education identity and knowledge graph

_Semester platform maturity program · 2026-10-05 · Source: uploads/what else is needed to become the apple google and.pdf. Status is design-stage: nothing is "done" until repo code, tests and release evidence exist._

**Principle:** Semester must become the system people prefer to use every day, the system institutions trust to operate, and the system partners prefer to build on.

## Standard

- Nodes: person, identity, institution, program, course, requirement, task, action, learning objective, skill, evidence, credential, support resource, policy, opportunity, community, mentor, employer, outcome.
- Stable canonical identifiers; source authority and freshness per important field; tenant-aware relationship boundaries.
- Versioned policies and requirements; provenance for derived data and AI outputs; event history; exportable record structure.
- Graph-quality tools: duplicate detection, missing relationships, stale sources, policy conflicts, reconciliation reports.
- The moat is understanding relationships among data, policies, people, actions and outcomes, not storing data.

## Capability record

| Field | Value |
| --- | --- |
| Current evidence | `ui_kits/architecture/`, `docs/master/SEMESTER_EDUCATION_GRAPH.md`, `handoff/semester-core/provenance.ts.txt` |
| Implementation state | Designed: 32 graph nodes, 17 rules, provenance ranking in semester-core. Not built. |
| Product owner | Product |
| Technical owner | Engineering (data) |
| Risk owner | Founder |
| Success metrics | Share of fields with source + freshness; Duplicate person rate; Stale-source alerts resolved in SLA; Permission-aware search precision |
| Launch gate | Canonical IDs + source authority on every pilot field |
| Next action | Define canonical identifiers and the source-authority table for pilot fields |
| Security / privacy / accessibility | RLS + tenant_id on every row; no student records to AI; WCAG 2.2 AA |
| Replacement authority gate | Institution approval with reconciliation evidence before Semester becomes authoritative for any domain |

## Execute

See `handoff/execute/` streams and `13-platform-maturity.md`.

## Every node and relationship carries

- Canonical ID
- Tenant ID
- Owner
- Source authority
- Source system
- Source record ID
- Freshness timestamp
- Version
- Data classification
- Consent/grant requirement
- Role/capability requirement
- Retention policy
- Audit history
- Export rule
- Deletion rule
- Migration source
- Confidence/verification status

## Authority categories

| Category | Example | Handling |
| --- | --- | --- |
| Official institutional | Enrollment, grade, hold, term dates | Institution/registrar-authorized record |
| Instructor-published | Syllabus, course AI rules, study packs | Course/term scoped, versioned |
| Student-owned | Notes, tasks, private plan, AI preferences | Private by default; student controls sharing |
| Semester-derived | Workload estimate, action suggestion | Explainable, source-linked, never silently official |
| AI-generated | Summary, draft, recommendation | Policy-bound, cited, not authoritative |
| External source | Library source, partner opportunity | Labelled with source and freshness |
| Community-generated | Post, review, peer tip | Moderated, clearly non-official |
| Verified credential | Institution-approved skill or award | Evidence and authority required |

## Student-agency model

- Default: student-owned workspace is private.
- Sharing: student picks recipient, category, purpose, duration and items.
- Access: recipient sees only authorized scope; every access recorded.
- Revocation: student can revoke unless policy or law requires otherwise.
- AI: only policy-approved context reaches a model.
