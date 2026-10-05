# Route and feature crosswalk — unified platform

This extends
[`docs/expansion/ROUTE-AND-FEATURE-CROSSWALK.md`](expansion/ROUTE-AND-FEATURE-CROSSWALK.md),
which maps the v2 brief's §28 items and remains correct. This file adds three
things: every screen on main against the blueprint's five destinations, the
blueprint's public and account routes, and a preserve / extend / refactor /
defer call for each.

Baseline `origin/main` `c029822`. Source of the screen list:
`DESTINATIONS` in `app/src/lib/nav.ts`, dumped at audit time (59 entries).

## How routing works today

- Hash router: `app/src/lib/route.ts` (`toHash`, e.g. `#/home`,
  `#/course/econ`, `#/guide/econ?mode=slides`), guarded by `route.test.ts`,
  `oneroute.test.ts` and `routewhy.test.ts`.
- Screen components are registered in `app/src/screens.tsx`; the registry is
  checked by `screens.test.ts` and `lib/nav.registry.test.ts`.
- Eight shelves (`GROUPS`): Semester, Courses, Study, Make, Campus, Life,
  Beyond, Data. `ALWAYS_TO_HAND = home, me, notifs`.
- Served from GitHub Pages under `/semester/`, a single `index.html`. There
  are **no path routes**, and no public/marketing pages exist.

**Rule for every row:** screen ids and hash URLs are stable. Moving a screen
to a different destination changes `nav.ts` metadata, not its route.

## Screens → blueprint destinations

| Destination | Screens (nav id — label) | Call |
|---|---|---|
| **Today** | `home` Today · `brief` Reports · `behind` When you are behind · `notifs` Alerts | Extend `home` with the Action Center and Path Snapshot (D-006) |
| **My Path** | `degree` The degree · `yes` Registration · `registrar` Term deadlines · `pathway` Pathway · `applying` Applications · `courses` Courses · `import` Add a course · `edit` Edit the course · `announce` A change to a date | Extend `degree` (Path Snapshot, requirement categories per D-004, advisor agenda) and `yes` (readiness workflow) |
| **Search** | Global search and command palette (`components/Command.tsx`, ranker per ADR 0006) · `ask` Ask Semester · `help` How this works | Preserve; new features add keywords to `nav.ts`, not new entries |
| **Plan** | `calendar` Calendar · `runway` Exam runway · `clocks` Timers and alarms · `costs` Money · `meals` Meal plan · `housing` Housing · `maps` Getting there · `activities` Activities · `work` Work on it | Extend `calendar` with personal/work/study blocks against the term plan |
| **Me** | `me` Progress · `profile` Profile · `account` Account · `privacy` · `export` · `data` · `settings` · `connect` · `links` · `mine` Personal · `people` · `mail` · `family` · `career` · `athletics` · `nil` · `university` | Extend `account` with Membership (Phase 2). Career, family and athletics become contextual modules (Phase 4) |
| **Workspace (inside Me / Study)** | `study` · `meet` · `update` · `analyse` · `solve` · `exam` · `sources` · `create` · `draw` · `deck` · `write` · `sheet` · `equations` · `essay` · `proof` | Preserve; Phase 3 Study Studio extends these and does not add a parallel studio |
| **Campus (contextual)** | `call` · `groupwork` · `classmates` · `university` | Preserve; `university` is institution-facing and gated by role and flags |

Placement is proposed under D-003 (needs owner). Until it is approved, the
eight-shelf navigation is unchanged.

## Blueprint public and account routes

None of these exist on main. Hash routes (`#/pricing`) would sit inside the
app shell. Real paths (`/pricing`) need either a second Vite entry
(multi-page build) or prerendered static HTML, because GitHub Pages cannot
rewrite. **Recommendation (D-011, proposed): a separate multi-page Vite entry
`site/` with prerendered static pages at real paths, which is SEO-safe and
leaves the app's hash router untouched. The app is reached at `/app/`, or at
the current root during migration.**

| Route | Purpose | Existing material to reuse | Phase |
|---|---|---|---|
| `/` | Hero "College is complicated. Your path shouldn't be.", demo, conversion | `components/Splash.tsx` visual language; tokens in `src/lib/look.ts` | 2 |
| `/product` `/students` `/institutions` | Feature and audience pages | `SEMESTER_MARKET_READINESS.md`, `docs/institutional-rollout/generated/publication/executive-institutional-brief.md` | 2 |
| `/pricing` | Free / Plus / Pro / Institution Access | Blueprint §12 | 2 |
| `/tools` | Graduation timeline, schedule builder, registration checklist, advisor planner | `lib/graduation.ts`, `lib/registration.ts`, `lib/registration-day.ts` (pure, reusable signed-out) | 2 |
| `/resources` `/help` | Resource centre, help | `help` screen content | 2 |
| `/about` `/careers` `/contact` | Company pages; careers contact harrisonjrubin7@gmail.com | — | 2 |
| `/security` `/privacy` `/accessibility` | Trust Center | `SECURITY.md`, `privacy` screen, `a11y/` guards | 2 |
| `/login` `/signup` | Identity handoff into the app | `screens/Account.tsx`, `lib/cloud.ts` auth | 2 |
| `/account` `/membership` | Plan, cancel, history placeholders, export, deletion | `account`, `export`, `privacy` screens; `data_requests` table (#762) | 2 |

## Regression-sensitive routes

Any change that touches these needs the named tests green, and a note in
[AUDIT.md](AUDIT.md) if behaviour moves:

- `home` — `lib/today-decision.test.ts`, `components/TodayDecisionSurface`
- `yes` — `lib/registration.test.ts`, `lib/registration-day.test.ts`,
  `components/RegistrationDay.test.tsx`
- `degree` — `lib/degree.test.ts`, `lib/graduation.test.ts`,
  `components/GraduationSimulator.test.tsx`
- `#/profile`, which is the public URL named in the blueprint —
  `lib/profile.test.ts`
- Route shape — `lib/route.test.ts`, `lib/oneroute.test.ts`, `screens.test.ts`,
  `lib/nav.registry.test.ts`
- Every mounted root — `src/rootunmount.test.ts`
