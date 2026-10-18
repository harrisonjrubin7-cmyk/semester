# Recovery Center — design

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

**Status: R1 built (below); R2 and R3 are designs.** Decision D-153.

> **A correction to the first version of this page.** It said "Restart my week"
> was absent from the student app and proposed building it. That was wrong: the
> week-that-went-wrong screen exists (`screens/Behind.tsx`), and Today already
> shows a welcome-back card after a break. The claim came from research that
> found no feature *named* "Restart my week" and was not checked against the
> code before it was written here. It also missed that `Recovery.tsx` itself told
> students there was nothing to restore while `Export` held a restore. Both are
> fixed below; what R1 built is smaller than what this page first promised, and
> that is the reason.

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
| Recover an unsaved draft | Yes | `lib/draft.ts` (14 days, device-only, says so: `KEPT_LINE`), `lib/draft.hook.ts` | **Closed in R1:** `Recovery` lists them (`lib/recoverydrafts.ts`) |
| Undo a change | Yes, one step | `lib/undo.ts`, `SHOWN_FOR` = 8 s, on-device | Gone after eight seconds |
| Restore a removed item | Partly | Server tombstones kept 90 days (`RETENTION.md`); `Snapshots` (on `Export`) restores the *whole workspace* from up to 20 copies over 7 days, cost shown first, `lib/snapshots.ts` | No student view of tombstones; no per-item restore. **`Recovery` said nothing could be restored; fixed in R1 and held by `Recovery.test.tsx`** |
| Restore a past plan version | **Absent** (per plan) | Whole-workspace copies above are the nearest thing | Needs a version store |
| Rebuild a week after missed deadlines | **Yes** | `screens/Behind.tsx`: everything outstanding, sorted against the student's own hours, nothing hidden; reached from Today's welcome-back card, `BehindOffer`, `lib/you.ts`, `insights/pressure.ts` | **Closed in R1:** `Recovery` now links it. (`FlightPlanRecovery` is a preview-only sample and not the feature) |
| Explain stale or unavailable data, with the official fallback | Partly | `lib/source.ts` (`freshnessLine`, `sourceLine`), `NotOfficial`, `lib/failure.ts`, `lib/trouble.ts`, `lib/offline-mode.ts`; `Recovery`'s first section prints the last sync; the Connect row says what last synced | Explained one source at a time. A consolidated explainer was dropped from R1: what the store can read cheaply is the sync time `Recovery` already prints, so a list of one would add nothing |
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
4. **Restart my week.** It is `screens/Behind.tsx`; `Recovery` links it.
5. **Why is this out of date?** The sync section and the Connect row cover
   what the store can read. A per-source explainer waits until more sources
   record when they last updated.
6. **Ask someone.** Help, with the relevant context attached only after the
   student has reviewed it.

### R1 — built: no schema, no new navigation

What shipped, all on the existing `Recovery` screen:

- **Unfinished writing on this device** (`lib/recoverydrafts.ts`). Each draft
  `draft.ts` holds, by the screen it belongs to, with its word count, when it was
  last typed and how many days it has left, and an *Open* that goes to that
  screen, where it is put back as it always was. Read-only: there is no delete
  here, because a removal with no undo is what `DO-NOT-BUILD.md` #11 forbids;
  clearing the field on its own screen still lets one go. A guard reads the
  source and fails if a screen starts keeping drafts that this list does not
  know.
- **The claim about restoring, corrected.** The screen said there was no earlier
  version of a plan to restore. There is no per-plan version, but there are
  copies of the whole workspace, and it now says so, and links them.
- **One link added, one reworded.** *Sort out a bad week* (`Behind`) is new.
  The existing Export row now also says it is where to go back to an earlier
  copy: a second row to the same screen was tried and refused by
  `lib/oneroute.test.ts`, which holds the repo to one route per home.

What was designed here and **not** built, and why:

- **"Restart my week" as new behaviour.** It exists. The design also said the
  student chooses what still matters and "the rest is archived". That needs a
  new persisted state (a set-aside marker per deadline) — a migration, a sync
  mapping, an export entry — which is not "no schema". It is an owner decision
  and is not in R1; `Behind` already shows everything and hides nothing.
- **A consolidated stale-data explainer.** See the table above.

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
| Recovery does not say nothing can be restored while `Export` holds a restore | `screens/Recovery.test.tsx` (shown red by putting the sentence back) |
| No shame or score vocabulary | `content/ledger.ts` entries for the phrases above |
| Draft list shows only what `draft.ts` holds, honours `KEEP_DAYS`, offers no delete, and knows every screen that keeps a draft | `lib/recoverydrafts.test.ts`, `screens/Recovery.test.tsx` |

## Open questions for the owner

1. Is R1 enough for now, or is the per-plan version store (R2) a launch item?
2. Is a cooling-off window for deleted accounts wanted at all (R3)? It trades
   the strength of "delete" against the value of "undo".
3. ~~Should "Restart my week" appear on Today or only here?~~ Answered by the
   code: Today's welcome-back card and `Behind` already exist, and `Recovery`
   links `Behind`. One door to the feature, two ways to reach it.
4. Should a deadline be *settable aside* — kept, out of the way, restorable —
   which needs the new persisted state described under R1? Today the choices
   are done or outstanding.
