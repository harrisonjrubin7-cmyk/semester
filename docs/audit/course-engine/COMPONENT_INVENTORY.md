# Component inventory

## New course shell components

| Component | State | Contract |
|---|---|---|
| `AppShell` | tested | 248 px Ink rail at desktop, context bar, five labeled mobile destinations, skip link, and command palette. |
| `SourceStatusBadge` | tested | Glyph plus text for source/review state; color is supplemental. |
| `LoadingState`, `ErrorState`, `EmptyState`, `OfflineStrip` | tested | Explicit operational states and working retry/offline language. |
| `OverviewPanel` | tested by build | One primary review action and restrained course metrics. |
| `UploadPanel` | tested by build | Keyboard-accessible chooser, drag/drop, hashing, upload progress, and source classification. |
| `CalendarPanel` | tested by build | All-day/time-unspecified language and record status. |
| `ReviewPanel` | tested by build | Review state plus inspectable extracted payload. |
| `StudyModePanel` | tested by build | Stored study assets or an honest unavailable state. |
| `ProgressPanel` | tested by build | Recorded evidence only; mastery is labeled estimated. |
| `BenchmarkPanel` | tested by build | Real measurements only; no fabricated values. |

## Existing reusable foundation

The Vite app has 572 TSX component files, including `SourceBadge`, `StudyStudio`, `SystemContextBar`, accessibility tools, decision trails, operational states, and data tables. These are evidence of reusable behavior, not automatic compatibility with the Next.js package.

## Consolidation gap

The course engine currently duplicates a small shell/status layer because it is a separate application package. The next architecture decision must either:

1. integrate the course routes into the existing Vite app and reuse its components directly, or
2. extract framework-neutral tokens, types, and primitives into a shared package consumed by both apps.

Maintaining two hand-authored source vocabularies or token systems is not an acceptable steady state.
