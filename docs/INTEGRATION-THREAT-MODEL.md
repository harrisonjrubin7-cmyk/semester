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
| T16 | A hold's reason (a debt, a conduct matter, a health form) reaches Semester | The mapping keeps only office, blocks-registration and link; unmapped fields are dropped; `reason`, `amount`, `balance` refused as canonical names in TS and as `display` keys by trigger | `mock-sis.test.ts`: "never its reason or amount"; check: "a hold carrying its reason" |
| T17 | A student cannot remove what a school sent about them | Owner-only delete policy on their references; consent revocation stops the next sync | check: "the student deleting their own hold" (and every other role refused); component test |
| T18 | "No hold" shown from a stale feed | *No registration hold on record* only when both window and hold feed are live/recent; otherwise nothing is said | `school-records.test.ts` |
| T19 | An advisor's notes, or the reason for a referral, reaches Semester | Mappings keep office, time, mode and links only; `notes` and `reason` refused as canonical names and as `display` keys; `instructor_notes` refused as an incoming field | `mock-campus.test.ts`; check: "an advisor's notes" |
| T20 | A student relies on Semester for an emergency | Alerts carry a caveat on every rendering naming the official system; stale after 15 minutes, then "not the official current record" | `school-records.test.ts`, `schoolrecords.test.tsx` |
| T21 | A bursar amount or balance shown | Mapping has no amount field; `amount`, `balance` refused as names and keys; connector flag high-risk and off | `mock-campus.test.ts`: "never an amount or balance" |
| T28 | A connection approved but not switched on by its school still syncs | The worker requires the adapter's connector flag in `production` for the school | `worker.test.ts` (found by Codex on #779) |
| T29 | One connection's import overwrites another's student record | Reference identity includes the connection | `integration-control-plane.check.sql`, `worker.test.ts` (found by Codex on #779) |
| T30 | Anyone who finds the `integration-tick` function makes the service role run syncs | Bearer token checked by the database against `integration_cron_secret` in Vault (SHA-256 digests compared; service role only); 503 when it cannot check, never a yes; POST only; the answer is counts, never a school or connection | `integration-tick-auth.check.sql`, `integrationtick.test.ts` |
| T31 | A mock adapter reaches production through the scheduler | Registry preflight refuses a mock or two adapters claiming one connection; `runSync` refuses a mock without `allowMock`, which the endpoint never passes | `registry.test.ts`, `worker.test.ts` |
| T32 | A connection that keeps failing floods dead letters, or retries forever | Attempts are counted from consecutive failed runs, whatever the status; after the fifth the connection is held until an operator replays it, and an unreadable hold pulls nothing | `tick.test.ts` |
| T33 | A Canvas connection is used for SSRF or leases another connection's credential | The database accepts only a bare HTTPS origin; the adapter further restricts it to hosted `instructure.com`, refuses cross-origin/path pagination, and the live runtime leases only the connection row's tenant-bound pointer | `canvas-read-adapter.test.ts`, `tick.test.ts`, `provider-client.test.ts`, `integration-control-plane.check.sql` |
| T13 | A mock adapter mistaken for a real connector | `mock: true` in the declaration; named "Mock LMS"; not in any registry | review |

## Phase 7 review

Re-read against what now exists, including the worker that holds the service role.

| # | Threat | Control | Proved by |
| --- | --- | --- | --- |
| T22 | The service-role worker writes one school's data under another | The school is read from the connection row, never supplied; every write carries it; a reference for another school aborts the run before anything is written; person and consent lookups are filtered by that school | `worker.test.ts`: "never resolves a person through another school's identity or consent" (dropping the filter turns it red) |
| T23 | A deprovisioned student keeps receiving imports | Subjects resolve only through an **active** SCIM membership | `worker.test.ts`: "stops importing a student the school has deprovisioned" |
| T24 | Logs kept forever, or deleted during litigation | `integration_retention_sweep()` with fixed windows; `legal_hold` (service role only, reason required) exempts a connection | `integration-hardening.check.sql` (19 checks; removing the hold filter or sweeping open dead letters turns it red) |
| T25 | A policy added later leaks a table the case-by-case suites never touch | `integration-rls-matrix.check.sql` walks every integration table as four accounts and fails on a table missing from its list | a `using (tenant_id is not null)` policy on sync runs turned it red, naming both accounts |
| T26 | A stale connection goes unnoticed | `integration_health()` marks stale past twice the freshness target; runbook alert rules | `integration-hardening.check.sql` |
| T27 | A redelivered event older than the idempotency window is ingested twice | 30-day window stated in the runbook; timestamp regression still refuses an older version over a newer one | `pipeline.test.ts` (timestamp regression) |

## Residual risks

- **The service role bypasses RLS.** The worker now exists and scopes every read and write to the connection's own
  school (T22). What remains is operational: the service key must live only where the worker runs, and a second
  code path that uses it must follow the same rules — review any new one against `worker.ts`.
- **Webhook signature validation** is provider-specific and not yet implemented; the endpoint that receives a webhook
  must verify it before calling `runSync`. No such endpoint exists yet.
- **Canvas has not been provider-validated.** The adapter is contract-tested with synthetic responses only. The Edge
  runtime has no production credential broker, and no institutional connection, sandbox run, reconciliation rehearsal,
  monitoring evidence or customer UAT exists. Registration must not be reported as a live integration.
- **Grade passback on unbound registrations** remains instructor-gated and stoppable only by global kill switches until each registration is bound (D-1). The Edge Function reads a *missing* gate function as "unbound" during a deploy window; any other error refuses.
- **`tenant_policy_audit_event` stores old/new rows as JSON.** Integration rows are stripped of the credential
  pointer and cursor; other columns (names, scope keys) are configuration, not student data.
