# Advisor Meeting Mode: Phase G

**Flag:** `advisor_meeting_mode` (`VITE_ADVISOR_MEETING_MODE`). Off by default
(D-012). With it off, the Degree screen has its four tabs as before, and a test
holds that.

**Destination:** My Path → `degree` › **Advisor meeting**. The student's
preparation, their sharing panel and, folded at the bottom, the advisor's view
all live in that one tab.

**Sharing model:** signed-in, expiring grants to an advisor at the student's
own school, with no link-based access. The owner decided this on
27 Sep 2026 (D-016); the details are in D-042.

> ⚠️ **One additive migration, not applied anywhere** (D-043). It reaches
> production only if this branch is merged to `main`, and that needs owner
> approval.

## What the student can do

| Command asks for | How |
|---|---|
| Create agenda | Agenda items, added and removed one at a time |
| Add questions | Questions, each with a place for the answer given, filled in after the meeting |
| Attach a plan scenario or course shortlist | At most one graduation scenario (Phase D), as its comparison lines, and any saved courses (Phase F). **Only what is ticked can be shared** |
| Share with an authorized advisor | Name as the advisor knows them, the advisor's school email, and an expiry of one week, one month, three months or four months (the maximum). **Preview and share…** shows exactly what the advisor will see before anything is sent, and says the student can revoke it from this screen |
| Set access expiration | Required on every share, 120 days at most (a term); enforced by the database |
| Revoke access | **Revoke…** (confirmed) stops it opening at once. It stays in the list with its log until deleted; the database refuses to un-revoke |
| Access and revocation log | Each share shows active, expired or revoked (with the date), and "Opened N times, last on …" from the server's read log |
| Export or print a summary after confirmation | **Download summary…** and **Print summary…** preview the text first, with focus on Cancel. Private notes are never in it, and it says so |
| Personal follow-up actions | Text, a done tick and an optional date. They reach a share only if the student ticks "Include my follow-up actions when I share" |
| Private notes | "Only on this device, never shared or exported" |

**Signed out,** preparing, exporting and printing all work, and the sharing
section says to sign in.

## What the advisor can see

Only what the student explicitly shared:

- the agenda and questions;
- the ticked scenario, courses and (if ticked) follow-up actions;
- the name the student chose to share as.

The advisor view is folded as "Caseload". It is the plans students shared, not every student at the school. It
asks the server nothing until it is opened. It lists titles and dates, and
opening one shows the snapshot with "The student can see that you opened it,
and can revoke it."

Never shared, by construction: the payload has no field for them, and a test
asserts the payload's keys.

- Study history, grades, health, finances, supporters, other notes.
- The student's private meeting notes.
- Anything the student did not tick.

## Server: `20260928301000_advisor_shares.sql`

| Object | What it does |
|---|---|
| `advisor_shares` | `student_id`, `advisor_id`, `tenant_id`, `title`, `payload` (a JSON object ≤ 32 KB), `created_at`, `expires_at` (required, ≤ 120 days), `revoked_at`. RLS: **the student** selects, deletes, and sets `revoked_at` (to a value, never back to null). **The advisor** has no table access. There is no direct insert |
| `advisor_share_events` | One row per read. The student sees the rows for their own shares; the advisor sees none. They go when the share is deleted |
| `share_with_advisor(email, title, payload, expires)` | Finds the address only among live `academic_advisor` grants scoped to the student's own school, and inserts. Every miss gives the same message |
| `list_advisor_shares()` | For the advisor: live shares' titles and dates. Logs nothing |
| `read_advisor_share(id)` | For the advisor: checks the share is theirs, unrevoked and unexpired. Logs the read and returns the snapshot |
| audit triggers (`20260930190000_advisor_share_audit.sql`) | Creating, reading, revoking and deleting a share each write one pseudonymous `audit_event` for the share's school: the verb, a hash of the share id, and (for a new share) the number of days. Never the title, the payload or an address. A school's auditor reads its own school's; a refused attempt writes nothing (its own write rolls back). Proved by `share-audit.check.sql` |
| `lti_account_untouched` | Redefined with `advisor_shares` at both ends, so account linking never retires an account holding shares. Restated in `20260928304000_untouched_advisor_after_help.sql`, because `20260927230000_help_requests.sql` (merged into the base later) redefines it without them, and the later version wins |

**Deletion:**

- `OWNED_TABLES` lists `advisor_shares` (`student_id`), so **Delete my
  account** removes a student's shares, and their logs go with them.
- An advisor's received shares go through the foreign key.
- `RETENTION.md` has the entry.

## Files

