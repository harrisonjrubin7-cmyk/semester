# Native domain catalog

**As of** 2026-10-05 · **Base** `origin/main` `3bd382dc` · **PDF** Education OS brief, platforms A–T

> **Claim ceiling.** Maturity is a reading of code, migrations, and a read-only look at project `lzrqvlugnawcgywkhqlz`. It is not a pilot, a certification, or authority. The thirty-six-field cards for D01–D40 stay in [`docs/master/SEMESTER_DOMAIN_CATALOG.md`](../master/SEMESTER_DOMAIN_CATALOG.md). This catalog is the PDF's own list, pointed at those cards. Universal defaults (accessibility, audit, SLO, support, consent, AI) are in [PDF_TO_CODE_RECONCILIATION.md](PDF_TO_CODE_RECONCILIATION.md).

**Ready for pilot: 0. Ready for production: 0. Ready to become authoritative: 0.**

## Student OS and daily experience (PDF A, phase 2)

| Feature | Domain | Roles | Route | Code | Tables / RPCs | Authority | Class | Priority | Risk | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Today | D01 | Student | `home` | `screens/Today.tsx`, `lib/today-center.ts` | Device state; optional account sync | S+X student plan; institution facts labelled | Native but incomplete | P0 wedge surface | Seeded term read as real | Source label on every fact already required; keep it |
| Action Center | D01 | Student | `home` (not its own route) | today-center, office-action publish | `office` actions when published | Derived | Native but incomplete | P0 | Official action implied by a suggestion | Separate guidance from office-published actions |
| Calendar / schedule | D02 | Student | `calendar` | `screens/Calendar.tsx` | `calendar_feeds` | S student; X feeds | Native but incomplete | P1 | Stale feed shown as current | Freshness chip on every imported event |
| Tasks, notes, files | D02 | Student | `mine`, `note` | `screens/Mine.tsx`, productivity server | `tasks`, `notes`, `productivity_*` | S, sync gated | Native but incomplete | P1 | Device-only loss | Account link before calling it durable |
| Goals | D01 | Student | none found | — | — | — | Not started | P2 | A new goals table beside plans | Fold into path, do not add a second store |
| Path / academic plan | D03 | Student | `pathway`, `degree` | `Pathway.tsx`, `Degree.tsx` | course plan contribution RPC | X official audit; S plan | Transitional | P0 for the wedge | Plan read as a degree audit | Copy already says it is not the registrar audit; hold that |
| Registration readiness | D12 | Student | `registration` | `Registration.tsx` | `my_registration`, `registration_*` | X SIS | Unsafe to activate | P0 wedge | A readiness view treated as enrolment | Readiness copy and handoff only until gates pass |
| Course workspace | D04 | Student, faculty | `courses`, `course`, `item` | `screens/Courses.tsx` | `courses`, guidance RPCs | X LMS | Native but incomplete | P1 | Course shell mistaken for the LMS | Label LMS as the record |
| Study, search, copilot | D01 D06 D07 | Student | `study`, `search`, `ask` | `Study.tsx`, `Search.tsx` | AI edge function | AI never official | Native but incomplete | P0 | Ungoverned answer | Decision flow in the workflow catalog |
| Support | D09 | Student, staff | `support`, `help` | `Support.tsx`, `Help.tsx` | `support_tickets`, `open_support_ticket` | S for Semester tickets | Native but incomplete | P0 | Ticket stored without consent boundary | Consent migration exists; keep it in front of send |
| Campus, community, career | D15 D19 D23 | Student | `university`, `community`, `career` | matching screens | `community_*`, `skill_*` | Mixed | See those rows | P1–P2 | Community and career claims | Do not activate community production |
| Student account | D13 | Student | `account`, `costs` | account and bill screens | `student_account_*` | X bursar | Unsafe to activate | P1 | Balance shown as official | Source label; no card data |
| Privacy, family, settings, profile | D24 D28 | Student, guardian | `privacy`, `family`, `settings`, `profile` | matching screens | `family_*`, export/erase RPCs | S consent | Family unsafe to activate | P0 privacy | Over-sharing | Scoped, time-bounded grants only |

## Learning and Course Studio (PDF B, phase 3)

| Feature | Class | Evidence | Authority | Next action |
| --- | --- | --- | --- | --- |
| Course home, syllabus, schedule, office hours display | Native but incomplete | `courses` destination keywords include syllabus, office hours, grading | X LMS | Display and guidance, not a second syllabus of record |
| Objectives, announcements, resources | Partial | `announce` screen is change-detection, not a course announcement board | X | Do not rename `announce` into an LMS board |
| Assignments | Partial | `gradebook_add_item` creates a graded item. No instruction/date builder (gap register) | X | Item is not an assignment |
| Assessments, question banks | Designed + pure rules | `lib/itembank.ts` is not wired to a screen | X | Unsafe to present as an exam engine |
| Rubrics | Not started as a builder | Grading scheme only | X | Gap register P0 |
| Gradebook, moderation, release, regrade, passback | Native but incomplete; unsafe | `Gradebook.tsx`, `gradebook_*` RPCs including `gradebook_release` and `gradebook_queue_passback` | X LMS until a term of dual-run | Passback runner is not invoked outside tests (prior gap) |
| Study packs, flashcards, practice | Native but incomplete | `study`, `drill`, `quiz`, `exam`, `publish_study_pack` | S student study material | Keep unofficial |
| Discussions, groups | Partial | `community`, `groupwork`, `groups` tables | S | Moderation gates |
| Course AI rules | Partial | `publish_course_rules` | Institution policy | Enforce in the gateway, not only in copy |
| Academic integrity, analytics, accessibility review, archive | Not started as workflows | Gap register: no integrity workflow, no faculty analytics share, no course a11y review | — | Documented only |
| Import / export | Partial | `Import.tsx`, `Export.tsx`, migration center | Transitional | Sample validation is not a catalog load |

