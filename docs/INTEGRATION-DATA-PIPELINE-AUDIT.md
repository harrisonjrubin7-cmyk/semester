# Integration data-pipeline audit

What is actually connected, what is modelled, and what would be needed for each. Nothing here is a live
endpoint unless its row says **exists**. "Requires tenant/provider verification" means no school has supplied
credentials, a contract or a sandbox, and no provider endpoint has been exercised.

## What exists today

| Path | What it does | Through the new gateway? |
| --- | --- | --- |
| Brightspace LTI 1.3 (`functions/lti`, `_shared/lti*.ts`, `lti_platform`, `lti_identity`, `lti_line_item`) | Launch, account linking, deep linking, and **score passback** for instructor-graded links | Partly: a registration can be bound to a school and connection (Phase 4); passback is then gated and launches record course context. Unbound registrations behave as before |
| SAML / SCIM (`institution_identity_provider`, `institution_membership`, `scim_*`, `app/server/institution/scim.ts`) | School-controlled identity and provisioning state | No. Identity is upstream of tenancy |
| University gateway (`app/server/institution`, `app/api/institution`) | Records/actions contract, journal, rate limits; **adapter registry empty**; sandbox institution | Separate; its adapters should declare the same contract |
| Student Canvas token (`functions/canvas`) | A student's own token reading their own Canvas | No, by design (student credential) |
| Pasted calendar feed (`functions/fetchcal`) | A student's own ICS link | No, by design |
| School data packs (`docs/SCHOOL_DATA_PACK.md`, `app/src/data`) | Public university data compiled into the build | No; `source_type = public_university` when imported |

## Matrix

Columns follow the command. Common values, to keep the table readable:

- **status**: `not connected` for every row unless stated.
- **auth**: as listed; credentials by secret-manager reference only.
- **cadence / freshness**: from the sync class in `catalog.ts`.
- **retry**: 5 attempts, 2 s base, 15 min cap, full jitter; permanent errors dead-letter at once.
- **rate limit**: per school and connection; provider figure requires verification.
- **error state**: `degraded` after a failed run with partial success, `error` after total failure, `paused` by operator.
- **writeback**: no, for every row.
- **approvals**: `integration:approve` by a university admin who is not the owner, plus the connector flag.
- **contract test**: `pipeline.test.ts` against the mock LMS only; every real provider is `not written`.
- **conflicts**: the kinds the pipeline detects — type, enum, missing required, duplicate id, timestamp
  regression, transform, scope, classification, consent, rate limit, deletion.