| New | Purpose |
|---|---|
| `supabase/migrations/20260928301000_advisor_shares.sql` | Above |
| `supabase/migrations/20260928304000_untouched_advisor_after_help.sql` | The advisor rows restated after `help_requests` |
| `supabase/grants.check.sql` | The three functions added to the allowlist; the suite failed without them |
| `supabase/advisor.check.sql` | 45 checks: who may share with whom, who may read, expiry, revocation, the log, deletion, linking |
| `lib/advisor-meeting.ts` | The device model (`semester.advisor-meeting.v1`), `sharePayload`, `payloadLines`, `meetingSummary` |
| `lib/advisor-shares.ts` | Expiry choices, `shareState`, `checkPayload`, and the RPC and table calls |
| `lib/advisor-attachments.ts` | `useSavedCourses`: the Phase F shortlist resolved against the catalog |
| `components/AdvisorMeeting.tsx` | Preparation, export/print, share, sharing panel |
| `components/AdvisorSharedView.tsx` | The advisor view |

| Changed | Change |
|---|---|
| `screens/Degree.tsx` | `advisorMeeting` prop (default: the flag); the tab |
| `lib/cloud.ts` | `advisor_shares` in `OWNED_TABLES` |
| `RETENTION.md`, `docs/SECURITY-GAP-ANALYSIS.md` (S-8) | Entries |
| `vite.config.ts` | The two `vi.mock` test files in `MOCKS_MODULES` |
| `styles/app.css` | `.advisor-*` |

## Tests

| File | Covers |
|---|---|
| `lib/advisor-meeting.test.ts` | **Payload:** only agenda and questions by default; the scenario and follow-ups only when ticked; exactly nine keys, none for notes. **Summary:** answers and follow-ups in, notes out, and it says so. **Reader:** round trip and refusals |
| `lib/advisor-shares.test.ts` | **Expiry:** active, expired and revoked; always set, never past 120 days. **Payload:** only through the RPC, with the previewed payload; bad address, empty and oversized meetings refused before sending; one message for every failed lookup. **Log and actions:** the read log, newest first; revoke sets `revoked_at` on that id only; a gone share reads plainly to the advisor |
| `components/AdvisorMeeting.test.tsx` | The Degree tab only with the flag on. The meeting kept on the device. **Export:** only after a preview without notes, with focus on Cancel. **Signed out:** no share. **Share:** the preview is exactly what is sent (unticked courses, follow-ups and notes absent), and it is sent only after confirming; follow-ups go only when ticked. **Sharing panel:** states and read counts; revoke only after confirming. **Advisor view:** asks nothing until opened, then shows only the snapshot and that the student sees it |
| `supabase/advisor.check.sql` | See above |
| `lib/privacy.test.ts`, `lib/ltiaccount.test.ts`, `lib/retention.test.ts` (existing) | Now see the tables |

**Revert checks.** Each guard was shown red against a revert and green on
restore.

App:

- Sharing without confirming.
- Notes in the payload.
- Follow-ups always sent.
- Export without confirming.
- The tab ignoring the flag.
- A revoked share read as active.
- Unbounded expiry.
- The server's lookup message shown raw.
- The advisor list loaded on mount.

Database:

- Any account treated as an advisor.
- An advisor at any school.
- A read after revocation.
- Un-revoking.
- An unlogged read.
- `lti_account_untouched` ignoring shares (also red in `ltiaccount.test.ts`).

## Responsive manual-test checklist

Checked in Chromium with the flag on, a meeting with two agenda items, a
question, a follow-up, private notes and one saved course, signed out:

- [x] 390 and 1280px: the tab, the fields, what to bring, the follow-ups,
  notes and actions fit.
- [x] Download summary… previews the text without the notes; focus is on
  Cancel.
- [x] The signed-out sharing message.
- [x] No horizontal overflow (measured), no `pageerror`.
- [ ] Signed-in share, sharing panel and advisor view against a live project.
  Not run here, because no project is configured. The server side is covered
  by `advisor.check.sql` on Postgres 16, and the client by the mocked tests.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `meeting_created` | A meeting prepared |
| `meeting_exported` / `_printed` | After confirmation; never the text |
| `advisor_share_created` | After confirmation (`days`); never the address or payload |
| `advisor_share_revoked` / `_deleted` | After confirmation |
| `advisor_share_opened` | Server-side; already the student-visible log |

## Rollback

- **The feature.** Leave the flag unset (the default), and the tab is gone.
  Meetings stay on the device, unread.
- **Shares already made.** The tab is the only place to revoke them, so revoke
  or delete them before turning the flag off. They also lapse by themselves
  within 120 days.
- **The migration.** To undo it, drop the three functions and two tables, then
  re-run `20260928300000_untouched_graduation_drafts.sql` (see the migration's
  header).
