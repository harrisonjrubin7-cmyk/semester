---
description: Make the calendar direct — drag anything you own to move it, in every view, and double-tap empty space to add an event there.
argument-hint: "[optional: a single view to do first, e.g. 'month' or 'day']"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Nothing on the calendar is static

`app/src/screens/Calendar.tsx` is 1375 lines and every item on it is read-only.
`grep -rn "draggable\|onDragStart\|onPointerDown" app/src/screens app/src/components`
finds nothing in the calendar at all: to move a task you leave the calendar,
find it, open it, and type a new date. A calendar you cannot move things on is a
printout.

Two changes, in every view.

## 1. Drag to move

The four views and where their items are drawn:

| View | Function | Grid | Positioning |
| --- | --- | --- | --- |
| Day | `DayView` | `components/HourGrid.tsx` | `ROW = 54` px per hour, `GUTTER = 46`, top = minutes past midnight |
| Week | `WeekView` | `components/WeekGrid.tsx` | `ROW = 46`, `GUTTER = 30`, lanes from `lib/weekpage.ts` |
| Month | `MonthView` | hand-rolled grid, `lib/monthgrid.ts` + `monthGrid` in `lib/date.ts` | day cells |
| Semester | `SemesterView` | hand-rolled | week rows |

**Day and week:** dragging moves both the day and the time. The grid already
maps minutes to pixels; invert that same arithmetic to map a drop back to
minutes, and snap to 15 minutes. Show the new time on the block as it moves.

**Month:** dragging moves the day only. The time of day is untouched.

**Semester:** dragging moves to the week it lands in, keeping the day of the
week where the drop is unambiguous, otherwise Monday of that week. If a week row
is too small for this to be honest, say so and leave the view alone rather than
shipping a gesture that lands things a day off.

### What can be dragged, and what happens when it lands

This is the part that matters. This app's whole premise is that a deadline is
the syllabus's, not the app's, so the four kinds do not behave the same:

1. **Your tasks** (`PersonalTask`, `state/slices/mine.ts`) — drag freely.
   Dispatch `editTask`. Its `time` is free text and is never parsed, so on a day
   or week drop, write the new clock time in the same wording the app already
   uses elsewhere. This is the easy case and the one to build first.
2. **Your appointments** (`Appointment`) — drag freely, both axes. `at` is
   minutes past midnight and `time` is how it is written; keep them consistent.
   There is `addAppointment`, `setAppointmentKind` and `deleteAppointment` but
   no move — add `moveAppointment` to `state/slices/mine.ts` with a reducer
   test, rather than deleting and re-adding, which would lose the id and
   anything pointing at it.
3. **Syllabus deadlines** (`Item`, in the catalogue) — draggable, but *never*
   silently. This is a claim about what a professor said, so:
   - On drop, ask once, in place: "Move ECON PS4 to Fri 10 Oct? The syllabus
     says Wed 8 Oct." Confirm moves it; anything else puts it back.
   - Write it through the same path `screens/EditCourse.tsx` uses —
     `replaceCourse` — not by mutating the catalogue in place.
   - Record that it moved. Add an optional field to `Item` in `lib/types.ts`
     (`movedFrom?: { month: number; day: number; year?: number }`) and show
     "Moved from 8 Oct" wherever the item's syllabus quote is shown. Optional,
     so every existing course still loads. Check `docs/data-contract.md` and
     `packages/contract/src/index.ts` and update them if this crosses the
     contract; if it does, say so before writing the code.
   - Never touch the `quote` or `checked` fields. The sentence from the syllabus
     stays exactly what the syllabus said.
4. **Class meetings and campus events** — not draggable. A class is a recurring
   pattern, and dragging one instance would either rewrite the whole timetable
   or invent a one-off the data has no room for; a campus event is not yours to
   move. Instead, a press on one offers what is real: for a class, "Cancel this
   one" and "Edit the meeting pattern" (which goes to `edit`); for a campus
   event, the existing save/unsave. Make the not-draggable case *feel*
   deliberate — a small resistance and the sheet, not a dead item.

### How the gesture must behave

