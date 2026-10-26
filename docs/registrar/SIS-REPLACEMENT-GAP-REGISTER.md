# Registrar / legacy SIS replacement — gap register

Status: **implementation-to-spec gap register** (blueprint output 1). No schema,
API, migration or deployment was produced by this document. Every row below
was checked against `origin/main` migrations and `app/` source at the time of
writing; table counts were taken with `git grep` over `supabase/migrations/`.

Source of truth for the target: the uploaded *Registrar system migration
blueprint: legacy SIS* (14 pages). The blueprint says its table names and
endpoints are **proposals, not verified Semester infrastructure**. Its cited
standards (`docs/platform/API_CONTRACT_STANDARD.md`,
`docs/platform/INTEGRATION_AND_MIGRATION_FACTORY.md`,
`docs/master/SEMESTER_RELEASE_GATE_CATALOG.md`) are **not in this repository**.

## Authority and scope (read first)

- `docs/institutional-readiness/INSTITUTIONAL-CAPABILITY-MATRIX.md` says Semester
  must not be described as a SIS replacement, migration complete, or official
  record authority. It lists OneRoster/SIS adapters as *designed / not
  implemented* ("production adapter registry empty") and native grades as *not
  proven gradebook of record*.
- The blueprint requires institutional approval before Semester becomes
  authoritative for any scope. Nothing in this register changes that.

## Status vocabulary

`Exists` (in schema and used) · `Partial` (some columns/behaviour, wrong grain
or missing rules) · `Missing` (no table, route or code found) · `Blocked`
(needs input only the institution can give).

## 1. Identity and academic context (blueprint §1)

| Blueprint entity | Closest repo artifact | Status | Gap |
|---|---|---|---|
| `persons` | none | Missing | Every academic row FKs `auth.users`, so a historical student with no account cannot exist. |
| `person_identifiers` (namespace + external key) | `lti_identity`, `scim_external_identity`, `institution_identity_provider` | Partial | Identity-provider bindings, not a person-keyed legacy-ID crosswalk. |
| `account_person_links` | `academic_record_subjects` (tenant, `student_ref`, `user_id`, unique both ways) | Partial | Links an account to a student ref; there is no person layer under it. |
| `institution_memberships` | `schools` / role grants | Partial | No membership status and validity period. |
| `student_academic_contexts` (career, entry term) | `student_context` (`user_id` PK, self/verified segments, `is_minor`) | Partial | Segments are demographic/self-declared, not an academic career. No career, entry term or status. |
| `student_program_assignments` (program version, catalog version, effective period) | none | Missing | No program or catalog versioning. |

## 2. Curriculum and scheduling (blueprint §4, §5)

| Blueprint entity | Closest repo artifact | Status | Gap |
|---|---|---|---|
| Course master (stable identity) | `courses` is per-user JSON (`user_id`, `id`, `data`) | Missing | `courses` is a student's own course plan, not the institutional catalog. |
| Course version / draft / review / publication | `course_studio` tables (authoring content) | Missing | No version chain, review request, approval or publication gate. |
| Program requirement graph | none | Missing | — |
| Offering / section split | `registration_sections` (term + course_code + section) | Partial | One table holds offering and section. |
| Capacity | inline `capacity`, `waitlist_capacity`, `seats_taken`, `waiting` on `registration_sections` | Partial | No shared/reserved capacity pools (`capacity_pools` 0 migrations). |
| Section–capacity bindings, seat reservations | none | Missing | — |
| Meeting patterns (IANA timezone, DST, exceptions) | `registration_sections.meetings` (jsonb array) | Partial | No recurrence model, no exception dates, no persisted occurrences. |
| Teaching assignments | none | Missing | — |
| Schedule validation output (findings, blocking/advisory) | `app/server/institution/registration.ts` (in-process rules) | Partial | Not persisted as `schedule_version` validation results. |
| Schedule publication / section change requests with impact | none | Missing | — |

## 3. Enrollment transactions (blueprint §2)

| Blueprint entity | Closest repo artifact | Status | Gap |
|---|---|---|---|
| `registration_operations` (idempotency, request digest, receipt) | `registration_requests` (unique `actor, idem_key`) | Partial | No digest, receipt or expected-schedule-version column in the reviewed definition. |
| `eligibility_evaluations` (policy version, findings) | rules in `registration.ts`; `registration_holds`, `registration_completions` | Partial | Results are not persisted as evaluations. |
| `enrollments` (context, section, status, credits, grade mode, record version) | `registration_enrollments` (section, student, `state`, `wait_seq`, `grade` only `W`, `version`) | Partial | No academic-context FK, no credits, no grade mode, status enum is product-specific. |
| `enrollment_events` (prior/new state, actor, reason) | `registration_audit_event` | Partial | Audit, not a state-transition ledger with prior/new state. |
| `waitlist_entries` / `waitlist_offers` | `registration_enrollments` `waitlisted` state + `wait_seq` | Partial | No offer window, offer state or expiry. |
| `registration_overrides` (scope, approver, validity, use limits) | `registration_overrides` (section, student, granted_by) | Partial | Validity/use-limit scope to be checked against the blueprint before reuse. |
| Add / drop / swap / withdraw semantics | `registration_terms` (add-drop and withdraw windows, `max_credits`) and `registration_transaction` functions | Partial | Swap atomicity and waitlist acceptance rules need tests against the blueprint's §2.5 table. |
| Lock ordering and bounded transient retry | `registration_transaction` | Partial | Not verified against the blueprint's lock-order requirement. |

## 4. Grades and academic history (blueprint §3)

