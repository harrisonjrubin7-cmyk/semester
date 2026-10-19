# Empty, loading, error and recovery state library

Every state answers what happened, what is affected, what still works and what
the student can do next. It keeps the last usable state while refreshing and
never blames the student for missing data.

## Empty

Use `EmptyState` from `app/src/components/ui.tsx`: a plain sentence, one
primary next step and optional help. Examples: "Start with one course or one
goal", "You can plan here without connecting a calendar", and "Nothing needs
your attention right now".

## Loading and saving

Use layout-matching skeletons or named steps, not an unexplained spinner.
Announce status without moving focus. Use `SaveState` beside the affected
object: Saving, Saved, Saved locally, Offline, Sync trouble or Conflict. Never
block the whole page for one card update.

## Error

Use `ErrorState` for a failed region and `ScreenTrouble` for a failed screen.
State the failure, affected scope, preserved work, required recovery, official
fallback and reference ID. Generic "Something went wrong" is not sufficient
for a consequential workflow.

## Permission and policy

State what is unavailable, why, who controls it and the approved alternative.
A blank panel is never a permission state. Sharing previews name included and
excluded data, recipient, duration and revocation before confirmation.

## Offline, stale and uncertainty

Offline preserves local work and says whether it will sync. Stale data shows
the last known update and official fallback. Estimated and AI-assisted results
show assumptions, sources and correction controls. The student may keep
planning without mistaking the result for an official record.

## Success and undo

Use calm inline confirmation and point to the next step. Low-risk local actions
prefer Undo. Sending, payment, official registration, institutional record
changes, sensitive sharing, export and permanent deletion require confirmation
and a receipt instead.

The detailed component API and current placements remain canonical in
[`../EMPTY-LOADING-ERROR-SUCCESS-STATES.md`](../EMPTY-LOADING-ERROR-SUCCESS-STATES.md).
