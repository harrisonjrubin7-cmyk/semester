# Session handoff

**Date** 2026-10-06. **Branch** `cursor/unmatched-named-catalog-3071`. **Rebased onto** `origin/main` at `81dcdabf`, the merge of pull request #1336.

## Objective that was completed

After a catalog file is imported, a course the student named stays on the Term plan until that file contains a section with the same code. The list names the institution and the import day. It does not add a section or a seat. A code the file does contain leaves the list; the sections on screen are the file’s.

The meeting surface is `AdvisorMeeting` on My Path. It is shown only when `advisor_meeting_mode` is on. Screen `meet` is glossary word-overlap and is not this handoff.

## Working tree at the start

Clean at `3623c117`. `origin/main` had moved to `7b9ae1c2` and already had `overallReadiness` and `uncheckedSections` in `path-readiness.ts`. It did not have a named-course row or `meetingWithNamedAgenda`.

## What the next session should read first

1. This file.
2. `EXECUTION_BACKLOG.md` next item: security closure OP-01, only with an explicit non-production database the operator names.
3. `app/src/lib/planpreview.ts` `unmatchedNamed` and `RegistrationPortal` `NamedPlan`.

## Rebase note

This branch now includes main’s `uncheckedSections`, `readinessFacts`, and `overallReadiness`. The headline ignores id `named` while that row is `not_started`, and counts it when it is `attention` or `ready`. A catalog with no named course can still read Ready. A named course that is not yet an agenda line keeps the headline short of Ready. Main’s “no meeting times” unavailable state is unchanged.

## Do not redo

- Do not navigate this handoff to screen `meet`.
- Do not copy grades, notes, requirements, or the rest of the record onto the agenda.
- Do not call `shareWithAdvisor` from the checklist button.
- Do not create an advisee grant.
- Do not apply migrations or call Stripe.

## Checks recorded

See `TEST_AND_RELEASE_GATES.md`. After the rebase onto the #1336 merge: `npx tsc -b` exit 0, and the unmatched set (`planpreview`, `RegistrationPortal.namedplan`, `RegistrationPortal.conflicts`) exit 0 (3 files, 15 tests). The 390px Term plan walk on `#/yes` had an empty `pageerror` list.

## Unverified

Hosted Supabase project, applied migrations, production audit rows, SSO for a named tenant, and any customer. The operations roadmap’s “no production audit row” sentence was not re-queried.
