# Your campus-portal DDL (6 Oct): the authoritative reference for campus portals

`semester_campus_portals.sql` has 129 tables in schema `semester`, alongside `semester_schema_manifest.csv` (one row per table) and `semester_ddl_review_notes.docx`. All three are kept verbatim. None of it has been executed.

| Domain | Tables |
|---|---|
| Shared foundation | 19 |
| Admissions | 16 |
| Registrar | 18 |
| Housing | 23 |
| Dining | 23 |
| Payments | 7 |
| Governance | 14 |
| LTI | 9 |

## Precedence
1. **The live repo**, where a table already exists (`../../../REPO-CROSSWALK.md`).
2. **This file**, for admissions, registrar, housing, dining, campus payments, governance and LTI campus integration.
3. `../010_campus_portals.sql`, `../011_ferpa_access_and_ledgers.sql` and `../013_audit_logging.sql` are **superseded** wherever they overlap. Read them only for the command functions this DDL leaves out, and port them to the `semester` schema:
   - `require_mode`
   - `request_student_activation`
   - `authorize()` and the purpose policies
   - `record_audit()` with the metadata allow-list
4. `../012_deep_linking.sql` (pending Deep Linking selections) is still needed. This DDL has no equivalent.
5. `../001`–`009` cover the education core, memberships, personal billing and LTI grade passback, and still apply.

## Differences to resolve before building
- **LTI registrations:** this DDL scopes registrations to a tenant, while `../008_lti_hardening.sql` uses a shared registry. Either works. If one Canvas Developer Key serves several schools, pick one approach and make issuer + client_id + deployment resolve to exactly one tenant in the integration control plane.
- **RLS:** **`014_semester_read_policies.sql`** adds the first reviewed read policies (writes stay command-only). `014_semester_read_policies_test.sql` holds the pgTAP checks, which haven't been run.
  - **Identity:** a Supabase user maps to people through `identity_links(issuer = 'supabase-auth')`, plus an active membership.
  - **Helpers:** `my_people`, `is_me`, `is_member`, `is_me_unmembered` (for applicants), `teaches_section`, `teaches_student`, `advises` and `delegated(item)`. They're owned by a **BYPASSRLS helper role**, because FORCE RLS also binds the table owner. Creating that role needs a superuser once.
  - **Allowed by default:** your own records; an instructor sees enrollments and roster names for their own sections; an advisor sees advisee holds, enrollments and requests; a delegate sees only the named items; members see the catalog and dining hours and menus; applicants see their own application and released decisions.
  - **No client policy (stays denied):** audit, disclosure, tokens, PII, privileged grants, exports, LTI, payment internals, reviews, recommendations, placement instructions and accommodation evidence.
  - **Still to do:** restrict the columns a roster can see with a view (`preferred_name`, `status` only).
- **Command-layer checks the DDL can't enforce:** workflow transitions, same-application and same-cycle links, overdraft locks, refund ceilings, seat capacity at the SIS, duplicate provisioning, task-dependency cycles, superseding released decisions, and freezing published plans.

## LTI custom claims (from the ERD PDF, 6 Oct)
| Property | Use | Never |
|---|---|---|
| `semester_record_profile` | Ask for a minimized field profile, intersected with approved fields and the actor's permissions | Widen access |
| `semester_consent_ref` | Locate possible consent, then verify subject, recipient, records, purpose, signature and revocation | Count as consent |
| `semester_policy_hint` | Detect a configuration mismatch; record the policy actually used | Choose the policy |
| `student_id` | Optional mapping through a restricted resolver | Merge accounts by email; appear in logs |
| `advisor_id` | A hint to check against an active advisor assignment | Grant access |
| `ferpa_exception`, `admin=true` | Ignored (an optional mismatch log) | Authorize anything |
| Unknown keys | No effect; log key names only | Log values |

## LTI roles
LTI roles map to course-scoped capabilities only.
- **Learner:** never registrar mutations or other students' records.
- **Instructor:** never university-wide faculty access.
- **TA:** never full instructor rights.
- **Administrator:** never Semester platform admin.
- **Mentor:** never blanket family or advisor access.
- **Unknown roles:** grant nothing.