| Blueprint entity | Closest repo artifact | Status | Gap |
|---|---|---|---|
| Working gradebook (assignments, rubrics) | `gradebook_schemes`, `gradebook_items`, `grade_entries` (versioned), `regrade_*`, `grade_passbacks` | Exists | Built for the working gradebook; `grade_entries` keys to `auth.users`, not an attempt. |
| `course_attempts` | none | Missing | — |
| `grade_scale_versions` | `grade_levels`, `gradebook_schemes` (per course/term/version) | Partial | No institution-level approved scale with effective scope and GPA treatment. |
| `grade_submissions` (faculty scope, submission status) | `grade_entries` / gradebook operations | Partial | No submitter-teaching-assignment check. |
| `official_grade_decisions` (decision type, supersedes, approval) | none for grades; `academic_record_entries` / `academic_record_changes` is a propose/approve ledger for generic record values | Missing (grades) / Partial (pattern) | The ledger pattern (previous-entry chain, approval, reason) fits, but its grain is `student_ref` + `subject_key`, not course attempt. |
| `academic_record_corrections` | `academic_record_changes` (`set`/`void`, reason, decision) | Partial | Generic values, not grade corrections with evidence. |
| `credit_award_decisions` (transfer) | none | Missing | `credit_award*` 0 migrations. |
| `academic_calculation_runs` (policy version, inputs, rounding) | GPA/credit math in `app/src/lib/grades.ts` and related client code | Missing (server) | Calculation is client-side; nothing is recorded as a reproducible run. |
| `standing_decisions` | none | Missing | — |
| `transcript_snapshots` | `app/src/data/transcripts/*` (fixtures), `app/scripts/transcripts.mjs` | Missing (server) | No issued-snapshot table; fixtures are not records. |

## 5. Common REST contract (blueprint §4–§6)

| Blueprint item | Repo state | Status | Gap |
|---|---|---|---|
| `/v1/academic/*` routes (curriculum, scheduling, enrollment, grades) | none (`git grep "/v1/academic"` on `origin/main`: no matches) | Missing | Access is through Supabase tables/RPC and edge functions. |
| `Idempotency-Key`, `If-Match` / expected version rules | `registration_requests` idempotency; `version` columns | Partial | Header contract not defined as a route standard. |
| Error body (`code`, `retryable`, `safe_next_action`, `correlation_id`) | Not found in reviewed code | Missing | — |
| Status code map (200–503) | — | Missing | — |
| OpenAPI for proposed routes (output 4) | none | Blocked | Needs the API standard (not in repo) and the layering decision in the questions below. |

## 6. Migration roadmap (blueprint §7–§8)

| Phase | Repo state | Status |
|---|---|---|
| M0 Scope and authority | No institution, legacy SIS, writer-of-record or data owners are named anywhere in the repo. | Blocked (institution input) |
| M1 Source profiling and mapping | No legacy extracts, code dictionaries or crosswalks available. | Blocked |
| M2 Controlled staging (restricted storage, manifests, quarantine) | No staging store for registrar extracts. | Missing |
| M3 Repeatable transformation | None. `docs/DATA-MIGRATION-PLAN.md` covers only Semester's own device/Postgres changes. | Missing |
| M4 Reconciliation | None. | Missing |
| M5 Shadow operation | None. | Missing |
| M6 Cutover rehearsal | None. | Missing |
| M7 Production authority transfer | Not applicable until M0–M6 and institutional sign-off. | Blocked (approval) |
| M8 Stabilize and retire | Not applicable. | Blocked (approval) |
| Rollback model (writes after authority transfer) | Not designed. | Missing |

## 7. Immediate outputs (blueprint §9)

| # | Output | Status |
|---|---|---|
| 1 | Current implementation-to-spec gap register | **Done** (this document; docs only) |
| 2 | Institution source dictionaries and policy golden cases | Blocked (institution input) |
| 3 | Reviewed migrations and relationship constraints | Not started. Needs the layering decision. |
| 4 | Machine-readable OpenAPI contracts | Not started. Blocked on the API standard and layering decision. |
| 5 | Enrollment concurrency and grade-correction tests | Not started. Feasible against existing `registration_transaction` and `academic_record_*` once the target is decided. |
| 6 | Repeatable import and reconciliation tooling | Blocked (source extracts) |
| 7 | Hosted role-based acceptance results | Blocked (no confirmed staging target, no institutional UAT) |
| 8 | Signed authority-transfer and cutover records | Blocked (institutional approval; cannot be produced in this repository) |

## Deployment status

Nothing in this register is deployed. No migration has been applied to any
database, and no route or service has been published.

## Decisions needed before building (blueprint output 3 onward)

1. **Institution and legacy SIS**: which institution, which legacy system, and who
   can authorize an extract. Milestones M0–M1 cannot start without this.
2. **Record authority**: should Semester's grade and enrollment records become
   the system of record for any scope, or stay a shadow of the legacy SIS? The
   capability matrix currently records this as undecided.
3. **Layering**: add the blueprint's four layers as **new additive tables** beside
   the existing `registration_*`, `gradebook_*` and `academic_record_*` tables, with
   adapters from the old shapes (recommended, matching the additive rule in
   `docs/DATA-MIGRATION-PLAN.md`), or reshape the existing tables in place.
   Recommendation: additive, because the existing tables are in production use.
4. **Standards**: provide the three cited standards (API contract, integration and
   migration factory, release gate catalog), or confirm that `docs/API-PLATFORM.md`
   plus the release checks in this repo may stand in for them.
5. **Staging target**: which Supabase project or branch may receive reviewed
   migrations. Production application needs explicit approval.

## Next executable tasks (no approval needed)

- Write the target schema as a reviewed, additive migration on a branch, with
  constraint tests, after decision 3 is confirmed.
- Write an OpenAPI draft for the enrollment and curriculum routes after decision 4.
- Write enrollment concurrency tests against `registration_transaction` now; they
  guard the current behaviour whichever layering is chosen.
