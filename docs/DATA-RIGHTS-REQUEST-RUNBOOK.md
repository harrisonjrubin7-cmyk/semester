# Data-rights request runbook

**Produced 30 September 2026; updated 3 October 2026. Owner: privacy. Review monthly and after any data-model, retention, export, erasure, or legal-hold change.**

This is the operated path behind **Privacy and your rights → Your privacy requests**. It covers access/export, correction, restriction, and assisted erasure. It does not replace legal review, a signed DPA, or a jurisdiction-specific response clock.

## Intake boundary

- A signed-in person files only about their own authenticated account.
- The server derives the subject and tenant; the browser does not assert either.
- The request starts `received`, receives a thirty-day due date, and writes `privacy.request_raised` to the pseudonymous audit envelope.
- A second open request of the same kind returns the existing request. It does not reset the clock.
- Detail is optional, limited to 1,000 characters, and the UI tells the person not to include passwords, payment details, medical information, or another person's records.
- Filing alone never deletes, changes, exports, or restricts data.

## Daily operating queue

The named privacy owner or delegated data steward checks **Operations console → Privacy requests** at least each business day. The queue is derived server-side from live `data_request:handle` grants at exact-school scope, orders unresolved work by deadline, and excludes demo tenants unless the operator separately holds the applicable implementation grant and asks to include them. It returns metadata only: never the subject identifier or request detail. Do not copy request detail into tickets, chat, email, or analytics.

1. Confirm the request reference, tenant, deadline, affected stores, owner, identity state, approval state, and legal-hold state shown in the metadata queue. The console shell alone does not authorize this view.
2. Claim the request with fresh MFA. Claiming writes the audit event first and moves a newly received request to `verifying`; another steward cannot open or act on it.
3. Select **View request detail** as a separate fresh-MFA action. This read is audited and returns a pseudonymous subject reference. Opening the row alone never fetches sensitive detail.
4. Verify identity or authority using the account session and institution-approved process. Never ask for a password or full government identifier. Record only the verification basis and an opaque evidence reference; do not put identity evidence itself in the request row.
5. Perform the bounded export, correction, restriction, or erasure procedure. Keep another person's records out of the response.
6. For erasure, request the existing `data-deletion` approval against the exact request id and tenant. Approval execution remains a separate two-person path. A pending or approved request is not authority to erase.
7. Recheck legal-hold state. A live hold blocks completed erasure even when an approval was executed. It may support a reasoned refusal; it never disappears silently.
8. With fresh MFA, record `completed` or `refused`, the plain-language resolution, and an opaque evidence reference. The server writes the audit event before the lifecycle update. Completed requests receive an immutable, pseudonymous completion certificate; completed erasure additionally requires the exact executed approval.
9. Confirm the requester can retrieve the certificate and see the final status and explanation in the app. Do not claim delivery from an internal state alone.

## Escalation

- **Due in 7 days:** privacy owner and operations owner review the case and dependency.
- **Due in 2 business days:** incident commander owns a same-day plan and institution contact where required.
- **Overdue, misrouted, cross-tenant, or unauthorized access:** stop processing, preserve the audit trail, open the incident workflow, and assess notification duties.
- **Security, legal-hold, minor/guardian, institution-request, or identity dispute:** do not improvise. Route to the privacy owner and counsel.

## Evidence to retain

- Request id, kind, tenant, received/due/resolved timestamps, status, verification fact, and final resolution.
- Pseudonymous audit events for intake and every trusted status/action transition.
- Export manifest or erasure receipt where applicable, without duplicating the exported content. Store only its opaque reference in the request lifecycle.
- Immutable completion certificate id and the exact deletion approval id for completed erasure.
- Incident or exception id when the request missed its clock or crossed a boundary.

Never put passwords, access tokens, payment data, medical detail, or copies of another person's records in the queue or evidence package.

## Rehearsal

Quarterly, use two synthetic accounts in different tenants and separate data-steward accounts. File all four kinds; confirm same-kind idempotency, metadata-only queueing, cross-tenant refusal, exact-school grant enforcement, fresh-MFA gates, steward ownership, explicit audited detail reads, due-date escalation, failed-audit rollback, legal-hold blocking, exact executed approval enforcement, immutable certificates, final requester visibility, and audit events. Store the dated result under `docs/evidence/privacy/`; a written runbook is not rehearsal evidence.