## Access audit vs FERPA recordkeeping
Every sensitive access is security-audited. Whether a §99.32 disclosure record is required is a separate classification. For example, school-official, parent and eligible-student cases are exceptions.
- **Disclosure records:** kept as long as the education records are.
- **Denials:** a denied request is still classified.
- **Tokenized logs:** these are still PII when linkable to a student.

## Your local tracer (6 Oct)
`Semester_Sortable_Audit_Tracer.html.txt` is kept verbatim as a reference (rename it to .html to open it). It's a sortable Canvas/Blackboard matrix, a live claim decoder (decode only, no signature check) and a simulated tracer state machine. The app's equivalents are `#/operations/lticompliance`, `#/operations/jwt` (id_token plus AGS payload) and `#/operations/ltitrace`.

## Degree tracker and AI suite (015_degree_and_ai.sql, 6 Oct)
**Degree tracker:** catalog versions → requirement sets → nodes, rules and course sets; then student bindings, credit items, equivalencies, exceptions, audit runs, results, allocations, plans, planned courses, advisor reviews, graduation applications and certifications.
- **Requirement states:** met, met if in-progress passes, not met, **unresolved** and planned.
- **One allocation per credit item per run.** The engine must solve constraints rather than allocate greedily; otherwise a course can be used up by the wrong requirement.
- **Official check:** each run records whether it matches the official audit.

**AI and planning:** study plans and sessions, availability windows, practice attempts, assistant preferences, AI runs, source references, policy decisions, recommendations, action approvals and execution results.
- **Recommendations:** each one stores the proposed option, supporting records, alternatives, assumptions, uncertainties, approvals needed and the next reversible action.
- **Approval binding:** a trigger refuses any execution whose payload hash differs from the approved hash, or whose approval is more than an hour old.
- **Personal learning data is owner-only:** no advisor or instructor sees sessions, attempts or preferences. It never becomes a risk profile by default.

**Prototype:** `#/student/degree` (requirement tree, unresolved transfer, what-if, advisor review), `#/student/recommendation` (working shown, approve → execute → verify) and `#/student/briefing`.

**Replacing university systems:** replace the student-facing portal first. Replacing the institutional system behind it is a separate authority decision, with its own proof:
- validated rules for degree audit
- authoritative seats for registration
- campus-card authority for dining
- accounting reconciliation for student accounts
- separate proof for any ERP domain

## Retention guard, structural tests, permission evaluator (6 Oct)
- **`016_disclosure_retention_guard.sql`:** deleting a disclosure record is blocked unless a current records-officer review says the student's records are no longer kept, there's no hold, and no inspection request is open.
  - It fails closed, and TRUNCATE is revoked.
  - There's no assumed "delete after N years" rule.
- **`016_structural_tests.sql`:** 8 checks.
  - RLS enabled and forced on every table.
  - Tenant ids on both sides of every foreign key.
  - The housing exclusion constraint, and the audit history guard.
  - No PUBLIC grants; every definer function pins search_path; no TRUNCATE for the authenticated role.
- **`course-permission-evaluator.ts.txt`:** extracted from PDF text, so indentation was lost.
  - LTI roles add *candidate* capabilities only. A decision needs tenant, membership, LTI context match, deployment capability, grant, relationship, purpose and field scope.
  - It returns a typed reason code.
- **Prototype:** `#/trust/monitor`, the governance monitor (aggregates only).

## Housing and dining reduced schema (6 Oct)
- **`housing_dining_reference.sql`:** 55 tables. **All 55 already exist in `semester_campus_portals.sql`.** It's a reduced, fresh-database reference with simplified billing and payment dependencies. Per its own notes (`pdfs/housing_dining_review_notes.*`), **never apply it alongside the 129-table schema.** Use it only to study housing and dining in isolation.
- **`tenant_isolation_baseline_tests.sql`:** 10 baseline pgTAP assertions, for a sandbox only. They complement `016_structural_tests.sql` (structure) and `014_semester_read_policies_test.sql` (behavior).
- **Still to write**, from its notes:
  - fixtures with positive own-tenant access and other-tenant denial
  - same-tenant ownership, and advisor and faculty scope
  - exports and storage
  - role revocation, and concurrent mutations
