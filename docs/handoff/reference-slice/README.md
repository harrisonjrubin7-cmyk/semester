# Uploaded reference slice (6 Oct 2026)

Your uploaded package, kept verbatim with `.txt` suffixes so the design-system compiler leaves it alone: a 25-table bounded slice covering tenants, roles, documents, CRM, implementation, endpoints and educational read models. It hasn't been run.

**Do not apply it alongside `handoff/semester-platform` migrations 010–180.** They model the same things in different schemas. The 135-table design is the superset. Use this slice as a cross-check, or as the starting point if you'd rather begin small. Pick one.

| Slice | Design system equivalent | Note |
|---|---|---|
| semester.tenants | core.institutions + core.workspaces | Workspaces add personal ownership |
| semester_private.memberships | core.profiles (+ proposed iam.memberships) | Multi-tenant membership still proposed |
| semester_private.permissions / roles / role_permissions | ctl.capabilities | Capabilities, not role bundles |
| semester_private.role_assignments | ctl.grants (resource_type, resource_id, expires_at) | Section scope via resource_type = section |
| semester_private.can() | ctl.can() | Same question, one function |
| semester.sections | acad.sections |  |
| semester.enrollments | acad.enrollments | Mirror of SIS |
| semester.assignments | work.assignments | state column added in 170 |
| semester.submissions | learn.submissions | Idempotent api.submit_work |
| semester.accounts / opportunities | biz.accounts / biz.opportunities |  |
| semester.implementations | biz.pilots (+ proposed impl.projects) |  |
| semester.resources / document_links | docs.contract_documents, pilot_documents, case_documents | Explicit joins instead of a resource registry |
| semester.documents / document_versions | docs.documents / docs.document_versions + docs.version_states | State kept off the immutable version row |
| semester.review_tasks | docs.review_tasks |  |
| semester.signature_requests / signature_evidence | docs.signature_requests / docs.signature_evidence |  |
| semester.legal_holds | docs.legal_holds |  |
| semester.transition_events | docs.transition_events |  |
| semester_private.command_receipts | docs.transition_events.idempotency_key (unique) | Receipts per command family |
| semester_private.outbox | ctl.outbox |  |
| semester.api_endpoints | handoff/api/endpoints.json | Catalog as a file, not a table |
| semester.create_document_version | api.create_document_version (180) | Idempotent via docs.command_receipts; requires a server-verified upload + SHA-256 |
| semester.transition_document | api.transition_document (180) | Same codes; activate alias |

Reconciliation detail and the HTTP adapter: `handoff/api/README.md`.

## v2 (uploaded later on 6 Oct)
`v2/` holds the reconstructed v2: the same 25 tables and 4 functions, a contracts v2 and a workflow simulator, all kept verbatim. Its notes say it isn't a byte-identical recovery of v1. The table map above still applies. v2's required tests are folded into `handoff/semester-platform/tests/REQUIRED.md`, mapped to this design's objects.

`v2/SemesterDashboard.tsx.txt` is the uploaded React + Zod local simulation dashboard, kept verbatim for reference. The design system's equivalents are `ui_kits/company-os/#docflow` (state machine) and `#sim` (throughput).
