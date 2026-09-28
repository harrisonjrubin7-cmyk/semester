# Faculty enablement

Part 4 of the expansion command. Phase 2. Nothing here is built yet, and
almost none of it exists: `main` is written from the student's side.

## What exists on main

- Roles `faculty` and `teaching_assistant` exist, and
  `app/src/components/institutional/role-workspace.ts` sketches what faculty do
  (prepare materials, draft assignments, draft feedback) — preview-only.
- Course AI policy, **read from the syllabus**: `CoursePolicy` in
  `app/src/lib/types.ts`, and the layered `resolve()` in
  `app/src/lib/toolkit/policy.ts` (assignment over course over school over
  university). That precedence is the rule this part must keep: a faculty
  setting sits at the course and assignment layers and can never loosen the
  school's.
- Office hours from the student's side: `app/src/lib/officehours.ts`,
  `app/src/components/OfficeHours.tsx`.
- LTI launch and grade passback: `app/src/lib/ltiarrival.ts`,
  `app/src/lib/ltiscore.ts`, `supabase/migrations/20260921160000_lti.sql`.
- `public.approved_source` records sources approved per course.
- `public.accommodation_shares` lets a student share a verified accommodation
  with one instructor for one course.

## In flight

- #779 adds LTI binding (`lti_integration_binding`) — deep linking builds on it.
- #788 adds the student's AI-use declaration, which is the integrity half of
  item 4.
- #781–#787 (AI Toolkit) use `lib/toolkit/policy.ts`.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `course_feature_settings` | **New**, per course, opt-in per feature | `tenant_feature_policy` is per school only |
| `course_ai_tool_policies` | **New**, per course and assignment | Written by the instructor, read by `toolkit/policy.ts` `resolve()` as its course and assignment layers |
| `faculty_resource_packs`, `faculty_resource_pack_items` | **New** | Items reference `approved_source` rows rather than copying them |
| `course_deep_links` | **Extend** #779's LTI binding | A deep link is an LTI message on an existing registration |
| `course_preview_sessions` | **Not a table** | Preview is a render with a student context, not a stored session |
| `faculty_workload_estimates` | **Static data** per feature | "About 10 minutes to set up, none weekly" is a property of the feature, not the course |
| `office_hour_theme_summaries` | **New**, aggregate only, `n >= 5` enforced by a check constraint | The pattern `course_demand_snapshots` uses with `n >= 10` |
| `faculty_feedback_items` | **Reuse** `public.feedback` with a `faculty` kind | One feedback pipeline |
| `faculty_service_expectations` | **Documentation**, not data | A service-level statement is a published document |
| `course_accessibility_checks` | **New** | Per resource: captions, transcript, document tags, contrast; result and date |

## Capabilities and flags

- **`course:configure`** and **`resource:publish`** (the latter exists) at
  `course` scope, granted to the instructor of record and, if they choose, a TA.
- Flag `faculty.course_tools`, `off`.

## Hard boundaries

- **No individual student activity dashboard, by default or by setting.** An
  instructor sees what a student chose to send (an agenda, a question, an
  accommodation share) and aggregates above the threshold. There is no view of
  who studied what, when or for how long.
- Office-hour themes are topics, counted, with no names, no quotes and nothing
  below five students. Below the threshold the screen says so rather than
  showing a smaller number.
- No automated misconduct detection or accusation workflow. Integrity support is
  disclosure (#788), provenance and the course policy.
- A course setting cannot permit what the school forbids: the resolver refuses,
  and the settings screen shows the school's rule as the reason.
- Preview as student renders exactly what a student sees, using the same
  component tree, not a mock-up.

## Tests

- `resolve()` with a permissive course layer under a restrictive school layer
  returns the school's answer (extends the existing policy tests).
- Office-hour themes with four contributors return nothing; with five, counts
  only, and the payload contains no user id.
- Preview render equals the student render for the same course (snapshot of
  both, compared).
- Publishing a resource pack with an item missing captions shows the
  accessibility warning and still lets the instructor decide.
- `.check.sql`: an instructor of course A cannot read course B's settings or
  any student's individual rows.
