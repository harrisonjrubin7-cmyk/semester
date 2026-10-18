# Experience continuity: where each of the sixteen items stands

**Baseline:** `origin/main` at `cbc6c5a`, 27 Sep 2026.

**The brief:** make Semester feel like one system over time. It should
remember context, not make students repeat themselves, keep their work,
explain itself, and have a stable home. It has sixteen items.

**How to read this page:** each item has three parts.

- **Already there**, with the files.
- **This change**, meaning what was built alongside this page.
- **Next**, meaning the concrete remaining work in the order it should land.

Nothing is marked done that a test does not hold. Companion pages:

- [DO-NOT-BUILD.md](DO-NOT-BUILD.md): item 16, enforced by
  `app/src/donotbuild.test.ts`.
- [DESIGN-SYSTEM-IMPROVEMENTS.md](DESIGN-SYSTEM-IMPROVEMENTS.md): the sheet,
  drawer and privacy-panel contracts that items 3 and 7 build on.
- [UX-ENHANCEMENT-PLAN.md](UX-ENHANCEMENT-PLAN.md): the Today audit that item 2
  answers.

## Summary

| # | Item | Status | This change |
|---|---|---|---|
| 1 | Context continuity | Partial | Recently opened deadlines and courses; "Continue where you left off" in search |
| 2 | Today as the home state | Partial → tighter | Action Center capped at 1 + 3 |
| 3 | Universal object drawer | Shell exists, one use | None. Next is extracting the shell |
| 4 | One search / command surface | Partial | Continue rows on the search page |
| 5 | Staged onboarding, return-user recovery | Partial → return flow built | Welcome-back card on Today |
| 6 | Notification discipline | Partial → enforced | Tiers, daily cap, a "why" on every notification |
| 7 | "Why am I seeing this?" and My Data | Partial | None |
| 8 | Life-happens flows | Partial | None |
| 9 | Progressive disclosure | Partial | None |
| 10 | Cross-role model | Missing as one map | §10 below |
| 11 | Undo, history, recoverability | Partial | None |
| 12 | System health, freshness | Mostly there | None |
| 13 | Print, export, share standard | Built, unwritten | §13 below |
| 14 | Interruption and resumption | Partial | Covered by items 1 and 5 |
| 15 | Real-user testing | Pilot only | §15 below |
| 16 | Do-not-build list | Scattered | [DO-NOT-BUILD.md](DO-NOT-BUILD.md) plus a test |

---

## 1. Preserve context everywhere

**Already there:**

- A real back stack: `history` in `state/shape.ts`, walked by
  `state/slices/navigate.ts`.
- Hash URLs for every screen (`lib/route.ts`), kept in step with the
  browser's Back.
- `?screen=` deep links (`lib/deeplink.ts`).
- Recently opened *screens* (`state.recent`).
- Browser-style tabs (`components/Tabs.tsx`).
- `useDraft` in `lib/draft.hook.ts`, used by five long-form editors.

**This change:**

- `lib/opened.ts`. The navigation funnel now records the deadlines and courses
  opened, newest first, capped at 8. Only ids are kept, and titles are looked
  up at render time.
- The search page (`components/Command.tsx`) offers the four most recent as
  **Continue where you left off**, and only unfinished ones: a ticked deadline
  is not offered back.

**Next:**

1. **A route-context object.** `courseId`/`itemId`/`eventId` are separate
   fields today, so "Get help" opened from an assignment arrives knowing
   nothing. Add one optional `context: { courseId?, itemId?, date? }` to
   `go`. Then have `GetHelp` and `lib/help-routes.ts` pre-filter from it. This
   is DO-NOT-BUILD rule 5.
2. **Sticky filters.** `filter`/`evFilter` reset on reload. Persist them
   per screen.
3. **`useDraft` on short forms.** Help requests (`GetHelp`), `AskForTime` and
   `QuickAdd` lose what was typed on an error or a closed sheet.
4. **Context chips.** On `item` and `course`, show the parent: the course on
   a deadline, the term on a course. Make them tappable.

## 2. Today is the home state

**Already there:**

- `TodayDecisionSurface` shows one next decision with "Why am I seeing
  this?", plus a 72-hour timeline.
- The Action Center (`components/TodayActionCenter.tsx`, flag
  `today_action_center`) shows ranked actions, and quick capture exists
  (`lib/capture.ts`, `QuickAdd`).
- The clutter audit is `UX-ENHANCEMENT-PLAN.md` §1.2.

**This change:** `NEXT_LIMIT` in `lib/actions.ts` goes from 5 to **3**. Today
is now one most important action plus up to three, with the rest behind
"View all". Nothing is hidden; the fold moves.

**Next:** carry out the §1.2 consolidation so Today has exactly six things:

1. One next action.
2. Up to three priorities.
3. The time-sensitive schedule.
4. One support path.
5. Capture.
6. Links onward.

The eleven stacked blocks become those six. Do not add widgets to Today; new
modules propose an `Action` instead (DO-NOT-BUILD rules 2 and 3).

## 3. Universal object drawer

