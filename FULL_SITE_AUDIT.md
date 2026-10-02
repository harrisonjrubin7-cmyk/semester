# Semester full-site audit — 1 October 2026

## Product and architecture overview

Semester is a React 19 + TypeScript + Vite progressive web application. Its
student data is local-first, with optional Supabase account sync and separate
institutional adapters behind server-side authorization. The interface is one
application with configurable navigation and layout modes; it is not a set of
independent desktop and mobile products.

The application already has a mature, intentionally restrained visual system:
near-black and metallic grounds, course-derived accents, Barlow/Cinzel type,
semantic surface/text/border/action/status tokens, a 4px-based spacing scale,
three corner settings, sparse elevation, one page frame, and shared interaction
primitives. The current pass preserves that foundation.

## Route inventory

The exhaustive registry in `app/src/screens.tsx` contains 96 application screens
across 90 lazy modules, plus onboarding. The navigation registry exposes the
student-facing destinations through eight task shelves.

```text
home search directory university athletics nil career family pathway launchpad
hub support opportunities create privacy data help courses course item calendar
event me profile notifs settings setLook setNav setAlerts setCourses setGrading
setWorkload setAbout setAssistant mine note import study guide drill guess quiz
lesson update connect links ask work maps mail export yes draw solve edit analyse
classmates community moderation console volunteer agreements volunteers activities
clocks proof applying behind degree meet people brief essay deck write sheet
equations exam announce costs gap groupwork call meals dining housing runway
registrar registration gradebook sources account slides activity whatsnew recovery
onboarding
```

Primary user areas are Today, Courses, Study, Calendar, and Progress/Me. The
directory further groups destinations into Semester, Courses, Study, Make,
Campus, Life, Beyond, and Data. Detail routes inherit their parent destination,
and workspace Search/Directory, Ask, Mail, Call, Drill/Quiz, Slides, Settings,
and Gap intentionally use specialized frames.

## Shared component inventory

- Shells: application header, tab/feed/home/shelf/workspace navigation, page
  frame, settings frame, system context bar, responsive sidebar and mobile bar.
- Actions: shared buttons, icon buttons, action buttons, segmented controls,
  chips and horizontally scrollable chip rows.
- Forms: persistent labels, field messages, file pickers, native selects,
  credential fields, confirmation controls and responsive field grids.
- Feedback: loading, empty, error, offline, status, undo and recovery states.
- Overlays: shared popover, modal focus management, drawers/sheets, command
  search, Quick Add, Accessibility tools and workflow trail.
- Content: section headings, cards/panels, badges, source/trust indicators,
  tables/data lists, course pickers and provenance-aware institutional modules.

## Baseline validation

| Gate | Baseline result |
| --- | --- |
| Production build | Pass (`tsc -b` and Vite build) |
| Lint/policies | Pass with 23 existing React compiler warnings; styles, labels and terminology pass |
| Source screen audit | 96 screens / 90 modules; 29 system-ready, 55 targeted migration, 12 specialized or lower-scoring frames |
| Automated viewport sweeps | Present, but local Playwright runtime unavailable in the initial environment |
| Existing browser review | All 97 routes previously opened at desktop and phone sizes; focused 320px and 1024px checks recorded in `docs/UI-USABILITY-REVIEW-2026-10-01.md` |

The first package-runner attempt was incompatible with the checkout's npm
layout and could not reach the registry. The existing dependency tree was
restored without source changes; subsequent gates run the locked local tools
directly.

## Full-site audit checklist

- [x] Route and lazy-module registry reconciled.
- [x] Navigation, page frame, shared actions, forms, feedback and overlays inventoried.
- [x] Logged-out/unconfigured institutional states retained and reviewed as gated states.
- [x] Loading, empty, error, offline and recovery primitives located and sampled.
- [x] Mobile, tablet and desktop behavior reviewed from existing browser evidence and width guards.
- [x] Keyboard/focus rules reviewed for global navigation and overlays.
- [x] Design tokens, typography, density, contrast and reduced-motion controls reviewed.
- [x] Baseline build, lint and static screen audit run.
- [x] Post-change focused regression suite and live desktop/mobile verification.
- [x] Final full test/build/policy rerun and improvement report.

## Findings and priorities

### P0

No current P0 was reproduced. The branch builds, the route registry is
exhaustive, and no confirmed core navigation, data-loss, security-sensitive or
task-blocking mobile failure remains open. Institutional activation and approval
remain external release gates and are not inferred from repository readiness.

### P1

1. **Shared disclosure semantics and render safety.** Accessibility tools and
   workflow steps visually behave like buttons that open dialogs, but their
   implementation uses empty native `details` elements whose content is
   portaled elsewhere. This weakens the semantic relationship, complicates
   expanded-state reporting, and is the only new React ref warning in this
   usability branch. Replace the hidden disclosure mechanism with a real button,
   `aria-expanded`, `aria-haspopup` and `aria-controls`, while preserving focus
   return, outside dismissal, lazy loading and state retention.
2. **Representative runtime verification.** Recheck the shared shell and the
   changed disclosures at 320–390px and desktop width, including keyboard focus,
   viewport containment and console output.
3. **Stable class-chat unread boundary.** The room correctly freezes its unread
   divider at the opening mark, but did so by reading a mutable ref during
   render. Preserve the behavior with a lazy state snapshot and cover the
   parent-mark update that must not move the divider.

### P2

1. Reduce the remaining pre-existing React compiler warnings in focused batches;
   do not hide event-time clock reads or ref behavior behind lint suppression.
2. Continue migrating the 55 source-audit “targeted migration” screens toward
   shared frames and primitives only when the specialized layout does not serve
   the workflow better.
3. Measure the two large entry chunks before changing code-splitting boundaries;
   most heavy tools are already lazy and size alone is not a user-impact finding.

### P3

- Further decorative polish and motion are intentionally deferred. They do not
  improve task completion, clarity or accessibility enough to outrank the work
  above.

## Implementation plan

1. Replace the shared tool disclosure's empty `details` control with an
   explicitly associated button-and-dialog primitive.
2. Update shared popover and disclosure regression coverage, including expanded
   state and opener-safe outside dismissal.
3. Replace the class-chat render ref with an explicit opening snapshot and add
   a regression for the frozen `NEW` divider.
4. Validate focused tests, lint, build, desktop/mobile runtime behavior and the
   security scan required for meaningful code changes.
5. Update `IMPROVEMENT_REPORT.md` with exact scope, outcomes and remaining risk.
