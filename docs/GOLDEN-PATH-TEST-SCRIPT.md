# Golden Path Test Script

The one student journey a controlled launch has to get right, step by step,
with what proves each step and where that proof lives. Launch-readiness
Phase 1.

**Most of this journey is being built in open pull requests.** It is not built
here a second time. This script is what they have to add up to. Its state is
as of `origin/main` at `9f3735a`, 2026-09-27.

## The journey

| # | Step (from the launch command) | On main | Supplied by an open PR |
| --- | --- | --- | --- |
| 1 | Student signs in | `components/Credentials.tsx`, `lib/cloud.ts` (PKCE, SSO) | — |
| 2 | Sees Today | `screens/Today.tsx`, `components/TodayDecisionSurface.tsx` | — |
| 3 | Understands one verified next action | Source labels on Today from #779 (`module.source_freshness_cards`) | The action model, scoring and Action Center: harrisonjrubin7-cmyk/semester#767, #768, #769. Source labels: #766. "Did this help?": #772 |
| 4 | Opens My Path or Plan | `screens/Degree.tsx`, `screens/Calendar.tsx` | The five destinations (Today · My Path · Search · Plan · Me) behind `journeyNavigation`: harrisonjrubin7-cmyk/semester#773. Path Snapshot: #771 |
| 5 | Completes a registration, advising or study action | `screens/Yes.tsx` (registration), `screens/Registrar.tsx` | Advisor Meeting Mode: harrisonjrubin7-cmyk/semester#802 |
| 6 | Opens a source-linked Assignment or Study workspace | `components/toolkit/AssignmentPanel.tsx` (Provenance), behind the AI Toolkit flags | — |
| 7 | Reaches human help if needed | `components/OfficeHours.tsx` | Ask a person, with a staff inbox: harrisonjrubin7-cmyk/semester#791. From the Action Center: #800 |
| 8 | Sees completion and the next step | Stage completion in the assignment workspace (#782) | "Done moves the next action up": #773's smoke, step 5 |
| 9 | Resumes safely on phone, tablet or desktop | `lib/cloud.ts`, `lib/merge.ts`, `lib/offline.ts` | Adaptive devices and continuity: harrisonjrubin7-cmyk/semester#777 |

## How it is walked

`npm run smoke:pilot` in harrisonjrubin7-cmyk/semester#773
(`app/scripts/pilot-smoke.mjs`) already walks steps 3, 4, 5 and 8 against a
served build at 390 px and 1280 px. It covers path details, a course clash
found, a backup section, one next step with its source, done moving the next
action up, and a reload finding everything. It reports 28 checks, all passing,
and includes a control. **It is not yet in `ci.yml`.** Adding it there, once
that stack merges, is the first step toward making this script a regression
test.

`npm run smoke:golden` (`app/scripts/golden-path.mjs`, #896) **is** in
`ci.yml`. It walks the signed-out app at 390 px and 1280 px through:
- first run;
- the account step, declined;
- a course added from a pasted syllabus: built, its dates reviewed and
  approved, saved, and listed on the course. The one model request is
  answered by a stub that refuses unless it is sent the syllabus, and whose
  reply quotes it verbatim, so the app's quote check keeps the dates;
- an action made and seen on Today;
- Plan (step 4): the course's deadline marked on its day on the calendar,
  and something added to that day;
- My Path (step 4): path details saved and shown on the Path Snapshot;
- a deadline's own page (step 6, `#/item/<id>`): the syllabus sentence it was
  read from, its Source & details, and "Work for this". This is the
  source-linked workspace every build has; the AI Toolkit's workspace is
  behind build flags a production build leaves off, and is tied to no
  deadline;
- the Guide, and "Describe the problem" naming whose question it is (step 7).
  A second CI run builds with `VITE_HUMAN_HELP` on and goes on to the request
  to a person: exactly what would be sent is shown, carrying the question;
  signed out, nothing on the screen sends, and nothing is pressed;
- Support;
- completion;
- resume after a reload and in a second tab;
- a restore from the backup file into a fresh browser context.

It is the regression test for the signed-out journey. Steps 1 and 9 — sign
in, and resume on a second device through the account — are
`npm run smoke:sync` (`app/scripts/account-sync.mjs`, #972), in `ci.yml` as
the `account-sync` job against a local Supabase.

Every step in the table above is now walked by one of the two. What is
proved against a stand-in rather than production: the model's reply to a
syllabus (stubbed), the account service (a local Supabase), and human help
(a build with `VITE_HUMAN_HELP` on — whether the deployed build has it on is
a repository variable, not something this repository can read).

## At each step, the smoke also asserts

- **Source and freshness.** Anything presented as the university's says
  where it came from and how old it is. A missing label counts as a failure.
- **Privacy.** No request leaves for a host outside the build's CSP (see
  `lib/csp.test.ts`), and nothing is sent to an institutional system. During
  a beta, `kill.writeback` is engaged (see
  [`PRIVATE-BETA-PROGRAM.md`](PRIVATE-BETA-PROGRAM.md)).
- **Accessibility.** The checks in `app/scripts/accessibility-smoke.mjs`:
  one main landmark, a skip link that moves focus, named controls, and no
  overflow at 320 px.
- **Poor network.** Step 9 is repeated with the context offline. The app
  must show what it has and say it is offline, not show an empty page.

## Beta use

Beta testers walk the same nine steps by hand and report through the beta
panel on Help. An accessibility report goes to the top of the triage queue.
The weekly review compares what testers reported against what the smoke
passed. A step that passes in the smoke but fails for a person means the smoke
is missing a check.
