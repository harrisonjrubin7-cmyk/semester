# Current state

Audit date: 2026-10-08
Audited branch: `codex/course-engine-ui-continuation`
Course Engine baseline: `b190f96a`
Continuation base: `origin/main` at `bf208b6e`

## Executive finding

Semester is not an empty prototype. The repository contains a large Vite/React application (`app/`), 204 Supabase migrations, institutional/governance packages, and extensive tests. The new `course-engine/` vertical slice adds a separate Next.js/FastAPI/Celery/PostgreSQL/Redis/MinIO course workflow. It is source-aware and testable, but it is not deployed or institutionally activated.

The course engine currently supports the credible path `create course → upload → extract/cite → review → calendar → study asset → export/progress`. The UI pass in this branch adds the missing premium shell and operational states while retaining the existing API and data model.

## Evidence snapshot

| Capability | State | Evidence | Limitation |
|---|---|---|---|
| Existing Semester application | tested | `app/src/`, 807 TSX files and 1,395 test-named files | Breadth does not prove every conceptual OS workflow is API-wired or deployed. |
| Course engine schema | coded | `course-engine/apps/api/app/models/entities.py`, 21 persisted entity classes | Initial migration is metadata-driven. Production Postgres was not exercised in this pass. |
| Course engine API | tested | `course-engine/apps/api/app/api/routes.py`, 40 route declarations; API tests | Provider-dependent extraction/generation remains adapter-backed. |
| Student course shell | tested | `course-engine/apps/web/components/app-shell.tsx`; Vitest and axe tests | No visual-regression baseline or device lab run yet. |
| Source/status vocabulary | tested | `source-status.tsx` and its tests | Institutional verification is not inferred from an upload. |
| Study modes | API-wired | Cards, Read, Field guide, Slides, Doc, Quiz, Cases, Cram, Listen routes read stored assets | Real asset generation requires a configured provider and reviewed source evidence. |
| Exports | tested | WeasyPrint, ReportLab, python-docx services and tests | WeasyPrint could not run on this macOS host; container runtime is still unverified here. |
| Deployment | documented | Dockerfiles and Compose files | No production deployment or live institutional operation was observed. |

## Working-tree protection

The primary checkout remained on a separate design-archive branch. This continuation was rebased and verified in an isolated clean worktree; unrelated checkout state was not modified.

## Completion definition

The audit uses: `documented | designed | prototyped | coded | API-wired | tested | deployed`. A higher state is not inferred from a lower one. “Tested” means a named automated or live check passed; it does not mean approved, activated, or independently assured.
