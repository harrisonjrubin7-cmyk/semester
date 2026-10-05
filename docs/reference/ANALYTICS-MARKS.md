# Analytics marks

> **Type:** reference · **Audience:** operators, security-reviewers · **Owner:** `data` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/platform-reference.test.ts`

This page lists what the product sends to a Semester server about use today (three marks in one table), the structured log lines the university gateway emits, and the event definitions that are not sent; stop reading if you want how the three figures are queried and what they cannot say ([`ANALYTICS.md`](../../ANALYTICS.md)).

**Status:** LIVE for the three marks, in code: a signed-in build with the account service configured sends them. This page cannot see the production database, so whether the migration is applied there is not verified; block 0 of [`supabase/analytics.sql`](../../supabase/analytics.sql) is how an operator checks. Everything in "Defined only" is PLANNED and is not sent.

There is no third-party analytics in the app, and signed out nothing is sent. The privacy wording is [`app/src/lib/privacy.ts`](../../app/src/lib/privacy.ts); [`app/src/lib/activity.test.ts`](../../app/src/lib/activity.test.ts) fails if that page stops naming the record.

## Sent to a server today

### The three marks

One row per account, per UTC day, per mark, in `public.activity`. The table holds no screen name, title, course, count, time of day, device or address.

| Mark | Means | How the app derives it |
| --- | --- | --- |
| `opened` | The app was open with this account signed in, that day. | Always present in the set. |
| `course` | The account had at least one course of its own by then. | `state.courses.length > 0`. The sample semester is not a course in that list. |
| `studied` | The account had answered at least one card by then. | At least one key in `state.reviews`. |

The app derives the set from its own state and sends it; it does not fire an event at each moment. The set is `marksFor` in [`app/src/lib/activity.ts`](../../app/src/lib/activity.ts), called from one place, [`app/src/state/store.tsx`](../../app/src/state/store.tsx).

### The table

| Part | Definition |
| --- | --- |
| Table | `public.activity (user_id uuid, day date, mark text)`, primary key `(user_id, day, mark)`, `user_id` references `auth.users` and cascades on delete. |
| Day | UTC, defaulted by the database clock. A caller cannot supply it. |
| Check constraint | `mark in ('opened', 'course', 'studied')`. A fourth mark needs a migration widening this, a line in `ANALYTICS.md`, an edit to `MARKS` in `activity.ts` and to `supabase/activity.check.sql`, and owner review ([`docs/ANALYTICS-EVENTS.md`](../ANALYTICS-EVENTS.md)). |
| Index | `activity_day_idx` on `day`, for the report's reads. |
| Row-level security | Select and delete policies for the account the rows are about. No insert policy and no update policy. |
| Grants | `select, delete` to `authenticated`; `select` to `service_role`; everything revoked from `anon`. |
| Write path | `public.note_activity(marks text[])`, `security definer`, `search_path` empty, executable by `authenticated` only. It reads the account from `auth.uid()` and the day from the database, returns without writing when signed out, drops any mark outside the three rather than raising, and deletes that account's rows older than 400 days on each write. |
| Retention | 400 days, pruned on write; the schedule is in [`RETENTION.md`](../../RETENTION.md). |
| Migration | [`supabase/migrations/20260921151000_activity.sql`](../../supabase/migrations/20260921151000_activity.sql). |
| Structural checks | [`supabase/activity.check.sql`](../../supabase/activity.check.sql). |

### How the client sends

| Behavior | Detail |
| --- | --- |
| Condition | Only when `cloudConfigured` is true (the account service is configured in the build) and the set is non-empty. The call is `rpc('note_activity', { marks })`. |
| De-duplication | After a successful call it stores `YYYY-MM-DD\|<sorted marks>` in `localStorage` under `semester.activity`. The same line on the same UTC day sends nothing. The guard is written after the call, so a failed call is retried. |
| Failure | A call that errors throws inside `noteToday`; the one caller discards it. Storage that cannot be read only costs a repeated upsert, which the primary key absorbs. |
| Accuracy | A mark is dated to the first day the app was open with it true, so a mark can be a day late. No figure is accurate to the day for one account. |

### Gateway log lines

The university gateway writes JSON log lines to its process output. They are server logs, not a product-analytics feed: nothing in this repository parses them. They exist only in a deployed gateway; the gateway is MOCK_DEMO without a tenant ([`docs/FEATURE-TRUTH-TABLE.md`](../FEATURE-TRUTH-TABLE.md)).

| Event | Emitted by | Sink | Fields |
| --- | --- | --- | --- |
| `institution.request` | `createGateway` in [`gateway.ts`](../../app/server/institution/gateway.ts), once per request | `console.info` of the JSON, set by the production runtime ([`runtime.ts`](../../app/server/institution/runtime.ts)). `start.ts` passes no telemetry sink, so the standalone process emits none. | `event`, `requestId`, `correlationId`, `method`, `route`, `status`, `durationMs`, `errorClass` |
| `institution.authorization` | `createMembershipResolver` audit callback | `console.info` in `start.ts`, in `runtime.ts`, and in the productivity runtime ([`runtime.ts`](../../app/server/productivity/runtime.ts)), which resolves membership the same way | `event`, `userId`, `providerIdentifier`, `tenantId` (when known), `outcome` (accepted or denied), `reason`, `occurredAt` |
| `productivity.request` | `createProductivityApi` in [`http.ts`](../../app/server/productivity/http.ts), once per request | `console.info` of the JSON, set by the productivity runtime. Only a deployment that sets `SEMESTER_PRODUCTIVITY` to on emits it. | `event`, `route` (the template, never the path), `method`, `status`, `durationMs`, `requestId`, `correlationId`, `actorType` (when known) |
| `productivity.error` | the productivity runtime, when a command or a request threw something unexpected | `console.error` | `event`, `source` (the service or the HTTP layer), `name` (the error's class, never its message), `correlationId`, `requestId` and `route` (http only) |
| `institution.scim.audit_unrecorded` | the SCIM repository, only when writing a refusal to the audit table failed | `console.error` | `event`, `tenantId`, `credentialId`, `status` |

Notes on `institution.request`:

- `route` is one of the matched routes below, or `/unmatched`. A path outside the set is logged as `/unmatched`, never as the raw path. The confirm route is logged as `/v1/intelligence/actions/:id/confirm`, without the id.
- `errorClass` is `server` for status 500 and above, `client` for 400 and above, otherwise `none`.
- `requestId` is minted by the gateway; `correlationId` is the client's when well formed, minted otherwise. The audit rows carry the same correlation id.
- The matched routes are `/health`, `/health/live`, `/health/ready`, `/v1/auth/config`, `/v1/intelligence/policy`, `/v1/intelligence/respond`, `/status`, `/records`, `/actions/prepare`, `/actions/commit` and `/actions/reconcile`.

`institution.authorization` names an account and an identity-provider identifier. It is a log line on the gateway's own host, and it is the one line on this page that does.

### Not telemetry

- **Edge functions** write free-text `console` lines (for example `lti launch ok: …`). They are not structured events and are not listed here. They are described per function in [`EDGE-FUNCTIONS.md`](EDGE-FUNCTIONS.md).
- **The integration worker** (`app/server/integration`) emits no telemetry event and writes nothing to the console. It records its runs, errors, dead letters and webhook receipts as database rows in the school's tenant (`integration_sync_runs`, `integration_sync_errors`, `integration_dead_letter_events`, `integration_webhook_events`). Those are operational records for the school's integration staff, not analytics. The test scans the directory and fails if it starts writing to the console or logging an `event:` object.
- **The access log** (`public.access_log`) records, per account per day, that a calendar feed or a push batch was served, by one of seven client families. It exists so a student can tell a leaked calendar link from a private one. It is written by the `calendar` and `push` functions, not by the app. See [`EDGE-FUNCTIONS.md`](EDGE-FUNCTIONS.md).
- **Domain events** ([`EVENTS.md`](EVENTS.md)) are a separate contract. No producer writes them yet.

## Defined only

[`docs/ANALYTICS-EVENTS.md`](../ANALYTICS-EVENTS.md) is "definitions only, per D-005". Nothing named below is sent to a server. A definition moves into the table above only in its own pull request, which must write the question into `ANALYTICS.md`, widen the check constraint in a migration, extend `MARKS` with its tests and `activity.check.sql`, and get owner review.

| Definition | Status in that page |
| --- | --- |
| `activation` | Exists: the legacy course-plus-study funnel, from the `opened`, `course` and `studied` marks. It is not the controlled setup-only `student_activated` definition. |
| `path_created` | Defined; would be a mark `path`. |
| `plan_saved` | Defined; would be a mark `plan`. |
| `backup_saved` | Defined; would be a mark `backup`. |
| `conflict_resolved` | Defined; needs design first, since nothing on the device records it. |
| `action_completed` | Defined; would be a mark `acted`. |
| `agenda_created` | Defined; waits on Advisor Meeting Mode, which is not built. |
| `clarity_submitted` | Defined; not a mark. An answer is content, so it would need its own aggregate-only table with a floor of ten. |

Never collected, by that page's own list: titles, course codes, notes, goals, anything typed, the Action Center's ranking inputs, anything per screen or per session, and time of day.
