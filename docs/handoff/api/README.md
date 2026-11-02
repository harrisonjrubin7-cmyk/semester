# API layer

- `api_contracts.ts.txt`: your HTTP contract types (uploaded 6 Oct). Strip `.txt` when copying.
- `endpoints.json`: every endpoint derived from the capability registry. It covers a GET for each capability that reads records, and a POST for each command. Every endpoint starts at `implementationStatus: "specified"`; only repo tests may raise it.

The full uploaded package (schema, contracts, dashboard, README) is in `handoff/reference-slice/` with a table-by-table map.

## Reconciling the uploaded package with this design system

The uploaded README describes a separate reference slice. It uses its own schemas (`semester`, `semester_private`) and tables (`app.tenants`, `app.memberships`, `private.roles`, `private.role_assignments`), and offers section-scoped role assignments plus `private.has_permission()`. **Do not run both.** Pick one authorization core.

| Concern | Uploaded slice | This design system (migrations 010–180) | Recommendation |
|---|---|---|---|
| Tenancy | app.tenants (institution, company) | core.institutions + core.workspaces (personal, institution, company) | Keep core.workspaces. It covers personal ownership, which the slice leaves out |
| Roles | tenant roles + role_permissions | ctl.capabilities + ctl.grants with resource scope | Keep ctl.grants. Its resource_type/resource_id already scopes grants to a section |
| Section scope | role_assignments.section_id | acad.teaching_assignments + ctl.grants(resource_type='section') | Teaching authority comes from teaching_assignments, other grants from ctl |
| Permission check | private.has_permission(tenant, perm, section) | ctl.can(cap, tenant, org, resource_type, resource_id) | One function. If you prefer the slice's name, wrap ctl.can |
| Document states | 9 states | 9 states (180, identical) | Same |
| Transition RPC | semester.transition_document(p_tenant, …, p_participants) | api.transition_document(p_version, p_action, p_expected, p_reason, p_idem) | Adapter below |
| Errors | ApiError codes | 180 now raises the same codes | Same |
| `activate` action | one action | 180 maps `activate` to make_effective or record_execution | Same |

## Contract change recommended
Split the overloaded `participants` field into `reviewerIds` (for submit) and `signerIds` plus optional `externalPartyIds` (for request_signatures; see docs.external_parties in 190). The adapter inserts docs.review_tasks or docs.signature_requests before calling transition_document.

## Adapter (server only; identity comes from the session, never the body)
\`\`\`ts
// POST /api/v1/tenants/:tenantId/document-versions/:versionId/transitions
const { data, error } = await supabase.rpc('transition_document', {
  p_version: versionId, p_action: body.action, p_expected: body.expectedState,
  p_reason: body.reason, p_idem: headers['Idempotency-Key'],
});
// participants: for 'submit', insert docs.review_tasks first; for 'request_signatures', docs.signature_requests.
// Map Postgres exception message → ApiError.code (they are identical strings).
\`\`\`

## Gaps the uploaded README listed, and where they are now handled
- **Signature evidence from a verified provider callback:** `semester-platform/app/api/signatures/callback.route.ts.txt` checks the provider's signature over the raw body, then calls `docs.record_signature_event` (190). That function removes duplicates by event id and rejects a signature on any content other than the exact version. Provider payload field paths still need mapping to the real provider.
- **create_document_version:** `api.create_document_version` (180) has an idempotency receipt. The API layer must verify the upload and compute its SHA-256.
- **Retention and holds-aware deletion:** `docs.retention_actions` and `docs.retention_due` (190), plus `semester-platform/workers/retention.ts.txt`. Holds always block deletion. Anonymization is deliberately left switched off until it's defined per document type.
- **External signers:** `docs.external_parties` (190). These signers are verified by the provider and are not tenant members.
- **Sensitive document classes:** `docs.documents.sensitivity` and `docs.audiences` (190). Payroll, accommodation, legal matter, investigation and student-service documents are readable only by the owner or an explicit audience member whose access hasn't expired. There is no capability shortcut.

None of this has been run.