**Already there:** `components/ExplanationSheet.tsx` already is the pattern.
It is a bottom sheet under 1180px and a non-modal right drawer above it, with
focus return and Escape. Today it only knows how to show an `Action`.

**Next:**

1. Extract its shell as `components/ObjectSheet.tsx`, taking title, status,
   source, purpose, facts, primary action, related items, and an "Open full
   details" link. Keep `ExplanationSheet` as its first caller, so its tests
   hold the behaviour.
2. Add previews in this order: deadline, course, service (from
   `lib/help-routes.ts`), event, place (`lib/findplace.ts`), person.
3. Open them from search results and Today rows instead of navigating. "Open
   full details" is the navigation.

## 4. One search, command and help surface

**Already there:**

- One overlay (`components/Command.tsx`) over one ranker (`lib/find.ts`,
  `docs/architecture/0006-search-is-one-ranker.md`).
- It covers deadlines, courses, units, lessons, notes, documents, sheets,
  decks, tasks, appointments, screens, and an "Ask" hand-off to the assistant.
- It deliberately does not run data-changing commands; the file's own
  docblock says why.

**This change:** Continue rows (item 1).

**Next:**

1. Add services, places, people and events to `lib/find.ts`, as rows rather
   than as separate search screens.
2. Every result states its type, context, and **source and freshness**
   (`SourceBadge`).

"Create" stays a screen with a preview. That is a settled design choice, not
a gap.

## 5. Staged onboarding and return-user recovery

**Already there:**

- A five-step first run (`screens/Onboarding.tsx`).
- Screens that reveal themselves as they become useful (`lib/reveal.ts`).
- A one-line "since you last looked" on Today (`lib/since.ts`).

**This change:** `lib/welcomeback.ts`, drawn on Today as **Welcome back · N
days away** after five or more calendar days. It shows:

- **What carries forward**, in words.
- **What needs confirming:** deadlines that fell during the gap and are
  unticked, each with a tick. It never calls them "missed", because the app
  cannot see a paper handed in elsewhere.
- **What is ahead:** the next seven days.
- **One restart action.**

It is silent on a first run and for short gaps.

**Next:** a just-in-time teaching moment the first time each core workflow is
used, in place of any tour.

## 6. Notification discipline

**Already there:**

- One reminder engine (`lib/notify.ts`), with a switch per rule, quiet hours,
  muted courses, and once-per-reminder dedupe.
- Push is planned on the device (`lib/push.ts`).
- Notices has Required, Soon, Update and FYI tiers, and a digest setting
  (`lib/comms.ts`).

**This change:**

| Tier | Rules | Delivery | Cap |
|---|---|---|---|
| Critical | registrar deadline, tuition payment | In-app notification and push | Never capped |
| Important | class starting, due today, two-day warning, exam in a week, class you can't miss | In-app notification and push | At most 5 a day, on a budget of their own |
| Helpful | time to start, all-clear, Sunday summary | In-app notification and push | At most 1 a day; can never use the important budget |
| Informational | new features, completed syncs | Notices only, never a notification | n/a |
| Sponsorship | none | Not built; separate opt-in only | n/a |

- The table is `TIER`, `IMPORTANT_CAP` and `HELPFUL_CAP` in `lib/notify.ts`
  (6 a day in all). The same budgets apply to an open tab (`fire`) and to
  push (`planAhead`). They are separate so that the morning's nudges can
  never cost an afternoon class warning its place.
