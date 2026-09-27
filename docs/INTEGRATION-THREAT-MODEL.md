# Integration threat model

Scope: the integration control plane (migration `20260927170000`), the gateway library
(`app/src/lib/integration`), and the dashboard. Method: for each asset, who could reach it wrongly, and what
stops them — with the test that proves the stop.

## Assets

Provider credentials · imported student facts (T1–T3) · connection configuration · sync logs · the audit trail ·
kill switches · the classification floor.

## Threats and controls

| # | Threat | Control | Proved by |
| --- | --- | --- | --- |
| T1 | A provider token stored in an app table and read back | `credentials_reference` must match `vault:|env:|secret-manager:`; no API role may select the column; audit rows drop it | check: "a pasted token", "reading the credential pointer", "audit rows carrying the credential pointer" |
| T2 | An integration admin browses students because the connection exists | `canonical_entity_references` with a `subject_user_id` is readable by that subject only | check: "the integration admin reads a student's T1 assignment reference" (0) |
| T3 | School A reads or writes school B's integration rows | Every policy uses `has_capability(..., 'school', tenant_id)`; child rows reference `(connection_id, tenant_id)` so a row cannot point across schools | check: "another school's integration admin sees the connection", "a child row pointing at another tenant's connection" |
| T4 | A connection turned on without approval | Status and approval columns are off the column grants; `healthy`/`degraded` and any write direction need `approved_at`; the owner cannot approve their own | check: "setting status directly", "a healthy connection that was never approved", "an owner approving their own connection" |
| T5 | A sensitive scope requested (grades, roster, accommodations, health…) | Scope key refused by name in SQL; adapter declaration refused in TS; pipeline refuses such a field | check: "a scope on the never list"; `pipeline.test.ts`: never-ingest |
| T6 | T3+ data routed to consumer AI or Community by a school setting | Check constraints on `data_classification_rules`; trigger refuses a looser tenant row; `routeAllowed` mirrors it | check: "a tenant sending education records to consumer AI"; `classification.test.ts` |
| T7 | A replayed or duplicated webhook applied twice | `unique (connection_id, idempotency_key)`; pipeline claims the key first | check: "the same webhook delivered twice"; test: "counts a webhook delivered twice once" |
| T8 | A replay executed from the browser, or during an incident | Browser can only *request* (`integration_request_replay`); refused under `kill.integration_sync`; audited | check: "a replay while the global switch is engaged" |
| T9 | External ids, emails or tokens leak through error text | `sanitized_message` capped at 500; external reference only as `sha256:`; `sanitizeMessage` strips tokens/emails/ids; salted per school | check: "an error carrying an external id in the clear"; test: "never puts the external id…" |
| T10 | A kill switch engaged by the wrong person, or without a reason | Global needs `killswitch:engage` over the platform (only `incident_responder`); school rows over the school; engaged needs a reason | check: "a university admin engaging a global switch", "a switch engaged without a reason" |
| T11 | Stale or estimated data shown as official | `isOfficialCurrent` only for connected sources at live/recent; UI sentence says "Not the official current record" | `pipeline.test.ts`: freshness |
| T12 | A provider sends an older version and overwrites a newer one | Timestamp regression refused | test: "refuses an older version" |
| T14 | Grades posted to an LMS a school has not approved, or during an incident | `lti_passback_decision` before any signing: kill switches, both flags in production, approved write-direction healthy connection, approved unexpired `scope.lms.score_publish` | `lti-integration.check.sql` (32 checks; five deliberate breaks each turn it red) |
| T15 | A launch records who launched | `lti_record_context` stores the context id only, tenant-wide T0, no subject | check: "tenant-wide, T0, LMS as source of truth" |
| T13 | A mock adapter mistaken for a real connector | `mock: true` in the declaration; named "Mock LMS"; not in any registry | review |

## Residual risks

- **The service role bypasses RLS.** The future worker will use it. It must pass the connection's own `tenant_id`
  into every write and never accept a tenant from a payload. The composite foreign keys limit the damage of a
  mistake (a child row cannot name another school's connection) but do not prevent a worker writing to the
  wrong connection. A code review gate on the worker is required.
- **Webhook signature validation** is provider-specific and not yet implemented; the worker must verify before
  claiming the idempotency key.
- **Grade passback on unbound registrations** remains instructor-gated and stoppable only by global kill switches until each registration is bound (D-1). The Edge Function reads a *missing* gate function as "unbound" during a deploy window; any other error refuses.
- **`tenant_policy_audit_event` stores old/new rows as JSON.** Integration rows are stripped of the credential
  pointer and cursor; other columns (names, scope keys) are configuration, not student data.
