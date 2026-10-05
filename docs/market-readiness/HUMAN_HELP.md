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
| Tables, capability and the only doors in | `supabase/migrations/20260927230000_help_requests.sql` |
| Every rule walked as the account it concerns (44 checks) | `supabase/help-requests.check.sql` |
| Needs, vocabulary, preview, status table | `app/src/lib/help-routes.ts` |
| The student's screen (University → Get help) | `app/src/components/GetHelp.tsx` |
| The staff inbox, under the same tab | `app/src/components/HelpInbox.tsx` |
| Which inboxes are the caller's | `supabase/migrations/20260927231000_help_inbox.sql` |

## The rules, and where each is enforced

| Rule | Database | App |
| --- | --- | --- |
| Only their name, confirmed email, and what they wrote and ticked is sent | `private.help_context_ok` closes the context to seven named keys | fields start unticked; `payload` is built from `preview` |
| Nobody is referred automatically | the only insert is `send_help_request`, acting as the caller | no code path sends without the confirm step |
| Wellbeing is never a stored request | no destination kind exists for it | a directory note with 988, nothing sent |
| Accessibility and money are reached directly | `accepts_requests` refused for those kinds | directory-only, no fields offered |
| Staff see only their own office's requests | no table grant; `help_inbox` returns ids and times, never words | — |
| Every staff open is visible to the student | `open_help_request` writes an event | "Opened N times by the office" |
| Withdrawing erases what it said — including after the office closed it | `withdraw_help_request` empties question, context, reply and identity from any status but withdrawn | "Withdraw and erase" |
| Account deletion empties it | `forget_my_help_requests`, listed in `OWNED_TABLES` | — |

Staff capability: `help_request:respond`, held by academic advisors,
registrars, tutors, learning-center staff, faculty, TAs, career coaches and
university staff — always scoped to one office, course or department.
Destinations are configured by `tenant:implement` during implementation.

## From the Action Center

`askForHelp(action, go)` maps an action to a need — a deadline or study step
to course help, a path or registration step to advising — pre-fills its title
and date, and opens Get help on it. It returns false for actions no person
answers (setup steps), so the caller keeps its note. Three rules, each tested:
fields arrive **filled but unticked**; the hand-over is **held in memory for
one navigation** and never stored; and a pre-filled field the need does not
normally offer is still **shown**, never carried invisibly.

## Retiring an office

Retiring a destination, or turning off `accepts_requests`, stops new requests
at once. It does not hide the ones already sent: the office stays in
`my_help_destinations` for the people who answer it until every request to it
is closed or withdrawn, so nothing a student is waiting on is stranded.

## Without an integration

If a school has not connected an office, the same preview becomes a note to
copy and take to office hours or an email. Nothing is stored. The route is
useful on the first day, before any university has configured anything.

## The staff inbox

Drawn only for an account that `my_help_destinations` says answers for an
office — the database decides, the screen holds no role check. Each inbox
lists statuses and times. A request's words appear only after **Open (the
student will see this)**, and only forward moves are offered: seen,
scheduled, closed. A reply goes back to the student beside their question,
and stays on the staff card as "Your office's reply" — reopening a request
shows it (`20260927234000`), and an answer sent with the box empty keeps it.

**Who is asking.** An opened request names the student — their Semester
display name and the university email the server confirmed — because an
office cannot book an appointment with a question alone. The student is told
first: the confirm screen lists both, with their real values, as *always
included*, above the lines they ticked (`IDENTITY_SENT`). Identity is
recorded when the student sends (`20260927233000_help_request_review_fixes.sql`),
so the office sees exactly what the confirm screen showed even if the student
renames themselves later; withdrawal erases it with the question. The inbox
list, before an open, still names nobody.

## Not built here, deliberately

- **The Action Center's button itself.** The bridge is here —
  `helpFromAction`, `askForHelp` and `takeHelpSeed` in `lib/help-routes.ts` —
  but the Action Center is still in open drafts (#768, #769, #772), so the
  two-line change to its "Ask for help" lands with whichever of them merges.
- **A time-based purge of closed requests.** `RETENTION.md` says so; a
  university sets the period before production.