| provider_domain | provider_name / product | pattern | api_or_standard | candidate endpoints/events | external → canonical | mapping status | schema conflicts expected | normalization | direction | cadence | freshness target | ceiling | consent | owner | source of truth | feature flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| identity | SAML IdP / SCIM (school's) — **exists** as provisioning state | event | SAML 2.0, SCIM 2.0 | SCIM Users/Groups; SAML assertion | user → person_reference | not mapped to canonical | none known | opaque reference only | read | near real time | 15 min | T3 | no (institutional) | Identity office | IdP | — (existing) |
| sis | Banner / PeopleSoft CS / Workday Student / Jenzabar | incremental API, batch | vendor REST / Ethos; batch file | requires tenant/provider verification | term, program, catalog entry, section, registration window, enrollment, hold summary → same | **mock adapter + contract test** (`mock-sis.ts`) | term code formats; section id reuse across terms; enrollment status enums | term code → canonical; status enum map | read | hourly–daily | 24 h | T3 | yes (enrollment) | Registrar | Registrar / SIS | `integration.sis_read` |
| degree_audit | uAchieve / Stellic / custom | API, on demand | vendor API | requires verification | requirement status → academic_requirement | **mock adapter + contract test** | requirement tree shapes differ by vendor | flatten to requirement + status | read | daily / on demand | 24 h | T3 | yes | Registrar | Degree audit system | `integration.degree_audit_read` |
| catalog | SIS catalog / scheduling | incremental API, batch | vendor / public feed | requires verification | catalog entry, section meeting → course_catalog_entry, course_section | not started | cross-listing; meeting time formats | ISO times, cross-list groups | read | daily | 24 h | T0 | no | Registrar | Registrar catalog | `integration.sis_read` |
| lms | Canvas / Brightspace / Blackboard / Moodle / D2L | LTI launch, webhook, API | LTI 1.3 / Advantage (NRPS **not** requested; AGS see D-1) | launch; assignment updated | course → lms_context; assignment → assignment; policy → course_policy | **mock adapter + contract test** | due date time zones; unpublished vs deleted; enum drift | ISO UTC; enum map | read | event / daily | 24 h | T1 (T3 for personal) | yes | Academic technology | LMS | `integration.lms_lti` |
| advising | EAB Navigate / Starfish / custom | incremental API | vendor API | requires verification | appointment, referral → same | **mock adapter + contract test** (`mock-campus.ts`) | appointment status enums | enum map | read | near real time | 60 min | T3 | yes | Advising office | Advising system | `integration.advising_crm` |
| admissions_crm | Slate / Salesforce EDU | batch | vendor API / export | requires verification | admitted status → student_program | not started | — | — | read | daily | 24 h | T3 | yes | Admissions | Admissions CRM | none yet |
| career | Handshake / 12twenty | incremental API | vendor API | requires verification | job, internship, event → same | **mock adapter + contract test** | posting expiry | — | read | daily | 24 h | T1 | no | Career office | Career platform | `integration.career` |
| erp / bursar / financial_aid | Workday / Banner Finance / PeopleSoft | batch, manual | vendor | requires verification | action item only → notification | **mock adapter + contract test** (office, due date, link; never an amount) | amounts must never be mapped | deep link only | read | school-approved | 24 h | T3 | yes | Bursar / Aid | Bursar / Aid office | `integration.erp_bursar_actions` |
| library | Primo / Alma / EBSCO | incremental API | vendor API | requires verification | source → library_source | **mock** (study spaces) + contract test | licence state | — | read | daily | 24 h | T0 | no | Library | Library | `integration.campus_services` |
| tutoring | WCOnline / TutorTrac | incremental API | vendor | requires verification | service, appointment → same | **mock** (services offered, T0) + contract test | — | — | read | daily | 24 h | T1 | yes (appointments) | Learning center | Tutoring center | `integration.campus_services` |
| events / organizations | Campus Groups / Presence / Engage | incremental API | vendor | requires verification | event, organization → same | **mock adapter + contract test** | recurring events | expand to instances | read | daily | 24 h | T0 | no | Student life | Events / orgs office | `integration.campus_services` |
| calendar | Google / Microsoft (institutional) | incremental API | Graph / Calendar API | requires verification | calendar event → same | **mock** (academic calendar, T0) + contract test | time zones, recurrence | ISO UTC | read | daily | 24 h | T1 | yes | IT | Calendar provider | `integration.campus_services` |
| research | Research office systems | batch | — | requires verification | research_opportunity | not started | — | — | read | daily | 24 h | T1 | no | Research office | Research office | none yet |
| study_abroad / alumni | Terra Dotta / Graduway | batch | — | requires verification | opportunity | not started | — | — | read | daily | 24 h | T1 | no | Offices | Offices | none yet |
| alerts / transit | Rave / Everbridge; GTFS | webhook; feed | vendor; GTFS-RT | requires verification | notification, service | **mock adapters + contract test** (15-minute target) | alert severity scales | enum map | read | near real time | 15 min | T0 | no | Safety / Transportation | Alert system | `integration.campus_services` |

## Gaps this audit found

1. **Grade passback bypassed the flag system** — closed for bound registrations in Phase 4 (D-1).
2. **The university gateway's adapter contract and the new adapter declaration are separate shapes.** Real
   adapters should satisfy both; converging them is Phase 4–5 work.
3. **The worker exists and has nothing to run.** `app/server/integration/worker.ts` runs the pipeline against the
   tables on the fifteen-minute `integration-sync` tick (`app/server/integration/tick.ts`), writes sync runs and dead
   letters, and is tested; but `ADAPTERS` in `app/server/integration/registry.ts` is empty, so no connection syncs
   until an adapter is registered.
4. **Freshness on student screens** — closed in Phase 5: Today's *From your school* section shows source and freshness for
   every fact and labels anything not live or recent as not the official current record.
