# Registration Day Mode: Phase C

**Flag:** `registration_day_mode` (`VITE_REGISTRATION_DAY_MODE`), off by
default (D-012).

**Destinations:**

- **Today**, as a card above whichever Today is showing.
- **My Path**, in Registration (`yes`) › Term plan › Registration day.

**Builds on:**

- #762's registration day: countdown, ranked clash-free backups, checklist,
  readiness count and section list. All of it is unchanged.
- Phase B's Today and BL-1.4's Action Center, for the readiness actions.

## What it does

**When it shows.**

- The window opens within **72 hours**, or opened less than a day ago.
- Or the student ticks **Show Registration Day Mode on Today now**, for a
  pilot, a demo, or someone who wants it early.
- Otherwise the Today card renders nothing.

**The Today card** follows the brief's example:

```
REGISTRATION DAY
Registration opens in 01:42:18          ← ticks each second in the last day
[Student entered] Your registration time, as you entered it.
!  10 credits selected, 5 under your 15-credit target
✓  No schedule conflicts
!  2 backup options needed
PRIMARY PLAN
1. PSY 220 — No backup chosen yet.
2. STAT 101 — If STAT 101 is unavailable: 1. ECON 120 01  2. PHIL 115 01
[Imported · Updated 2 days ago] Sections and seat counts from the catalog you imported. Not live.
[Copy course references] [Open official registration system] [Prepare advisor questions] [Registration day plan]
Semester never registers you and cannot hold a seat.
```

**On the Registration Day tab,** with the mode on, #762's tab gains:

- **Your plan at a glance:** the same three lines, and a **credit target** the
  student types (there is no default: Semester does not guess a load).
- **Seat source line:** "Seat counts as of your last catalog import", with an
  **Imported** badge and its age.
- **Seat alerts: not available.** Your school has not connected a live seat
  feed, so Semester cannot tell you when a seat opens. There is no switch
  that pretends otherwise.
- **Worked out from your plan:** the checks Semester can see for itself.
  They are derived, not tickable, so a student cannot tick a claim the cart
  contradicts:
  - schedule reviewed (no conflicts);
  - credit target checked;
  - backup courses saved for every section.
- **Course references:** code, section and CRN where the catalog has one
  (`crn` column), otherwise "reference number not in your catalog". There is
  a copy button.
- **Your official registration system:**
  - The student saves its address, `https:` only (`safePortalUrl`).
  - **Open official registration system** goes through `ConfirmDialog` with
    the external tone. Focus starts on Cancel, and a new tab opens with
    `noopener,noreferrer`.
- **Reminders:** "Remind me the day before and an hour before", on by
  default.
- **Show Registration Day Mode on Today now.**

**Reminders.**

- **When:** the day before (from 8 a.m.) and the hour before.
- **Rule:** they ride the existing **registrar deadline** rule (`term`), so
  they follow that toggle and are silent in the student's **quiet hours**
  (`dueReminders` returns nothing inside them).
- **Where they land:** the registration workspace (`landingFor('regday:…')`
  gives `yes`).
- **Callers:** all three places that build the notifier's source pass the
  window, and a test reads each of them:
  - the in-page tick (`state/store.tsx`);
  - `PushTop`;
  - `PushSwitch`.

**Readiness actions (Action Center).** While the mode shows, each open item
becomes one action in the **Registration readiness** group. The possible
items are:

- add the time;
- build the cart;
- a backup for each unbacked section;
- resolve conflicts;
- each unticked checklist item.

Priority is `critical` in the last three days, so these rank above ordinary
deadlines then. Every action opens `yes`. Every action's limitations say
"Nothing here registers you", and none of them claims to know about holds or
seats.

## What it never does

- It never registers, enrolls or holds a seat. There is no automated
  submission path.
- It never says a seat is available. Seat counts are labelled Imported, with
  their age, and "not live".
- It never opens an official system without a confirmation, and never opens
  an `http:` or `javascript:` address.
- It never invents a portal address, a CRN or a credit load.

## Source labels

