# University OS architecture

Semester is the student's journey and workflow layer over the systems a university already runs. Today it is
the system of record for none of them.

**Destination (D-143).** Connect first, replace by domain, operate as one system. Semester's end state is to
replace the fragmented stack, becoming the system of record for each domain an institution chooses to migrate.
A domain moves only when it clears the replaceability bar in
[`DOMAIN-REPLACEMENT-REGISTER.md`](DOMAIN-REPLACEMENT-REGISTER.md), which computes that none has yet. Health,
counseling and clinical records, and emergency response stay bounded however far replacement goes.

**Today Semester does not replace:** the SIS or student record, the ERP (finance, HR), the official degree audit,
official registration, the LMS gradebook, financial-aid determination, payments or the bursar, health,
counseling, disability or clinical records, conduct, or emergency and safety systems.

**Semester does provide:** an action centre, a readable academic path and plan, source-aware study and work
tools, campus, career and advising actions, governed community, AI policy and provenance, and one
permission-aware interface over whichever of those systems a school has approved.

## Layers

```
┌───────────────────────────────────────────────────────────────────────────┐
│ SEMESTER                                                                    │
│ Student: Home · Courses · Study · Calendar · Me   (unchanged; see nav.ts)   │
│ Staff:   University → Services · Records · Connections · Control · Integrations │
└──────────────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────────────▼────────────────────────────────────┐
│ PLATFORM SERVICES (exist)                                                  │
│ Supabase Auth · schools (tenant) · role_grants + has_capability (RLS)      │
│ tenant_feature_policy · ai_policy · consent_record · audit tables          │
│ university gateway (app/server/institution, app/api/institution)           │
└──────────────────────────────────────┬────────────────────────────────────┘
┌──────────────────────────────────────▼────────────────────────────────────┐
│ SHARED INTEGRATION GATEWAY / CONTROL PLANE (this change)                   │
│ integration_connections · scopes · mappings · sync runs/errors             │
│ webhook events (idempotent) · dead letters · source records/freshness      │
│ canonical_entity_references · data_classification_rules · kill switches    │
│ app/src/lib/integration: adapter contract · pipeline · retry · redact      │
└──────────────────────────────────────┬────────────────────────────────────┘
      ┌──────────┬──────────┬──────────┼──────────┬──────────┬──────────┐
   SSO/SCIM   SIS/Audit   LMS/LTI   CRM/Advising  ERP/Bursar  Campus services
```

Every institutional integration goes through the gateway. Feature modules read canonical references and
freshness; they never call a provider.

Two existing paths are deliberately *not* institutional integrations and stay outside the gateway: a
student's own Canvas token (`functions/canvas`) and a pasted calendar link (`functions/fetchcal`). Those are
the student reading their own data with their own credential.

## Gateway flow

```
provider event / API page / batch file
 → adapter (fetch + parse only)
 → connection gate: kill switch · approved · not paused · tenant
 → idempotency: (connection, idempotency_key) unique
 → per record:
     schema validation → classification ceiling → never-ingest names
     → scope approved → subject resolved + consent (personal records)
     → mapping + transform → timestamp regression
     → canonical reference with provenance + freshness
 → run summary · sanitized errors · next cursor (not advanced on total failure)
 → audit (database triggers)
```

`app/src/lib/integration/pipeline.ts` implements this as a pure function over an injected store.
`app/server/integration/worker.ts` binds it to the tables with the service role, scoping every read and write to the
connection's own school; the contract tests bind it to memory. Operating it is `INTEGRATION-OPERATOR-RUNBOOK.md`.

## Adapter declaration

Every adapter declares (`adapter.ts`, checked by `validateDeclaration`): identity and version, authentication
method, a credential *reference* (never a secret), scopes, classification ceiling (within the domain's), entity
and field mappings, direction (write only behind a `writeback.*` flag), modes, cursor strategy, freshness
target, rate limit, retry policy, dead-letter strategy, source of truth, consent requirement, retention,
degraded states, disconnect flow, audit events, feature flag, kill switch, contract tests, and whether it is a
mock. A mock can never be registered as live.

## Canonical model

Thirty-two canonical entity types (`catalog.ts`, mirrored in the `integration_mappings` check). Every imported
fact is a `canonical_entity_references` row carrying `source_system`, `source_record_id`, `source_url`,
`source_timestamp`, `source_of_truth`, `classification`, `freshness_status`, `mapping_version`, `confidence`,
`external_deleted_at`. A fact about one student has `subject_user_id` and is readable by that student only.

Freshness: `live · recent · stale · unavailable · manual · estimated · needs_confirmation`. Only a connected
institutional source at `live` or `recent` may be shown as the official current record
(`freshness.ts: isOfficialCurrent`).

## SIS → LMS → Semester

```
SIS course section  → canonical course_section → LMS context (lms_context) → Semester course workspace
SIS enrollment      → canonical enrollment (personal, T3) → course membership → Study / Plan / Home
LMS assignment      → canonical assignment (course-wide, T1) → action card + assignment workspace
LMS course policy   → canonical course_policy (T1) → assignment policy card and AI controls
```

Read-first. Mapping tables sit beside Semester's own course and plan data; nothing overwrites a student's
entries. Never ingested by default, and refused by name as a scope and as a field: grades, GPA, gradebook,
roster, submissions, accommodations, health, counseling, conduct, instructor notes, financial aid.

## Sync framework

1. Event / webhook where the provider supports it (signed where available).
2. Incremental API pull by cursor / watermark / version token.
3. Scheduled secure batch file.
4. Controlled manual import.

| Class | Preferred | Target |
| --- | --- | --- |
| Identity lifecycle | SSO/SCIM events | near real time |
| Holds, appointments, urgent status | webhook or frequent incremental | near real time where supported |
| Schedule, enrollment, catalog, terms | incremental API | hourly–daily, per school |
| Degree audit | API, on demand, scheduled | daily / on demand |
| LMS assignments, policy, sources | LTI, webhook, API | event-driven or daily |
| Career, events, services | incremental API, batch | daily |
| Bursar, aid action items | minimal feed, deep link | school-approved; no decisions, no payments |

Reliability: idempotency as a unique constraint, event versioning, back-off with full jitter and Retry-After,
dead letters for permanent errors and exhausted retries, replay only by request (a worker runs it), a
per-school-and-connection token bucket, mapping versions, and a safe degraded mode in which the UI says
"source unavailable" rather than showing old data as current.

## Data governance

T0 public · T1 course-authorized · T2 student work · T3 education record · T4 regulated/sensitive · T5
restricted research/IP · T6 highly restricted. T3 never reaches consumer AI; T4–T6 are never ingested, never
reach AI, Community or a connector. A school may tighten any class and can loosen none — the database refuses
it. Imported records are never used for popularity, risk scoring, discipline, admissions, aid, housing,
employment or behavioural profiling.
