# Nontraditional learner pathways

Part 8 of the expansion command. Phase 4. **Can start now.** Nothing here is
built yet beyond the pathway screen that exists.

## What exists on main

- **Pathway** (`app/src/screens/Pathway.tsx`, nav id `pathway`) and
  `app/src/lib/pathway.ts`: life stages from prospective to doctoral,
  professional and alumnus, and templates including Transfer credit,
  International arrival, Thesis, Research publication and Clinical placement.
- Athletics and NIL are the only special-population workspaces.
- `public.student_context` (expansion migration) holds private student segments
  the student sets, and nothing on staff side can read it — the right home for
  a pathway choice.
- Transfer: `public.articulation_rules` (partner proposes, registrar approves) and
  `public.transfer_evaluations` — the database half of the transfer tool, with no
  screen yet.

## In flight

- [#780](https://github.com/harrisonjrubin7-cmyk/semester/pull/780) Graduation
  Simulator and [#794](https://github.com/harrisonjrubin7-cmyk/semester/pull/794)
  Academic Life Balance both plan time; the adult and caregiver time budget
  extends whichever lands, not a third planner.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `learner_pathway_preferences`, `pathway_profiles` | **Reuse** `student_context` | It is already student-set and staff-invisible |
| `transfer_articulations` | **Reuse** `articulation_rules` | |
| `credit_evaluation_statuses` | **Reuse** `transfer_evaluations.status` | |
| `stackable_credentials` | **New** | Nothing like it; links to `skill_records` |
| `research_milestones`, `committee_workflows` | **Extend** the Thesis template in `pathway.ts` | A template with dated steps and named roles |
| `funding_deadlines` | **Reuse** `opportunities` with `kind = 'scholarship'`, plus a `fellowship` kind | |
| `work_schedule_preferences`, `modality_preferences`, `service_access_preferences` | **Device preferences** used as filters | They filter what is shown; they are not sent |

The pathways are **templates and filters over what exists**, not eight
subsystems: evening and online section filters on the catalog, a time budget
on the calendar, time-zone-aware deadlines from
[localization](LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md), and
official-resource routing for veterans, caregivers and international students
from the school pack.

## Capabilities and flags

- `articulation:propose` and `articulation:approve` (exist) for transfer.
- Flag `path.learner_pathways`, `off`.

## Hard boundaries

- **A pathway is chosen by the student, never inferred.** Nothing reads age,
  enrolment pattern, schedule or location to decide someone is a parent, a
  veteran or a working student.
- A pathway choice is never visible to staff unless the school's official record
  already holds it (e.g. `veterans_certifying_official` sees certification
  status, from the official source, not from the student's pathway choice).
- Transfer "what counts where" is an estimate labelled as one until the
  registrar's evaluation says otherwise.
- Benefits (GI Bill, employer tuition) are routed to the official office, never
  calculated.

## Tests

- No module reads `student_context` except the student's own screens (import
  graph test) and RLS refuses every staff capability (`.check.sql`, extending
  `supabase/expansion.check.sql`).
- A transfer scenario shows "Estimate" until an `institution_verified`
  evaluation exists.
- Filters for evening and online sections return only those sections from a
  fixture catalog.
