# Data-rights request runbook

**Produced 30 September 2026. Owner: privacy. Review monthly and after any data-model, retention, export, erasure, or legal-hold change.**

**Status: a target procedure, not a built one.** Intake is built and tracked (the student screen, the `data_subject_request` table, the `privacy.request_raised` audit event). Everything under *Daily operating queue* onward describes how answering is meant to work; **no answering surface exists yet, no one is named to answer, and no response time is decided** (**[COUNSEL REQUIRED]**, P-03). Read each step below as a target until the surface is built and rehearsed.

This is the operated path behind **Privacy and your rights → Your privacy requests**. It covers access/export, correction, restriction, and assisted erasure. It does not replace legal review, a signed DPA, or a jurisdiction-specific response clock.

## Intake boundary

- A signed-in person files only about their own authenticated account.
- The server derives the subject and tenant; the browser does not assert either.
- The request starts `received`, receives a due date (the column defaults to thirty days; that is an internal database default, not a response time anyone has approved — **[COUNSEL REQUIRED]**, P-03; no tenant-specific shortening exists, a tenant clause would need to be built), and writes `privacy.request_raised` to the pseudonymous audit envelope.
- A second open request of the same kind returns the existing request. It does not reset the clock.
- Detail is optional, limited to 1,000 characters, and the UI tells the person not to include passwords, payment details, medical information, or another person's records.
- Filing alone never deletes, changes, exports, or restricts data.

## Daily operating queue

The named privacy owner or delegated data steward checks unresolved `data_subject_request` rows ordered by `due_at`, at least each business day. Use a trusted service session; do not copy request detail into tickets, chat, email, or analytics.

1. Confirm the operator is authorized for the request's tenant and is not the requester.
2. Verify identity and authority using the account session and institution-approved process. Never ask for a password or full government identifier.
3. Check legal holds before export, restriction, or erasure. A hold changes the response; it does not disappear silently.
4. Move the request to `verifying` or `in_progress` through a trusted operations service (**target, not built**: no such service exists today). Students cannot edit status, due date, verification, resolution, or tenant.
5. Perform the bounded action using the existing export, correction, restriction, or erasure procedure. Keep another person's records out of the response.
6. Record `completed` or `refused`, `resolved_at`, and a plain-language resolution. A refusal must name the reason and the correction or appeal route.
7. Confirm the requester can see the final status and explanation in the app. Do not claim delivery from an internal state alone.

## Escalation

- **Due in 7 days:** privacy owner and operations owner review the case and dependency.
- **Due in 2 business days:** incident commander owns a same-day plan and institution contact where required.
- **Overdue, misrouted, cross-tenant, or unauthorized access:** stop processing, preserve the audit trail, open the incident workflow, and assess notification duties.
- **Security, legal-hold, minor/guardian, institution-request, or identity dispute:** do not improvise. Route to the privacy owner and counsel.

## Evidence to retain

- Request id, kind, tenant, received/due/resolved timestamps, status, verification fact, and final resolution.
- Pseudonymous audit events for intake (built) and for every trusted status/action transition (**target, not built**: today only intake writes an audit event; a later status change writes none).
- Export manifest or erasure receipt where applicable, without duplicating the exported content.
- Incident or exception id when the request missed its clock or crossed a boundary.

Never put passwords, access tokens, payment data, medical detail, or copies of another person's records in the queue or evidence package.

## Rehearsal

Quarterly, use two synthetic accounts in different tenants. File all four kinds, confirm same-kind idempotency, cross-tenant refusal, student read isolation, operator separation, due-date escalation, legal-hold behavior, export withholding, erasure receipt, final requester visibility, and audit events. Store the dated result under `docs/evidence/privacy/`; a written runbook is not rehearsal evidence.
