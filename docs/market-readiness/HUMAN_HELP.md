# Getting Help From a Person

**Status: `TESTING`** — built, policy-tested and behind `VITE_HUMAN_HELP`
(off in production; on in the institutional preview). No university has
configured an office yet.

A student who is stuck should be able to go from the app to the right human —
advisor, registrar, transfer center, tutor, writing center, librarian,
instructor, career coach — without the app deciding for them and without
anything leaving that they did not read first.

## Where it lives

| Part | File |
| --- | --- |
| Tables, capability and the only doors in | `supabase/migrations/20260927180000_help_requests.sql` |
| Every rule walked as the account it concerns (44 checks) | `supabase/help-requests.check.sql` |
| Needs, vocabulary, preview, status table | `app/src/lib/help-routes.ts` |
| The screen (University → Get help) | `app/src/components/GetHelp.tsx` |

## The rules, and where each is enforced

| Rule | Database | App |
| --- | --- | --- |
| Only what the student wrote and ticked is sent | `private.help_context_ok` closes the context to seven named keys | fields start unticked; `payload` is built from `preview` |
| Nobody is referred automatically | the only insert is `send_help_request`, acting as the caller | no code path sends without the confirm step |
| Wellbeing is never a stored request | no destination kind exists for it | a directory note with 988, nothing sent |
| Accessibility and money are reached directly | `accepts_requests` refused for those kinds | directory-only, no fields offered |
| Staff see only their own office's requests | no table grant; `help_inbox` returns ids and times, never words | — |
| Every staff open is visible to the student | `open_help_request` writes an event | "Opened N times by the office" |
| Withdrawing erases what it said | `withdraw_help_request` empties question, context and reply | "Withdraw and erase" |
| Account deletion empties it | `forget_my_help_requests`, listed in `OWNED_TABLES` | — |

Staff capability: `help_request:respond`, held by academic advisors,
registrars, tutors, learning-center staff, faculty, TAs, career coaches and
university staff — always scoped to one office, course or department.
Destinations are configured by `tenant:implement` during implementation.

## Without an integration

If a school has not connected an office, the same preview becomes a note to
copy and take to office hours or an email. Nothing is stored. The route is
useful on the first day, before any university has configured anything.

## Not built here, deliberately

- **A staff inbox screen.** The functions exist and are tested; the staff
  surface belongs with the role workspaces, not in this change.
- **Linking to the Action Center.** `feature/action-model` (open) records a
  `help` event on an action. Once it lands, that event should open this route
  with the action's course and deadline pre-filled — still unticked.
- **A time-based purge of closed requests.** `RETENTION.md` says so; a
  university sets the period before production.
