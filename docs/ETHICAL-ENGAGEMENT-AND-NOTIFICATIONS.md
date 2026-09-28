# Ethical engagement and notifications

Part 16 of the expansion command. Phase 6. Much of it exists, including the
refusals.

## What exists on main

- **The refusals are already written.** `app/src/lib/you.ts`: "There is no
  streak, no percentage of you, and no comparison with anybody." The same stance
  in `app/src/lib/weekly.ts`, `app/src/lib/revise.ts` and
  `app/src/lib/waiting.ts`. No leaderboard, XP or points exist.
- The only `streak` in the code is a spaced-repetition field defined in
  `app/src/lib/review.ts` — consecutive correct recalls on one card — and read
  by the scheduler modules around it (`app/src/lib/fsrs.ts`,
  `app/src/lib/intime.ts`, `app/src/lib/rework.ts`, `app/src/lib/knowing.ts`,
  `app/src/lib/learning-loop.ts`). It is an algorithm input, never displayed as
  a streak. Every other mention in `app/src` is a comment (most of them
  refusing one) or a model prompt explaining why card wording must not change.
- Weekly rhythm: `app/src/lib/weekly.ts`, `app/src/lib/weekpage.ts`,
  `app/src/lib/brief.ts` (morning and evening), the Week, Day and Term reports.
- Reflection: `app/src/components/StudyJournal.tsx`, `app/src/lib/postmortem.ts`.
- Notifications: `app/src/lib/notify.ts` (quiet hours, mutes), `app/src/lib/push.ts`,
  `public.contact_channels` (SMS and email, opt-in, quiet hours).
- Calendar: ICS export and a subscribable feed (`app/src/lib/subscribe.ts`).

## In flight

- [#794](https://github.com/harrisonjrubin7-cmyk/semester/pull/794) Crunch Week
  Forecast is the "lighter week — prepare ahead" signal's counterpart; both read
  the same week model.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `planning_rituals`, `weekly_previews`, `weekly_reflections` | **Reuse** `weekly_checkins` + `weekly.ts` | |
| `change_digests` | **Computed** from source changes (`reconcile.ts`, #779 freshness events) | A digest is a view of what changed |
| `engagement_preferences`, `widget_preferences`, `calendar_sync_preferences` | **One preferences object** (shared with [My Data](STUDENT-DATA-CONTROL-CENTER.md)) | |
| `quiet_hours` | **Reuse** `notify.ts` `Quiet` and `contact_channels.quiet_hours` | The one quiet-hours setting |
| `notification_channels` | **Reuse** `contact_channels` + `push_devices` | |
| `notification_consents` | **Reuse** `contact_channels.opted_in` / `verified_at`; a consent row per channel in `consent_record` for SMS | TCPA needs the record |
| `notification_rate_limits` | **Code** in `notify.ts`, beside quiet hours | |

## Capabilities and flags

- None for students. Email and SMS sending are `off` and need a sender, a cost
  decision and a consent record — see the audit's open questions.

## Hard boundaries

Never built, and a structural test holds the line:

- endless feed; public leaderboards; streak pressure; shame notifications;
  fear-based urgency; dark patterns around consent; engagement-maximizing
  notification ranking.

Also: every email or SMS has one-tap unsubscribe; nothing is sent inside quiet
hours; consent is never pre-ticked.

## Tests

- `app/src/community/engagement.test.ts`, a structural test over rendered
  strings: no `leaderboard`, `rank among`, `streak` in rendered text (the
  scheduler's card field is a property access, not text), `you're falling
  behind`, `don't break`, or percentage-of-you. A refusal ("no streak") is told
  from an offer by a negation rule the test checks on itself. It was shown to
  fail against a planted `Your streak: 4 days`. The list of forbidden mechanics
  it reads is `FORBIDDEN_MECHANICS` in `app/src/community/governance.ts`.
- `notify.ts`: nothing fires inside quiet hours; the rate limit holds across a
  day with forty due items.
- The consent control starts unchecked (accessibility tree snapshot).
