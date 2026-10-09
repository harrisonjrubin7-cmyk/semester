# Course Engine current state

Audit date: 2026-10-08
Audited branch: `codex/course-engine-mvp`

## Executive finding

Semester is not an empty prototype. The repository contains a large Vite/React application (`app/`), institutional and governance packages, extensive tests, and an established design system. The `course-engine/` vertical slice is a separate Next.js/FastAPI/Celery/PostgreSQL/Redis/MinIO course workflow. It is source-aware and testable, but it is not deployed or institutionally activated.

The course engine supports the credible path `create course → upload → extract/cite → review → calendar → study asset → source inspection → export/progress`. This branch adds the responsive course shell, explicit operational states, and an owner-scoped source viewer while retaining the existing API and data model.

## Evidence snapshot

| Capability | State | Evidence | Limitation |
|---|---|---|---|
| Existing Semester application | tested | `app/src/` and its test suite | Breadth does not prove every conceptual OS workflow is API-wired or deployed. |
| Course engine schema | coded | `course-engine/apps/api/app/models/entities.py` | Initial migration is metadata-driven. Production Postgres was not exercised in this pass. |
| Course engine API | tested | `course-engine/apps/api/app/api/routes.py` and API tests | Provider-dependent extraction and generation remain adapter-backed. |
| Student course shell | tested | `course-engine/apps/web/components/app-shell.tsx`; Vitest and axe tests | No visual-regression baseline or device lab run yet. |
| Source viewer | tested | `source-viewer.tsx`; ownership and location-format tests | Exact PDF bounding-box overlays, correction actions, and cloud signed delivery remain open. |
| Source/status vocabulary | tested | `source-status.tsx` and its tests | Institutional verification is not inferred from an upload. |
| Study modes | API-wired | Cards, Read, Field guide, Slides, Doc, Quiz, Cases, Cram, and Listen routes read stored assets | Real asset generation requires a configured provider and reviewed source evidence. |
| Exports | tested | WeasyPrint, ReportLab, python-docx services and tests | WeasyPrint could not run on this macOS host; container runtime is still unverified here. |
| Deployment | documented | Dockerfiles and Compose files | No production deployment or live institutional operation was observed. |

## Completion definition

This audit uses: `documented | designed | prototyped | coded | API-wired | tested | deployed`. A higher state is not inferred from a lower one. “Tested” means a named automated or live check passed; it does not mean approved, activated, or independently assured.