- Every notification now ends with **why it was sent**, naming the Settings
  switch (or "you set this up yourself" for the student's own rules).
- A new rule does not type-check until it has a tier.
- `donotbuild.test.ts` fails if a notification is created anywhere except
  the three allow-listed files.

**Next:**

1. Snooze on a notification, not only on an action.
2. Fold `lib/actions.ts`'s `critical/high/normal/low` and `lib/comms.ts`'s
   tiers into this one vocabulary.

## 7. "Why am I seeing this?" and My Data

**Already there:**

- `ExplanationSheet` covers why now, why this, what it's based on, what it
  changes, what Semester can't tell you, other options, and how it was
  ranked.
- Every `Action` carries these, and `TodayDecisionSurface` has its own.
- Data controls exist but are spread over five screens: `Privacy`, `Data`,
  `Account`, `Connect` and `Export`.

**Next:**

1. One **My Data** hub (the Data Privacy Panel contract in
   DESIGN-SYSTEM-IMPROVEMENTS §4.13) that links those five.
2. Add AI preferences from `lib/aiflags.ts`.
3. Add "Why am I seeing this?" to Notices rows and search's recommended
   journeys.

## 8. Life-happens flows

**Already there:**

| Situation | Where |
|---|---|
| Behind | `screens/Behind.tsx`, `BehindOffer` (which also points at withdrawal dates) |
| Absent | `AbsenceNotices` |
| Need more time | `AskForTime` |
| Get help, by kind | `lib/help-routes.ts` + `GetHelp`: course, writing, research, registration, career, community, accessibility, money, wellbeing |
| Accommodations, basic needs, emergency | `screens/Support.tsx` |
| Graduating | `GraduationSimulator` |
| Term end | `CloseTerm` |

**Next:** add the missing situations as `help-routes` entries rather than new
screens:

- I missed an assignment.
- I can't afford a material or fee.
- I'm considering withdrawing.
- I need to change my schedule.
- I'm transferring.
- I'm returning after stopping out.

Each follows one pattern: acknowledge → urgency or safety → official options
→ what Semester can't determine → next action → a person → privacy.

## 9. Progressive disclosure

**Already there:**

- `components/Fold.tsx` folds content.
- The `chunk` access mode (`lib/accessmode.ts`) shows one step at a time.
- Holds show Required with a `SourceBadge` (`lib/official-notices.ts`).

**Next:** make Layer 1/2/3 the shape of a hold or notice row:

- **Layer 1:** what it stops.
- **Layer 2:** who owns it and how to reach them.
- **Layer 3:** the record, type, timestamp and policy, behind "Details".

## 10. Cross-role object map

The same names, statuses and detail shape for every role. Only permission and
density change.

| Object | Student | Advisor / staff | Administrator |
|---|---|---|---|
| Action | Complete, snooze, dismiss, correct, ask for help | Recommend, follow up (help inbox: `HelpInbox`) | Configure templates; see aggregate use |
| Course | Learn, plan | View authorised context | Maintain integrations and policy |
| Service | Find, book, contact (`help-routes`) | Receive referrals (`HelpInbox`) | Configure availability and routing |
| Source | See authority and freshness (`SourceBadge`) | Verify, correct | Govern the source and its data contract |
| Plan | Personal plan | Prepare for advising | Review aggregate outcomes |
| Notice | Read, act | Send within their office | Govern tiers and senders |

The three role vocabularies that disagree today (`lib/role.ts`,
`packages/institution`, the roles migration; see `ROLE_REQUIREMENTS.md`) must
converge on this table's names before a second staff screen is built.

## 11. Undo, history, recoverability

**Already there:**

- An eight-second undo for removals (`lib/undo.ts`, `Undone`).
- Editor undo and redo (`lib/history.ts`), document versions
  (`lib/docversions.ts`), and "go back a day" snapshots (`Snapshots`).
- Workspace backup.
- `TypeToConfirm` for the consequential.

**Next:**

1. A receipt for every outward request: help, booking, export.
2. A student-visible activity list of those receipts.
3. Archive rather than delete for courses and notes.

## 12. System health and freshness

**Already there:**

- Five source labels with freshness lines (`lib/source.ts`, `SourceBadge`).
- A last-sync line on Today.
- Storage and data health (`screens/Data.tsx`, `StorageRoom`).
- Troubleshooting (`Trouble`).

**Next:** one app-wide sync indicator (in progress, delayed or unavailable)
that links to the source and its fallback. Put `SourceBadge` on every
imported fact.

## 13. Print, export and share standard

**Already there:** CSV, Markdown, ICS and JSON (`lib/export.ts`, with QA in
`lib/exportqa.ts`), print, course sharing, and share-in.

**The standard, for every export:**

1. State what it contains.
2. Give the source and freshness of each fact in it.
3. Give its privacy class: *yours only*, *shareable*, or *contains others'
   data*.
4. Say who can open it. A link carries its expiry and a revoke path.
5. Use accessible structure: headings, table headers, and alt text on
   figures.

A new export format goes through `lib/exportqa.ts`.

## 14. Interruption and resumption

**Already there:** drafts on the long editors, in-progress state
(`lib/underway.ts`), a timer visible everywhere, offline support through the
service worker, and error boundaries.

**This change:** "Continue where you left off" (item 1) and the welcome-back
card (item 5) are the resumption surfaces.

**Next:**

1. Short-form drafts (item 1).
2. Honour `navigator.connection.saveData` as a basic mode: no figures or
   audio preloading.

## 15. Real-user testing

**Already there:** the pilot and its interviews (`PILOT.md`), and the service
design research notes (`docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md`).

**The standing panel:**

- **Students:** first-year, transfer, commuter, working, online, graduate,
  international, assistive-technology users, first-generation, and students
  who know campus well or barely.
- **Staff:** advisors, faculty, librarians, student-success staff, and IT and
  accessibility administrators.

**The task script.** Each task is timed and unaided, and gets one success
question afterwards.

1. Find tutoring after falling behind.
2. Understand a deadline and name its official source.
3. Plan the next three days around assignments and work.
4. Prepare for an advising appointment.
5. Find accessible campus support.
6. Change a registration plan.
7. Explain why a recommendation appeared.
8. Return to unfinished work (items 1 and 5).
9. Resolve a stale or unavailable source (item 12).

Run each task with at least three people per circumstance before a phase's
flag defaults on.

## 16. Do not build

See [DO-NOT-BUILD.md](DO-NOT-BUILD.md). It has twelve rules. The mechanical
ones (the top-level navigation set, notification ownership, and no ad or
tracking SDK) fail the build through `app/src/donotbuild.test.ts`. The lists
that test checks are read from the page itself.