- **Pointer Events, one implementation, all views.** Write it once as a hook —
  `app/src/lib/drag.ts` plus a `useDragToMove` — and use it from all four views
  and both grids. Do not use HTML5 drag-and-drop: it does not work on touch.
  Do not add a drag library.
- **A drag starts after a long press on touch (about 250ms) or 6px of movement
  with a mouse.** Below that it is a scroll or a tap, and the calendar must
  still scroll normally under a finger. `components/AskForTime.tsx` and
  `ai/AskAbout.tsx` already hold long presses at 450ms with a 10px drift — read
  them and stay out of each other's way, or the row that is meant to ask the
  assistant about a deadline will fight the row that is meant to move it. State
  in the code which gesture wins and why.
- **The item follows the finger** with the original left in place at low
  opacity, and the target cell or hour highlighted. `touch-action: none` on the
  dragged element only, so the rest of the page still scrolls.
- **Auto-scroll** when a drag reaches the top or bottom edge of a scrolling grid.
- **Undo, always.** Every move shows the same undo affordance the assistant's
  actions use (`ai/Actions.tsx`, `components/Undone.tsx`). A mis-drop on a
  phone must cost one tap to fix.
- **Escape or a drop outside the grid cancels** and the item goes back.
- **Keyboard equivalent, not optional.** A focused item takes `Enter` or `Space`
  to pick up, arrow keys to move by a day (or 15 minutes with Shift in the timed
  views), `Enter` to drop, `Escape` to cancel — and announces the new date in a
  live region. A drag-only calendar is unusable with a keyboard or a screen
  reader, and the rest of this app does not ship that.
- **Nothing moves into the past silently.** Dropping a deadline before today is
  allowed but says so.

## 2. Double-tap empty space to add

- **Month:** double-tap a day cell → new item on that date, no time.
- **Day and week:** double-tap an empty part of the grid → new item on that day,
  at the hour you tapped, snapped to 15 minutes.
- **Semester:** double-tap a week → new item on the Monday of that week.

What opens is a small inline composer over the calendar, not a navigation away:

- Prefilled with the date and time from where you tapped, shown as words and
  editable.
- One text field. Reuse the parser in `lib/capture.ts` and the preview behaviour
  of `components/QuickAdd.tsx` — it shows what it read before it writes, and
  that reasoning holds here for the same reason.
- Course chips from `catalog.courses` so it can be filed, and a kind picker
  (`lib/kinds.ts`) so it colours correctly.
- Enter adds and keeps the composer open on the same day; Escape closes.
- **It writes one of yours** — a `PersonalTask` via `addTask`, or an
  `Appointment` via `addAppointment` when it has a real time — and never an
  `Item`. A re-imported syllabus rewrites its own items and would eat anything
  written into that list. `QuickAdd`'s file comment says this; obey it.
- Double-tap on an *occupied* cell opens the thing, as a single tap does. Do not
  create underneath something.
- On desktop, a single click on empty space plus a click-and-drag across hours
  also creates — dragging out a span sets its length. Keep double-tap working
  everywhere so the phone gesture and the laptop gesture are the same gesture.

## Guardrails

- Do not restructure the calendar's two axes. View (`calView`) and source
  (`calSource`) stay independent; the file comment explains why and it is right.
- Do not change what leaves the device (`lib/context.ts`).
- Do not add a dependency.
- Keep the file-top prose in every file you touch, and add to it: say what a
  drag means in that view and what it refuses to move.

## Done means

From `app/`:

```bash
npm run lint && npm test && npm run build
```

All green, plus tests that actually cover the arithmetic and the rules:

- Pixel → minutes and pixel → day inversion, for both grids, including the
  15-minute snap and the edges of the grid.
- Dragging a task across a month boundary, and across a daylight-saving change —
  run `npm run test:zones`, which already checks two timezones.
- A syllabus deadline drag writes through `replaceCourse`, sets `movedFrom`, and
  leaves `quote` and `checked` untouched.
- A class meeting and a campus event refuse the drag.
- Undo restores the exact previous date and time.
- The keyboard path moves an item without a pointer.

Then say, plainly: which views you tested at which widths, on touch and with a
mouse, and anything that is still static and why.
