# Student First-Win Specification

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PRODUCT SPECIFICATION — OUTCOME NOT YET MEASURED** |
| Owner | Harrison Rubin — Product, Design, Accessibility and Support coordination; backup and qualified accessibility reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Intended population | A student beginning with no or limited Semester data |

## Definition

The first win occurs when a student adds the minimum trustworthy academic context, reaches Today, understands one relevant next action and either completes it or intentionally schedules/defers it—while knowing the source/limits and where to get help. Account creation, page viewing, sample-data exploration or AI output alone is not the win.

## Golden path

1. **Arrive with an honest choice.** Explain device/local behavior, optional account use and sample versus personal data. Do not force AI, notification or broad data access.
2. **Set only necessary context.** Choose term/school context and add one real course or limited plan through an available method. Make manual entry a first-class fallback.
3. **Confirm what Semester knows.** Preview imported/entered items, source labels, dates and uncertainty; allow correction before relying on them.
4. **Reach Today.** Present one dominant next action with why now, source/freshness, what it changes and any official-system limitation.
5. **Act or decide intentionally.** Complete, snooze, dismiss/correct or open the relevant workflow. Preserve work and make reversible actions undoable.
6. **Close the loop.** Show what changed, what is next, where the record lives and how to get human/non-AI help.

## Acceptance criteria

| Area | Required behavior |
| --- | --- |
| Comprehension | student can state what to do next, why, and where the underlying information came from |
| Completion | action produces the expected local or verified external result; no silent consequential write |
| Trust | sample/entered/imported/official status, freshness and limitations are visible and accurate |
| Agency | skip, manual/non-AI route, correction, snooze/dismiss and help are available where applicable |
| Recovery | refresh/back preserves usable progress; error/offline/restricted paths preserve work and explain recovery |
| Accessibility | keyboard and screen-reader path, visible focus, labels, zoom/reflow, target size and reduced motion are verified |
| Responsive quality | 320/390 mobile, 760 transition, 1180 desktop and long-content cases preserve the task order |
| Privacy | minimum data, clear destination/purpose and no dark pattern or unrelated consent |
| Performance | feedback is immediate and approved route budgets are met; loading is honest and cancellable where appropriate |
| Support | relevant help is reachable and the student knows what Semester versus the institution can resolve |

## Measurement plan

Proposed measures require approval before being treated as targets: completion rate, time to first win, correction/abandonment/help rate, source-understanding success, accessibility defects, error recovery and qualitative confidence. Targets remain `[TO BE APPROVED]`. Events must be purpose-limited, avoid prompt/content capture and sensitive profiling, and distinguish sample from personal/verified data.

Completion evidence is a privacy-safe event sequence plus representative observed sessions and accessibility review—not analytics alone. The study should include at least the evidence scope already scheduled in [`PROOF-CALENDAR.md`](../PROOF-CALENDAR.md); any participant count or success threshold must be approved rather than backfilled after results.

## Edge and failure cases

No account; no institution connection; no course yet; invalid/partial syllabus; duplicate course; stale or conflicting date; denied notification/file permission; offline during entry; AI unavailable; inaccessible document; no current action; action points to an unavailable institutional service; student says the recommendation is wrong. Each case needs a safe next step and preserved data.

## Repository validation — 2026-10-03

**Result: PASS for the scripted repository path; operational/user validation remains open.** The production bundle and focused controls were exercised from the `d246a348` checkout with the bundled Node runtime and existing locked dependencies.

| Gate | Result | Exact scope |
| --- | --- | --- |
| focused first-run/state/component suite | **PASS** — 6 files, 43 tests | `pnpm exec vitest run src/screens/firstrun.test.ts src/data/onboarding.test.ts src/state/persist/firstrun.test.ts src/components/TodayGuide.test.tsx src/components/DailyRhythm.test.tsx src/lib/browser-recovery.test.ts` |
| production build | **PASS** — TypeScript and Vite exited 0 | `pnpm run build`; Vite emitted its existing large-chunk advisory, not a build failure |
| golden student journey | **PASS** — 13/13 steps at 390×844 and 1280×900 | cold first run; account offered and declined; manual syllabus course; Today; personal action; calendar; path; source detail; help door; completion; reload/second tab; export and restore into a fresh browser context |
| focused accessibility smoke | **PASS** — 6 critical journeys at desktop and 400% reflow | one main landmark, document language, headings/titles, visible control names, ARIA references, duplicate IDs, overflow and desktop skip-link focus |

The golden path was signed out. It used a deterministic model stub for syllabus parsing, did not send a human-help request because `VITE_HUMAN_HELP` was off, and proved same-device persistence plus backup-file transfer—not account-synchronized resume. The accessibility smoke is automated structure/reflow evidence, not manual screen-reader or qualified conformance evidence. No representative participant, approved analytics event sequence, target, baseline or observed completion rate was involved.

## Evidence state

**Code/config evidence.** Onboarding, course import/manual entry, Today decisions, action/help patterns, local persistence and many accessibility/state controls exist with focused tests. The 2026-10-03 production-bundle run passed the scripted first-win path at phone and desktop widths, plus the focused automated accessibility smoke described above.

**Operational evidence.** The repository still does not contain a completed first-win study, approved targets, route-wide event validation, manual assistive-technology record or proof that a representative student completed this exact path unaided. Account-synchronized resume and the enabled human-help send path were outside this run; some decision surfaces remain flag-dependent.

**Missing test/proof.** Approve the metric and event specification; reconcile the default flag/configuration; validate account sync and enabled human-help sending in an authorized environment; exercise remaining slow/offline/denied/error states; conduct representative usability and manual assistive-technology sessions; close critical findings; record Product acceptance.

## Claim ceiling

Semester may describe this as its intended student first-win path and may cite the specific implemented/tested steps. It may not claim the first win is achieved or validated until the evidence above is filed.

## Prohibited claims

Do not claim a measured activation rate, time-to-value, student outcome, universal ease of use, accessible completion or institutional accuracy without current approved evidence.
