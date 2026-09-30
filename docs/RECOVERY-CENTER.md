# Recovery Center — design

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

**Status: design, not built. Decision D-153 (proposed).** Nothing here ships
until the owner decides it; the first phase needs no schema and no new
navigation.

## The point

A student at a deadline whose plan will not save, whose week fell apart, or who
returns after a month needs one place that says *what is safe, what is waiting,
what can come back, and what to do next* — without shame, without a score, and
without promising something the app cannot do.

## It is an extension, not a new screen

`screens/Recovery.tsx` already exists and is routed (`recovery` in
`screens.tsx`). Its header is explicit about its limits: it gathers five things
that used to live on five screens — the sync words, the offline ledger, the
device library's backup, reconnect, and a person on Help — and it "claims
nothing it cannot do. There is no version history of a plan, so this screen does
not offer one." The Recovery Center is that screen growing the sections below,
in that order, each added only when the thing behind it exists.

It adds **no top-level navigation item** (`DO-NOT-BUILD.md` #1; the roots are
`home, courses, study, calendar, support, mine, me`). It is reached from where
Recovery is reached today, and from the failure and stale states that already
say "something went wrong" (DD-002).

## What already exists, and what is absent

| Recovery function | Exists | Where | Gap |
|---|---|---|---|
| Resume an unfinished workflow | Partly | `lib/opened.ts` (keeps 8; drops finished work, DO-NOT-BUILD #12), `lib/welcomeback.ts` (after `AWAY_DAYS` = 5: what to confirm, what is ahead) | Only surfaces on Today; nothing on Recovery |
| Recover an unsaved draft | Yes | `lib/draft.ts` (14 days, device-only, says so: `KEPT_LINE`), `lib/draft.hook.ts` | Not listed anywhere a student can browse; found only by returning to the field |
| Undo a change | Yes, one step | `lib/undo.ts`, `SHOWN_FOR` = 8 s, on-device | Gone after eight seconds |
| Restore a removed item | Partly | Server tombstones kept 90 days (`RETENTION.md`); `Snapshots` restores the *whole workspace* from up to 20 snapshots over 7 days (`lib/snapshots.ts`) | No student view of tombstones; no per-item restore |
| Restore a past plan version | **Absent** | `Recovery.tsx` says so | Needs a version store |
| Rebuild a week after missed deadlines | **Absent** in the student app | `welcomeback.ts` lists; `components/institutional/FlightPlanRecovery.tsx` is a preview-only sample | The feature the PDF calls "Restart my week" |
| Explain stale or unavailable data, with the official fallback | Partly | `lib/source.ts` (`freshnessLine`, `sourceLine`), `NotOfficial`, `lib/failure.ts`, `lib/trouble.ts`, `lib/offline-mode.ts` | Explained one field at a time; no single "why is this out of date, and where is the official system" |
| Ask for help with context attached, after review | Partly | Help inbox | Context is not attached from Recovery |
| Restore an account after deletion (cooling-off) | **Absent** | `lib/erase.ts` erases | A retention and legal decision, not a UI one — see phase R3 |

## Design

Sections, top to bottom, on the existing screen. Each is a `Panel`/`NavRow`
(`components/shell/Rows.tsx`), with the empty, error and narrow states
`DO-NOT-BUILD.md` #8 requires (`components/unity/States.tsx`).

1. **Is my work safe?** The sync words and offline ledger that are there now.
   One sentence, then the detail.
2. **Pick up where you left off.** From `opened.ts` and the drafts index
   (`draft.ts`): unfinished things, each with what was kept and for how long
   ("Kept on this device for 12 more days — not synced and not in your export").
3. **Something changed or went missing.** Undo while it lasts (`undo.ts`);
   afterwards, the snapshot list (`Snapshots`) with its cost line, and — when
   R2 lands — per-plan versions. Every restore takes a snapshot first, as
   `Snapshots` already does (DO-NOT-BUILD #11).
4. **Restart my week.** R1, below.
5. **Why is this out of date?** One explanation per stale source, in the
   standard shape: what happened, why, what you can still do, the official
   system to open, retry.
6. **Ask someone.** Help, with the relevant context attached only after the
   student has reviewed it.

### R1 — no schema, no new navigation

- **Restart my week**, built on `welcomeback.ts`'s existing reading of what is
  overdue and ahead. The student chooses what still matters; the rest is
  archived, not deleted. Overdue items are named without shame ("This deadline
  passed. Here are your options"), and the offer of a **ten-minute next step**
  is the first action, not the last.
- **The stale-data explainer**, assembled from `freshnessLine`/`sourceLine`
  across the sources a student actually has, ending in the official system.
- **A drafts list**, so a kept draft can be found without remembering the field.

### R2 — needs a version store

Per-plan version history. This is the one function that needs a migration and a
retention decision (how many versions, for how long — `RETENTION.md` sets the
precedent of 90 days for tombstones and 7 for snapshots). Until it exists the
screen keeps saying it does not exist.

### R3 — needs the owner

Account restore within a cooling-off period. `lib/erase.ts` erases; a
cooling-off window means *not* erasing for N days, which changes what "delete my
account" promises (`DATA-PORTABILITY-AND-OFFBOARDING.md`, `COPPA`
posture in D-139). Not designed here beyond naming the conflict.

## What it will not do

- **No scores, rankings or risk labels** — not "you are behind", not "at risk",
  not a behavioural index (`DO-NOT-BUILD.md` #3; the strategy briefs' own rule).
  A rebuilt week carries its reasons and its inputs, in `Action.explanation`'s
  shape, shown by `ExplanationSheet`.
- **No notifications of its own.** A "your week is off" nudge would be a
  notification, and only `lib/notify.ts` may create one, with an owner, a
  preference, a cap and a way out (#4).
- **No claim it cannot keep.** Nothing labelled "restore" that only re-imports;
  nothing that suggests the school's record is Semester's to repair. The
  official system is always named (#7).
- **No AI-written fact presented as official.** Any assistant-drafted plan is
  labelled `estimated` or `needs_review`, never `institution_verified`.

## Tests it needs

| Behaviour | Held by |
|---|---|
| Recovery is reachable and adds no root | `donotbuild.test.ts` (roots list unchanged) |
| A screen opened cold has a way on | `screens/deadends.test.tsx` |
| Every restore snapshots first | extend `lib/snapshots` tests |
| "Restart my week" archives and never deletes | new `lib/recoverweek.test.ts`, including a revert-the-fix run |
| No shame or score vocabulary | `content/ledger.ts` entries for the phrases above |
| Draft list shows only what `draft.ts` holds and honours `KEEP_DAYS` | extend `lib/draft` tests |

## Open questions for the owner

1. Is R1 enough for now, or is the per-plan version store (R2) a launch item?
2. Is a cooling-off window for deleted accounts wanted at all (R3)? It trades
   the strength of "delete" against the value of "undo".
3. Should "Restart my week" appear on Today for a returning student, or only
   here? `welcomeback` already owns that moment; a second door is DD-004's shape.
