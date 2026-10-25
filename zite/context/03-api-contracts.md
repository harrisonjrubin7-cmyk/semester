# Semester API contract standard and endpoint inventory (proposed)

> Source: same document, section 5. A proposal: Zite endpoints implement these as typed workflows.
> Text extracted from the PDF with its layout kept; read it as the governing brief, not as proof that anything exists.

```text
5. API specifications

5.1 API contract standard
Proposed standard:

  Base path:
    /api/v1
 Authentication:
   verified end-user session or narrowly scoped service identity

 Workspace context:
   explicit workspace identifier
   validated against server-side membership and authorization

 Pagination:
   cursor-based for collections

 Mutation safety:
   Idempotency-Key for retriable consequential commands
   expectedVersion for optimistic concurrency where applicable

 Tracing:
   requestId and correlationId

 Errors:
   structured error code, safe explanation,
   retryability, field errors, request reference

 Versioning:
   API contract versions plus event schema versions

 Async:
   202 Accepted + operation identifier
   only when the operation is actually queued

 Authorization:
   enforce action + resource + scope + policy
   UI visibility is not authorization


5.2 Endpoint inventory
     Domain                                Representative endpoints

 Session        GET /me; GET /me/workspaces; POST /sessions/revoke

 Membership     GET /workspaces/{id}/memberships; POST /workspaces/{id}/invitations

 Student home   GET /workspaces/{id}/today; GET /workspaces/{id}/actions

                GET/POST /workspaces/{id}/tasks; PATCH
 Tasks
                /workspaces/{id}/tasks/{taskId}

 Plans          GET/POST /workspaces/{id}/plans; POST /plans/{id}/shares

                GET /workspaces/{id}/calendar/events; POST
 Calendar
                /workspaces/{id}/calendar/events

                GET /workspaces/{id}/terms; GET /workspaces/{id}/courses; GET
 Academic
                /sections/{id}

                GET /workspaces/{id}/students/me/readiness; POST /readiness-
 Readiness
                evaluations

 Registration   POST /registration-requests; GET /registration-requests/{id}
       Domain                                 Representative endpoints

  Learning         GET /sections/{id}/assignments; POST /study-sets; POST /documents

                   GET /workspaces/{id}/services; POST /service-requests; POST
  Services
                   /appointments

  Privacy          GET /me/consents; POST /consents; POST /consents/{id}/revoke

  Search           POST /search

  AI               POST /ai/requests; GET /ai/requests/{id}

  Integrations     GET /workspaces/{id}/connections; POST /connections/{id}/sync

  Reconciliation   GET /sync-runs/{id}/findings; POST /findings/{id}/resolve

  Workflow         GET /approvals; POST /approvals/{id}/decisions

  Company CRM      GET/POST /company/accounts; GET/POST /company/opportunities

  Implementation   GET/POST /company/implementation-projects

                   GET /billing/subscriptions; GET /billing/invoices; POST
  Billing
                   /billing/checkout-sessions

                   POST /webhooks/payments/{provider}; POST
  Webhooks
                   /webhooks/integrations/{adapter}

  Reliability      GET /company/operations/health; GET/POST /company/incidents

  Evidence         GET /company/controls; POST /company/controls/{id}/evidence

These are proposed routes; the implementation should standardize path nesting and ownership
before generating the complete OpenAPI artifact.

5.3 Example student-home response

  {
       "data": {
         "workspaceId": "institution-workspace-id",
         "term": {
           "id": "term-id",
           "label": "Current term"
         },
         "actions": [
           {
             "id": "action-id",
             "title": "Review your registration hold",
             "reason": "This may prevent registration.",
             "state": "needs_attention",
             "provenance": {
               "kind": "official",
               "sourceName": "Registrar",
               "sourceUpdatedAt": "2026-10-22T17:00:00Z",
               "syncedAt": "2026-10-22T17:05:00Z"
             },
             "primaryAction": {
                 "kind": "official_handoff",
                 "label": "Open registrar instructions",
                 "targetRef": "approved-handoff-id"
             }
         }
       ]
     },
     "meta": {
       "requestId": "request-id",
       "projectionVersion": 18,
       "freshness": "recent"
     }
 }


5.4 Example command request

 POST /api/v1/workspaces/{workspaceId}/tasks/{taskId}/complete
 Authorization: Bearer <session-token>
 Idempotency-Key: <unique-key>
 Content-Type: application/json


 {
     "expectedVersion": 4
 }


Expected handling:

 1. Verify session.
 2. Resolve workspace and active membership.
 3. Authorize task completion.
 4. Check idempotency record and request hash.
 5. Validate expected version.
 6. Update task.
 7. Append audit and outbox records in the transaction.
 8. Commit.
 9. Return authoritative resulting state.
 10. Deliver downstream events asynchronously.



5.5 Example error

 {
     "error": {
       "code": "RESOURCE_VERSION_CONFLICT",
       "message": "This task changed in another session. Refresh it before retrying.",
       "retryable": false,
       "requestId": "request-id"
     }
 }
5.6 Events and webhooks

 type SemesterEvent<T> = {
    id: string;
    type: string;
    schemaVersion: number;
    occurredAt: string;
    workspaceId: string;
    actorId?: string;
    subjectId: string;
    correlationId: string;
    causationId?: string;
    payload: T;
 };


Example events:

 membership.activated.v1
 membership.revoked.v1
 task.completed.v1
 consent.revoked.v1
 registration.requested.v1
 integration.sync.completed.v1
 integration.reconciliation.failed.v1
 contract.activated.v1
 subscription.changed.v1
 invoice.paid.v1
 entitlement.changed.v1
 incident.declared.v1


Webhook requirements:
   Verify signatures against the raw request where the provider requires it.
   Reject invalid or stale requests according to provider rules.
   Deduplicate by provider and event identifier.
   Persist receipt before acknowledging durable acceptance.
   Process state changes through authorized domain logic.
   Handle delayed and reordered events.
   Reconcile against provider state.
   Keep sensitive record content out of ordinary event payloads.


```