## Registrar, registration, records (PDF C, phase 4)

| Feature | Class | Code / data | Blocker |
| --- | --- | --- | --- |
| Hierarchy, campuses, schools, departments | Native but incomplete | `schools`, `institution_*`, `school_*` | F-01 isolation off |
| Terms, sections, meetings, capacity | Partial | `registrar_put_term`, `registrar_put_section` | Bulk catalog import missing |
| Prerequisites | Partial | Per-section course codes | — |
| Co-requisites | Not started | Gap register: no co-requisite rule | — |
| Windows, time tickets | Unsafe | `registration_time_tickets` student-writable copy; server enforces opening only | Registrar cannot issue staggered tickets |
| Holds | Unsafe | `registration_holds` RLS and no policy (default deny). Adapter list empty | No sync |
| Enrol, add/drop, withdraw | Unsafe | `registration_enroll`, `registration_drop`, `registration_withdraw` | SIS remains the record; closed as authority |
| Overrides | Partial | `registrar_grant_override` | Enrolment requests only |
| Standing, degree audit, transfer, articulation, graduation, conferral | Unsafe / partial | `Degree.tsx` student arithmetic; ledger kinds exist | Not a registrar audit; no transcript |
| Transcript / official export | Not started as issuance | Per-student ledger CSV. `ledger.ts` says not a transcript | Legal review |
| Reconciliation, migration, audit | Designed + tables | `migration_*`, `academic_record_*` | No dual-run evidence |

Command shape the PDF requires (request → policy → capability → source → approval → idempotency → command → audit → receipt → projection): pieces exist (`approval_request`, `audit_event`, `private.domain_outbox_events`, registration RPCs). A projection worker and read-model registry were not found. The chain is not one system.

## Student success, finance, campus, community, career, family (PDF D, G, H, I, J, K)

| Domain | Class | Must stay true |
| --- | --- | --- |
| D09 Advising | Native but incomplete. Caseload, check-in, success plan, referral outcome: not found | Notes are T3+ and consented |
| D13 Student finance | Ledger tables exist. No payment-provider connection measured this pass. Stripe checkout is a separate commercial path held by flag | Never store raw card numbers. Bursar stays authoritative |
| D14 Aid | Directory handoff | No aid decision in Semester |
| D15–D18 Campus, housing, dining, events | Dining RPCs exist (`dining_place_order` and queue). Housing maintenance request not found. Events backend not found by the prior catalog | Office remains the record |
| D19 Community | Posts, comments, reactions, reports, appeals, aliases, moderation RPCs exist | Unsafe to activate. Appeals and restrictions need the existing moderation path, not a new one |
| D21 Safety | Handoff copy | Semester is never the emergency system |
| D23 Career | Skills, portfolio, interview prep drafts. Employer side is sandbox | Self-reported claims stay labelled |
| D24 Family | Invites, grants, accept, revoke path, export withholding of guardian restrictions | Unsafe until security and privacy review |

## Control plane, integration, trust, company, console, developer (PDF L–Q)

| PDF block | Class | Measured |
| --- | --- | --- |
| L Control plane | Native but incomplete | `tenant_*` 11 tables, `scim_*` 3, configuration studio and workflow builder migrations, feature policy, module mode, kill switch, cohorts. No evidence a tenant runs on them. |
| M Integration factory | Transitional | 16 `integration_*` tables, LTI and Canvas edge functions, governance write migration. Prior catalog: adapters empty, services 503 unless sandbox. This pass did not replay a sync. |
| N Trust | Designed/documented + partial | Privacy RPCs (`raise_my_data_subject_request`, `export_my_data`), legal holds, erasure, trust-room function. HECVAT and pen-test evidence are documents, not certifications. |
| O Company OS | Designed/documented | GTM tables mostly empty of live tuples except small catalog/compliance/support estimates. No runway figure, no board pack, no insurance record in code. |
| P Command center | Native but incomplete | 10 tabs: Command center, Approvals, Break-glass, Audit, Customers, Figures, Finance model, Releases and flags, Evidence, Views. Support tab is conditional. PDF lists dozens of sections these tabs do not implement (Tenant 360, QBR, dunning, error budgets, board reports). |
| Q Developer / marketplace | Not started for partners | Outbound OAuth helper only. No partner app review, metering, or revenue share. |
| R Graph | Not a product | Nodes in the PDF map to existing tables or to nothing. Required node metadata (authority, freshness, classification, consent, retention) is a standard to apply per table, not a new database. |
| Global (phase 12) | Designed/documented | D40. English. No RTL, no residency split, no regional payment provider. |

## Duplicate and stale

| Item | Class | Why |
| --- | --- | --- |
| Second design-token package | Duplicate if created | `look.ts` / `tokens.css` already win |
| Second navigation for "Education OS" | Duplicate if created | `navareas.ts` is the student week |
| `docs/master` domain cards vs this folder | This folder is the index | Edit cards in `docs/master/tools/domains.py` when a fact changes, then render. Do not fork the 36 fields here |
| Ops read models named `ops_*` | Not started under those names | Prior reconciliation. Still not found by name |
| Projection worker | Not started | Outbox table exists |
