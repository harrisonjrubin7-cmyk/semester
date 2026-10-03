# Student onboarding specification

## Target outcome

Within 10 minutes, a student can understand the product’s limits, choose manual/local-first setup, add or import one course/calendar source, see a useful week, confirm a realistic plan and intentionally complete, schedule, snooze or defer one next action.

## Flow and states

1. **Welcome:** value, official-record disclaimer, accessibility/help, individual vs sponsored context.
2. **Account choice:** continue locally where supported or sign in; explain sync and recovery tradeoffs.
3. **School/context:** search/select or continue without; never imply a partnership.
4. **Permissions:** just-in-time purpose, data received, write/read scope, duration and revoke path.
5. **Setup:** manual course/date/task entry first; optional approved imports.
6. **Plan:** visible schedule/workload; correct a mistake; empty/example state.
7. **Act:** one recommended, reversible next action.
8. **Control:** reminders, privacy, export/delete, help and known limits.

Each step needs loading, empty, validation, service error, offline/degraded, back/skip, save/resume, recovery and success states; keyboard/focus/screen-reader behavior; privacy-safe analytics; and a direct support path.

## Activation and first-win events

`student_activated` fires once per approved account/device rule when the student completes the approved minimum setup, currently adding or importing at least one course or calendar source. Invitation delivery, account creation, login and sample-data exploration do not count. This proposed event is not the existing `ANALYTICS.md` / `supabase/analytics.sql` “activation” report, which currently requires both a course and a `studied` mark. That legacy report must remain labeled as its own course-plus-study funnel and must not be published as this setup-only activation rate. The new event and query remain unavailable until implemented, versioned and sample-validated.

`student_first_win` fires separately after activation when the student reaches Today, understands one relevant prioritized reversible action, can identify its source and limitations, knows where to get relevant human/non-AI help, and intentionally completes, schedules, snoozes or defers it. A full first-week plan is not an extra gate. Store only event/version, event time, approved tenant/cohort, setup method, coarse comprehension/help checks and coarse decision outcome—never task titles or course content. Validate both events against representative samples before accepting either metric, and report activation-to-first-win loss.

## Acceptance

At least 80% of representative UAT participants finish unaided; median time ≤10 minutes; no critical accessibility/privacy/security issue; abandonment reason captured without coercion; support can diagnose by event/correlation metadata without opening student content.
