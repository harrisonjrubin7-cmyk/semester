# Today + Action Center: Phase B

**Flag:** `today_action_center` (`VITE_TODAY_ACTION_CENTER`), production by
default. An explicit `off` restores the earlier briefing as a rollback.

**Destination:** Today (`home`). While the flag is on, students see it in
place of the #761 briefing.

**Built on (D-020, D-021):**

| Backlog item | What | Branch |
|---|---|---|
| BL-1.1 | `lib/source.ts`, `SourceBadge` | `feature/source-labels` |
| BL-1.2/1.3 | `lib/actions.ts`, the canonical model, stored under `semester.actions.v1` | `feature/action-model` |
| BL-1.4 | `components/ActionCenter.tsx` and `lib/today-actions.ts`: the ranked list and its controls | `feature/action-center` |

Phase B is an **increment on BL-1.4**. It puts Today around the Action
Center, moves the explanation into a sheet, and gates all of it behind the
flag.

## What the student sees (flag on)

| Block | From | Behaviour |
|---|---|---|
| **Path Snapshot** | Phase B | One of exactly three sentences: "On track based on your current plan.", "A few choices could affect your timeline." or "Add a few details to see a clearer path." Then covered / recorded requirements and credits, a labelled `Meter`, **Student entered**, and "Not the registrar's audit". |
| **Next best step + Next + View all** | BL-1.4 | One most important action, up to three next (was five; see `EXPERIENCE-CONTINUITY.md` §2), the rest behind View all. Each shows a due line, source badge and primary button. The controls are **Start · Done · Snooze until tomorrow · Not relevant · Something is wrong · Ask for help**. Undo restores the previous choice exactly. |
| **Why this?** | Phase B, on BL-1.4 | Replaces BL-1.4's inline `<details>`. Under 1180px it is a modal bottom sheet; at 1180px and above it is a non-modal drawer. It has seven headed parts: Why now?, Why this?, Based on, What it changes, What Semester can't tell you, Other options, and **How it was ranked** (BL-1.4's score breakdown). |
| **Done for today** | Phase B | Shown when nothing due today or tomorrow is still open **and** something was completed today, in the Action Center or on the course. For example: "You are set for today. Your next deadline is in 3 days." The list below it is relabelled "When you have a moment". There are no counts, praise or streaks. |
| **Commitments** | Phase B | At most **one urgent** card: a deadline or task within 24 h, never a class, and never the item the Action Center leads with. Then at most **four** rows, time first (Today / Tomorrow / In N days, counted in calendar days) over 10 days. Same-day, same-course rows fold into one. |
| **Quick Actions** | Phase B | Search (palette) · Build plan (Registration) · Add course · View schedule · Prepare for advising (My Path). The order is fixed. |
| **Context pane** (≥1180px) | Phase B | Planning status, the rest of today's classes, account-sync freshness, and a count of upcoming dates not checked against the syllabus. |

**With an explicit rollback to off,** Today is the #761 briefing as it shipped: path card,
one Next best step with "Why am I seeing this?" and "Not now", and the
72-hour rail. The H-2 fix is the only always-on change.

## Source labels

Source labels are BL-1.4's, and unchanged:

| Item | Label |
|---|---|
| Checked deadline | `imported` |
| Unchecked deadline | `needs_review` |
| Path | `estimated` |
| Due reviews | `estimated` |
| Empty workspace | `student_entered` |

Phase B adds `student_entered` on the Path Snapshot figures, which are the
student's own entries, and `needs_review` as "date not checked" on
commitment rows.

## Files

| New | Purpose |
|---|---|
| `lib/today-center.ts` | Status sentences, `UNCALM` / `isCalm`, `timeFirstLabel`, `itemSource`, `doneForToday`, `planCommitments` |
| `components/TodayActionCenter.tsx` | The flag-on Today: path, Action Center, commitments, quick actions, context pane |
| `components/ExplanationSheet.tsx` | Sheet and drawer |
| `components/QuickActions.tsx` | The five actions |
| `styles/textbuttons.test.ts` | H-2 guard |

| Changed | Change |
|---|---|
| `components/ActionCenter.tsx` (BL-1.4) | `Why` is a button that opens `ExplanationSheet` with `rankingLine(s)`; there is an optional `closure` prop |
| `components/ActionCenter.test.tsx` (BL-1.4) | The explanation test opens the sheet and checks the same seven strings |
| `components/TodayDecisionSurface.tsx` | Flag on: `TodayActionCenter`. Flag off: the #761 briefing, restored as `DecisionBriefing` |
| `lib/experience-flags.ts` | `MODULE_FLAGS`, 15 flags, never defaulting to preview. The names are written out in `MODULE_FLAG_ENV` so `lib/deploy.test.ts` can see them |
| `.github/workflows/pages.yml`, `app/.env.example`, `SECRETS.md` | The 15 `VITE_` names mapped, documented and **unset**: they build as `off` until someone sets one. Control check: removing `VITE_TRUST_CENTER` from the workflow fails `deploy.test.ts` |
| `styles/app.css` | H-2 fix (own commit, always on); Phase B layout, sheet and drawer rules, and styles for the Action Center inside a Phase B panel |

## What Phase B dropped in the rebase

These overlapped BL-1.2 to BL-1.4, so they were deleted rather than merged:

- Its own action model.
- Its own `ActionCard` and controls (three snooze times, dismissal reasons,
  correction).
- Its own store hook.

BL-1.4's Snooze is "until tomorrow" only. Offering more than one time is a
follow-up for BL-1.4's `Controls`, not a second control set.

## Accessibility

- **Controls.** Every control is a button. BL-1.4 already worked this way
  (no swipe or long press); Phase B keeps it.
- **Sheet.**
  - `role="dialog" aria-modal="true"`, using `useModal` (trap, Escape, focus
    return).
  - Focus lands on "Why now?".
  - There is a visible Close button.
- **Drawer.** `<aside aria-labelledby>`, not modal. Escape closes it and focus
  returns to the opener.
- **Motion.** The sheet's rise animation is stilled by `data-calm` and
  `prefers-reduced-motion`.
- **Styling.** Tokens only, with the 760/1180 breakpoints, and every target is
  at least 44px. The styles, labels and dead-CSS checks are clean.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `today_action_explained` | Why this? opened (`type`) |
| `today_done_shown` | Done-for-today rendered |
| `today_commitment_opened` | A commitment row or the urgent card opened (`kind`) |
| `today_quick_action` | Quick action pressed (`label`) |

BL-1.4's own controls would add `start`, `complete`, `snooze`, `dismiss`,
`correct`, `help` and `undo`, keyed by action `type`. It never collects a
note's text.

## Tests

| File | Covers |
|---|---|
| `lib/today-center.test.ts` | The three sentences; calm words, including a guard that **every action BL-1.4 proposes** passes them; source labels; done-for-today (closed on the course, completed in the Action Center, not yesterday); calendar-day labels; commitments |
| `components/TodayActionCenter.test.tsx` | Flag off is #761; flag on puts the Action Center inside Today with an approved sentence; ≤1 urgent card and ≤4 rows, never repeating the lead; Done → closure → Undo; sheet on a phone (seven headings, focus, Escape); drawer and pane on a desktop; no banned words |
| `components/ActionCenter.test.tsx` (BL-1.4) | Explanation through the sheet |
| `lib/experience-flags.test.ts` | Module names and defaults; Action Center is production by default and explicitly reversible |
| `styles/textbuttons.test.ts` | H-2 |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- Flag ignored.
- Closure hidden whenever a deadline leads.
- Commitments repeating the lead.
- An uncalm trigger in BL-1.4's proposals.
- Removing the H-2 CSS.

## Responsive manual-test checklist

Checked in Chromium with `VITE_TODAY_ACTION_CENTER=preview`:

- [x] 360, 390, 768 and 1280px: nothing extends past its column (measured).
- [x] 390px: Action Center controls wrap; Why this? opens the bottom sheet.
- [x] 1280px: two columns plus the context pane; the drawer opens beside the
  page.
- [x] Flag off at 390 and 1280px: the #761 briefing with the H-2 fix.
- [x] No `pageerror`.
- [ ] Parchment (light) ground and `calm` mode.
- [ ] VoiceOver / NVDA on real devices.

## Rollback

- **The feature.** Leave `VITE_TODAY_ACTION_CENTER` unset (the default). Today
  is then the #761 briefing, and BL-1.4's Action Center does not render.
- **The H-2 fix.** It is in its own commit; revert that commit.
- **Data.** There is no migration and no synced-state change.
