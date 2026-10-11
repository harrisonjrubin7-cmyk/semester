# Course Engine reconciliation

**Reconciled** 2026-10-08 · **Repository source** `b190f96a` · **Current base** `origin/main` `55adab11` · **Archive** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`

This register reconciles the separately landed `course-engine/` MVP with the mounted design archive and the existing Semester product. It is repository evidence, not archive authority, deployment evidence or permission to ship a second application.

## Measured boundary

Commit `b190f96a` added 89 files under `course-engine/`: a Next.js web app with 15 workspace modes, a FastAPI service with 40 route decorators, 21 SQLAlchemy entity models, a Celery worker, a separate Alembic schema, PostgreSQL/Redis/MinIO Compose services, five API test files, seed/benchmark scripts and local verification prose. The root npm workspace still contains only `app` and `packages/*`; `app/src/screens.tsx` and `app/src/lib/nav.ts` do not register the new shell.

The MVP therefore does **not** change an archive or current catalog row to `existing and verified`. Its useful behaviors are design and implementation evidence to fold into current authorities. Its separate shell, auth, schema and infrastructure are not integration targets.

## One disposition per meaningful family

| ID | MVP family and source | Current Semester owner / archive overlap | Disposition | Evidence-backed basis and acceptance boundary |
| --- | --- | --- | --- | --- |
| CE-01 | Next.js shell and 15 route modes: `course-engine/apps/web/app/`, `components/workspace.tsx` | `app/src/screens.tsx`, `app/src/lib/nav.ts`, `CourseHub.tsx`, `CourseStudio.tsx`; catalog B-027 and C-001–C-039 | Intentionally excluded with a repository-backed rationale | The brief forbids a second app, route system and design system. The shell uses its own Next/Tailwind/raw-color stack and is outside the root workspace. Behaviors must land in current Semester routes and semantic tokens. |
| CE-02 | Registration, login and bearer-token identity: `/auth/register`, `/auth/login`, `core/security.py`, `User` | Current identity, membership and immutable request-context contracts; Phase 2 | Intentionally excluded with a repository-backed rationale | A parallel user/JWT authority would bypass current membership, role, tenant and capability resolution. Any course operation must consume the verified current request context and deny by default. |
| CE-03 | Owner-only course CRUD and `Course` model | `public.courses`, current course state, `CourseHub`, `CourseStudio`; C-002–C-004 | Existing but incomplete | A current course domain and course UI exist, but the MVP's owner-only UUID model is not tenant/course-membership authority. Completion requires one canonical course key, exact membership/capability checks, provenance, recovery and tests before course setup can move from missing. |
| CE-04 | Separate Alembic/SQLAlchemy schema with 21 entities | Supabase migrations, RLS, current course/publication/file/study models | Intentionally excluded with a repository-backed rationale | Copying the schema would create parallel users, courses, assignments, calendar events, assets and progress. Required fields may inform repository-native migrations only after collision, authority, retention and rollback review. |
| CE-05 | Two-step file intake, checksum, object storage and lifecycle | `Import.tsx`, `intake.ts`, `extract.ts`, device Drive/source locker; Stream 01 `student-files` / `course-materials` gap | Existing but incomplete | Current Semester already accepts multiple syllabus/readings and preserves local originals, but no approved server bucket, retention contract, exact course scope, signed download boundary or verified scanner exists. The MVP's local upload endpoint and scanner hook do not close those gaps. |
| CE-06 | PDF/DOCX/PPTX/XLSX/CSV/text/ZIP extraction and location-bearing chunks | `extract.ts`, `intake.ts`, `StudyStudio.tsx`, `studystudio.ts`; student import and C-005/C-011 | Existing but incomplete | Current extraction and multi-source study paths are reachable and tested. Server persistence, safe archive parity, OCR/media adapters, bounded asynchronous recovery and a single source/chunk authority remain incomplete. |
| CE-07 | Citation records and rejection of unknown citation ids | `studystudio.ts`, `StudyStudio.tsx`, `SourceLocker.tsx`; archive source/provenance contract | Existing but incomplete | Semester verifies exact quotations and retains page/slide or character locations in generated sections. The MVP adds useful normalized-record evidence, but its citation ids are not connected to current source objects, deletion propagation or server tenancy. |
| CE-08 | Date extraction, review, conflict resolution, editable calendar and ICS | `Import.tsx`, `import-review.ts`, current calendar state; Course Studio schedule C-007 | Existing but incomplete | Current import already keeps ambiguous results in review, lets the student edit/drop dates and requires explicit confirmation before reminders. A server-authoritative conflict record, course-scoped persistence, external reconciliation and safe ICS publication remain missing. |
| CE-09 | Study-asset generation, regeneration and 14 prompt definitions | `StudyStudio.tsx`, `studystudio.ts`, current AI gateway/policy, Write exports; B-027 and C-009–C-011 | Existing but incomplete | Current Semester already generates from multiple selected sources, checks course AI policy, requires explicit send consent, refuses unsupported citations and saves an editable draft. Server job persistence, cancellation, version history and provider-gateway adoption remain incomplete. |
| CE-10 | PDF, DOCX and flashcard-PDF renderers | Current Write/PDF/DOCX and study-card export paths | Existing but incomplete | Existing exports are the owner. The MVP renderers are not invoked by Semester, and its local benchmark does not prove current production rendering, accessibility or large-document behavior. |
| CE-11 | Flashcard review, quiz attempts and learner progress | Current cards, quizzes, reviews, Study Readiness and device state | Existing but incomplete | Reachable student-controlled practice exists. The parallel progress tables are not adopted; any server move must preserve student scope, no hidden risk scoring, explainability, deletion and tenant boundaries. |
| CE-12 | Celery extraction/generation jobs and job polling contract | Current bounded server/edge patterns and projection operations; platform resilience streams | Prototype only | The worker is isolated from current queues, request context, audit, rate limits, cancellation and operating controls; the API documentation says polling is not yet implemented. It is implementation evidence, not a connected worker. |
| CE-13 | Google/Outlook, OCR, speech, legacy conversion, malware, KMS and media hooks | Current controlled-integration, storage and AI/provider gates | Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision | The MVP explicitly marks these adapters or deployment services as non-live. Exact provider contracts, credentials, scopes, institutional approval and operational evidence are absent. |
| CE-14 | Docker Compose PostgreSQL/Redis/MinIO deployment topology | Current Supabase/Vite/Edge deployment architecture and repository release gates | Prototype only | Docker was unavailable in the source verification report, and the topology is not the production architecture. No deployment, secret, backup, restore, scanning or live isolation evidence follows from the Compose files. |
| CE-15 | Seed data and renderer benchmark | Current fixtures, performance budgets and release evidence | Documentation or roadmap only | Seeded credentials/sample data and a one-run local benchmark support development only. The report itself records a failed WeasyPrint host run and no Docker execution; no production performance claim is accepted. |
| CE-16 | MVP tests and `VERIFICATION_REPORT.md` | Current TypeScript/Vitest/PostgreSQL/RLS/browser/security gates | Documentation or roadmap only | Ten backend tests and separate type/build checks are evidence for the isolated MVP only. They do not exercise Semester navigation, capabilities, RLS, semantic tokens, 320px behavior, current AI gateway or cross-role journeys. |

Disposition totals are 8 existing but incomplete, 3 intentionally excluded, 2 prototype only, 2 documentation or roadmap only and 1 externally blocked. There are zero `existing and verified`, `missing and in scope` or `duplicate or superseded` rows in this current-artifact register; archive catalog rows keep their canonical dispositions in their existing registers.

## Course Studio impact

The MVP does not change the dependency order of archive Course Studio rows:

1. **Keep the current authorities.** `CourseHub`, `CourseStudio`, `Import`, `StudyStudio`, the current AI gateway/policy layer, Supabase migrations and current request context remain owners. The separate UI, auth, Alembic models and queues are not imported.
2. **Close source authority before server ingestion.** The earliest unresolved contract is Stream 01's `student-files` / `course-materials` storage boundary: canonical course identity, exact student or teaching relationship, bucket/path policy, declared-versus-detected type, size/archive limits, scan quarantine, retention/deletion, provenance propagation, rate limits, audit and recovery.
3. **Then connect the first bounded vertical slice.** Extend the existing student import path so multiple course sources can be safely persisted and reviewed, with extracted dates remaining uncommitted until explicit student confirmation and every accepted correction retaining its source. Reuse the same confirmed sources in the existing Study Studio; do not add a Course Engine route.
4. **Keep official academic authority separate.** A student-confirmed personal calendar/study source is not an LMS course shell, faculty-published syllabus, official assignment, grade or record. Faculty setup and publication require exact course membership/capability plus institution/course-scoped audit and rollback.

## Required acceptance evidence for the next slice

- One repository-native course/source identity and no parallel data model.
- Verified request context, exact tenant and course relationship, server-side capability check and cross-tenant negative tests.
- Bounded multi-file intake with type/size/archive validation, quarantine or fail-closed scan state, idempotent completion and recoverable partial failure.
- Original-source retention/deletion behavior, provenance/freshness labels and propagation of confirmed corrections.
- Dates and assignments remain reviewable and do not enter reminders/calendar until explicit confirmation.
- Existing Study Studio consumes only selected, policy-permitted source text; citations resolve to retained originals and deletion makes downstream limitations visible.
- Current UI patterns, complete reachable states, keyboard/screen-reader behavior, reduced motion and the critical path at 320px.
- Focused route/server/RLS/storage tests plus current repository gates. Deployment, providers, institutional approval and DAST remain separate evidence.

## Release boundary

This reconciliation changes no production route, schema, policy, dependency, capability or deployment. The isolated MVP remains source evidence. No provider is connected, no storage bucket exists because of this page, no course data migrated, and no security or readiness claim is raised.
