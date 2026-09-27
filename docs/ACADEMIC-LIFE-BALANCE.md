# Academic Life Balance + Crunch Week Forecast: Phase E

**Flags:**

- `academic_life_balance` (`VITE_ACADEMIC_LIFE_BALANCE`): the week's hours in
  Plan.
- `crunch_week_forecast` (`VITE_CRUNCH_WEEK_FORECAST`): the forecast inside
  that view, and one card on Today. The card needs both flags (D-027).

Both are off by default (D-012). With both off, the calendar and Today are
unchanged, and a test holds the Today half of that.

**Destinations:**

- Plan → `calendar`, Week view: under the grid.
- Today: one card above the briefing, only when a crunch is coming.

No new tab.

**Builds on:**

- `lib/clash.ts` (the hard days in the next fortnight). The two do not
  overlap: this looks one to four weeks out.
- `lib/activities.ts` (commitments), `lib/rest.ts` (rest blocks and the
  floor), `lib/windows.ts` (work windows), `lib/athletics.ts` (the season),
  `lib/pace.ts` (the student's own past times), the timetable and the
  syllabus deadlines.

It extends that work rather than rebuilding it.

## What it shows

### `academic_life_balance`, in Plan

A panel under the week grid, for the Sunday-to-Saturday week around the day
the calendar is on:

1. **Your week, in hours.** Hours by category, with the number as text and the
   bar drawn beside it (`aria-hidden`). The categories are:
   - class;
   - work;
   - commute;
   - study;
   - personal;
   - athletics and travel;
   - open time.

   Every total is labelled **Estimated**.
2. **What has no set time.** A line naming the hours that are counted but not
   placed on the clock: commitments given as hours a week, and the commute.
3. **Each day.** Committed hours, open hours and the number of deadlines,
   with a density strip.
4. **Folded away** ("Long stretches, overlaps and open blocks"):
   - **Long stretches:** four hours or more of commitments with no gap longer
     than 15 minutes.
   - **Overlaps:** two commitments on the clock at once, with the minutes.
   - **Open blocks** of an hour or more. **Student entered** when they fall
     inside the work windows the student set; **Estimated** when inside the
     default 7a–11p day.
5. **Due this week.** Each deadline with its source:
   - **Imported** when confirmed against the syllabus;
   - **Needs review** otherwise.
6. **Commute** (folded). Days and minutes each way. Kept on this device.
7. **What it does not do.** It says it counts hours, does not rate a week, and
   cannot see sleep, health or anything not entered.

### `crunch_week_forecast`

**In Plan**, under the balance:

- "The week of Oct 11 has four major deadlines in six days. Want to start two
  earlier?"
- The deadlines, each with its source.
- **Suggested earlier starts**, one or two, each with a reason, labelled
  **Estimated**, and an **Add to calendar…** button.
- **Why this?** (folded): why now, what it changes, what it can't tell you,
  and other options.

**On Today**, the same line, the deadlines and their weakest source, and four
controls:

- **Plan earlier starts** opens Plan's week view on the first suggested day.
- **Why this?** opens the explanation sheet (a bottom sheet under 1180px, a
  drawer from 1180px), with **A date here is wrong** (correct).
- **Snooze a week.**
- **Dismiss.**

The crunch is an `Action` (`crunchAction`), so its choice is stored in the
Action Center's own library under the same key and follows the same
transitions.

## The rules (D-028)

| | |
|---|---|
| Major deadline | An exam, a project, paper, essay, presentation or report, or ≥ 10% by the syllabus's own weights |
| Crunch | ≥ 3 major deadlines within 6 days |
| When | 7 to 27 days ahead |
| How many starts | Count − 2, from one to two |
| Which | The longest by the student's own past times, then the heaviest by weight, then the earliest |
| Where | An open block in the week before the first deadline, from tomorrow; one start a day; not before 9am in the default day |
| How long | Half the student's past time for that kind of work, between 60 and 120 minutes; 90 when unknown |

**How time is counted:**

- A minute covered by two things is counted once, in this order: class,
  athletics, work, study, personal.
- A commitment given as hours a week is spread evenly over the seven days.
- The commute counts twice (there and back) on the days chosen.
- Open time is the waking day, less what is on the clock, less what has no set
  time.
- The waking day is 7a to 11p, or the student's rest floor when it is on.

**Where each input lands:**

| Input | Category | Source |
|---|---|---|
| Timetable | Class | Imported |
| Commitment: job or research | Work | Student entered |
| Commitment: varsity, club sport or intramural | Athletics | Student entered |
| Other commitments | Personal | Student entered |
| Appointment: work | Work | Student entered |
| Appointment: study | Study | Student entered |
| Other appointments | Personal | Student entered |
| Rest block | Personal | Student entered |
| Athletics season, travel included | Athletics | Student entered |
| Commute | Commute | Student entered |

**Rest blocks** are never part of a long stretch or a conflict (D-029).

## What it never does

- It never places anything on a calendar by itself. A suggestion becomes a
  Study event on the student's own Semester calendar only after a
  `ConfirmDialog`:
  - the dialog previews the title, day, time and length;
  - it says the due date does not change;
  - focus starts on Cancel.

  Nothing is written to an external calendar.
- It never scores a week, sets a "healthy" range, or uses wellbeing, burnout,
  stress or overload wording. `life-balance.test.ts` checks the forecast's
  words.
- It never infers anything about a student from usage, and it records no
  usage.
- It never says "at risk", "failing" or "behind".
- It never changes a due date or contacts an instructor. Asking the instructor
  is listed as the student's option.

## Privacy

- **The commute** is the only new input. It lives in `semester.life-balance.v1`
  on the device, and no table or sync carries it.
- **Everything else** is read from where it already lives, including the
  athletics library through `useAthleticEvents`, so its key is not restated.
- **No migration.** No table or network call is added.

## Files

| New | Purpose |
|---|---|
| `lib/life-balance.ts` | Spans, day and week summaries, conflicts, long stretches, open blocks, major deadlines, `crunchForecast`, `crunchAction`, `suggestionAppointment`, the commute reader |
| `lib/life-balance.hook.ts` | `useLifeBalance`: inputs from the store, the season and the commute |
| `components/LifeBalance.tsx` | The Plan panel, the forecast, the confirmation and the commute form |
| `components/CrunchWeekCard.tsx` | The Today card |

| Changed | Change |
|---|---|
| `lib/experience-flags.ts` | `crunch_week_forecast` |
| `screens/Calendar.tsx` | `LifeBalanceSlot`, lazy, under the Week view |
| `components/TodayDecisionSurface.tsx` | `crunchWeek` prop (default: both flags); lazy card beside Registration Day Mode |
| `styles/app.css` | `.balance*`, `.crunch-card*` |
| `.github/workflows/pages.yml`, `app/.env.example`, `SECRETS.md` | `VITE_CRUNCH_WEEK_FORECAST` |

## Tests

| File | Covers |
|---|---|
| `lib/life-balance.test.ts` | **Aggregation:** category hours; each minute once; stated hours spread; commute; trips clipped to days; the rest floor as the waking day. **Conflicts:** found with minutes; rest left out; none on a clear day. **Stretches and open blocks:** joined and broken at a real gap; the default day versus the student's windows. **Sources:** timetable Imported, typed Student entered, deadlines Imported or Needs review, never Institution verified. **Forecast:** four in six days; three asks for one start; spread, minor or too-close deadlines give none; starts on different days, not before nine, inside open blocks; nothing placed; every explanation field filled; calm words. **Also:** major deadlines; the commute reader |
| `components/LifeBalance.test.tsx` | **The view:** hours and days with numbers as text. **Sources:** on deadlines. **Adding a start:** only after the preview, with focus on Cancel; Cancel adds nothing. **The commute:** saved on the device and counted. **The Today card:** absent with the flag off; the line and source; Plan earlier opens the week; Why this; snooze for a week in the Action Center's store |
| `lib/experience-flags.test.ts` | Sixteen flags; the new variable read |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- Double-counting overlapped minutes.
- Rest blocks counted as conflicts.
- The forecast starting today.
- Class labelled student entered.
- Adding before the confirmation.
- The card ignoring its flag.
- Snooze until tomorrow instead of a week.
- Two starts on one day.
- Starts before nine.

## Responsive manual-test checklist

Checked in Chromium, with both flags on, own courses, a crunch in the week of
Oct 11, a shift, practice, lab reading, dinner and a commute:

- [x] 390px Today: the card fits, the four buttons wrap, and Needs review
  shows.
- [x] 1280px Today: Why this? opens the drawer with every section and the
  correct button.
- [x] Plan earlier starts goes to `#/calendar` in the Week view, on the week of
  the first start.
- [x] 390 and 1280px Plan: the categories, the days, the forecast, and
  suggestions on two days.
- [x] The confirmation previews the block; focus is on Cancel.
- [x] No horizontal overflow (measured), no `pageerror`.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `balance_viewed` | The panel rendered with anything in it |
| `crunch_shown` | A crunch card rendered (`count`, `days`) |
| `crunch_plan_opened` | Plan earlier starts |
| `crunch_explained` | Why this? opened |
| `crunch_snoozed` / `_dismissed` / `_corrected` | The choice recorded |
| `study_block_added` | After confirmation; never the title |
| `commute_saved` | Saved; never the days or minutes |

## Rollback

- **The feature.** Leave both flags unset (the default). The panel and the card
  are not rendered, and their chunks are never loaded.
- **The data.**
  - Study blocks already added are ordinary appointments. They stay until the
    student deletes them.
  - The commute stays in `semester.life-balance.v1` on the device, unread.
  - Crunch choices stay in the Action Center's library, where unknown ids are
    ignored.
- Nothing is on the server to undo.
