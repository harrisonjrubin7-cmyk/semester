# Native screen catalog

**As of** 2026-10-05 · **Measured** 95 keys in `SCREENS`, plus `home` and `onboarding` (97). 63 destinations in `lib/nav.ts`. 7 areas in `lib/navareas.ts`.

> **Claim ceiling.** A screen existing is not a capability. Grades, registration, housing, dining, family, and the console render real components and still are not authoritative. Traceability below is the PDF screen to the route. Deeper workflow gaps are in the workflow catalog and `docs/master/SEMESTER_GAP_REGISTER.md` (57 of 589 catalogued screens missing; that 589 is the design catalog, not the 97 routes).

## Shell

| PDF ask | Actual | Class |
| --- | --- | --- |
| One Education OS experience | `app/` only | Native |
| Ink side rail, parchment content | Grounds `ink` and `parchment` in `look.ts`. Light default is parchment (D-1293 leaves indigo optional) | Requires design-system migration only where a screen still uses a one-off colour. Audit ledger is the gate |
| Mobile tab bar | `lib/tabbar.ts`: Today, Plan, Learn, Help, Progress | Native |
| Context / source bar | `components/unity/SystemContextBar.tsx`, `ProvenanceChips.tsx` | Native but incomplete: not proven on every screen |
| Role-specific workspaces as separate apps | Same router, capability-gated console and registrar | Do not split frontends |

Area homes: Today `home`, Plan `calendar`, Learn (see `navareas.ts`), Help, Campus, Progress, You.

## Student OS screens the PDF names

| PDF screen | Route id | File | Area intent | Class | Notes |
| --- | --- | --- | --- | --- | --- |
| Today | `home` | `screens/Today.tsx` | today | Native but incomplete | Opens the app. Static import, not lazy |
| Action Center | `home` | today-center | today | Native but incomplete | Not a separate destination |
| Calendar | `calendar` | `screens/Calendar.tsx` | plan | Native but incomplete | |
| Schedule | `calendar`, `courses` | Calendar, Courses | plan / learn | Duplicate risk | No third schedule screen |
| Tasks | productivity / mine | `Mine.tsx`, server productivity | plan | Native but incomplete | Tasks API not the default mount (domain card) |
| Goals | — | — | — | Not started | Use path |
| Path | `pathway` | `Pathway.tsx` | progress | Transitional | |
| Academic plan | `degree` | `Degree.tsx` | progress | Transitional | Says it is not the registrar audit |
| Registration readiness | `registration` | `Registration.tsx` | progress | Unsafe to activate | |
| Course workspace | `courses`, `course`, `item` | `Courses.tsx` | learn | Native but incomplete | |
| Study | `study` | `Study.tsx` | learn | Native but incomplete | |
| Notes | `mine`, `note` | `Mine.tsx` | plan | Native but incomplete | |
| Files | `mine` drive | `screens/mine/Drive.tsx` | plan | Native but incomplete | IndexedDB risk on the domain card |
| Projects | `groupwork` | `Groupwork.tsx` | learn | Native but incomplete | |
| Search | `search` | `Search.tsx` | shell | Native but incomplete | Client index, not a tenant search service |
| AI Copilot | `ask` | ask screen | learn | Native but incomplete | |
| Support | `support`, `help` | `Support.tsx`, `Help.tsx` | help | Native but incomplete | |
| Campus | `university`, `maps` | `University.tsx`, `Maps.tsx` | campus | Native but incomplete | |
| Community | `community` | community screen | campus | Unsafe to activate | |
| Career | `career`, `opportunities` | `Career.tsx`, `Opportunities.tsx` | progress | Pilot-only employer data | |
| Student account | `account`, `costs` | account, `Costs.tsx` | you | Unsafe to activate | |
| Privacy Center | `privacy` | `Privacy.tsx` | you | Native but incomplete | |
| Family sharing | `family` | `Family.tsx` | you | Unsafe to activate | |
| Accessibility | settings + accommodation tables | `settings/` | you | Designed/documented | No disability-services case UI |
| Profile | `profile`, `me` | `Profile.tsx`, `Me.tsx` | you | Native but incomplete | |
| Settings | `settings` and `set*` | `screens/settings/` | you | Native but incomplete | Look, nav, alerts, courses, grading, workload, assistant, about |

Every student screen owes, and does not yet prove on every route: source, authority, freshness, one next action, official versus guidance, a support handoff, a 320px layout, offline behaviour where the action is local, a consent boundary, a data class, and a test. The design contracts in `app/src/styles/` and `app/src/a11y/` cover the system. They are not a per-screen sign-off.

## Course Studio screens

| PDF | Route or gap | Class |
| --- | --- | --- |
| Course home | `course` | Native but incomplete |
| Syllabus, objectives | Inside course detail, not a studio | Partial |
| Schedule | `calendar` | Partial |
| Announcements | `announce` is syllabus-change detection (`screens/changes/`) | Stale name if read as an LMS board |
| Resources, readings | `sources`, `update` | Native but incomplete |
| Notes | `note` | Student-owned |
| Study packs, flashcards, practice | `study`, `drill`, `quiz`, `guess`, `exam` | Native but incomplete; unofficial |
| Tutoring | `ask`, `meet` | Guidance |
| Discussions | community | Unsafe |
| Groups | `groupwork`, `classmates` | Partial |
| Office hours | Displayed from course data | No faculty hold-hours workflow |
| Assignments, assessments | `item`, `gradebook` | Not an assignment builder |
| Question banks, rubrics | No screen | Not started |
| Gradebook and release | `gradebook` | Unsafe to activate |
| Course AI rules | settings assistant + `publish_course_rules` | Partial |
| Course copilot | `ask` in course context | Partial; policy chain incomplete |
| Integrity, analytics, a11y review, archive | No screen found | Not started |
| Import / export | `import`, `export` | Transitional |

## Staff and operator screens

| PDF workspace | Route | Class |
| --- | --- | --- |
| Registrar | `registrar` | Unsafe to activate |
| Console / command center | `console` | Native but incomplete. Grant `console:operate` or the screen states there is nothing to show |
| Trust room | `TrustRoom.tsx` routed as part of trust surfaces | Designed + partial. Not a certification |
| Moderation | `moderation` | Unsafe to activate |
| Volunteers | `volunteer`, `volunteers` | Partial |
| Runway / finance model | `runway`, console Finance model tab | Designed. Opening cash is a placeholder in the company catalog |
| Data studio | `data` | Device-side pasted data |

## PDF command-center sections versus console tabs

The PDF lists executive overview, inbox, my work, approvals, tenants, tenant 360, customers, customer 360, GTM, pilots, implementation, QBRs, renewals, commercial documents, support, beta, flags, releases, integrations, trust, incidents, SLOs, vendors, finance, forecasts, board reports, capacity, preferences.

Present as tabs or nearby screens: approvals, break-glass, audit, customers, figures, finance model, releases and flags, evidence, saved views, conditional support. The rest are not routes. Class: designed/documented only, except the tabs above (native but incomplete).

## States

Shared states to keep using: `EmptyState`, `Notice`, `ErrorState`, `LoadingState`, `PermissionNotice` (`components/ui.tsx`, `components/unity/States.tsx`). Offline: `OfflineBanner`. Forbidden console: the no-grant `Notice` in `Console.tsx`. Long-content and 320px are contract tests, not a per-screen waiver.

## Accessibility status (all screens)

Keyboard, name, and contrast contracts exist and are tested. No qualified external evaluation. Colour is paired with words via `lib/status.ts` where that component is used. Reduced motion uses `--motion-*`. This is not a conformance claim.