- **Command-layer checks it calls out:**
  - roommates in the same cycle, and assignments consistent with their application
  - allocation expiry checked inside the locked confirmation
  - atomic native spending with no overdraft, and ownership of the funding account
  - valid benefits, locations and dates
  - refund and allocation sums, and reversals on the matching account
  - immutable publication and signatures, and validated JSON rules
  - no legal basis or consent ever taken on the client's word
- **Retention:** applies to the full governance schema (see `016_disclosure_retention_guard.sql`), not this reduced one.

## Housing and dining commands (017, 6 Oct)
`017_housing_dining_commands.sql` is the server-side layer the review notes call for.

**Housing:**
- `reserve_bed`: needs an open selection window, for you or for your accepted roommate group. The hold lasts 15 minutes and replays are idempotent; an exclusion violation becomes `BED_OR_PERSON_ALREADY_ALLOCATED`.
- `confirm_bed`: checks the version and the **expiry inside the lock**. A foreign or missing hold gets the same answer.
- `expire_holds`: the explicit expiry worker.

**Dining:**
- `spend_from_wallet`: for the POS service permission only. Serialized by the wallet row lock, so there's no overdraft; idempotent; refused for wallets connected to an external campus-card system.
- `approve_wallet_adjustment`: the approver can't be the requester, and it can't overdraw.
- `reverse_wallet_entry`: same wallet, exact negation, once; a reversal can't itself be reversed.

**Shared helpers:**
- `actor_person`
- `has_permission`: reads current grants with scope, never a stale claim
- `write_audit`

All are owned by `semester_rls_helper`, with `search_path = ''`.

**`017_command_tests.sql`:**
- **Access test cases:** AC-04, 05, 06, 07, 11 and 14.
- **Housing:** replaying a request returns the same allocation; an expired hold can't be confirmed.
- **Dining:** no overdraft; the requester can't approve their own adjustment; a purchase reverses only once.
- **Concurrency:** this needs two connections, so it's described in the file rather than scripted.

## Housing allocations, standalone (6 Oct)
- **`housing_allocations_migration.sql`:** the allocation table alone, with request-key length checks and a version/updated_at trigger. **The same table already exists in `semester_campus_portals.sql`.** Use this file as the reviewed definition of that table, not as an extra migration; running both would fail on "already exists". If the trigger is new, merge it into the main DDL.
- **`housing_allocations_isolation_tests.sql`:** 18 pgTAP assertions for allocation isolation. It complements `017_command_tests.sql`, which covers reserve and confirm, expiry inside the lock, and replay.

## Remaining access tests (018)
`018_remaining_access_tests.sql` covers AC-09, 10, 12, 13 and 16, so all 16 access test cases now have a test. See `handoff/assurance/03-*` for the coverage map.

## Migration package PDF (6 Oct)
`pdfs/PostgreSQL-migration-package.*` describes a 12-file ZIP:
- the housing DDL (the same table as `housing_allocations_migration.sql`)
- a permission migration
- two-university fixtures with 18 pgTAP assertions
- a rollback script
- a jose LTI validator with 16 synthetic token cases
- a local test-runner dashboard
- SHA-256 checksums

**The ZIP itself wasn't attached.**

**One identity mismatch to resolve:** that package's identity adapter uses PostgreSQL `session_user`. Supabase and 014–017 here use `auth.uid()`, read through `identity_links`. These don't mix. With a pooled connection, `session_user` is the pool's role, not the person. **For Supabase, keep the `auth.uid()` adapter (014's `my_people()`)**, and treat the `session_user` version as sandbox-only.

Its rollback script is destructive. Never run it automatically, and keep it out of CI.
