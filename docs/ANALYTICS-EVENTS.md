# Pilot event definitions

**Status: definitions only, per D-005 (approved 27 Sep 2026).** Nothing on this
page is sent to a server. [`/ANALYTICS.md`](../ANALYTICS.md) still promises
exactly three server marks (`opened`, `course`, `studied`), and the check
constraint in `supabase/migrations/20260921151000_activity.sql` still enforces
it.

Each event below says what question it answers, where the fact already lives
on the student's device, and what collecting it on the server would take. A
mark moves from this page into `ANALYTICS.md` only in its own PR, which must:

1. Write the question into `ANALYTICS.md`, next to the three existing marks.
2. Add a migration widening the `activity.mark` check constraint.
3. Extend `lib/activity.ts` `MARKS`, plus its tests and `supabase/activity.check.sql`.
4. Get owner review before merge. Merging is the production change.

The shape of the three existing marks is the model to follow: one row per
account, per day, per mark. It carries no screen, no title, no course, no
count and no free text.

## Definitions

| Event | Question it answers | On the device today | Server shape if approved |
|---|---|---|---|
| `activation` | Did a new student get to a first useful screen? | Already `opened` + `course` in `ANALYTICS.md` | **Exists.** No change |
| `path_created` | Did the student describe where they are headed? | `semester.path-profile.v1:<account>` has any field, or `state.requirements` is non-empty (`lib/path-profile.ts` `hasPathProfile`) | Mark `path`, once a day while true |
| `plan_saved` | Did the student save a potential schedule? | `semester.registration.v1` `plans.length > 0` | Mark `plan` |
| `backup_saved` | Did the student choose a backup section? | `semester.registration-day.v1` backups (≤5 per section) | Mark `backup` |
| `conflict_resolved` | Did a time conflict get fixed before registration? | Not recorded. Conflicts are recomputed (`lib/registration.ts` `conflicts()`) and nothing notes when one disappears | **Needs design.** Record "had a conflict, now has none" on the device first |
| `action_completed` | Does the Action Center lead to done things? | `semester.actions.v1:<account>` history entries with `event: 'complete'` | Mark `acted` |
| `agenda_created` | Did the student prepare for an advisor meeting? | Advisor Meeting Mode is not built yet (the other session's Phase G) | Mark `agenda`, added with Phase G |
| `clarity_submitted` | "Did this help you understand what to do next?" | `semester.clarity.v1:<account>`: answers yes / somewhat / no, at most weekly (`lib/clarity.ts`) | **Not a mark.** An answer is content, not presence. If collected, it needs its own aggregate-only table with n ≥ 10 reporting, like `course_demand_snapshots` |

## What is never collected

- Titles, course codes, notes, goals, programme names, requirement names, or
  anything typed.
- The Action Center's ranking inputs or which action was shown.
- Anything per screen or per session, or time-of-day.
- The clarity answer tied to an identifiable account, if it is ever collected.

## What the student can see

Every fact above is in the student's own device stores. Those are included in
**Take it with you** (`lib/workspace-backup.ts`, which now registers the
actions, path-profile and clarity stores) and removed by **Erase from this
device** (`lib/erase.ts`, by prefix).