| Figure | Label |
|---|---|
| Registration time | `student_entered` (or `imported` if a future feed sets it; #762's `TicketSource`) |
| Sections, seat counts, meeting times | `imported`, with the catalog's import time |
| Credit target, portal address | `student_entered` |

## Data

`semester.registration-day.v1` gains four fields:

| Field | Default |
|---|---|
| `creditTarget` | `null` |
| `portalUrl` | `null` |
| `remind` | `true` |
| `manual` | `false` |

- **Old plans:** a plan saved before this reads with those defaults (tested).
- **Catalog:** `CatalogCourse` gains an optional `crn`, parsed from a `crn`
  column, at most 20 characters.
- **What is not changed:** no synced-state change, no `SCHEMA` bump, and no
  migration. The `seat_watches` table (#762) is untouched: there is no seat
  feed to watch.

## Files

| New | Purpose |
|---|---|
| `lib/registration-window.ts` | Store key, `localTime`, `windowReminders` and `storedWindow`: the only parts the always-loaded notifier needs, kept apart from the catalog parser |
| `lib/registration-actions.ts` | Readiness actions for the Action Center |
| `lib/registration-plan.ts` | `useRegistrationPlan`: cart and plan for screens other than the workspace |
| `components/RegistrationDayCard.tsx` | The Today card |
| `components/ConfirmDialog.tsx` | Preview-then-confirm (DESIGN-SYSTEM §4.9); first use |

| Changed | Change |
|---|---|
| `lib/registration-day.ts` | Four fields; `safePortalUrl`, `modeActive`, `clockDigits`, `summaryLines`, `derivedChecks`, `courseReferences`; re-exports the window module |
| `lib/registration.ts` | Optional `crn` |
| `lib/notify.ts` | `registrationOpens` on the source; the window reminders under `term` |
| `lib/land.ts` | `regday` → `yes` |
| `state/store.tsx`, `components/PushTop.tsx`, `components/PushSwitch.tsx` | Pass `registrationOpens: storedWindow()` |
| `components/RegistrationDay.tsx`, `components/RegistrationPortal.tsx` | The mode's panels (`mode` prop, default the flag); `importedAt` passed through |
| `components/TodayDecisionSurface.tsx` | The card above either Today; **lazy-loads** the card and Phase B's surface |
| `components/TodayActionCenter.tsx` | Adds readiness actions when the mode's flag is on |
| `styles/app.css` | Card, lines and mode rules; `.device`-scoped dialog rules on the app tokens, at `TypeToConfirm`'s layer (85) |

## Bundle

Measured with `npm run build`:

| Build | Entry chunk |
|---|---|
| Phase B base | 627.65 kB |
| First Phase C build | 641.31 kB (+13.7 kB) |
| After moving the notifier's needs to `registration-window.ts` and lazy-loading the flagged Today surfaces | **602.68 kB** |

The card is 4.5 kB and Phase B's surface 25.5 kB, and each is fetched only
when its flag is on.

## Tests

| File | Covers |
|---|---|
| `lib/registration-day.mode.test.ts` | Old plans read with defaults; bad targets and non-https addresses refused; when the mode shows; the clock in the last day only; the three lines; credit target over and under; derived checks; references with and without a CRN; CSV `crn`; both reminders and their times; none claims registration; the `term` toggle and quiet hours silence them; landing on `yes`; `storedWindow` reads, respects `remind`, and survives bad JSON; all three callers pass it |
| `lib/registration-actions.test.ts` | Nothing outside the mode; time first; per-section backups, conflicts and unticked items; nothing when done; critical in the last three days and ranking above a deadline; grouped, routed to `yes`, calm, and honest about registering |
| `components/RegistrationDayCard.test.tsx` | Follows the flag; absent a month out; present when switched on; the brief's shape in the last day; copies references with the CRN; the official system only through a confirmation that starts on Cancel, with `noopener,noreferrer`; no invented address; readiness actions lead the Action Center only with the flag |
| `components/RegistrationDay.mode.test.tsx` | Follows the flag; flag off is #762's tab; credit target; https-only address; seat source and no seat alerts; derived checks not tickable; references; reminder and Today switches; every control named |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- `http:` accepted.
- One caller forgetting the window.
- The mode always on.
- The reminder ignoring its toggle.
- Confirm first with no focus ref.
- The tab ignoring the flag.
- Today ignoring the flag.

## Responsive manual-test checklist

Checked in Chromium with both flags on, a seeded catalog and cart, and the
window 1 h 42 m away:

- [x] 390px: the card fits (measured, no overflow); the clock ticks; the
  confirmation fits.
- [x] 1280px: the card spans the column above Phase B's Today; the four
  actions sit on one row.
- [x] Registration Day tab at 1280px: "Opens in 01:41:46", the reminder and
  Today switches, and the new panels.
- [x] No `pageerror`.
- [ ] Parchment (light) ground; `calm` mode (the dialog has no animation).
- [ ] VoiceOver / NVDA on real devices.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `regday_mode_shown` | Card rendered (`manual` or `window`) |
| `regday_references_copied` | Copy course references |
| `regday_portal_confirmed` | Confirmation accepted; never the address |
| `regday_portal_cancelled` | Confirmation cancelled |
| `regday_reminder_fired` | Window reminder fired (`day` or `hour`) |

## Rollback

- **The feature.** Leave `VITE_REGISTRATION_DAY_MODE` unset (the default).
  The card, the tab panels and the readiness actions are then gone, and #762's
  tab is as it shipped.
- **Reminders.** These fire only with the flag's data present: a plan with a
  time and `remind` on. To stop them without the flag, untick the reminder or
  turn off the registrar-deadline reminder setting.
- **Data.** There is no migration. The four new fields are ignored by older
  builds, because `readRegistrationDay` in #762 builds its result from the
  fields it knows.
